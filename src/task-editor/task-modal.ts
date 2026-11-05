import { App, Modal, Setting, addIcon, setIcon } from "obsidian";
import Sortable from "sortablejs";
import type { Project, Task, TaskDraft } from "../tasks/domain";
import { todayKey } from "../tasks/domain";
import { taskDateSuggestions } from "../tasks/date-suggestions";
import type { I18n, TranslationKey } from "../i18n";
import { shouldCommitLabelOnEnter, updateLabelChipInput } from "../labels/label-chip-input";
import { summarizeLabels } from "../labels/label-summary";
import { LabelPickerModal } from "../labels/label-picker-modal";
import type { LabelEditingOptions } from "../labels/label-picker-modal";
import { MobileKeyboardScroller } from "../shared/mobile-keyboard-layout";
import { normalizeTaskTitleInput } from "../tasks/task-title";
import { moveTaskStep, stepDateState } from "../tasks/task-steps";
import { normalizeTaskSteps } from "../tasks/task-body";
import { StepModal } from "./step-modal";
import { MAXIMUM_REPEAT_INTERVAL, anchorRepeat } from "../tasks/schedule";
import type { RepeatUnit } from "../tasks/schedule";
import { repeatLabel } from "./schedule-labels";

const DATE_SUGGESTION_KEYS = {
  today: "date.today",
  tomorrow: "date.tomorrow",
  "seven-days": "date.sevenDays",
  none: "date.none"
} satisfies Record<ReturnType<typeof taskDateSuggestions>[number]["id"], TranslationKey>;

function normalizeSchedule(draft: TaskDraft): TaskDraft {
  return {
    ...draft,
    time: draft.date ? draft.time : null,
    repeat: draft.date ? anchorRepeat(draft.repeat, draft.date) : null
  };
}

function decorateField(setting: Setting, icon: string, accessibleName: string): void {
  setting.settingEl.addClass("taskmate-compact-setting");
  const marker = document.createElement("span");
  marker.addClass("taskmate-field-icon");
  marker.setAttribute("aria-hidden", "true");
  setIcon(marker, icon);
  setting.settingEl.prepend(marker);
  setting.controlEl.setAttribute("aria-label", accessibleName);
}

function addEmbeddedLabel(setting: Setting, label: string): void {
  setting.controlEl.addClass("taskmate-embedded-select");
  const labelEl = setting.controlEl.createSpan({
    text: label,
    cls: "taskmate-embedded-field-label",
    attr: { "aria-hidden": "true" }
  });
  setting.controlEl.prepend(labelEl);
}

// A calendar with a target, so Deadline reads differently from the scheduled-date calendar.
const DEADLINE_ICON = "taskmate-calendar-target";
addIcon(DEADLINE_ICON, `<g transform="scale(4.1667)" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 9V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h4"/><path d="M15 2v4"/><path d="M8 2v4"/><path d="M3 10h6"/><circle cx="17" cy="17" r="6"/><circle cx="17" cy="17" r="2.5"/><circle cx="17" cy="17" r="0.5" fill="currentColor"/></g>`);

/**
 * Lays out a date input as a bordered field with a persistent label above a calendar marker, so
 * Scheduled and Deadline stay distinguishable. The native picker indicator is hidden, so the whole
 * field opens the picker instead.
 */
// The repeat list offers month-end as its own choice; it is stored as a monthly rule on the last day.
const MONTH_END_CHOICE = "month-end";
const FIVE_MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
// A symbol rather than copy, so it needs no translation.
const NO_TIME = "--:--";

/** Five-minute steps, plus a stored minute outside them so editing never changes it silently. */
export function timeMinuteOptions(storedMinute: string | null): string[] {
  if (!storedMinute || FIVE_MINUTES.includes(storedMinute)) return FIVE_MINUTES;
  return [...FIVE_MINUTES, storedMinute].sort();
}

function embedDateLabel(input: HTMLInputElement, label: string): HTMLElement {
  const wrapper = createDiv({ cls: "taskmate-embedded-date" });
  input.replaceWith(wrapper);
  wrapper.createSpan({ text: label, cls: "taskmate-embedded-field-label", attr: { "aria-hidden": "true" } });
  const marker = wrapper.createSpan({ cls: "taskmate-embedded-date-icon", attr: { "aria-hidden": "true" } });
  setIcon(marker, "calendar");
  wrapper.appendChild(input);
  wrapper.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("button")) return;
    input.focus();
    try {
      input.showPicker();
    } catch {
      // Some hosts open the picker only from a direct tap on the input, which still works.
    }
  });
  return wrapper;
}

export class TaskModal extends Modal {
  private draft: TaskDraft;
  private keyboardScroller: MobileKeyboardScroller | null = null;
  private stepSortable: Sortable | null = null;
  private readonly baselineAvailableHeight: number;

  constructor(
    app: App,
    task: Task | null,
    private readonly projects: Project[],
    private readonly labelOptions: LabelEditingOptions,
    defaultProjectId: string | null,
    private readonly availableRegion: HTMLElement,
    private readonly i18n: I18n,
    private readonly onSave: (draft: TaskDraft) => Promise<boolean>,
    private readonly onDelete: (() => Promise<boolean>) | null = null
  ) {
    super(app);
    this.baselineAvailableHeight = availableRegion.getBoundingClientRect().height;
    this.draft = {
      title: task?.title ?? "",
      date: task?.date ?? null,
      deadline: task?.deadline ?? null,
      time: task?.time ?? null,
      repeat: task?.repeat ?? null,
      priority: task?.priority ?? null,
      labels: task?.labels ?? [],
      projectId: task?.projectId ?? defaultProjectId,
      steps: task?.steps.map((step) => ({ ...step })) ?? [],
      notes: task?.notes ?? "",
      sourceNote: task?.sourceNote ?? null
    };
    this.setTitle(task ? i18n.t("taskModal.editTitle") : i18n.t("taskModal.addTitle"));
  }

  onOpen(): void {
    const { contentEl } = this;
    const { t } = this.i18n;
    this.modalEl.addClass("taskmate-task-modal");
    const fields = contentEl.createDiv({ cls: "taskmate-task-fields" });

    const titleSetting = new Setting(fields).setName(t("taskModal.title"));
    titleSetting.settingEl.addClass("taskmate-title-setting");
    decorateField(titleSetting, "circle-check", t("taskModal.title"));
    titleSetting.addTextArea((text) => {
      const titleInput = text.inputEl;
      titleInput.rows = 1;
      titleInput.wrap = "soft";
      titleInput.setAttribute("aria-label", t("taskModal.title"));
      const resizeTitleInput = () => {
        titleInput.setCssStyles({ height: "auto" });
        titleInput.setCssStyles({ height: `${titleInput.scrollHeight}px` });
      };
      text.setPlaceholder(t("taskModal.titlePlaceholder")).setValue(this.draft.title).onChange((value) => {
        const normalized = normalizeTaskTitleInput(value);
        if (normalized !== value) titleInput.value = normalized;
        this.draft.title = normalized;
        resizeTitleInput();
      });
      titleInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") event.preventDefault();
      });
      window.requestAnimationFrame(resizeTitleInput);
      if (!window.matchMedia("(max-width: 700px)").matches) {
        window.setTimeout(() => titleInput.focus(), 0);
      }
    });

    const dateSetting = new Setting(fields).setName(t("taskModal.date"));
    dateSetting.settingEl.addClass("taskmate-date-setting");
    decorateField(dateSetting, "calendar-days", t("taskModal.date"));
    const datePresets = dateSetting.controlEl.createDiv({ cls: "taskmate-date-presets" });
    const dateButtons: HTMLButtonElement[] = [];
    let dateInput: HTMLInputElement;
    let dateTimeRow!: HTMLElement;
    let onDateChange = (): void => undefined;
    const refreshDateSelection = () => {
      onDateChange();
      for (const button of dateButtons) {
        const selected = button.dataset.date === (this.draft.date ?? "");
        button.toggleClass("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    };
    for (const suggestion of taskDateSuggestions()) {
      const button = datePresets.createEl("button", {
        cls: "taskmate-suggestion-chip",
        attr: { type: "button", "aria-pressed": "false" }
      });
      button.dataset.date = suggestion.date ?? "";
      button.createSpan({ text: t(DATE_SUGGESTION_KEYS[suggestion.id]) });
      button.addEventListener("click", () => {
        this.draft.date = suggestion.date;
        dateInput.value = suggestion.date ?? "";
        refreshDateSelection();
      });
      dateButtons.push(button);
    }
    dateSetting.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.addClass("taskmate-date-input");
      text.inputEl.setAttribute("aria-label", t("taskModal.date"));
      dateInput = text.inputEl;
      // Scheduled and Time share one row, since a time belongs to the scheduled date.
      const dateField = embedDateLabel(text.inputEl, t("taskModal.date"));
      dateTimeRow = dateSetting.controlEl.createDiv({ cls: "taskmate-date-time-row" });
      dateTimeRow.appendChild(dateField);
      text.setValue(this.draft.date ?? "").onChange((value) => {
        this.draft.date = value || null;
        refreshDateSelection();
      });
    });
    refreshDateSelection();

    // A tap panel replaces the native time input, whose minute list ignores `step` in Obsidian. Hours and
    // five-minute steps sit in grids so a time takes two taps without scrolling.
    const timeField = dateTimeRow.createDiv({ cls: "taskmate-embedded-date taskmate-time-field" });
    timeField.createSpan({ text: t("taskModal.time"), cls: "taskmate-embedded-field-label", attr: { "aria-hidden": "true" } });
    setIcon(timeField.createSpan({ cls: "taskmate-embedded-date-icon", attr: { "aria-hidden": "true" } }), "clock");
    const timeToggle = timeField.createEl("button", {
      cls: "taskmate-time-toggle",
      attr: { type: "button", "aria-label": t("taskModal.time"), "aria-expanded": "false" }
    });
    const timeValue = timeToggle.createSpan({ cls: "taskmate-time-value" });
    setIcon(timeToggle.createSpan({ cls: "taskmate-time-chevron", attr: { "aria-hidden": "true" } }), "chevron-down");
    const removeTime = timeField.createEl("button", {
      cls: "taskmate-date-clear clickable-icon",
      attr: { type: "button", "aria-label": t("taskModal.removeTime") }
    });
    setIcon(removeTime, "x");
    const timePanel = dateSetting.controlEl.createDiv({ cls: "taskmate-time-panel" });
    timePanel.hidden = true;
    timePanel.createDiv({ text: t("taskModal.hour"), cls: "taskmate-time-panel-label" });
    const hourGrid = timePanel.createDiv({ cls: "taskmate-time-grid", attr: { role: "group", "aria-label": t("taskModal.hour") } });
    timePanel.createDiv({ text: t("taskModal.minute"), cls: "taskmate-time-panel-label" });
    const minuteGrid = timePanel.createDiv({ cls: "taskmate-time-grid", attr: { role: "group", "aria-label": t("taskModal.minute") } });
    const hourButtons = HOURS.map((hour) => hourGrid.createEl("button", { text: hour, attr: { type: "button" } }));
    const minuteButtons = timeMinuteOptions(this.draft.time?.slice(3) ?? null)
      .map((minute) => minuteGrid.createEl("button", { text: minute, attr: { type: "button" } }));
    const setTimePanelOpen = (open: boolean): void => {
      timePanel.hidden = !open;
      timeToggle.setAttribute("aria-expanded", String(open));
      timeField.toggleClass("is-open", open);
    };
    const renderTime = (): void => {
      const hour = this.draft.time?.slice(0, 2) ?? null;
      const minute = this.draft.time?.slice(3) ?? null;
      timeValue.setText(this.draft.time ?? NO_TIME);
      for (const button of hourButtons) {
        button.toggleClass("is-active", button.textContent === hour);
        button.setAttribute("aria-pressed", String(button.textContent === hour));
      }
      for (const button of minuteButtons) {
        button.toggleClass("is-active", button.textContent === minute);
        button.setAttribute("aria-pressed", String(button.textContent === minute));
        button.disabled = hour === null;
      }
    };
    for (const button of hourButtons) button.addEventListener("click", () => {
      this.draft.time = `${button.textContent}:${this.draft.time?.slice(3) ?? "00"}`;
      refreshScheduleControls();
    });
    for (const button of minuteButtons) button.addEventListener("click", () => {
      if (!this.draft.time) return;
      this.draft.time = `${this.draft.time.slice(0, 2)}:${button.textContent}`;
      refreshScheduleControls();
      setTimePanelOpen(false);
      timeToggle.focus();
    });
    // The whole field opens and closes the panel; only the × keeps its own action.
    timeField.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest(".taskmate-date-clear") || timeToggle.disabled) return;
      setTimePanelOpen(timePanel.hidden);
    });
    removeTime.addEventListener("click", () => {
      this.draft.time = null;
      refreshScheduleControls();
      timeToggle.focus();
    });

    const deadlineSetting = new Setting(fields).setName(t("taskModal.deadline"));
    deadlineSetting.settingEl.addClass("taskmate-deadline-setting");
    decorateField(deadlineSetting, DEADLINE_ICON, t("taskModal.deadline"));
    let deadlineInput!: HTMLInputElement;
    let removeDeadline!: HTMLButtonElement;
    deadlineSetting.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.addClass("taskmate-date-input");
      text.inputEl.setAttribute("aria-label", t("taskModal.deadline"));
      deadlineInput = text.inputEl;
      const field = embedDateLabel(text.inputEl, t("taskModal.deadline"));
      removeDeadline = field.createEl("button", {
        cls: "taskmate-date-clear clickable-icon",
        attr: { type: "button", "aria-label": t("taskModal.removeDeadline") }
      });
      setIcon(removeDeadline, "x");
      text.setValue(this.draft.deadline ?? "").onChange((value) => {
        this.draft.deadline = value || null;
        removeDeadline.toggle(this.draft.deadline !== null);
      });
    });
    removeDeadline.addEventListener("click", () => {
      this.draft.deadline = null;
      deadlineInput.value = "";
      removeDeadline.toggle(false);
      deadlineInput.focus();
    });
    removeDeadline.toggle(this.draft.deadline !== null);

    const repeatSetting = new Setting(fields).setName(t("taskModal.repeat"));
    repeatSetting.settingEl.addClass("taskmate-repeat-setting");
    decorateField(repeatSetting, "repeat", t("taskModal.repeat"));
    repeatSetting.controlEl.createSpan({
      text: t("taskModal.repeat"),
      cls: "taskmate-embedded-field-label",
      attr: { "aria-hidden": "true" }
    });
    let repeatUnit!: HTMLSelectElement;
    let repeatInterval!: HTMLInputElement;
    const readRepeat = (): void => {
      const choice = repeatUnit.value;
      const unit = (choice === MONTH_END_CHOICE ? "month" : choice) as RepeatUnit | "";
      const interval = Math.min(MAXIMUM_REPEAT_INTERVAL, Math.max(1, Math.trunc(Number(repeatInterval.value)) || 1));
      // A monthly rule keeps the day it already records; otherwise the scheduled date supplies it on save.
      const keptDay = typeof this.draft.repeat?.monthDay === "number" ? this.draft.repeat.monthDay : undefined;
      this.draft.repeat = !unit ? null
        : choice === MONTH_END_CHOICE ? { unit, interval, monthDay: "last" }
          : unit === "month" && keptDay !== undefined ? { unit, interval, monthDay: keptDay }
            : { unit, interval };
      repeatInterval.hidden = !unit;
    };
    repeatSetting.addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = "1";
      text.inputEl.max = String(MAXIMUM_REPEAT_INTERVAL);
      text.inputEl.inputMode = "numeric";
      text.inputEl.addClass("taskmate-repeat-interval");
      text.inputEl.setAttribute("aria-label", t("taskModal.repeatInterval"));
      repeatInterval = text.inputEl;
      text.setValue(String(this.draft.repeat?.interval ?? 1)).onChange(readRepeat);
    });
    repeatSetting.addDropdown((dropdown) => {
      dropdown.selectEl.setAttribute("aria-label", t("taskModal.repeat"));
      repeatUnit = dropdown.selectEl;
      dropdown.addOption("", t("repeat.none"));
      for (const unit of ["day", "week", "month", "year"] as const) {
        dropdown.addOption(unit, repeatLabel(t, { unit, interval: 1 }));
        if (unit === "month") dropdown.addOption(MONTH_END_CHOICE, repeatLabel(t, { unit, interval: 1, monthDay: "last" }));
      }
      dropdown.setValue(this.draft.repeat?.monthDay === "last" ? MONTH_END_CHOICE : this.draft.repeat?.unit ?? "").onChange(readRepeat);
    });
    repeatInterval.hidden = !this.draft.repeat;

    const scheduleHint = fields.createDiv({ cls: "setting-item-description taskmate-schedule-hint" });

    // Time and repeat need a date. Unusable values are kept in the
    // draft while the user edits and dropped on save.
    const refreshScheduleControls = (): void => {
      const hasDate = this.draft.date !== null;
      timeToggle.disabled = !hasDate;
      if (!hasDate) setTimePanelOpen(false);
      removeTime.toggle(hasDate && this.draft.time !== null);
      renderTime();
      repeatUnit.disabled = !hasDate;
      repeatInterval.disabled = !hasDate;
      scheduleHint.setText(hasDate ? "" : t("taskModal.scheduleNeedsDate"));
      scheduleHint.hidden = hasDate;
    };
    // Picking another date moves a monthly rule's day with it; opening the editor does not, so a 30th
    // currently shown on 28 February keeps repeating on the 30th.
    let anchoredDate = this.draft.date;
    onDateChange = () => {
      if (this.draft.date !== anchoredDate) {
        anchoredDate = this.draft.date;
        if (typeof this.draft.repeat?.monthDay === "number" && this.draft.date) {
          this.draft.repeat = { ...this.draft.repeat, monthDay: Number(this.draft.date.slice(8)) };
        }
      }
      refreshScheduleControls();
    };
    refreshScheduleControls();


    const projectSetting = new Setting(fields).setName(t("taskModal.project"));
    decorateField(projectSetting, "folder", t("taskModal.project"));
    addEmbeddedLabel(projectSetting, t("taskModal.project"));
    projectSetting.addDropdown((dropdown) => {
      dropdown.selectEl.setAttribute("aria-label", t("taskModal.project"));
      dropdown.addOption("", t("taskModal.unassigned"));
      for (const project of this.projects) dropdown.addOption(project.id, project.name);
      dropdown.setValue(this.draft.projectId ?? "").onChange((value) => {
        this.draft.projectId = value || null;
      });
    });

    const prioritySetting = new Setting(fields).setName(t("taskModal.priority"));
    decorateField(prioritySetting, "flag", t("taskModal.priority"));
    addEmbeddedLabel(prioritySetting, t("taskModal.priority"));
    prioritySetting.addDropdown((dropdown) => {
      dropdown.selectEl.setAttribute("aria-label", t("taskModal.priority"));
      dropdown
        .addOption("", t("taskModal.noPriority"))
        .addOption("1", t("filter.priorityValue", { priority: 1 }))
        .addOption("2", t("filter.priorityValue", { priority: 2 }))
        .addOption("3", t("filter.priorityValue", { priority: 3 }))
        .setValue(this.draft.priority ? String(this.draft.priority) : "")
        .onChange((value) => {
          this.draft.priority = value ? Number(value) as 1 | 2 | 3 : null;
        });
    });

    const labelSetting = new Setting(fields).setName(t("taskModal.labels")).setDesc(t("taskModal.labelsDescription"));
    labelSetting.settingEl.addClass("taskmate-label-setting");
    decorateField(labelSetting, "tags", t("taskModal.labels"));
    const labelEntryRow = labelSetting.controlEl.createDiv({ cls: "taskmate-label-entry-row" });
    const labelEditor = labelEntryRow.createDiv({
      cls: "taskmate-editor-label-summary taskmate-label-chip-editor"
    });
    const labelInput = labelEditor.createEl("input", {
      type: "text",
      cls: "taskmate-label-chip-input",
      placeholder: t("taskModal.labelsPlaceholder"),
      attr: {
        "aria-label": t("taskModal.labels"),
        enterkeyhint: "enter"
      }
    });
    const addLabel = labelEntryRow.createEl("button", {
      text: t("taskModal.addLabel"),
      cls: "taskmate-label-add",
      attr: {
        type: "button",
        "aria-label": t("taskModal.addLabelAriaLabel")
      }
    });
    let pendingLabelInput = "";
    let labelInputComposing = false;
    let labelsExpanded = false;
    const refreshLabelEditor = () => {
      labelEditor.querySelectorAll("[data-taskmate-label-chip], .taskmate-label-overflow-toggle")
        .forEach((element) => element.remove());
      const summary = summarizeLabels(this.draft.labels);
      const visible = labelsExpanded ? this.draft.labels : summary.visible;
      for (const label of visible) {
        const chip = document.createElement("span");
        chip.addClass("taskmate-editor-label-chip");
        chip.dataset.taskmateLabelChip = label;
        chip.createSpan({ text: label });
        const remove = chip.createEl("button", {
          cls: "taskmate-label-chip-remove",
          attr: {
            type: "button",
            "aria-label": t("taskModal.removeLabelAriaLabel", { label })
          }
        });
        setIcon(remove, "x");
        remove.addEventListener("click", () => {
          this.draft.labels = this.draft.labels.filter((item) => item !== label);
          if (this.draft.labels.length <= 3) labelsExpanded = false;
          refreshLabelEditor();
        });
        labelEditor.insertBefore(chip, labelInput);
      }
      if (summary.hidden.length > 0) {
        const toggle = document.createElement("button");
        toggle.addClass("taskmate-label-overflow-toggle");
        toggle.type = "button";
        toggle.textContent = labelsExpanded
          ? t("tasks.hideExtraLabels")
          : t("tasks.moreLabels", { count: summary.hidden.length });
        toggle.setAttribute("aria-expanded", String(labelsExpanded));
        toggle.setAttribute("aria-label", labelsExpanded
          ? t("tasks.hideExtraLabels")
          : t("tasks.moreLabelsAriaLabel", { count: summary.hidden.length }));
        toggle.addEventListener("click", () => {
          labelsExpanded = !labelsExpanded;
          refreshLabelEditor();
        });
        labelEditor.insertBefore(toggle, labelInput);
      }
      addLabel.disabled = pendingLabelInput.trim().length === 0;
    };
    const updateFromInput = (commitPending: boolean, keepFocus: boolean) => {
      const next = updateLabelChipInput(this.draft.labels, labelInput.value, commitPending);
      this.draft.labels = next.labels;
      pendingLabelInput = next.pending;
      labelInput.value = pendingLabelInput;
      refreshLabelEditor();
      if (keepFocus) window.requestAnimationFrame(() => labelInput.focus({ preventScroll: true }));
    };
    labelInput.addEventListener("compositionstart", () => { labelInputComposing = true; });
    labelInput.addEventListener("compositionend", () => {
      labelInputComposing = false;
      updateFromInput(false, false);
    });
    labelInput.addEventListener("input", (event) => {
      pendingLabelInput = labelInput.value;
      addLabel.disabled = pendingLabelInput.trim().length === 0;
      if (labelInputComposing || (event as InputEvent).isComposing) return;
      updateFromInput(false, false);
    });
    labelInput.addEventListener("keydown", (event) => {
      if (!shouldCommitLabelOnEnter(event.key, labelInputComposing || event.isComposing, event.keyCode)) return;
      event.preventDefault();
      updateFromInput(true, true);
    });
    addLabel.addEventListener("pointerdown", (event) => event.preventDefault());
    addLabel.addEventListener("click", () => updateFromInput(true, true));
    const chooseLabels = labelSetting.controlEl.createEl("button", {
      text: t("taskModal.chooseLabels"),
      cls: "taskmate-editor-label-picker-open",
      attr: {
        type: "button",
        "aria-label": t("taskModal.chooseExistingLabelsAriaLabel"),
        title: t("taskModal.chooseExistingLabelsAriaLabel")
      }
    });
    chooseLabels.addEventListener("click", () => {
      new LabelPickerModal(this.app, {
        selectedLabels: this.draft.labels,
        allLabels: this.labelOptions.allLabels,
        recentLabels: this.labelOptions.recentLabels,
        favoriteLabels: this.labelOptions.favoriteLabels,
        preserveUnavailableSelectedLabels: true,
        i18n: this.i18n,
        onConfirm: async (selected, favorites) => {
          this.draft.labels = selected.slice(0, 500);
          labelsExpanded = false;
          refreshLabelEditor();
          this.labelOptions.favoriteLabels = favorites;
          await this.labelOptions.onFavoriteLabelsChange(favorites);
        }
      }).open();
    });
    refreshLabelEditor();

    const stepsSetting = new Setting(fields).setName(t("taskModal.steps"));
    stepsSetting.settingEl.addClass("taskmate-steps-setting");
    decorateField(stepsSetting, "list-checks", t("taskModal.steps"));
    const stepsEditor = stepsSetting.controlEl.createDiv({ cls: "taskmate-steps-editor" });
    const stepsHeader = stepsEditor.createDiv({ cls: "taskmate-steps-header" });
    stepsHeader.createSpan({ text: t("taskModal.steps") });
    const stepsCount = stepsHeader.createSpan({ cls: "taskmate-steps-count" });
    const stepsList = stepsEditor.createDiv({ cls: "taskmate-steps-list" });
    const addStep = stepsEditor.createEl("button", { text: t("taskModal.addStep"), cls: "taskmate-add-step", attr: { type: "button" } });
    const renderSteps = () => {
      this.stepSortable?.destroy();
      this.stepSortable = null;
      stepsList.empty();
      const completedCount = this.draft.steps.filter((step) => step.completed).length;
      stepsCount.textContent = t("taskModal.stepProgress", { completed: completedCount, total: this.draft.steps.length });
      this.draft.steps.forEach((step, index) => {
        const row = stepsList.createDiv({ cls: "taskmate-step-row" });
        row.dataset.stepIndex = String(index);
        row.toggleClass("is-completed", step.completed);
        const completed = row.createEl("input", { type: "checkbox", cls: "taskmate-step-completed", attr: { "aria-label": t("taskModal.stepCompletedAriaLabel", { step: index + 1 }) } });
        completed.checked = step.completed;
        completed.addEventListener("change", () => {
          step.completed = completed.checked;
          row.toggleClass("is-completed", step.completed);
          const nextCompletedCount = this.draft.steps.filter((item) => item.completed).length;
          stepsCount.textContent = t("taskModal.stepProgress", { completed: nextCompletedCount, total: this.draft.steps.length });
        });
        const body = row.createEl("button", {
          cls: "taskmate-step-body",
          attr: { type: "button", "aria-label": t("taskModal.editStepAriaLabel", { title: step.text }) }
        });
        body.createDiv({ text: step.text, cls: "taskmate-step-title" });
        const dateState = stepDateState(step.date, todayKey());
        const dateText = step.date
          ? `${step.date}${dateState === "overdue" ? ` · ${t("taskModal.stepOverdue")}` : dateState === "today" ? ` · ${t("taskModal.stepDueToday")}` : ""}`
          : t("date.none");
        body.createDiv({ text: dateText, cls: `taskmate-step-metadata${dateState === "overdue" ? " is-overdue" : ""}` });
        body.addEventListener("click", () => {
          new StepModal(this.app, step, this.availableRegion, this.i18n, (updated) => {
            this.draft.steps[index] = updated;
            renderSteps();
          }, () => {
            this.draft.steps.splice(index, 1);
            renderSteps();
          }).open();
        });
        const disclosure = row.createSpan({ cls: "taskmate-step-disclosure", attr: { "aria-hidden": "true" } });
        setIcon(disclosure, "chevron-right");
      });
      if (this.draft.steps.length > 1) {
        this.stepSortable = Sortable.create(stepsList, {
          animation: 140,
          handle: ".taskmate-step-body",
          draggable: ".taskmate-step-row",
          delay: 250,
          delayOnTouchOnly: true,
          touchStartThreshold: 4,
          onEnd: (event) => {
            if (event.oldIndex === undefined || event.newIndex === undefined || event.oldIndex === event.newIndex) return;
            this.draft.steps = moveTaskStep(this.draft.steps, event.oldIndex, event.newIndex);
            renderSteps();
          }
        });
      }
    };
    addStep.addEventListener("click", () => {
      new StepModal(this.app, null, this.availableRegion, this.i18n, (step) => {
        this.draft.steps.push(step);
        renderSteps();
      }).open();
    });
    renderSteps();

    const notesSetting = new Setting(fields).setName(t("taskModal.notes"));
    notesSetting.settingEl.addClass("taskmate-notes-setting");
    decorateField(notesSetting, "notebook-pen", t("taskModal.notes"));
    notesSetting.addTextArea((area) => {
      area.inputEl.rows = 7;
      area.inputEl.setAttribute("aria-label", t("taskModal.notes"));
      area.inputEl.placeholder = t("taskModal.notes");
      area.setValue(this.draft.notes).onChange((value) => {
        this.draft.notes = value;
      });
    });

    const actions = contentEl.createDiv({ cls: "taskmate-modal-actions" });
    if (this.onDelete) {
      const remove = actions.createEl("button", { cls: "taskmate-delete-task" });
      setIcon(remove, "trash-2");
      remove.createSpan({ text: t("common.delete") });
      remove.addEventListener("click", async () => {
        if (!window.confirm(t("tasks.deleteConfirm", { title: this.draft.title }))) return;
        remove.disabled = true;
        try {
          if (await this.onDelete?.()) this.close();
        } finally {
          remove.disabled = false;
        }
      });
    }
    const ordinaryActions = actions.createDiv({ cls: "taskmate-modal-primary-actions" });
    const cancel = ordinaryActions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const save = ordinaryActions.createEl("button", { text: t("common.save"), cls: "mod-cta" });
    save.addEventListener("click", async () => {
      if (!this.draft.title.trim()) return;
      updateFromInput(true, false);
      this.draft.steps = normalizeTaskSteps(this.draft.steps);
      save.disabled = true;
      try {
        if (await this.onSave(normalizeSchedule(this.draft))) this.close();
      } finally {
        save.disabled = false;
      }
    });

    this.keyboardScroller = new MobileKeyboardScroller(
      fields,
      this.modalEl,
      this.availableRegion,
      this.baselineAvailableHeight
    );
    this.keyboardScroller.connect();
  }

  onClose(): void {
    this.stepSortable?.destroy();
    this.stepSortable = null;
    this.keyboardScroller?.disconnect();
    this.keyboardScroller = null;
    this.contentEl.empty();
  }
}

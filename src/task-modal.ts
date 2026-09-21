import { App, Modal, Setting, setIcon } from "obsidian";
import type { Project, Task, TaskDraft } from "./domain";
import { taskDateSuggestions } from "./task-input-suggestions";
import type { I18n, TranslationKey } from "./i18n";
import { shouldCommitLabelOnEnter, updateLabelChipInput } from "./label-chip-input";
import { summarizeLabels } from "./label-summary";
import { LabelPickerModal } from "./label-picker-modal";
import { MobileKeyboardScroller } from "./mobile-keyboard-layout";
import { normalizeTaskTitleInput } from "./task-title";

const DATE_SUGGESTION_KEYS = {
  today: "date.today",
  tomorrow: "date.tomorrow",
  "seven-days": "date.sevenDays",
  none: "date.none"
} satisfies Record<ReturnType<typeof taskDateSuggestions>[number]["id"], TranslationKey>;

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

export interface TaskModalLabelOptions {
  allLabels: string[];
  recentLabels: string[];
  favoriteLabels: string[];
  onFavoriteLabelsChange: (labels: string[]) => Promise<void>;
}

export class TaskModal extends Modal {
  private draft: TaskDraft;
  private keyboardScroller: MobileKeyboardScroller | null = null;
  private readonly baselineAvailableHeight: number;

  constructor(
    app: App,
    task: Task | null,
    private readonly projects: Project[],
    private readonly labelOptions: TaskModalLabelOptions,
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
      priority: task?.priority ?? null,
      labels: task?.labels ?? [],
      projectId: task?.projectId ?? defaultProjectId,
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
      titleInput.rows = 3;
      titleInput.wrap = "soft";
      titleInput.setAttribute("aria-label", t("taskModal.title"));
      const resizeTitleInput = () => {
        titleInput.style.height = "auto";
        titleInput.style.height = `${titleInput.scrollHeight}px`;
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
    const refreshDateSelection = () => {
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
      text.setValue(this.draft.date ?? "").onChange((value) => {
        this.draft.date = value || null;
        refreshDateSelection();
      });
    });
    refreshDateSelection();

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
      save.disabled = true;
      try {
        if (await this.onSave(this.draft)) this.close();
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
    this.keyboardScroller?.disconnect();
    this.keyboardScroller = null;
    this.contentEl.empty();
  }
}

import { App, Modal, Setting, setIcon } from "obsidian";
import type { Priority, Project, Task } from "./domain";
import { taskDateSuggestions, normalizeLabels } from "./task-input-suggestions";
import type { I18n, TranslationKey } from "./i18n";
import { shouldCommitLabelOnEnter, updateLabelChipInput } from "./label-chip-input";
import { summarizeLabels } from "./label-summary";
import { LabelPickerModal } from "./label-picker-modal";
import { MobileKeyboardScroller } from "./mobile-keyboard-layout";
import type { TaskModalLabelOptions } from "./task-modal";
import type { BulkTaskChanges } from "./bulk-task-actions";

const DATE_SUGGESTION_KEYS = { today: "date.today", tomorrow: "date.tomorrow", "seven-days": "date.sevenDays", none: "date.none" } satisfies Record<ReturnType<typeof taskDateSuggestions>[number]["id"], TranslationKey>;

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
  setting.controlEl.prepend(setting.controlEl.createSpan({ text: label, cls: "taskmate-embedded-field-label", attr: { "aria-hidden": "true" } }));
}

export class BulkTaskModal extends Modal {
  private changes: BulkTaskChanges = { addLabels: [], removeLabels: [] };
  private keyboardScroller: MobileKeyboardScroller | null = null;
  private readonly baselineAvailableHeight: number;
  private readonly initialLabels: string[];

  constructor(app: App, private readonly tasks: Task[], private readonly projects: Project[], private readonly labelOptions: TaskModalLabelOptions, private readonly availableRegion: HTMLElement, private readonly i18n: I18n, private readonly onApply: (changes: BulkTaskChanges) => Promise<void>) {
    super(app);
    this.baselineAvailableHeight = availableRegion.getBoundingClientRect().height;
    this.initialLabels = normalizeLabels(tasks.flatMap((task) => task.labels)).slice(0, 500);
    this.setTitle(i18n.t("bulk.title", { count: tasks.length }));
  }

  onOpen(): void {
    const { t } = this.i18n;
    this.modalEl.addClass("taskmate-task-modal", "taskmate-bulk-task-modal");
    const fields = this.contentEl.createDiv({ cls: "taskmate-task-fields" });
    const dateSetting = new Setting(fields).setName(t("taskModal.date"));
    dateSetting.settingEl.addClass("taskmate-date-setting");
    decorateField(dateSetting, "calendar-days", t("taskModal.date"));
    const datePresets = dateSetting.controlEl.createDiv({ cls: "taskmate-date-presets taskmate-bulk-date-presets" });
    const dateButtons: HTMLButtonElement[] = [];
    let dateInput: HTMLInputElement;
    const selectDate = (value: string | null | undefined) => {
      if (value === undefined) delete this.changes.date;
      else this.changes.date = value;
      dateInput.value = typeof value === "string" ? value : "";
      dateButtons.forEach((button) => {
        const selected = button.dataset.bulkDate === (value === undefined ? "unchanged" : value ?? "");
        button.toggleClass("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    };
    const unchanged = datePresets.createEl("button", { text: t("bulk.unchanged"), cls: "taskmate-suggestion-chip is-active", attr: { type: "button", "aria-pressed": "true" } });
    unchanged.dataset.bulkDate = "unchanged";
    unchanged.addEventListener("click", () => selectDate(undefined));
    dateButtons.push(unchanged);
    for (const suggestion of taskDateSuggestions()) {
      const button = datePresets.createEl("button", { cls: "taskmate-suggestion-chip", attr: { type: "button", "aria-pressed": "false" } });
      button.dataset.bulkDate = suggestion.date ?? "";
      button.createSpan({ text: t(DATE_SUGGESTION_KEYS[suggestion.id]) });
      button.addEventListener("click", () => selectDate(suggestion.date));
      dateButtons.push(button);
    }
    dateSetting.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.addClass("taskmate-date-input");
      text.inputEl.setAttribute("aria-label", t("taskModal.date"));
      dateInput = text.inputEl;
      text.onChange((value) => selectDate(value || null));
    });

    const projectSetting = new Setting(fields).setName(t("taskModal.project"));
    decorateField(projectSetting, "folder", t("taskModal.project"));
    addEmbeddedLabel(projectSetting, t("taskModal.project"));
    projectSetting.addDropdown((dropdown) => {
      dropdown.addOption("unchanged", t("bulk.unchanged")).addOption("clear", t("taskModal.unassigned"));
      this.projects.forEach((project) => dropdown.addOption(project.id, project.name));
      dropdown.onChange((value) => { if (value === "unchanged") delete this.changes.projectId; else this.changes.projectId = value === "clear" ? null : value; });
    });
    const prioritySetting = new Setting(fields).setName(t("taskModal.priority"));
    decorateField(prioritySetting, "flag", t("taskModal.priority"));
    addEmbeddedLabel(prioritySetting, t("taskModal.priority"));
    prioritySetting.addDropdown((dropdown) => dropdown.addOption("unchanged", t("bulk.unchanged")).addOption("clear", t("taskModal.noPriority")).addOption("1", t("filter.priorityValue", { priority: 1 })).addOption("2", t("filter.priorityValue", { priority: 2 })).addOption("3", t("filter.priorityValue", { priority: 3 })).onChange((value) => { if (value === "unchanged") delete this.changes.priority; else this.changes.priority = value === "clear" ? null : Number(value) as Priority; }));

    const labelSetting = new Setting(fields).setName(t("taskModal.labels")).setDesc(t("bulk.labelsDescription"));
    labelSetting.settingEl.addClass("taskmate-label-setting");
    decorateField(labelSetting, "tags", t("taskModal.labels"));
    const entryRow = labelSetting.controlEl.createDiv({ cls: "taskmate-label-entry-row" });
    const editor = entryRow.createDiv({ cls: "taskmate-editor-label-summary taskmate-label-chip-editor" });
    const input = editor.createEl("input", { type: "text", cls: "taskmate-label-chip-input", placeholder: t("taskModal.labelsPlaceholder"), attr: { "aria-label": t("taskModal.labels"), enterkeyhint: "enter" } });
    const add = entryRow.createEl("button", { text: t("taskModal.addLabel"), cls: "taskmate-label-add", attr: { type: "button", "aria-label": t("taskModal.addLabelAriaLabel") } });
    let pending = "";
    let composing = false;
    let expanded = false;
    const labelsNow = () => this.initialLabels.filter((label) => !this.changes.removeLabels.includes(label)).concat(this.changes.addLabels.filter((label) => !this.initialLabels.includes(label)));
    const include = (label: string) => {
      if (this.initialLabels.includes(label)) this.changes.removeLabels = this.changes.removeLabels.filter((item) => item !== label);
      else if (!this.changes.addLabels.includes(label)) this.changes.addLabels = [...this.changes.addLabels, label].slice(0, 500);
    };
    const exclude = (label: string) => {
      this.changes.addLabels = this.changes.addLabels.filter((item) => item !== label);
      if (this.initialLabels.includes(label) && !this.changes.removeLabels.includes(label)) this.changes.removeLabels = [...this.changes.removeLabels, label];
    };
    const refresh = () => {
      editor.querySelectorAll("[data-taskmate-label-chip], .taskmate-label-overflow-toggle").forEach((element) => element.remove());
      const labels = labelsNow();
      const summary = summarizeLabels(labels);
      for (const label of expanded ? labels : summary.visible) {
        const assigned = this.tasks.filter((task) => task.labels.includes(label)).length;
        const partial = assigned > 0 && assigned < this.tasks.length;
        const chip = document.createElement("span");
        chip.addClass("taskmate-editor-label-chip");
        if (partial) chip.addClass("taskmate-bulk-label-partial");
        chip.dataset.taskmateLabelChip = label;
        chip.createSpan({ text: partial ? t("bulk.labelPartial", { label, assigned, total: this.tasks.length }) : label });
        const remove = chip.createEl("button", { cls: "taskmate-label-chip-remove", attr: { type: "button", "aria-label": t("bulk.removeLabelAriaLabel", { label }) } });
        setIcon(remove, "x");
        remove.addEventListener("click", () => { exclude(label); if (labelsNow().length <= 3) expanded = false; refresh(); });
        editor.insertBefore(chip, input);
      }
      if (summary.hidden.length > 0) {
        const toggle = document.createElement("button");
        toggle.addClass("taskmate-label-overflow-toggle"); toggle.type = "button";
        toggle.textContent = expanded ? t("tasks.hideExtraLabels") : t("tasks.moreLabels", { count: summary.hidden.length });
        toggle.addEventListener("click", () => { expanded = !expanded; refresh(); });
        editor.insertBefore(toggle, input);
      }
      add.disabled = pending.trim().length === 0;
    };
    const commitInput = (commitPending: boolean, keepFocus: boolean) => {
      const next = updateLabelChipInput(labelsNow(), input.value, commitPending);
      next.labels.forEach(include); pending = next.pending; input.value = pending; refresh();
      if (keepFocus) window.requestAnimationFrame(() => input.focus({ preventScroll: true }));
    };
    input.addEventListener("compositionstart", () => { composing = true; });
    input.addEventListener("compositionend", () => { composing = false; commitInput(false, false); });
    input.addEventListener("input", (event) => { pending = input.value; add.disabled = !pending.trim(); if (!composing && !(event as InputEvent).isComposing) commitInput(false, false); });
    input.addEventListener("keydown", (event) => { if (shouldCommitLabelOnEnter(event.key, composing || event.isComposing, event.keyCode)) { event.preventDefault(); commitInput(true, true); } });
    add.addEventListener("pointerdown", (event) => event.preventDefault());
    add.addEventListener("click", () => commitInput(true, true));
    const choose = labelSetting.controlEl.createEl("button", { text: t("taskModal.chooseLabels"), cls: "taskmate-editor-label-picker-open", attr: { type: "button", "aria-label": t("taskModal.chooseExistingLabelsAriaLabel") } });
    choose.addEventListener("click", () => new LabelPickerModal(this.app, {
      selectedLabels: labelsNow(), allLabels: this.labelOptions.allLabels, recentLabels: this.labelOptions.recentLabels, favoriteLabels: this.labelOptions.favoriteLabels, preserveUnavailableSelectedLabels: true, i18n: this.i18n,
      onConfirm: async (selected, favorites) => { const next = new Set(selected); labelsNow().forEach((label) => { if (!next.has(label)) exclude(label); }); selected.forEach(include); this.labelOptions.favoriteLabels = favorites; await this.labelOptions.onFavoriteLabelsChange(favorites); refresh(); }
    }).open());
    refresh();

    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    const cancel = actions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const apply = actions.createEl("button", { text: t("bulk.apply", { count: this.tasks.length }), cls: "mod-cta" });
    apply.addEventListener("click", async () => { apply.disabled = true; try { await this.onApply(this.changes); this.close(); } finally { apply.disabled = false; } });
    this.keyboardScroller = new MobileKeyboardScroller(fields, this.modalEl, this.availableRegion, this.baselineAvailableHeight);
    this.keyboardScroller.connect();
  }

  onClose(): void { this.keyboardScroller?.disconnect(); this.keyboardScroller = null; this.contentEl.empty(); }
}

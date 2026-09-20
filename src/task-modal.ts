import { App, Modal, Setting, setIcon } from "obsidian";
import type { Project, Task, TaskDraft } from "./domain";
import { normalizeLabels, recentLabelSuggestions, taskDateSuggestions } from "./task-input-suggestions";
import type { I18n, TranslationKey } from "./i18n";
import { summarizeLabels } from "./label-summary";
import { MobileKeyboardScroller } from "./mobile-keyboard-layout";

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

export class TaskModal extends Modal {
  private draft: TaskDraft;
  private keyboardScroller: MobileKeyboardScroller | null = null;

  constructor(
    app: App,
    task: Task | null,
    private readonly projects: Project[],
    private readonly recentLabels: string[],
    defaultProjectId: string | null,
    private readonly availableRegion: HTMLElement,
    private readonly i18n: I18n,
    private readonly onSave: (draft: TaskDraft) => Promise<void>,
    private readonly onDelete: (() => Promise<void>) | null = null
  ) {
    super(app);
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
    titleSetting.addText((text) => {
      text.inputEl.setAttribute("aria-label", t("taskModal.title"));
      text.setPlaceholder(t("taskModal.titlePlaceholder")).setValue(this.draft.title).onChange((value) => {
        this.draft.title = value;
      });
      if (!window.matchMedia("(max-width: 700px)").matches) {
        window.setTimeout(() => text.inputEl.focus(), 0);
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
    decorateField(labelSetting, "tags", t("taskModal.labels"));
    let labelInput: HTMLInputElement;
    let labelsExpanded = false;
    let refreshLabelSummary = () => {};
    const recentLabelButtons: HTMLButtonElement[] = [];
    const refreshLabelSelection = () => {
      for (const button of recentLabelButtons) {
        const selected = this.draft.labels.includes(button.dataset.label ?? "");
        button.toggleClass("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    };
    labelSetting.addText((text) => {
      text.inputEl.setAttribute("aria-label", t("taskModal.labels"));
      text.setPlaceholder(t("taskModal.labelsPlaceholder")).setValue(this.draft.labels.join(", ")).onChange((value) => {
        this.draft.labels = normalizeLabels(value.split(",")).slice(0, 500);
        refreshLabelSelection();
        refreshLabelSummary();
      });
      labelInput = text.inputEl;
    });
    const labelSummaryEl = labelSetting.controlEl.createDiv({ cls: "taskmate-editor-label-summary" });
    refreshLabelSummary = () => {
      labelSummaryEl.empty();
      const summary = summarizeLabels(this.draft.labels);
      const visible = labelsExpanded ? this.draft.labels : summary.visible;
      for (const label of visible) labelSummaryEl.createSpan({ text: `#${label}`, cls: "taskmate-editor-label-chip" });
      if (summary.hidden.length === 0) return;
      const toggle = labelSummaryEl.createEl("button", {
        text: labelsExpanded ? t("tasks.hideExtraLabels") : t("tasks.moreLabels", { count: summary.hidden.length }),
        cls: "taskmate-label-overflow-toggle",
        attr: {
          type: "button",
          "aria-expanded": String(labelsExpanded),
          "aria-label": labelsExpanded ? t("tasks.hideExtraLabels") : t("tasks.moreLabelsAriaLabel", { count: summary.hidden.length })
        }
      });
      toggle.addEventListener("click", () => {
        labelsExpanded = !labelsExpanded;
        refreshLabelSummary();
      });
    };
    refreshLabelSummary();
    const labelSuggestions = recentLabelSuggestions(this.recentLabels);
    if (labelSuggestions.length > 0) {
      const recent = fields.createDiv({ cls: "taskmate-recent-labels" });
      recent.createDiv({ text: t("taskModal.recentLabels"), cls: "taskmate-suggestion-heading" });
      const chips = recent.createDiv({ cls: "taskmate-suggestion-chips" });
      for (const label of labelSuggestions) {
        const button = chips.createEl("button", {
          text: label,
          cls: "taskmate-suggestion-chip",
          attr: { type: "button", "aria-pressed": "false" }
        });
        button.dataset.label = label;
        button.addEventListener("click", () => {
          this.draft.labels = this.draft.labels.includes(label)
            ? this.draft.labels.filter((item) => item !== label)
            : [...this.draft.labels, label].slice(0, 500);
          labelInput.value = this.draft.labels.join(", ");
          refreshLabelSelection();
          refreshLabelSummary();
        });
        recentLabelButtons.push(button);
      }
      refreshLabelSelection();
    }

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
          await this.onDelete?.();
          this.close();
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
      save.disabled = true;
      try {
        await this.onSave(this.draft);
        this.close();
      } finally {
        save.disabled = false;
      }
    });

    this.keyboardScroller = new MobileKeyboardScroller(fields, this.modalEl, this.availableRegion);
    this.keyboardScroller.connect();
  }

  onClose(): void {
    this.keyboardScroller?.disconnect();
    this.keyboardScroller = null;
    this.contentEl.empty();
  }
}

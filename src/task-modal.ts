import { App, Modal, Setting } from "obsidian";
import type { Project, Task, TaskDraft } from "./domain";
import { normalizeLabels, recentLabelSuggestions, taskDateSuggestions } from "./task-input-suggestions";
import type { I18n, TranslationKey } from "./i18n";

const DATE_SUGGESTION_KEYS = {
  today: "date.today",
  tomorrow: "date.tomorrow",
  "seven-days": "date.sevenDays",
  none: "date.none"
} satisfies Record<ReturnType<typeof taskDateSuggestions>[number]["id"], TranslationKey>;

export class TaskModal extends Modal {
  private draft: TaskDraft;

  constructor(
    app: App,
    task: Task | null,
    private readonly projects: Project[],
    private readonly recentLabels: string[],
    defaultProjectId: string | null,
    private readonly i18n: I18n,
    private readonly onSave: (draft: TaskDraft) => Promise<void>
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

    new Setting(fields).setName(t("taskModal.title")).addText((text) => {
      text.setPlaceholder(t("taskModal.titlePlaceholder")).setValue(this.draft.title).onChange((value) => {
        this.draft.title = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });

    const dateSetting = new Setting(fields).setName(t("taskModal.date"));
    dateSetting.settingEl.addClass("taskmate-date-setting");
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
      dateInput = text.inputEl;
      text.setValue(this.draft.date ?? "").onChange((value) => {
        this.draft.date = value || null;
        refreshDateSelection();
      });
    });
    refreshDateSelection();

    new Setting(fields).setName(t("taskModal.project")).addDropdown((dropdown) => {
      dropdown.addOption("", t("taskModal.unassigned"));
      for (const project of this.projects) dropdown.addOption(project.id, project.name);
      dropdown.setValue(this.draft.projectId ?? "").onChange((value) => {
        this.draft.projectId = value || null;
      });
    });

    new Setting(fields).setName(t("taskModal.priority")).addDropdown((dropdown) => {
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
    let labelInput: HTMLInputElement;
    const recentLabelButtons: HTMLButtonElement[] = [];
    const refreshLabelSelection = () => {
      for (const button of recentLabelButtons) {
        const selected = this.draft.labels.includes(button.dataset.label ?? "");
        button.toggleClass("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    };
    labelSetting.addText((text) => {
      text.setPlaceholder(t("taskModal.labelsPlaceholder")).setValue(this.draft.labels.join(", ")).onChange((value) => {
        this.draft.labels = normalizeLabels(value.split(",")).slice(0, 500);
        refreshLabelSelection();
      });
      labelInput = text.inputEl;
    });
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
        });
        recentLabelButtons.push(button);
      }
      refreshLabelSelection();
    }

    new Setting(fields).setName(t("taskModal.notes")).addTextArea((area) => {
      area.inputEl.rows = 5;
      area.setValue(this.draft.notes).onChange((value) => {
        this.draft.notes = value;
      });
    });

    const actions = contentEl.createDiv({ cls: "taskmate-modal-actions" });
    const cancel = actions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const save = actions.createEl("button", { text: t("common.save"), cls: "mod-cta" });
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
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

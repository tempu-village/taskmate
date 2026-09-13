import { App, Modal, Setting } from "obsidian";
import type { Project, Task, TaskDraft } from "./domain";
import { normalizeLabels, recentLabelSuggestions, taskDateSuggestions } from "./task-input-suggestions";

function shortDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${month}/${day}`;
}

export class TaskModal extends Modal {
  private draft: TaskDraft;

  constructor(
    app: App,
    task: Task | null,
    private readonly projects: Project[],
    private readonly recentLabels: string[],
    defaultProjectId: string | null,
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
    this.setTitle(task ? "タスクを編集" : "タスクを追加");
  }

  onOpen(): void {
    const { contentEl } = this;

    new Setting(contentEl).setName("タイトル").addText((text) => {
      text.setPlaceholder("やること").setValue(this.draft.title).onChange((value) => {
        this.draft.title = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });

    const dateSetting = new Setting(contentEl).setName("日付");
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
      button.createSpan({ text: suggestion.label });
      if (suggestion.date) button.createSpan({ text: shortDate(suggestion.date), cls: "taskmate-suggestion-detail" });
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

    new Setting(contentEl).setName("プロジェクト").addDropdown((dropdown) => {
      dropdown.addOption("", "未所属");
      for (const project of this.projects) dropdown.addOption(project.id, project.name);
      dropdown.setValue(this.draft.projectId ?? "").onChange((value) => {
        this.draft.projectId = value || null;
      });
    });

    new Setting(contentEl).setName("優先度").addDropdown((dropdown) => {
      dropdown
        .addOption("", "なし")
        .addOption("1", "優先度 1")
        .addOption("2", "優先度 2")
        .addOption("3", "優先度 3")
        .setValue(this.draft.priority ? String(this.draft.priority) : "")
        .onChange((value) => {
          this.draft.priority = value ? Number(value) as 1 | 2 | 3 : null;
        });
    });

    const labelSetting = new Setting(contentEl).setName("ラベル").setDesc("カンマ区切り、最大500種類");
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
      text.setPlaceholder("仕事, 連絡").setValue(this.draft.labels.join(", ")).onChange((value) => {
        this.draft.labels = normalizeLabels(value.split(",")).slice(0, 500);
        refreshLabelSelection();
      });
      labelInput = text.inputEl;
    });
    const labelSuggestions = recentLabelSuggestions(this.recentLabels);
    if (labelSuggestions.length > 0) {
      const recent = contentEl.createDiv({ cls: "taskmate-recent-labels" });
      recent.createDiv({ text: "最近使ったラベル", cls: "taskmate-suggestion-heading" });
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

    new Setting(contentEl).setName("メモ").addTextArea((area) => {
      area.inputEl.rows = 5;
      area.setValue(this.draft.notes).onChange((value) => {
        this.draft.notes = value;
      });
    });

    const actions = contentEl.createDiv({ cls: "taskmate-modal-actions" });
    const cancel = actions.createEl("button", { text: "キャンセル" });
    cancel.addEventListener("click", () => this.close());
    const save = actions.createEl("button", { text: "保存", cls: "mod-cta" });
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

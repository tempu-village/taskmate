import { App, Modal, Setting } from "obsidian";
import type { Project, Task, TaskDraft } from "./domain";

export class TaskModal extends Modal {
  private draft: TaskDraft;

  constructor(
    app: App,
    task: Task | null,
    private readonly projects: Project[],
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

    new Setting(contentEl).setName("日付").addText((text) => {
      text.inputEl.type = "date";
      text.setValue(this.draft.date ?? "").onChange((value) => {
        this.draft.date = value || null;
      });
    });

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

    new Setting(contentEl).setName("ラベル").setDesc("カンマ区切り、最大500種類").addText((text) => {
      text.setPlaceholder("仕事, 連絡").setValue(this.draft.labels.join(", ")).onChange((value) => {
        this.draft.labels = [...new Set(value.split(",").map((label) => label.trim().replace(/^#/, "")).filter(Boolean))].slice(0, 500);
      });
    });

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

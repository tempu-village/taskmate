import { App, Modal, Setting } from "obsidian";
import type { Task, TaskDraft } from "./domain";

export class TaskModal extends Modal {
  private draft: TaskDraft;

  constructor(app: App, task: Task | null, private readonly onSave: (draft: TaskDraft) => Promise<void>) {
    super(app);
    this.draft = {
      title: task?.title ?? "",
      date: task?.date ?? null,
      important: task?.important ?? false,
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

    new Setting(contentEl).setName("重要").addToggle((toggle) => toggle.setValue(this.draft.important).onChange((value) => {
      this.draft.important = value;
    }));

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

import { App, Modal, Setting } from "obsidian";

export class ProjectModal extends Modal {
  private name = "";

  constructor(app: App, private readonly onSave: (name: string) => Promise<void>) {
    super(app);
    this.setTitle("プロジェクトを追加");
  }

  onOpen(): void {
    new Setting(this.contentEl).setName("プロジェクト名").addText((text) => {
      text.setPlaceholder("新しいプロジェクト").onChange((value) => {
        this.name = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });

    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    actions.createEl("button", { text: "キャンセル" }).addEventListener("click", () => this.close());
    const save = actions.createEl("button", { text: "追加", cls: "mod-cta" });
    save.addEventListener("click", async () => {
      if (!this.name.trim()) return;
      save.disabled = true;
      try {
        await this.onSave(this.name.trim());
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

import { App, Modal, Setting } from "obsidian";
import type { I18n } from "./i18n";

export class ProjectModal extends Modal {
  private name = "";

  constructor(app: App, private readonly i18n: I18n, private readonly onSave: (name: string) => Promise<void>) {
    super(app);
    this.setTitle(i18n.t("projectModal.addTitle"));
  }

  onOpen(): void {
    const { t } = this.i18n;
    new Setting(this.contentEl).setName(t("projectModal.name")).addText((text) => {
      text.setPlaceholder(t("projectModal.namePlaceholder")).onChange((value) => {
        this.name = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });

    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    actions.createEl("button", { text: t("common.cancel") }).addEventListener("click", () => this.close());
    const save = actions.createEl("button", { text: t("common.add"), cls: "mod-cta" });
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

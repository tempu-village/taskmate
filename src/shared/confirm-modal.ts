import { App, Modal } from "obsidian";

export interface ConfirmOptions {
  message: string;
  confirmText: string;
  cancelText: string;
}

// An Obsidian Modal replaces window.confirm so the prompt follows the app theme, opens in popout windows, and works on mobile.
class ConfirmModal extends Modal {
  private confirmed = false;

  constructor(app: App, private readonly options: ConfirmOptions, private readonly resolve: (confirmed: boolean) => void) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.createEl("p", { text: this.options.message });
    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    const cancel = actions.createEl("button", { text: this.options.cancelText });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { text: this.options.confirmText, cls: "mod-warning" });
    confirm.addEventListener("click", () => {
      this.confirmed = true;
      this.close();
    });
    // Focus the safe choice so Enter or an accidental tap does not run a destructive action.
    window.setTimeout(() => cancel.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
    this.resolve(this.confirmed);
  }
}

export function confirmAction(app: App, options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => new ConfirmModal(app, options, resolve).open());
}

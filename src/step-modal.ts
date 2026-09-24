import { App, Modal, Setting, setIcon } from "obsidian";
import type { TaskStep } from "./domain";
import type { I18n } from "./i18n";
import { MobileKeyboardScroller } from "./mobile-keyboard-layout";
import { normalizeTaskSteps } from "./task-body";

export class StepModal extends Modal {
  private readonly draft: TaskStep;
  private keyboardScroller: MobileKeyboardScroller | null = null;
  private readonly baselineAvailableHeight: number;

  constructor(
    app: App,
    step: TaskStep | null,
    private readonly availableRegion: HTMLElement,
    private readonly i18n: I18n,
    private readonly onSave: (step: TaskStep) => void,
    private readonly onDelete: (() => void) | null = null
  ) {
    super(app);
    this.baselineAvailableHeight = availableRegion.getBoundingClientRect().height;
    this.draft = step ? { ...step } : { text: String(), completed: false, date: null };
    this.setTitle(i18n.t(step ? "stepModal.editTitle" : "stepModal.addTitle"));
  }

  onOpen(): void {
    const { t } = this.i18n;
    this.modalEl.addClass("taskmate-step-modal");
    const fields = this.contentEl.createDiv({ cls: "taskmate-step-modal-fields" });

    const titleSetting = new Setting(fields).setName(t("stepModal.title"));
    titleSetting.addText((text) => {
      text.inputEl.setAttribute("aria-label", t("stepModal.title"));
      text.setPlaceholder(t("stepModal.titlePlaceholder")).setValue(this.draft.text).onChange((value) => {
        this.draft.text = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });

    const dateSetting = new Setting(fields).setName(t("stepModal.date"));
    dateSetting.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.setAttribute("aria-label", t("stepModal.date"));
      text.setValue(this.draft.date ?? "").onChange((value) => {
        this.draft.date = value || null;
      });
    });

    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    if (this.onDelete) {
      const remove = actions.createEl("button", { cls: "taskmate-delete-task" });
      setIcon(remove, "trash-2");
      remove.createSpan({ text: t("common.delete") });
      remove.addEventListener("click", () => {
        this.onDelete?.();
        this.close();
      });
    }
    const ordinaryActions = actions.createDiv({ cls: "taskmate-modal-primary-actions" });
    const cancel = ordinaryActions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const save = ordinaryActions.createEl("button", {
      text: t(this.onDelete ? "common.save" : "stepModal.add"),
      cls: "mod-cta"
    });
    save.addEventListener("click", () => {
      const [normalized] = normalizeTaskSteps([this.draft]);
      if (!normalized) return;
      this.onSave(normalized);
      this.close();
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

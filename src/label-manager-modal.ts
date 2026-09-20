import { App, Modal, setIcon } from "obsidian";
import { compareDisplayText } from "./i18n";
import type { I18n } from "./i18n";
import type { ManagedLabel } from "./label-management";
import { normalizeManagedLabel } from "./label-management";

interface LabelManagerOptions {
  labels: ManagedLabel[];
  i18n: I18n;
  onRename: (from: string, to: string) => Promise<void>;
  onDelete: (label: string) => Promise<void>;
}

export class LabelManagerModal extends Modal {
  private query = "";
  private editingLabel: string | null = null;
  private resultsEl: HTMLElement | null = null;

  constructor(app: App, private readonly options: LabelManagerOptions) {
    super(app);
    this.setTitle(options.i18n.t("labelManager.title"));
  }

  onOpen(): void {
    const { t } = this.options.i18n;
    this.modalEl.addClass("taskmate-label-manager-modal");
    const search = this.contentEl.createEl("input", {
      type: "text",
      cls: "taskmate-label-manager-search",
      attr: { placeholder: t("labelManager.search"), "aria-label": t("labelManager.search") }
    });
    search.addEventListener("input", () => {
      this.query = search.value;
      this.editingLabel = null;
      this.renderResults();
    });
    this.resultsEl = this.contentEl.createDiv({ cls: "taskmate-label-manager-results" });
    this.renderResults();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderResults(): void {
    if (!this.resultsEl) return;
    const { t, locale } = this.options.i18n;
    const needle = this.query.trim().toLocaleLowerCase(locale);
    const labels = this.options.labels
      .filter((item) => item.label.toLocaleLowerCase(locale).includes(needle))
      .sort((left, right) => compareDisplayText(left.label, right.label, locale));
    this.resultsEl.empty();
    if (labels.length === 0) {
      this.resultsEl.createDiv({ text: t("labelManager.empty"), cls: "taskmate-empty-compact" });
      return;
    }
    for (const item of labels) this.renderRow(item);
  }

  private renderRow(item: ManagedLabel): void {
    if (!this.resultsEl) return;
    const { t } = this.options.i18n;
    const row = this.resultsEl.createDiv({ cls: "taskmate-label-manager-row" });
    if (this.editingLabel === item.label) {
      const editor = row.createDiv({ cls: "taskmate-label-manager-editor" });
      editor.createDiv({
        text: item.storedOnly
          ? t("labelManager.renameStoredOnly", { label: item.label })
          : item.taskCount === 1
            ? t("labelManager.renameUsedOne", { label: item.label, count: item.taskCount })
            : t("labelManager.renameUsed", { label: item.label, count: item.taskCount }),
        cls: "taskmate-label-manager-impact"
      });
      const input = editor.createEl("input", { type: "text", value: item.label });
      const actions = editor.createDiv({ cls: "taskmate-label-manager-editor-actions" });
      const cancel = actions.createEl("button", { text: t("common.cancel") });
      const confirm = actions.createEl("button", { text: t("labelManager.confirmRename"), cls: "mod-cta" });
      const refreshValidity = () => {
        const normalized = normalizeManagedLabel(input.value);
        confirm.disabled = normalized === null || normalized === item.label;
      };
      input.addEventListener("input", refreshValidity);
      cancel.addEventListener("click", () => {
        this.editingLabel = null;
        this.renderResults();
      });
      confirm.addEventListener("click", async () => {
        const normalized = normalizeManagedLabel(input.value);
        if (!normalized || normalized === item.label) return;
        confirm.disabled = true;
        try {
          await this.options.onRename(item.label, normalized);
          this.close();
        } finally {
          confirm.disabled = false;
        }
      });
      refreshValidity();
      window.setTimeout(() => input.focus(), 0);
      return;
    }

    const summary = row.createDiv({ cls: "taskmate-label-manager-summary" });
    summary.createSpan({ text: item.label, cls: "taskmate-label-manager-name" });
    summary.createSpan({
      text: item.storedOnly
        ? t("labelManager.storedOnly")
        : item.taskCount === 1
          ? t("labelManager.taskCountOne", { count: item.taskCount })
          : t("labelManager.taskCount", { count: item.taskCount }),
      cls: "taskmate-label-manager-count"
    });
    const rename = row.createEl("button", { attr: { "aria-label": t("labelManager.renameAriaLabel", { label: item.label }) } });
    setIcon(rename, "pencil");
    rename.addEventListener("click", () => {
      this.editingLabel = item.label;
      this.renderResults();
    });
    const remove = row.createEl("button", {
      cls: "taskmate-label-manager-delete",
      attr: { "aria-label": t("labelManager.deleteAriaLabel", { label: item.label }) }
    });
    setIcon(remove, "trash-2");
    remove.addEventListener("click", async () => {
      const message = item.storedOnly
        ? t("labelManager.deleteStoredOnlyConfirm", { label: item.label })
        : item.taskCount === 1
          ? t("labelManager.deleteConfirmOne", { label: item.label, count: item.taskCount })
          : t("labelManager.deleteConfirm", { label: item.label, count: item.taskCount });
      if (!window.confirm(message)) return;
      remove.disabled = true;
      try {
        await this.options.onDelete(item.label);
        this.close();
      } finally {
        remove.disabled = false;
      }
    });
  }
}

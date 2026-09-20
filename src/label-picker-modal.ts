import { App, Modal, Notice } from "obsidian";
import type { I18n } from "./i18n";
import type { LabelGroupId } from "./label-picker-model";
import { buildLabelGroups, FAVORITE_LABEL_LIMIT, suggestedLabels, toggleFavoriteLabel } from "./label-picker-model";
import { normalizeLabels } from "./task-input-suggestions";

type PickerTab = "suggested" | "all";

export interface LabelPickerOptions {
  selectedLabels: string[];
  allLabels: string[];
  recentLabels: string[];
  favoriteLabels: string[];
  i18n: I18n;
  onConfirm: (selectedLabels: string[], favoriteLabels: string[]) => Promise<void>;
}

export class LabelPickerModal extends Modal {
  private selectedLabels: string[];
  private favoriteLabels: string[];
  private tab: PickerTab = "suggested";
  private query = "";
  private activeGroup: LabelGroupId | null = null;
  private resultsEl: HTMLElement | null = null;
  private indexEl: HTMLElement | null = null;

  constructor(app: App, private readonly options: LabelPickerOptions) {
    super(app);
    const availableLabels = new Set(normalizeLabels(options.allLabels));
    this.selectedLabels = normalizeLabels(options.selectedLabels).filter((label) => availableLabels.has(label));
    this.favoriteLabels = normalizeLabels(options.favoriteLabels);
    this.setTitle(options.i18n.t("filter.labelPickerTitle"));
  }

  onOpen(): void {
    const { t } = this.options.i18n;
    this.modalEl.addClass("taskmate-label-picker-modal");

    const controls = this.contentEl.createDiv({ cls: "taskmate-label-picker-controls" });
    const search = controls.createEl("input", {
      type: "text",
      cls: "taskmate-label-picker-search",
      placeholder: t("filter.labelSearchPlaceholder"),
      attr: {
        "aria-label": t("filter.labelSearchAriaLabel"),
        "inputmode": "search",
        "enterkeyhint": "search"
      }
    });
    let composing = false;
    search.addEventListener("compositionstart", () => { composing = true; });
    search.addEventListener("compositionend", () => {
      composing = false;
      this.query = search.value;
      this.renderPicker();
    });
    search.addEventListener("input", (event) => {
      this.query = search.value;
      if (composing || (event as InputEvent).isComposing) return;
      this.renderPicker();
    });

    const tabs = controls.createDiv({ cls: "taskmate-label-picker-tabs", attr: { role: "tablist" } });
    (["suggested", "all"] as PickerTab[]).forEach((tab) => {
      const button = tabs.createEl("button", {
        text: t(tab === "suggested" ? "filter.suggestedLabelsTab" : "filter.allLabelsTab"),
        attr: { role: "tab" }
      });
      button.addEventListener("click", () => {
        this.tab = tab;
        this.renderPicker();
      });
    });
    this.indexEl = controls.createDiv({ cls: "taskmate-label-picker-index" });
    this.resultsEl = this.contentEl.createDiv({ cls: "taskmate-label-picker-results" });
    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions taskmate-label-picker-actions" });
    const cancel = actions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const confirm = actions.createEl("button", { text: t("filter.confirmLabelSelection"), cls: "mod-cta" });
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      try {
        await this.options.onConfirm([...this.selectedLabels], [...this.favoriteLabels]);
        this.close();
      } finally {
        confirm.disabled = false;
      }
    });
    this.renderPicker();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderPicker(): void {
    const { t } = this.options.i18n;
    const tabs = this.contentEl.querySelectorAll<HTMLButtonElement>(".taskmate-label-picker-tabs button");
    tabs.forEach((button, index) => {
      const selected = (index === 0 && this.tab === "suggested") || (index === 1 && this.tab === "all");
      button.toggleClass("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    if (!this.resultsEl || !this.indexEl) return;
    this.resultsEl.empty();
    this.indexEl.empty();
    this.indexEl.toggleClass("is-hidden", this.tab !== "all");

    if (this.tab === "suggested") {
      const suggested = suggestedLabels(this.options.allLabels, this.favoriteLabels, this.options.recentLabels);
      const needle = this.query.trim().toLocaleLowerCase(this.options.i18n.locale);
      const favorites = suggested.favorites.filter((label) => label.toLocaleLowerCase(this.options.i18n.locale).includes(needle));
      const recent = suggested.recent.filter((label) => label.toLocaleLowerCase(this.options.i18n.locale).includes(needle));
      this.renderSection(t("filter.favoriteLabels"), favorites);
      this.renderSection(t("filter.recentLabels"), recent);
      if (favorites.length === 0 && recent.length === 0) this.renderEmpty();
      return;
    }

    const groups = buildLabelGroups(this.options.allLabels, this.query, this.options.i18n.locale);
    if (!groups.some((group) => group.id === this.activeGroup)) this.activeGroup = groups[0]?.id ?? null;
    this.indexEl.setAttribute("aria-label", t("filter.labelIndexAriaLabel"));
    groups.forEach((group) => {
      const active = group.id === this.activeGroup;
      const button = this.indexEl?.createEl("button", {
        text: this.groupLabel(group.id),
        cls: active ? "is-active" : "",
        attr: { "aria-pressed": String(active) }
      });
      button?.addEventListener("click", () => {
        this.activeGroup = group.id;
        this.renderPicker();
      });
    });
    const active = groups.find((group) => group.id === this.activeGroup);
    if (!active) {
      this.renderEmpty();
      return;
    }
    this.resultsEl.createEl("h3", { text: this.groupLabel(active.id) });
    active.labels.forEach((label) => this.renderLabelRow(label));
  }

  private renderSection(title: string, labels: string[]): void {
    if (!this.resultsEl || labels.length === 0) return;
    const section = this.resultsEl.createDiv({ cls: "taskmate-label-picker-section" });
    section.createEl("h3", { text: title });
    labels.forEach((label) => this.renderLabelRow(label, section));
  }

  private renderLabelRow(label: string, container = this.resultsEl): void {
    if (!container) return;
    const { t } = this.options.i18n;
    const selected = this.selectedLabels.includes(label);
    const favorite = this.favoriteLabels.includes(label);
    const row = container.createDiv({ cls: "taskmate-label-picker-row" });
    const select = row.createEl("button", {
      cls: `taskmate-label-picker-select${selected ? " is-selected" : ""}`,
      attr: { "aria-pressed": String(selected) }
    });
    if (selected) select.createSpan({ text: "✓", cls: "taskmate-label-picker-check", attr: { "aria-hidden": "true" } });
    select.createSpan({ text: label });
    select.addEventListener("click", () => {
      this.selectedLabels = selected
        ? this.selectedLabels.filter((item) => item !== label)
        : [...this.selectedLabels, label].slice(0, 500);
      this.renderPicker();
    });

    const star = row.createEl("button", {
      text: favorite ? "★" : "☆",
      cls: `taskmate-label-picker-favorite${favorite ? " is-favorite" : ""}`,
      attr: {
        "aria-label": t(favorite ? "filter.removeFavoriteAriaLabel" : "filter.addFavoriteAriaLabel", { label }),
        "aria-pressed": String(favorite)
      }
    });
    star.addEventListener("click", () => this.toggleFavorite(label));
  }

  private toggleFavorite(label: string): void {
    const result = toggleFavoriteLabel(this.favoriteLabels, label);
    if (result.atLimit) {
      new Notice(this.options.i18n.t("filter.favoriteLimitNotice", { count: FAVORITE_LABEL_LIMIT }));
      return;
    }
    if (!result.changed) return;
    this.favoriteLabels = result.favorites;
    this.renderPicker();
  }

  private groupLabel(group: LabelGroupId): string {
    const { t } = this.options.i18n;
    if (group.startsWith("latin:")) return group.slice(-1);
    return t(group === "japanese" ? "filter.groupJapanese" : "filter.groupOther");
  }

  private renderEmpty(): void {
    this.resultsEl?.createDiv({ text: this.options.i18n.t("filter.noLabels"), cls: "taskmate-empty" });
  }
}

import { App, Modal, Setting } from "obsidian";
import type { Priority, TaskFilters } from "./domain";
import type { I18n } from "./i18n";
import { normalizeLabels } from "./task-input-suggestions";

export class TaskFilterModal extends Modal {
  private draft: TaskFilters;

  constructor(
    app: App,
    filters: TaskFilters,
    private readonly i18n: I18n,
    private readonly onApply: (filters: TaskFilters) => void
  ) {
    super(app);
    this.draft = { ...filters, priorities: [...filters.priorities], labels: [...filters.labels] };
    this.setTitle(i18n.t("filter.title"));
  }

  onOpen(): void {
    const { t } = this.i18n;
    const priority = new Setting(this.contentEl).setName(t("filter.priority"));
    ([1, 2, 3] as Priority[]).forEach((value) => priority.addButton((button) => {
      const refresh = () => {
        const selected = this.draft.priorities.includes(value);
        button.buttonEl.toggleClass("is-active", selected);
        button.buttonEl.toggleClass("mod-cta", selected);
      };
      button.setButtonText(`P${value}`).setTooltip(t("filter.priorityValue", { priority: value })).onClick(() => {
        this.draft.priorities = this.draft.priorities.includes(value)
          ? this.draft.priorities.filter((item) => item !== value)
          : [...this.draft.priorities, value];
        refresh();
      });
      refresh();
    }));

    new Setting(this.contentEl)
      .setName(t("filter.labels"))
      .setDesc(t("filter.labelsDescription"))
      .addText((text) => text
        .setPlaceholder(t("filter.labelsPlaceholder"))
        .setValue(this.draft.labels.join(", "))
        .onChange((value) => {
          this.draft.labels = normalizeLabels(value.split(",")).slice(0, 500);
        }));

    new Setting(this.contentEl)
      .setName(t("filter.completion"))
      .addToggle((toggle) => toggle.setValue(this.draft.includeCompleted).onChange((value) => {
        this.draft.includeCompleted = value;
      }))
      .setDesc(t("filter.includeCompleted"));

    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    const clear = actions.createEl("button", { text: t("filter.clearAll") });
    clear.addEventListener("click", () => {
      this.onApply({ priorities: [], labels: [], search: "", includeCompleted: false });
      this.close();
    });
    const apply = actions.createEl("button", { text: t("filter.apply"), cls: "mod-cta" });
    apply.addEventListener("click", () => {
      this.onApply(this.draft);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

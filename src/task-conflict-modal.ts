import { App, Modal } from "obsidian";
import type { Project } from "./domain";
import type { I18n, TranslationKey } from "./i18n";
import type { EditableTaskField, TaskConflictChoice } from "./task-edit-merge";
import type { TaskSaveConflict } from "./repository";

const FIELD_LABEL_KEYS = {
  title: "taskModal.title",
  date: "taskModal.date",
  priority: "taskModal.priority",
  labels: "taskModal.labels",
  projectId: "taskModal.project",
  steps: "taskModal.steps",
  notes: "taskModal.notes",
  sourceNote: "conflict.sourceNote"
} satisfies Record<EditableTaskField, TranslationKey>;

export class TaskConflictModal extends Modal {
  private readonly choices: Partial<Record<EditableTaskField, TaskConflictChoice>> = {};

  constructor(
    app: App,
    private readonly conflict: TaskSaveConflict,
    private readonly projects: Project[],
    private readonly i18n: I18n,
    private readonly onResolve: (
      choices: Partial<Record<EditableTaskField, TaskConflictChoice>>
    ) => Promise<boolean>
  ) {
    super(app);
    for (const item of conflict.comparison.conflicts) this.choices[item.field] = "current";
    this.setTitle(i18n.t("conflict.title"));
  }

  onOpen(): void {
    const { t } = this.i18n;
    this.modalEl.addClass("taskmate-conflict-modal");
    this.contentEl.createEl("p", { text: t("conflict.description"), cls: "taskmate-conflict-description" });

    const list = this.contentEl.createDiv({ cls: "taskmate-conflict-list" });
    this.conflict.comparison.conflicts.forEach((conflict, index) => {
      const section = list.createEl("fieldset", { cls: "taskmate-conflict-field" });
      section.createEl("legend", { text: t(FIELD_LABEL_KEYS[conflict.field]) });
      const radioName = `taskmate-conflict-${Date.now()}-${index}`;
      this.renderChoice(
        section,
        radioName,
        conflict.field,
        "current",
        t("conflict.currentValue"),
        this.formatValue(conflict.field, conflict.currentValue),
        true
      );
      this.renderChoice(
        section,
        radioName,
        conflict.field,
        "draft",
        t("conflict.draftValue"),
        this.formatValue(conflict.field, conflict.draftValue),
        false
      );
    });

    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions taskmate-conflict-actions" });
    const cancel = actions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const save = actions.createEl("button", { text: t("conflict.saveResolved"), cls: "mod-cta" });
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        if (await this.onResolve({ ...this.choices })) this.close();
      } finally {
        save.disabled = false;
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderChoice(
    container: HTMLElement,
    radioName: string,
    field: EditableTaskField,
    choice: TaskConflictChoice,
    heading: string,
    value: string,
    checked: boolean
  ): void {
    const label = container.createEl("label", { cls: "taskmate-conflict-choice" });
    const radio = label.createEl("input", { type: "radio", attr: { name: radioName, value: choice } });
    radio.checked = checked;
    radio.addEventListener("change", () => {
      if (radio.checked) this.choices[field] = choice;
    });
    const text = label.createDiv();
    text.createDiv({ text: heading, cls: "taskmate-conflict-choice-heading" });
    text.createDiv({ text: value, cls: "taskmate-conflict-choice-value" });
  }

  private formatValue(field: EditableTaskField, value: unknown): string {
    if (field === "projectId" && typeof value === "string") {
      return this.projects.find((project) => project.id === value)?.name ?? value;
    }
    if (field === "priority" && typeof value === "number") {
      return this.i18n.t("filter.priorityValue", { priority: value });
    }
    if (field === "steps" && Array.isArray(value)) {
      return value.length > 0 ? value.map((step) => {
        const item = step as { text?: string; completed?: boolean; date?: string | null };
        return `${item.completed ? "[x]" : "[ ]"} ${item.text ?? ""}${item.date ? ` (${item.date})` : ""}`;
      }).join("\n") : this.i18n.t("conflict.none");
    }
    if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : this.i18n.t("conflict.none");
    if (value === null || value === undefined || value === "") return this.i18n.t("conflict.none");
    return String(value);
  }
}

import { App, Modal, Setting } from "obsidian";
import type { Priority, Project } from "./domain";
import type { I18n } from "./i18n";
import { normalizeLabels } from "./task-input-suggestions";

export interface BulkTaskChanges {
  date?: string | null;
  projectId?: string | null;
  priority?: Priority | null;
  addLabels: string[];
  removeLabels: string[];
}

export class BulkTaskModal extends Modal {
  private changes: BulkTaskChanges = { addLabels: [], removeLabels: [] };

  constructor(
    app: App,
    private readonly count: number,
    private readonly projects: Project[],
    private readonly i18n: I18n,
    private readonly onApply: (changes: BulkTaskChanges) => Promise<void>
  ) {
    super(app);
    this.setTitle(i18n.t("bulk.title", { count }));
  }

  onOpen(): void {
    const { t } = this.i18n;
    const date = new Setting(this.contentEl).setName(t("taskModal.date"));
    let dateInput: HTMLInputElement | null = null;
    date.addDropdown((dropdown) => dropdown
      .addOption("unchanged", t("bulk.unchanged"))
      .addOption("clear", t("date.none"))
      .addOption("set", t("bulk.setValue"))
      .onChange((value) => {
        if (value === "unchanged") delete this.changes.date;
        else if (value === "clear") this.changes.date = null;
        else this.changes.date = dateInput?.value || null;
        if (dateInput) dateInput.disabled = value !== "set";
      }));
    date.addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.disabled = true;
      dateInput = text.inputEl;
      text.onChange((value) => {
        if (!text.inputEl.disabled) this.changes.date = value || null;
      });
    });

    new Setting(this.contentEl).setName(t("taskModal.project")).addDropdown((dropdown) => {
      dropdown.addOption("unchanged", t("bulk.unchanged")).addOption("clear", t("taskModal.unassigned"));
      this.projects.forEach((project) => dropdown.addOption(project.id, project.name));
      dropdown.onChange((value) => {
        if (value === "unchanged") delete this.changes.projectId;
        else this.changes.projectId = value === "clear" ? null : value;
      });
    });

    new Setting(this.contentEl).setName(t("taskModal.priority")).addDropdown((dropdown) => dropdown
      .addOption("unchanged", t("bulk.unchanged"))
      .addOption("clear", t("taskModal.noPriority"))
      .addOption("1", t("filter.priorityValue", { priority: 1 }))
      .addOption("2", t("filter.priorityValue", { priority: 2 }))
      .addOption("3", t("filter.priorityValue", { priority: 3 }))
      .onChange((value) => {
        if (value === "unchanged") delete this.changes.priority;
        else this.changes.priority = value === "clear" ? null : Number(value) as Priority;
      }));

    new Setting(this.contentEl).setName(t("bulk.addLabels")).addText((text) => text.onChange((value) => {
      this.changes.addLabels = normalizeLabels(value.split(",")).slice(0, 500);
    }));
    new Setting(this.contentEl).setName(t("bulk.removeLabels")).addText((text) => text.onChange((value) => {
      this.changes.removeLabels = normalizeLabels(value.split(",")).slice(0, 500);
    }));

    const actions = this.contentEl.createDiv({ cls: "taskmate-modal-actions" });
    const cancel = actions.createEl("button", { text: t("common.cancel") });
    cancel.addEventListener("click", () => this.close());
    const apply = actions.createEl("button", { text: t("bulk.apply", { count: this.count }), cls: "mod-cta" });
    apply.addEventListener("click", async () => {
      apply.disabled = true;
      try {
        await this.onApply(this.changes);
        this.close();
      } finally {
        apply.disabled = false;
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

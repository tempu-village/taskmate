import { App, PluginSettingTab, Setting } from "obsidian";
import type TaskMatePlugin from "./main";

export interface TaskMateSettings {
  taskFolder: string;
  projectFolder: string;
  proposalFolder: string;
  sourceFolders: string[];
  includeSourceSubfolders: boolean;
  recentSearches: string[];
  recentLabels: string[];
  favoriteLabels: string[];
}

export const DEFAULT_SETTINGS: TaskMateSettings = {
  taskFolder: "TaskMate/Tasks",
  projectFolder: "TaskMate/Projects",
  proposalFolder: "TaskMate/Proposals",
  sourceFolders: [],
  includeSourceSubfolders: true,
  recentSearches: [],
  recentLabels: [],
  favoriteLabels: []
};

export class TaskMateSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: TaskMatePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "TaskMate" });

    new Setting(containerEl)
      .setName("Task folder")
      .setDesc("One Markdown file is stored here for each task.")
      .addText((text) => text.setValue(this.plugin.settings.taskFolder).onChange(async (value) => {
        this.plugin.settings.taskFolder = value.trim() || DEFAULT_SETTINGS.taskFolder;
        await this.plugin.saveSettings();
        this.plugin.refreshViews();
      }));

    new Setting(containerEl)
      .setName("Project folder")
      .setDesc("One Markdown file is stored here for each project.")
      .addText((text) => text.setValue(this.plugin.settings.projectFolder).onChange(async (value) => {
        this.plugin.settings.projectFolder = value.trim() || DEFAULT_SETTINGS.projectFolder;
        await this.plugin.saveSettings();
        this.plugin.refreshViews();
      }));

    new Setting(containerEl)
      .setName("Proposal folder")
      .setDesc("AI import proposals are reviewed here before approved items become tasks.")
      .addText((text) => text.setValue(this.plugin.settings.proposalFolder).onChange(async (value) => {
        this.plugin.settings.proposalFolder = value.trim() || DEFAULT_SETTINGS.proposalFolder;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("AI source folders")
      .setDesc("One vault-relative folder per line. Notes inherit inclusion from these folders.")
      .addTextArea((text) => {
        text.inputEl.rows = 6;
        text.inputEl.addClass("taskmate-folder-list");
        text.setValue(this.plugin.settings.sourceFolders.join("\n")).onChange(async (value) => {
          this.plugin.settings.sourceFolders = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Include subfolders")
      .setDesc("Apply every AI source folder rule to its subfolders too.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.includeSourceSubfolders).onChange(async (value) => {
        this.plugin.settings.includeSourceSubfolders = value;
        await this.plugin.saveSettings();
      }));
  }
}

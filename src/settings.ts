import { App, PluginSettingTab, Setting } from "obsidian";
import type TaskMatePlugin from "./main";
import type { LanguagePreference } from "./i18n";

export interface TaskMateSettings {
  language: LanguagePreference;
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
  language: "auto",
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
    const { t } = this.plugin.i18n();
    containerEl.empty();
    containerEl.createEl("h2", { text: "TaskMate" });

    new Setting(containerEl)
      .setName(t("settings.language"))
      .setDesc(t("settings.languageDescription"))
      .addDropdown((dropdown) => dropdown
        .addOption("auto", t("settings.languageAuto"))
        .addOption("en", t("settings.languageEnglish"))
        .addOption("ja", t("settings.languageJapanese"))
        .setValue(this.plugin.settings.language)
        .onChange(async (value) => {
          this.plugin.settings.language = value as LanguagePreference;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
          this.display();
        }));

    new Setting(containerEl)
      .setName(t("settings.taskFolder"))
      .setDesc(t("settings.taskFolderDescription"))
      .addText((text) => text.setValue(this.plugin.settings.taskFolder).onChange(async (value) => {
        this.plugin.settings.taskFolder = value.trim() || DEFAULT_SETTINGS.taskFolder;
        await this.plugin.saveSettings();
        this.plugin.refreshViews();
      }));

    new Setting(containerEl)
      .setName(t("settings.projectFolder"))
      .setDesc(t("settings.projectFolderDescription"))
      .addText((text) => text.setValue(this.plugin.settings.projectFolder).onChange(async (value) => {
        this.plugin.settings.projectFolder = value.trim() || DEFAULT_SETTINGS.projectFolder;
        await this.plugin.saveSettings();
        this.plugin.refreshViews();
      }));

    new Setting(containerEl)
      .setName(t("settings.proposalFolder"))
      .setDesc(t("settings.proposalFolderDescription"))
      .addText((text) => text.setValue(this.plugin.settings.proposalFolder).onChange(async (value) => {
        this.plugin.settings.proposalFolder = value.trim() || DEFAULT_SETTINGS.proposalFolder;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName(t("settings.sourceFolders"))
      .setDesc(t("settings.sourceFoldersDescription"))
      .addTextArea((text) => {
        text.inputEl.rows = 6;
        text.inputEl.addClass("taskmate-folder-list");
        text.setValue(this.plugin.settings.sourceFolders.join("\n")).onChange(async (value) => {
          this.plugin.settings.sourceFolders = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t("settings.includeSubfolders"))
      .setDesc(t("settings.includeSubfoldersDescription"))
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.includeSourceSubfolders).onChange(async (value) => {
        this.plugin.settings.includeSourceSubfolders = value;
        await this.plugin.saveSettings();
      }));
  }
}

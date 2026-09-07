import { App, PluginSettingTab, Setting } from "obsidian";
import type BennrinaTodoPlugin from "./main";

export interface BennrinaTodoSettings {
  taskFolder: string;
  sourceFolders: string[];
  includeSourceSubfolders: boolean;
}

export const DEFAULT_SETTINGS: BennrinaTodoSettings = {
  taskFolder: "TaskMate/Tasks",
  sourceFolders: [],
  includeSourceSubfolders: true
};

export class BennrinaTodoSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: BennrinaTodoPlugin) {
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

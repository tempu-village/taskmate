import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  fileURLToPath(new URL("../styles.css", import.meta.url)),
  "utf8"
);
const viewSource = readFileSync(
  fileURLToPath(new URL("../src/view.ts", import.meta.url)),
  "utf8"
);
const taskModalSource = readFileSync(
  fileURLToPath(new URL("../src/task-modal.ts", import.meta.url)),
  "utf8"
);
const keyboardLayoutSource = readFileSync(
  fileURLToPath(new URL("../src/mobile-keyboard-layout.ts", import.meta.url)),
  "utf8"
);
const labelPickerModalSource = readFileSync(
  fileURLToPath(new URL("../src/label-picker-modal.ts", import.meta.url)),
  "utf8"
);
const labelManagerModalSource = readFileSync(
  fileURLToPath(new URL("../src/label-manager-modal.ts", import.meta.url)),
  "utf8"
);

function declarations(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesheet.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `${selector} must have a CSS rule`).not.toBeNull();
  return match?.[1] ?? "";
}

function exactDeclarations(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesheet.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, "m"));
  expect(match, `${selector} must have an exact CSS rule`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("mobile layout", () => {
  it("keeps navigation outside the scrollable screen body", () => {
    const view = declarations(".taskmate-view");
    const page = declarations(".taskmate-page");
    const content = declarations(".taskmate-content");
    const navigation = declarations(".taskmate-navigation");

    expect(view).toMatch(/display\s*:\s*flex\s*;/);
    expect(view).toMatch(/flex-direction\s*:\s*column\s*;/);
    expect(view).toMatch(/padding\s*:\s*0\s*!important\s*;/);
    expect(page).toMatch(/display\s*:\s*flex\s*;/);
    expect(page).toMatch(/flex\s*:\s*1\s+1\s+auto\s*;/);
    expect(page).toMatch(/min-height\s*:\s*0\s*;/);
    expect(page).toMatch(/height\s*:\s*auto\s*;/);
    expect(page).not.toMatch(/height\s*:\s*100%\s*;/);
    expect(page).toMatch(/overflow\s*:\s*hidden\s*;/);
    expect(content).toMatch(/flex\s*:\s*1\s+1\s+auto\s*;/);
    expect(content).toMatch(/overflow(?:-y)?\s*:\s*auto\s*;/);
    expect(navigation).toMatch(/position\s*:\s*static\s*;/);
  });

  it("allows translated modal actions to wrap", () => {
    expect(declarations(".taskmate-modal-actions")).toMatch(/flex-wrap\s*:\s*wrap\s*;/);
  });

  it("keeps search controls outside the keyboard-sensitive results scroller", () => {
    const renderMethod = viewSource.slice(
      viewSource.indexOf("private async render"),
      viewSource.indexOf("private renderHeader")
    );
    const searchScreen = viewSource.slice(
      viewSource.indexOf("private renderSearchScreen"),
      viewSource.indexOf("private renderProjectsScreen")
    );

    expect(renderMethod).toContain('this.renderSearchScreen(page, tasks, projects)');
    expect(searchScreen).toContain('createDiv({ cls: "taskmate-search-controls" })');
    expect(searchScreen).toContain('addEventListener("compositionstart"');
    expect(searchScreen).toContain('addEventListener("compositionend"');
    expect(searchScreen).toContain("renderSearchResults");
    expect(searchScreen).not.toContain("scheduleRender");

    const controls = declarations(".taskmate-search-controls");
    const results = declarations(".taskmate-search-results");
    expect(controls).toMatch(/flex\s*:\s*0\s+0\s+auto\s*;/);
    expect(results).toMatch(/flex\s*:\s*1\s+1\s+auto\s*;/);
    expect(results).toMatch(/min-height\s*:\s*0\s*;/);
    expect(results).toMatch(/overflow-y\s*:\s*auto\s*;/);
  });

  it("keeps date controls outside the result scroller and moves filters to a modal", () => {
    expect(viewSource).toContain('createDiv({ cls: "taskmate-date-controls" })');
    expect(viewSource).toContain('createDiv({ cls: "taskmate-date-results taskmate-scroll-region" })');
    expect(viewSource).toContain("new TaskFilterModal");
    expect(viewSource).not.toContain('screen: "filter"');

    expect(declarations(".taskmate-date-controls")).toMatch(/flex\s*:\s*0\s+0\s+auto\s*;/);
    const rule = declarations(".taskmate-date-results");
    expect(rule).toMatch(/flex\s*:\s*1\s+1\s+auto\s*;/);
    expect(rule).toMatch(/min-height\s*:\s*0\s*;/);
    expect(rule).toMatch(/overflow-y\s*:\s*auto\s*;/);
  });

  it("wraps long task titles within their task row", () => {
    const title = exactDeclarations(".taskmate-title");
    expect(title).toMatch(/min-width\s*:\s*0\s*;/);
    expect(title).toMatch(/max-width\s*:\s*100%\s*;/);
    expect(title).toMatch(/white-space\s*:\s*normal\s*;/);
    expect(title).toMatch(/overflow-wrap\s*:\s*anywhere\s*;/);
    expect(title).toMatch(/height\s*:\s*auto\s*;/);
    expect(title).toMatch(/appearance\s*:\s*none\s*;/);
    expect(title).toMatch(/border-radius\s*:\s*0\s*!important\s*;/);
    expect(title).toMatch(/overflow\s*:\s*visible\s*;/);
    expect(stylesheet).not.toContain(".taskmate-title-text");
    expect(stylesheet).not.toContain(".taskmate-title-overflow-toggle");
  });

  it("constrains shared task rows to the available list width", () => {
    const list = exactDeclarations(".taskmate-list");
    expect(list).toMatch(/min-width\s*:\s*0\s*;/);
    expect(list).toMatch(/max-width\s*:\s*100%\s*;/);

    const task = exactDeclarations(".taskmate-task");
    expect(task).toMatch(/min-width\s*:\s*0\s*;/);
    expect(task).toMatch(/max-width\s*:\s*100%\s*;/);
  });

  it("contains accidental horizontal overflow in task scroll regions", () => {
    const scrollRegion = exactDeclarations(".taskmate-scroll-region");
    expect(scrollRegion).toMatch(/min-width\s*:\s*0\s*;/);
    expect(scrollRegion).toMatch(/max-width\s*:\s*100%\s*;/);
    expect(scrollRegion).toMatch(/overflow-x\s*:\s*hidden\s*;/);
  });

  it("offers direct filter clearing only while criteria are active", () => {
    expect(viewSource).toContain('count > 0 ? t("filter.change") : t("filter.title")');
    expect(viewSource).toContain('setTitle(t("filter.clearActive"))');
    expect(viewSource).toContain("if (count > 0)");
    expect(viewSource).toContain("this.filterState.clear()");
  });

  it("preserves task-list scroll position across selection-only renders", () => {
    expect(viewSource).toContain("captureTaskListScrollTop(this.contentEl)");
    expect(viewSource).toContain("restoreTaskListScrollTop(this.contentEl, preservedScrollTop)");

    const selectionAction = viewSource.slice(
      viewSource.indexOf('if (action.type === "toggle-selected")'),
      viewSource.indexOf('if (action.type === "open")')
    );
    expect(selectionAction).toContain("preserveScroll: true");

    const selectionToolbar = viewSource.slice(
      viewSource.indexOf("private renderSelectionToolbar"),
      viewSource.indexOf("private async openFilterModal")
    );
    expect(selectionToolbar).toContain("preserveScroll: true");
  });

  it("avoids Android WebView's native search-input focus behavior", () => {
    expect(viewSource).not.toMatch(/\btype:\s*"search",/);
    expect(viewSource.match(/"inputmode": "search"/g)).toHaveLength(1);
    expect(viewSource.match(/"enterkeyhint": "search"/g)).toHaveLength(1);
  });

  it("keeps task modal actions outside the scrollable fields", () => {
    expect(taskModalSource).toContain('contentEl.createDiv({ cls: "taskmate-task-fields" })');
    expect(taskModalSource).toContain('contentEl.createDiv({ cls: "taskmate-modal-actions" })');
    expect(taskModalSource).toContain("new MobileKeyboardScroller(");
    expect(taskModalSource).toContain("this.baselineAvailableHeight");
    expect(taskModalSource).toContain("this.keyboardScroller?.disconnect()");

    const fields = declarations(".taskmate-task-fields");
    expect(fields).toMatch(/flex\s*:\s*1\s+1\s+auto\s*;/);
    expect(fields).toMatch(/min-height\s*:\s*0\s*;/);
    expect(fields).toMatch(/overflow-y\s*:\s*auto\s*;/);
    expect(fields).toContain("--taskmate-keyboard-clearance");

    const modalContent = declarations(".taskmate-task-modal .modal-content");
    expect(modalContent).toMatch(/display\s*:\s*flex\s*;/);
    expect(modalContent).toMatch(/flex-direction\s*:\s*column\s*;/);
    expect(modalContent).toMatch(/overflow\s*:\s*hidden\s*;/);
  });

  it("fits the entire task modal inside the host region above the keyboard", () => {
    expect(taskModalSource).toContain("availableRegion: HTMLElement");
    expect(keyboardLayoutSource).toContain("private readonly modal: HTMLElement");
    expect(keyboardLayoutSource).toContain("private readonly availableRegion: HTMLElement");
    expect(keyboardLayoutSource).toContain('"--taskmate-modal-available-height"');
    expect(keyboardLayoutSource).toContain('"--taskmate-modal-shift"');

    const modal = declarations(".taskmate-task-modal");
    expect(modal).toMatch(/display\s*:\s*flex\s*;/);
    expect(modal).toMatch(/max-height\s*:\s*var\(--taskmate-modal-available-height/);
    expect(modal).toContain("--taskmate-modal-shift");
    expect(declarations(".taskmate-task-modal .modal-content")).toMatch(/min-height\s*:\s*0\s*;/);
  });

  it("shows four compact date presets in one row", () => {
    expect(taskModalSource).not.toContain("shortDate(");
    expect(taskModalSource).not.toContain("taskmate-suggestion-detail");

    const presets = declarations(".taskmate-date-presets");
    expect(presets).toMatch(/display\s*:\s*grid\s*;/);
    expect(presets).toMatch(/grid-template-columns\s*:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)\s*;/);
  });

  it("uses one-row sort buttons with direction inside the active button", () => {
    expect(viewSource).not.toContain('controls.createEl("select"');
    expect(viewSource).toContain('createDiv({ cls: "taskmate-sort-options"');
    expect(viewSource).toContain('cls: "taskmate-sort-direction"');
    expect(viewSource).toContain('mode === this.sortMode && mode !== "manual"');

    const options = declarations(".taskmate-sort-options");
    expect(options).toMatch(/display\s*:\s*grid\s*;/);
    expect(options).toMatch(/grid-template-columns\s*:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)\s*;/);
  });

  it("gives title and notes the full modal width", () => {
    expect(taskModalSource).toContain('addClass("taskmate-title-setting")');
    expect(taskModalSource).toContain('addClass("taskmate-notes-setting")');
    expect(taskModalSource).toContain("titleSetting.addTextArea");
    expect(taskModalSource).toContain('event.key === "Enter"');
    const title = declarations(".taskmate-title-setting textarea");
    expect(title).toMatch(/width\s*:\s*100%\s*;/);
    expect(title).toMatch(/min-height\s*:\s*4\.5rem\s*;/);
    const notes = declarations(".taskmate-notes-setting textarea");
    expect(notes).toMatch(/width\s*:\s*100%\s*;/);
    expect(notes).toMatch(/min-height\s*:\s*9rem\s*;/);
  });

  it("uses compact icon-led task fields without mobile autofocus", () => {
    expect(taskModalSource).toContain('decorateField(titleSetting, "circle-check"');
    expect(taskModalSource).toContain('decorateField(dateSetting, "calendar-days"');
    expect(taskModalSource).toContain('decorateField(projectSetting, "folder"');
    expect(taskModalSource).toContain('decorateField(prioritySetting, "flag"');
    expect(taskModalSource).toContain('decorateField(labelSetting, "tags"');
    expect(taskModalSource).toContain('decorateField(notesSetting, "notebook-pen"');
    expect(taskModalSource).toContain('addClass("taskmate-embedded-select")');
    expect(taskModalSource).toContain('window.matchMedia("(max-width: 700px)").matches');

    expect(declarations(".taskmate-compact-setting")).toMatch(/display\s*:\s*grid\s*;/);
    expect(declarations(".taskmate-compact-setting .setting-item-info")).toMatch(/display\s*:\s*none\s*;/);
    expect(declarations(".taskmate-embedded-field-label")).toMatch(/position\s*:\s*absolute\s*;/);
  });

  it("uses continuous chip entry beside the shared indexed label picker", () => {
    expect(taskModalSource).toContain("new LabelPickerModal(this.app");
    expect(taskModalSource).toContain("preserveUnavailableSelectedLabels: true");
    expect(taskModalSource).toContain('text: t("taskModal.addLabel")');
    expect(taskModalSource).toContain('text: t("taskModal.chooseLabels")');
    expect(taskModalSource).toContain('addEventListener("compositionstart"');
    expect(taskModalSource).toContain('addEventListener("compositionend"');
    expect(taskModalSource).toContain("event.isComposing");
    expect(taskModalSource).toContain('addEventListener("input"');
    expect(taskModalSource).toContain('addEventListener("keydown"');
    expect(taskModalSource).toContain('addEventListener("pointerdown"');
    expect(taskModalSource).toContain("updateFromInput(true, true)");
    expect(taskModalSource).toContain("updateFromInput(true, false)");
    expect(taskModalSource).toContain('createDiv({ cls: "taskmate-label-entry-row" })');
    expect(taskModalSource).toContain('const addLabel = labelEntryRow.createEl("button"');
    expect(taskModalSource).not.toContain('event.key === "Backspace"');
    expect(taskModalSource).not.toContain("recentLabelSuggestions");
    expect(taskModalSource).not.toContain("taskmate-recent-labels");
    expect(viewSource).toContain("this.taskModalLabelOptions(tasks)");
    expect(viewSource).toContain("availableFilterLabels(tasks, true)");

    const controls = declarations(".taskmate-label-setting .setting-item-control");
    expect(controls).toMatch(/display\s*:\s*grid\s*;/);
    expect(controls).toMatch(/grid-template-columns\s*:\s*minmax\(0,\s*1fr\)\s+auto\s*;/);
    const entryRow = declarations(".taskmate-label-entry-row");
    expect(entryRow).toMatch(/display\s*:\s*grid\s*;/);
    expect(entryRow).toMatch(/grid-template-columns\s*:\s*minmax\(0,\s*1fr\)\s+auto\s*;/);
    expect(stylesheet).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.taskmate-label-setting \.setting-item-control\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);\s*\}/
    );
    expect(stylesheet).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.taskmate-editor-label-picker-open\s*\{\s*width:\s*100%;\s*\}/
    );
    expect(declarations(".taskmate-label-chip-editor")).toMatch(/flex-wrap\s*:\s*wrap\s*;/);
    expect(declarations(".taskmate-label-add")).toMatch(/min-height\s*:\s*44px\s*;/);
    expect(declarations(".taskmate-editor-label-picker-open")).toMatch(/min-height\s*:\s*44px\s*;/);
  });

  it("keeps the label index outside the scrollable label results", () => {
    expect(labelPickerModalSource).toContain('this.indexEl = controls.createDiv({ cls: "taskmate-label-picker-index" })');
    expect(labelPickerModalSource).toContain('this.resultsEl = this.contentEl.createDiv({ cls: "taskmate-label-picker-results" })');
    expect(labelPickerModalSource).not.toContain("position: sticky");

    const modal = declarations(".taskmate-label-picker-modal .modal-content");
    expect(modal).toMatch(/display\s*:\s*flex\s*;/);
    expect(modal).toMatch(/overflow\s*:\s*hidden\s*;/);
    const results = declarations(".taskmate-label-picker-results");
    expect(results).toMatch(/flex\s*:\s*1\s+1\s+auto\s*;/);
    expect(results).toMatch(/min-height\s*:\s*0\s*;/);
    expect(results).toMatch(/overflow-y\s*:\s*auto\s*;/);
  });

  it("separates label selection from the favorite star and exposes selected state", () => {
    expect(labelPickerModalSource).toContain('cls: `taskmate-label-picker-select${selected ? " is-selected" : ""}`');
    expect(labelPickerModalSource).toContain('text: favorite ? "★" : "☆"');
    expect(labelPickerModalSource).toContain('attr: { "aria-pressed": String(selected) }');
    expect(labelPickerModalSource).toContain('text: "✓"');
    expect(labelPickerModalSource).toContain('star.addEventListener("click", () => this.toggleFavorite(label))');
  });

  it("keeps label-picker changes in a draft until explicit confirmation", () => {
    expect(labelPickerModalSource).toContain('text: t("filter.confirmLabelSelection")');
    expect(labelPickerModalSource).toContain('await this.options.onConfirm([...this.selectedLabels], [...this.favoriteLabels])');
    expect(labelPickerModalSource).not.toContain("onSelectionChange");
    expect(labelPickerModalSource).not.toContain("onFavoritesChange");

    const actions = declarations(".taskmate-label-picker-actions");
    expect(actions).toMatch(/flex\s*:\s*0\s+0\s+auto\s*;/);
  });

  it("keeps label management results scrollable and uses mobile-sized actions", () => {
    expect(viewSource).toContain('setTitle(t("labelManager.menu"))');
    expect(labelManagerModalSource).toContain('this.modalEl.addClass("taskmate-label-manager-modal")');
    const modal = declarations(".taskmate-label-manager-modal .modal-content");
    expect(modal).toMatch(/display\s*:\s*flex\s*;/);
    expect(modal).toMatch(/overflow\s*:\s*hidden\s*;/);
    const results = declarations(".taskmate-label-manager-results");
    expect(results).toMatch(/flex\s*:\s*1\s+1\s+auto\s*;/);
    expect(results).toMatch(/overflow-y\s*:\s*auto\s*;/);
  });

  it("uses a click-or-tap label overflow summary in rows and the editor", () => {
    expect(taskModalSource).toContain("taskmate-editor-label-summary taskmate-label-chip-editor");
    expect(taskModalSource).toContain('t("tasks.moreLabels", { count: summary.hidden.length })');
    expect(taskModalSource).toContain('"aria-expanded", String(labelsExpanded)');
    expect(declarations(".taskmate-label-chip-editor")).toMatch(/flex-wrap\s*:\s*wrap\s*;/);
  });

  it("keeps the end of phone task lists above Obsidian navigation", () => {
    expect(viewSource).toContain('cls: "taskmate-content taskmate-scroll-region"');
    expect(viewSource).toContain('cls: "taskmate-search-results taskmate-scroll-region"');
    expect(viewSource).toContain('cls: "taskmate-date-results taskmate-scroll-region"');

    const scrollRegion = declarations(".is-phone .taskmate-scroll-region");
    expect(scrollRegion).toMatch(/padding-bottom\s*:\s*max\(/);
    expect(scrollRegion).toContain("--safe-area-inset-bottom");
    expect(scrollRegion).toContain("--mobile-toolbar-height");
    expect(scrollRegion).toMatch(/scroll-padding-bottom\s*:/);
  });
});

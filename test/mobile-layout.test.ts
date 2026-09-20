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

  it("offers direct filter clearing only while criteria are active", () => {
    expect(viewSource).toContain('count > 0 ? t("filter.change") : t("filter.title")');
    expect(viewSource).toContain('setTitle(t("filter.clearActive"))');
    expect(viewSource).toContain("if (count > 0)");
    expect(viewSource).toContain("this.filterState.clear()");
  });

  it("avoids Android WebView's native search-input focus behavior", () => {
    expect(viewSource).not.toMatch(/\btype:\s*"search",/);
    expect(viewSource.match(/"inputmode": "search"/g)).toHaveLength(1);
    expect(viewSource.match(/"enterkeyhint": "search"/g)).toHaveLength(1);
  });

  it("keeps task modal actions outside the scrollable fields", () => {
    expect(taskModalSource).toContain('contentEl.createDiv({ cls: "taskmate-task-fields" })');
    expect(taskModalSource).toContain('contentEl.createDiv({ cls: "taskmate-modal-actions" })');
    expect(taskModalSource).toContain("new MobileKeyboardScroller(fields)");
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
    expect(declarations(".taskmate-title-setting input")).toMatch(/width\s*:\s*100%\s*;/);
    const notes = declarations(".taskmate-notes-setting textarea");
    expect(notes).toMatch(/width\s*:\s*100%\s*;/);
    expect(notes).toMatch(/min-height\s*:\s*9rem\s*;/);
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
    expect(taskModalSource).toContain('cls: "taskmate-editor-label-summary"');
    expect(taskModalSource).toContain('t("tasks.moreLabels", { count: summary.hidden.length })');
    expect(taskModalSource).toContain('"aria-expanded": String(labelsExpanded)');
    expect(declarations(".taskmate-editor-label-summary")).toMatch(/flex-wrap\s*:\s*wrap\s*;/);
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

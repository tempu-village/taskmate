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

    const fields = declarations(".taskmate-task-fields");
    expect(fields).toMatch(/flex\s*:\s*1\s+1\s+auto\s*;/);
    expect(fields).toMatch(/min-height\s*:\s*0\s*;/);
    expect(fields).toMatch(/overflow-y\s*:\s*auto\s*;/);

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

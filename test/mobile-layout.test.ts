import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  fileURLToPath(new URL("../styles.css", import.meta.url)),
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
    const page = declarations(".taskmate-page");
    const content = declarations(".taskmate-content");
    const navigation = declarations(".taskmate-navigation");

    expect(page).toMatch(/display\s*:\s*flex\s*;/);
    expect(page).toMatch(/overflow\s*:\s*hidden\s*;/);
    expect(content).toMatch(/flex\s*:\s*1\s+1\s+auto\s*;/);
    expect(content).toMatch(/overflow(?:-y)?\s*:\s*auto\s*;/);
    expect(navigation).toMatch(/position\s*:\s*static\s*;/);
  });

  it("allows translated modal actions to wrap", () => {
    expect(declarations(".taskmate-modal-actions")).toMatch(/flex-wrap\s*:\s*wrap\s*;/);
  });
});

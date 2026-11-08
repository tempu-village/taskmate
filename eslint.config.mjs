// Mirrors the Obsidian Community scorecard scan of the plugin sources, and keeps E2E specs from touching
// the Vault directly or deleting files (see docs/engineering/design/desktop-e2e.md). Run with `npm run lint`.
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

// The scorecard rules target plugin code; specs get only the E2E rules below.
const scorecardRulesOff = Object.fromEntries(
  obsidianmd.configs.recommended.flatMap((config) => Object.keys(config.rules ?? {})).map((rule) => [rule, "off"])
);
const deletionCall = "^(delete|trash|trashFile|remove|rm|rmSync|rmdir|rmdirSync|unlink|unlinkSync)$";

export default defineConfig([
  { ignores: ["main.js", "node_modules/**", "test/*", "!test/e2e/", "test/e2e/*", "!test/e2e/specs/", "skills/**", "scripts/**", "*.config.*", "wdio.conf.mts"] },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      // Not reported by the scorecard; "TaskMate" is a product name, not sentence-case UI text.
      "obsidianmd/ui/sentence-case": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off"
    }
  },
  {
    // Specs change Vault files only through test/e2e/helpers.ts and never delete files.
    // Strings and comments may still say "delete" or "trash", as UI selectors and setting names do.
    files: ["test/e2e/specs/**/*.ts"],
    languageOptions: { parser: tseslint.parser },
    rules: {
      ...scorecardRulesOff,
      "no-restricted-imports": ["error", {
        paths: ["fs", "node:fs", "fs/promises", "node:fs/promises", "child_process", "node:child_process"]
          .map((name) => ({ name, message: "E2E specs must not touch the file system. Use test/e2e/helpers.ts." }))
      }],
      "no-restricted-syntax": ["error",
        { selector: "MemberExpression[property.name=/^(vault|adapter)$/]", message: "Use test/e2e/helpers.ts instead of app.vault or its adapter." },
        { selector: "ObjectPattern > Property[key.name=/^(vault|adapter)$/]", message: "Use test/e2e/helpers.ts instead of app.vault or its adapter." },
        { selector: `CallExpression[callee.property.name=/${deletionCall}/]`, message: "E2E specs must not delete files; delete through the TaskMate UI." },
        { selector: `CallExpression[callee.name=/${deletionCall}/]`, message: "E2E specs must not delete files; delete through the TaskMate UI." }
      ]
    }
  }
]);

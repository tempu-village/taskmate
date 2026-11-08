// Mirrors the Obsidian Community scorecard scan of the plugin sources. Run with `npm run lint`.
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  { ignores: ["main.js", "node_modules/**", "test/**", "skills/**", "scripts/**", "*.config.*", "wdio.conf.mts"] },
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
  }
]);

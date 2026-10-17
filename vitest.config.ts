import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL("./test/obsidian-stub.ts", import.meta.url))
    }
  },
  test: {
    // Local agent worktrees live inside the checkout; keep their copies of the tests out.
    exclude: [...configDefaults.exclude, ".claude/**", ".codex/**", ".worktrees/**"]
  }
});

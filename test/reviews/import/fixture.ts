import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve with node:path: under jsdom, `new URL(path, import.meta.url)` does not keep the file: scheme.
const SPECIFICATION_FOLDER = resolve(dirname(fileURLToPath(import.meta.url)), "../../../docs/engineering/specifications");
const EXAMPLE_PATH = resolve(SPECIFICATION_FOLDER, "import-review-example.json");
const SCHEMA_PATH = resolve(SPECIFICATION_FOLDER, "import-review.schema.json");

export const NOW = "2026-10-18T09:00:00+09:00";

export function exampleText(): string {
  return readFileSync(EXAMPLE_PATH, "utf8");
}

export function exampleJson(): Record<string, any> {
  return JSON.parse(exampleText());
}

export function schemaJson(): Record<string, unknown> {
  return JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
}

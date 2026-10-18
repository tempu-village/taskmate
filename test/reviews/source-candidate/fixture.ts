import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXAMPLE_PATH = fileURLToPath(new URL("../../../docs/engineering/rfcs/0033-source-candidate-proposal-example.json", import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL("../../../docs/engineering/rfcs/0033-source-candidate-proposal.schema.json", import.meta.url));

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

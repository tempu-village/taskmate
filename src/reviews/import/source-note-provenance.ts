import { sha256 } from "../../shared/sha256";

// Mirrors skills/taskpilot/scripts/todo_store.py (split_document, strip_yaml_keys,
// source_hash, yaml_list and mark_source) so TaskMate and Task Pilot agree on
// Source-note hashes and on the provenance lines they write. Python reads notes
// in text mode, which turns CRLF and CR into LF, so the same happens here first.

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const LINE_BREAK = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/;
const IMPORT_KEYS = new Set(["taskmate-import-status", "taskmate-imported-at", "taskmate-imported-hash", "taskmate-task-ids"]);

export interface SourceNoteProvenance {
  importedAt: string;
  importedHash: string;
  taskIds: string[];
}

export async function sourceNoteHash(text: string): Promise<string> {
  const { lines, body } = splitDocument(universalNewlines(text));
  const stable = withoutImportKeys(lines);
  return sha256(stable.length > 0 ? `---\n${stable.join("\n")}\n---\n${body}` : body);
}

export function importedHash(text: string): string | null {
  const value = topLevelValue(splitDocument(universalNewlines(text)).lines, "taskmate-imported-hash");
  return typeof value === "string" ? value : null;
}

export function withSourceNoteProvenance(text: string, provenance: SourceNoteProvenance): string {
  const { lines, body } = splitDocument(universalNewlines(text));
  const taskIds = [...new Set([...yamlList(lines, "taskmate-task-ids"), ...provenance.taskIds])];
  const next = [
    ...withoutImportKeys(lines),
    `taskmate-import-status: ${JSON.stringify("processed")}`,
    `taskmate-imported-at: ${JSON.stringify(provenance.importedAt)}`,
    `taskmate-imported-hash: ${JSON.stringify(provenance.importedHash)}`,
    "taskmate-task-ids:",
    ...taskIds.map((id) => `  - ${JSON.stringify(id)}`)
  ];
  return `---\n${next.join("\n")}\n---\n${body}`;
}

function universalNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

function splitDocument(text: string): { lines: string[]; body: string } {
  const match = FRONTMATTER.exec(text);
  if (!match) return { lines: [], body: text };
  return { lines: splitLines(match[1]), body: text.slice(match[0].length) };
}

function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split(LINE_BREAK);
  if (lines.at(-1) === "" && LINE_BREAK.test(text.slice(-1))) lines.pop();
  return lines;
}

function isTopLevelKey(line: string): boolean {
  return line.length > 0 && !/^[ \t-]/.test(line) && line.includes(":");
}

function withoutImportKeys(lines: string[]): string[] {
  const output: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (isTopLevelKey(line)) {
      skipping = IMPORT_KEYS.has(line.split(":", 1)[0].trim());
      if (skipping) continue;
    }
    if (skipping && /^[ \t-]/.test(line)) continue;
    skipping = false;
    output.push(line);
  }
  return output;
}

function topLevelValue(lines: string[], key: string): unknown {
  let value: unknown = undefined;
  for (const line of lines) {
    if (!isTopLevelKey(line)) continue;
    const separator = line.indexOf(":");
    if (line.slice(0, separator).trim() === key) value = scalar(line.slice(separator + 1));
  }
  return value;
}

function yamlList(lines: string[], key: string): string[] {
  const result: string[] = [];
  let collecting = false;
  for (const line of lines) {
    if (isTopLevelKey(line)) {
      collecting = line.split(":", 1)[0].trim() === key;
      continue;
    }
    if (collecting && line.trimStart().startsWith("-")) {
      const value = scalar(line.trimStart().slice(1));
      if (typeof value === "string") result.push(value);
    } else if (collecting && line.trim()) {
      break;
    }
  }
  return result;
}

function scalar(raw: string): unknown {
  const value = raw.trim();
  if (!value || value === "null") return null;
  if (value === "true" || value === "false") return value === "true";
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (/^["[{]/.test(value)) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

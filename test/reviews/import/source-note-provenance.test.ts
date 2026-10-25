import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { importedHash, sourceNoteHash, withSourceNoteProvenance } from "../../../src/reviews/import/source-note-provenance";

const SCRIPTS = fileURLToPath(new URL("../../../skills/taskpilot/scripts/", import.meta.url));
const directories: string[] = [];

const NOTES = {
  plain: "# Daily\n\n- Call Alex.\n",
  frontmatter: "---\ntype: meeting-note\nowner: \"Sato\"\ntags:\n  - work\n---\n\n# Sync\n\n- Send the contract.\n",
  crlf: "---\r\ntype: meeting-note\r\n---\r\n\r\n# Sync\r\n\r\n- Send the contract.\r\n",
  cr: "---\rtype: meeting-note\r---\rBody\r",
  provenanceOnly: "---\ntaskmate-import-status: \"processed\"\ntaskmate-imported-at: \"2026-10-01T00:00:00Z\"\ntaskmate-imported-hash: \"old\"\ntaskmate-task-ids:\n  - \"a\"\n---\nBody\n",
  mixed: "---\ntype: note\ntaskmate-imported-hash: \"old\"\ntaskmate-task-ids:\n  - \"a\"\nscenario: x\n---\n日本語の本文\n",
  noClosing: "---\ntype: note\nbody without closing\n",
  unicodeSeparator: "---\ntype: note extra: value\n---\nBody\n"
} as const;

function python(code: string, input: unknown): any {
  const result = spawnSync("python3", ["-c", `import json, sys\nsys.path.insert(0, ${JSON.stringify(SCRIPTS)})\nimport todo_store\ndata = json.loads(sys.stdin.read())\n${code}`], { input: JSON.stringify(input), encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Source-note provenance parity with Task Pilot", () => {
  it("computes the same Source-note hash as Task Pilot reading the note file", async () => {
    const directory = mkdtempSync(join(tmpdir(), "taskmate-provenance-"));
    directories.push(directory);
    for (const [name, note] of Object.entries(NOTES)) writeFileSync(join(directory, `${name}.md`), note);

    const expected = python("import pathlib\nprint(json.dumps({k: todo_store.source_hash(pathlib.Path(data['dir'], k + '.md').read_text(encoding='utf-8')) for k in data['names']}))",
      { dir: directory, names: Object.keys(NOTES) });

    for (const [name, note] of Object.entries(NOTES)) {
      expect(await sourceNoteHash(note), name).toBe(expected[name]);
    }
  });

  it("writes the same provenance lines as todo_store.mark_source", async () => {
    const vault = mkdtempSync(join(tmpdir(), "taskmate-provenance-"));
    directories.push(vault);
    mkdirSync(join(vault, "Notes"));
    for (const [name, note] of Object.entries(NOTES)) {
      if (name === "provenanceOnly" || name === "mixed") continue;
      writeFileSync(join(vault, "Notes", `${name}.md`), note);
      const marked = python("todo_store.mark_source(__import__('pathlib').Path(data['vault']), data['path'], 'processed', data['ids'])\nprint(json.dumps(open(data['file'], encoding='utf-8').read()))",
        { vault, path: `Notes/${name}.md`, ids: ["task-1", "task-2"], file: join(vault, "Notes", `${name}.md`) });
      const importedAt = /taskmate-imported-at: "([^"]+)"/.exec(marked)![1];

      const written = withSourceNoteProvenance(note, { importedAt, importedHash: await sourceNoteHash(note), taskIds: ["task-1", "task-2"] });

      expect(written, name).toBe(marked);
      expect(importedHash(written), name).toBe(await sourceNoteHash(note));
      expect(await sourceNoteHash(written), name).toBe(await sourceNoteHash(note));
    }
  });

  it("keeps existing Task associations and makes Task Pilot see the note as processed", async () => {
    const vault = mkdtempSync(join(tmpdir(), "taskmate-provenance-"));
    directories.push(vault);
    mkdirSync(join(vault, "Notes"));
    mkdirSync(join(vault, ".obsidian", "plugins", "taskmate"), { recursive: true });
    writeFileSync(join(vault, ".obsidian", "plugins", "taskmate", "data.json"), JSON.stringify({ sourceFolders: ["Notes"] }));
    const note = NOTES.mixed;

    const written = withSourceNoteProvenance(note, { importedAt: "2026-10-18T09:00:00.000Z", importedHash: await sourceNoteHash(note), taskIds: ["b", "a"] });
    writeFileSync(join(vault, "Notes", "mixed.md"), written);

    expect(written).toContain("taskmate-task-ids:\n  - \"a\"\n  - \"b\"\n---");
    expect(written).toContain("type: note\nscenario: x\ntaskmate-import-status");
    const sources = python("print(json.dumps(todo_store.source_records(__import__('pathlib').Path(data))))", vault);
    expect(sources).toEqual([{ path: "Notes/mixed.md", state: "processed", hash: await sourceNoteHash(note), taskIds: ["a", "b"] }]);
    expect(readFileSync(join(vault, "Notes", "mixed.md"), "utf8")).toBe(written);
  });
});

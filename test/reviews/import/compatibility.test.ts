import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, SUPPORTED_SCHEMA_VERSIONS, importReviewCompatibility } from "../../../src/reviews/import/proposal";
import { exampleJson, schemaJson } from "./fixture";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SCHEMA_PATH = `${ROOT}docs/engineering/specifications/import-review.schema.json`;

// The Import review Schema each schema version was released with. Task Pilot's staging is refused by any TaskMate that
// does not list the version, so a format change MUST NOT keep its version: raise CURRENT_SCHEMA_VERSION and Task Pilot's
// SCHEMA_VERSION, set MIN_TASKMATE_VERSION to the new plugin version, bump the plugin version, and add the new
// fingerprint here.
const RELEASED_SCHEMAS: Record<number, { sha256: string; minPluginVersion: string }> = {
  2: { sha256: "2f3946672e402ed3b73037160ab019eba9bcfd50d533b4832cba9debe65980f9", minPluginVersion: "0.7.0" }
};

function taskPilotConstants(): { schemaVersion: number; minTaskMateVersion: string } {
  const script = "import json, sys; sys.path.insert(0, sys.argv[1]); import import_review as r; "
    + "print(json.dumps({'schemaVersion': r.SCHEMA_VERSION, 'minTaskMateVersion': r.MIN_TASKMATE_VERSION}))";
  const result = spawnSync("python3", ["-c", script, `${ROOT}skills/taskpilot/scripts`], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

describe("Import review compatibility between Task Pilot and TaskMate", () => {
  const manifestVersion = JSON.parse(readFileSync(`${ROOT}manifest.json`, "utf8")).version as string;
  const released = Object.keys(JSON.parse(readFileSync(`${ROOT}versions.json`, "utf8")));

  it("keeps the writer, the reader, the Schema and the example on one schema version", () => {
    const schema = schemaJson() as { properties: { schemaVersion: { const: number } } };

    expect(taskPilotConstants().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(schema.properties.schemaVersion.const).toBe(CURRENT_SCHEMA_VERSION);
    expect(exampleJson().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(SUPPORTED_SCHEMA_VERSIONS).toContain(CURRENT_SCHEMA_VERSION);
    expect(importReviewCompatibility(manifestVersion)).toEqual({ pluginVersion: manifestVersion, importReviewSchemaVersions: [...SUPPORTED_SCHEMA_VERSIONS] });
  });

  it("fails when the review format changes without a new schema version and plugin version", () => {
    const fingerprint = createHash("sha256").update(readFileSync(SCHEMA_PATH, "utf8").replace(/\r\n/g, "\n")).digest("hex");
    const release = RELEASED_SCHEMAS[CURRENT_SCHEMA_VERSION];

    expect(release, `schema version ${CURRENT_SCHEMA_VERSION} has no released fingerprint`).toBeDefined();
    expect(fingerprint, "the Import review Schema changed: raise the schema and plugin versions (see RELEASED_SCHEMAS)").toBe(release.sha256);
    expect(taskPilotConstants().minTaskMateVersion).toBe(release.minPluginVersion);
    expect(released).toContain(release.minPluginVersion);
    expect(compareVersions(manifestVersion, release.minPluginVersion)).toBeGreaterThanOrEqual(0);
  });
});

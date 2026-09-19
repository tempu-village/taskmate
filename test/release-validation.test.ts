import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const VALIDATOR = join(ROOT, "scripts", "validate-release.mjs");
const BUMP_VERSION = join(ROOT, "scripts", "bump-version.mjs");
const CURRENT_VERSION = JSON.parse(
  readFileSync(join(ROOT, "manifest.json"), "utf8"),
).version as string;
const FILES = [
  "README.md",
  "LICENSE",
  "main.js",
  "manifest.json",
  "styles.css",
  "versions.json",
  "package.json",
  "package-lock.json",
];

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "taskmate-release-"));
  for (const file of FILES) {
    copyFileSync(join(ROOT, file), join(directory, file));
  }
  return directory;
}

function validate(directory: string, tag?: string) {
  const arguments_ = [VALIDATOR, "--root", directory];
  if (tag) arguments_.push("--tag", tag);
  return spawnSync(process.execPath, arguments_, { encoding: "utf8" });
}

describe("release validation", () => {
  it("accepts synchronized release metadata and an exact tag", () => {
    const result = validate(fixture(), CURRENT_VERSION);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      `OK release metadata and assets for ${CURRENT_VERSION}`,
    );
  });

  it("rejects a tag that does not exactly match the manifest version", () => {
    const result = validate(fixture(), `v${CURRENT_VERSION}`);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `release tag v${CURRENT_VERSION} must exactly match manifest.json ${CURRENT_VERSION}`,
    );
  });

  it("rejects version drift in package metadata", () => {
    const directory = fixture();
    const path = join(directory, "package.json");
    const packageJson = JSON.parse(readFileSync(path, "utf8"));
    packageJson.version = "0.0.0";
    writeFileSync(path, `${JSON.stringify(packageJson, null, 2)}\n`);

    const result = validate(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `package.json version 0.0.0 does not match manifest.json ${CURRENT_VERSION}`,
    );
  });

  it("rejects missing or empty release assets", () => {
    const directory = fixture();
    writeFileSync(join(directory, "styles.css"), "");

    const result = validate(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("styles.css must not be empty");
  });

  it("rejects empty or invalid required manifest fields", () => {
    const directory = fixture();
    const path = join(directory, "manifest.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.name = "";
    manifest.author = "   ";
    manifest.minAppVersion = "latest";
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = validate(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("manifest name must be a non-empty string");
    expect(result.stderr).toContain("manifest author must be a non-empty string");
    expect(result.stderr).toContain("manifest minAppVersion must use x.y.z SemVer");
  });

  it("updates every maintained version field with one command", () => {
    const directory = fixture();
    const result = spawnSync(process.execPath, [BUMP_VERSION, "9.8.7"], {
      cwd: directory,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    const manifest = JSON.parse(
      readFileSync(join(directory, "manifest.json"), "utf8"),
    );
    const packageJson = JSON.parse(
      readFileSync(join(directory, "package.json"), "utf8"),
    );
    const packageLock = JSON.parse(
      readFileSync(join(directory, "package-lock.json"), "utf8"),
    );
    const versions = JSON.parse(
      readFileSync(join(directory, "versions.json"), "utf8"),
    );

    expect(packageJson.version).toBe("9.8.7");
    expect(packageLock.version).toBe("9.8.7");
    expect(packageLock.packages[""].version).toBe("9.8.7");
    expect(manifest.version).toBe("9.8.7");
    expect(versions["9.8.7"]).toBe(manifest.minAppVersion);
  });
});

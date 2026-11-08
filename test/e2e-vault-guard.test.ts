import { mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertFixtureVault, assertSandboxPath, E2E_VAULT, FIXTURE_MARKER } from "./e2e/vault-guard";

const scratch = () => mkdtempSync(join(tmpdir(), "taskmate-guard-"));
const vault = (parent: string, name: string, marked = true) => {
  const path = join(parent, name);
  mkdirSync(path, { recursive: true });
  if (marked) writeFileSync(join(path, FIXTURE_MARKER), "");
  return path;
};

describe("E2E fixture Vault guard", () => {
  it("accepts the committed fixture Vault", () => {
    expect(() => assertFixtureVault(E2E_VAULT)).not.toThrow();
  });

  it("rejects a Vault outside the fixture folder", () => {
    const root = vault(scratch(), "vaults", false);
    expect(() => assertFixtureVault(vault(scratch(), "real"), root)).toThrow(/must be inside/);
    expect(() => assertFixtureVault(join(root, "..", "elsewhere"), root)).toThrow();
  });

  it("rejects a symbolic link that leads outside the fixture folder", () => {
    const root = vault(scratch(), "vaults", false);
    symlinkSync(vault(scratch(), "real"), join(root, "link"));
    expect(() => assertFixtureVault(join(root, "link"), root)).toThrow(/must be inside/);
  });

  it("rejects a fixture Vault without the marker", () => {
    const root = vault(scratch(), "vaults", false);
    expect(() => assertFixtureVault(vault(root, "basic", false), root)).toThrow(/marker/);
  });
});

describe("E2E sandbox Vault guard", () => {
  it("accepts a marked copy inside the temporary folder", () => {
    expect(() => assertSandboxPath(vault(scratch(), "copy"), E2E_VAULT)).not.toThrow();
  });

  it("rejects a Vault outside the temporary folder", () => {
    const temp = scratch();
    expect(() => assertSandboxPath(vault(scratch(), "real"), E2E_VAULT, temp)).toThrow(/temporary folder/);
  });

  it("rejects the fixture Vault itself", () => {
    expect(() => assertSandboxPath(E2E_VAULT, E2E_VAULT, resolve("test/e2e"))).toThrow(/fixture itself/);
  });

  it("rejects an unmarked copy", () => {
    expect(() => assertSandboxPath(vault(scratch(), "copy", false), E2E_VAULT)).toThrow(/marker/);
  });
});

// Specs change Vault files only through test/e2e/helpers.ts, which checks the sandbox, and never delete files.
const forbiddenInSpecs: [RegExp, string][] = [
  [/\bapp\s*\.\s*vault\b/, "app.vault"],
  [/\badapter\b/, "adapter"],
  [/["'](node:)?fs(\/promises)?["']/, "node:fs"],
  [/\brm(dir|Sync)?\b/, "rm"],
  [/\bdelete\b/i, "delete"],
  [/\btrash\b/i, "trash"]
];

describe("E2E spec rules", () => {
  const specsDir = resolve("test/e2e/specs");
  const specs = readdirSync(specsDir, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".ts"));

  it("finds the spec files", () => {
    expect(specs.length).toBeGreaterThan(0);
  });

  it.each(specs)("%s does not touch the Vault directly or delete files", (file) => {
    const source = readFileSync(join(specsDir, file), "utf8");
    const found = forbiddenInSpecs.filter(([pattern]) => pattern.test(source)).map(([, name]) => name);
    expect(found).toEqual([]);
  });
});

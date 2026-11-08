import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
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

import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

// Guards that keep E2E runs away from a developer's real Vaults. They use Node only, so Vitest can test them.

export const FIXTURE_MARKER = ".taskmate-e2e-fixture";
export const FIXTURE_VAULTS_ROOT = resolve("test/e2e/vaults");
// Fixed in code on purpose: no environment variable may point the tests at another Vault.
export const E2E_VAULT = "test/e2e/vaults/basic";

const isInside = (child: string, parent: string) => {
  const path = relative(parent, child);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
};

function realpathOrThrow(path: string, label: string): string {
  try {
    return realpathSync(path);
  } catch {
    throw new Error(`${label} does not exist: ${path}`);
  }
}

function assertMarker(vault: string, label: string): void {
  if (!existsSync(join(vault, FIXTURE_MARKER))) throw new Error(`${label} has no ${FIXTURE_MARKER} marker: ${vault}`);
}

/** Checks a Vault named in wdio.conf.mts before Obsidian starts, and returns its resolved path. */
export function assertFixtureVault(vault: string, vaultsRoot = FIXTURE_VAULTS_ROOT): string {
  const root = realpathOrThrow(vaultsRoot, "E2E Vault folder");
  const resolved = realpathOrThrow(resolve(vault), "E2E Vault");
  if (!isInside(resolved, root)) throw new Error(`E2E Vault must be inside ${root}: ${resolved}`);
  assertMarker(resolved, "E2E Vault");
  return resolved;
}

/** Checks that the Vault Obsidian opened is a temporary copy of a fixture Vault, not the fixture or a real Vault. */
export function assertSandboxPath(basePath: string, fixtureVault: string, tempRoot = tmpdir()): void {
  const opened = realpathOrThrow(basePath, "Opened Vault");
  const temp = realpathOrThrow(tempRoot, "Temporary folder");
  if (!isInside(opened, temp)) throw new Error(`Opened Vault is not inside the temporary folder ${temp}: ${opened}`);
  if (opened === realpathOrThrow(fixtureVault, "E2E Vault")) throw new Error(`Opened Vault is the fixture itself: ${opened}`);
  assertMarker(opened, "Opened Vault");
}

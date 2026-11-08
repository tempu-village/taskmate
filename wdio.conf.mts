import * as path from "node:path";
import { env } from "node:process";
import { parseObsidianVersions } from "wdio-obsidian-service";
import { assertFixtureVault, E2E_VAULT } from "./test/e2e/vault-guard";

// Obsidian builds are downloaded here; the service runs them against a sandboxed copy of the vault.
// Stop before Obsidian starts unless the Vault is a marked fixture inside test/e2e/vaults.
assertFixtureVault(E2E_VAULT);

const cacheDir = path.resolve(".obsidian-cache");
const versions = await parseObsidianVersions(env.OBSIDIAN_VERSIONS ?? "latest/latest", { cacheDir });
if (env.CI) {
  // CI uses this line as the Obsidian download cache key.
  console.log("obsidian-cache-key:", JSON.stringify(versions));
}

export const config: WebdriverIO.Config = {
  runner: "local",
  framework: "mocha",
  specs: ["./test/e2e/specs/**/*.e2e.ts"],
  maxInstances: Number(env.WDIO_MAX_INSTANCES || 2),
  capabilities: versions.map<WebdriverIO.Capabilities>(([appVersion, installerVersion]) => ({
    browserName: "obsidian",
    "wdio:obsidianOptions": {
      appVersion,
      installerVersion,
      plugins: ["."],
      vault: E2E_VAULT
    }
  })),
  services: ["obsidian"],
  reporters: ["obsidian"],
  mochaOpts: { ui: "bdd", timeout: 60 * 1000 },
  waitforInterval: 250,
  waitforTimeout: 10 * 1000,
  logLevel: "warn",
  cacheDir,
  injectGlobals: false
};

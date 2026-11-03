import * as path from "node:path";
import { env } from "node:process";
import { parseObsidianVersions } from "wdio-obsidian-service";

// Obsidian builds are downloaded here; the service runs them against a sandboxed copy of the vault.
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
      vault: "test/e2e/vaults/basic"
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

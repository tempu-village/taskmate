import { assertSandboxPath, E2E_VAULT } from "./vault-guard";

/** Fails unless the Vault open in this Obsidian session is a temporary copy of the fixture. wdio.conf.mts calls it once per spec file. */
export async function assertSandboxVault(browser: WebdriverIO.Browser): Promise<void> {
  const basePath = await browser.executeObsidian(({ app }) => (app.vault.adapter as unknown as { getBasePath(): string }).getBasePath());
  assertSandboxPath(basePath, E2E_VAULT);
}

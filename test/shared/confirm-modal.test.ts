/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

const opened = vi.hoisted(() => [] as Array<{ close(): void }>);

vi.mock("obsidian", () => ({
  Modal: class {
    readonly contentEl = document.createElement("div");
    constructor(readonly app: unknown) {
      opened.push(this);
    }
    open(): void {
      document.body.append(this.contentEl);
      (this as unknown as { onOpen(): void }).onOpen();
    }
    close(): void {
      this.contentEl.remove();
      (this as unknown as { onClose(): void }).onClose();
    }
  }
}));

const { confirmAction } = await import("../../src/shared/confirm-modal");

const options = { message: "Delete it?", confirmText: "Delete", cancelText: "Cancel" };
const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".taskmate-modal-actions button"));

describe("confirmAction", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("shows the message with Cancel and a warning-styled confirm button", () => {
    void confirmAction({} as never, options);
    expect(document.body.textContent).toContain("Delete it?");
    expect(buttons().map((button) => [button.textContent, button.classList.contains("mod-warning")]))
      .toEqual([["Cancel", false], ["Delete", true]]);
  });

  it("focuses Cancel when it opens", () => {
    vi.useFakeTimers();
    void confirmAction({} as never, options);
    vi.runAllTimers();
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it("resolves true only when confirmed", async () => {
    const confirmed = confirmAction({} as never, options);
    buttons()[1].click();
    await expect(confirmed).resolves.toBe(true);
  });

  it("resolves false on Cancel", async () => {
    const cancelled = confirmAction({} as never, options);
    buttons()[0].click();
    await expect(cancelled).resolves.toBe(false);
  });

  it("resolves false when closed without a choice, as Obsidian does on Escape", async () => {
    const closed = confirmAction({} as never, options);
    opened.at(-1)!.close();
    await expect(closed).resolves.toBe(false);
  });
});

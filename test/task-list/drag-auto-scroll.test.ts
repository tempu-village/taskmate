import { describe, expect, it } from "vitest";
import { calculateDragAutoScroll, pointerClientY } from "../../src/task-list/drag-auto-scroll";

const bounds = { top: 100, bottom: 700, height: 600 };

describe("drag auto-scroll", () => {
  it("uses a touch-sized responsive activation zone", () => {
    expect(calculateDragAutoScroll({ bounds: { top: 0, bottom: 300, height: 300 }, pointerY: 100, elapsedMs: 16, scrollTop: 1, maximumScrollTop: 100 }).zone).toBe(90);
    expect(calculateDragAutoScroll({ bounds, pointerY: 400, elapsedMs: 16, scrollTop: 1, maximumScrollTop: 100 }).zone).toBe(180);
    expect(calculateDragAutoScroll({ bounds: { top: 0, bottom: 1000, height: 1000 }, pointerY: 500, elapsedMs: 16, scrollTop: 1, maximumScrollTop: 100 }).zone).toBe(192);
  });

  it("does not scroll in the neutral region or at the activation boundary", () => {
    expect(calculateDragAutoScroll({ bounds, pointerY: 400, elapsedMs: 16, scrollTop: 100, maximumScrollTop: 500 }).delta).toBe(0);
    expect(calculateDragAutoScroll({ bounds, pointerY: 280, elapsedMs: 16, scrollTop: 100, maximumScrollTop: 500 }).delta).toBe(0);
    expect(calculateDragAutoScroll({ bounds, pointerY: 520, elapsedMs: 16, scrollTop: 100, maximumScrollTop: 500 }).delta).toBe(0);
  });

  it("scrolls upward at the top and downward at the bottom", () => {
    expect(calculateDragAutoScroll({ bounds, pointerY: 145, elapsedMs: 16, scrollTop: 100, maximumScrollTop: 500 }).delta).toBeLessThan(0);
    expect(calculateDragAutoScroll({ bounds, pointerY: 655, elapsedMs: 16, scrollTop: 100, maximumScrollTop: 500 }).delta).toBeGreaterThan(0);
  });

  it("starts at the entry speed without a dead band inside the zone", () => {
    const input = { bounds, elapsedMs: 1000, scrollTop: 100, maximumScrollTop: 500 };
    expect(calculateDragAutoScroll({ ...input, pointerY: 279 }).speed).toBeCloseTo(-205);
    expect(calculateDragAutoScroll({ ...input, pointerY: 521 }).speed).toBeCloseTo(205);
  });

  it("accelerates linearly and reaches its cap 20 px before the physical edge", () => {
    const input = { bounds, elapsedMs: 1000, scrollTop: 100, maximumScrollTop: 500 };
    const outer = calculateDragAutoScroll({ ...input, pointerY: 260 });
    const middle = calculateDragAutoScroll({ ...input, pointerY: 200 });
    const nearEdge = calculateDragAutoScroll({ ...input, pointerY: 120 });
    const edge = calculateDragAutoScroll({ ...input, pointerY: 100 });
    expect(Math.abs(outer.speed)).toBeLessThan(Math.abs(middle.speed));
    expect(Math.abs(middle.speed)).toBeLessThan(Math.abs(nearEdge.speed));
    expect(middle.speed).toBe(-600);
    expect(nearEdge.speed).toBe(-1000);
    expect(edge.speed).toBe(-1000);
  });

  it("uses elapsed time and clamps long frames", () => {
    const input = { bounds, pointerY: 100, scrollTop: 100, maximumScrollTop: 500 };
    expect(calculateDragAutoScroll({ ...input, elapsedMs: 16 }).delta).toBeCloseTo(-16);
    expect(calculateDragAutoScroll({ ...input, elapsedMs: 50 }).delta).toBe(-50);
    expect(calculateDragAutoScroll({ ...input, elapsedMs: 1000 }).delta).toBe(-50);
  });

  it("clamps movement at the scroll boundaries", () => {
    expect(calculateDragAutoScroll({ bounds, pointerY: 100, elapsedMs: 50, scrollTop: 0, maximumScrollTop: 500 }).delta).toBe(0);
    expect(calculateDragAutoScroll({ bounds, pointerY: 700, elapsedMs: 50, scrollTop: 500, maximumScrollTop: 500 }).delta).toBe(0);
    expect(calculateDragAutoScroll({ bounds, pointerY: 100, elapsedMs: 50, scrollTop: 10, maximumScrollTop: 500 }).delta).toBe(-10);
    expect(calculateDragAutoScroll({ bounds, pointerY: 700, elapsedMs: 50, scrollTop: 490, maximumScrollTop: 500 }).delta).toBe(10);
  });

  it("reads pointer and touch coordinates without assuming one input type", () => {
    expect(pointerClientY({ clientY: 321 } as MouseEvent)).toBe(321);
    const touch = { clientY: 456 } as Touch;
    const touchEvent = { touches: [touch], changedTouches: [] } as unknown as TouchEvent;
    expect(pointerClientY(touchEvent)).toBe(456);
    expect(pointerClientY({} as Event)).toBeNull();
  });
});

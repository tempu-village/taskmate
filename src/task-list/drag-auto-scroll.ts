export interface DragAutoScrollBounds {
  top: number;
  bottom: number;
  height: number;
}

export interface DragAutoScrollInput {
  bounds: DragAutoScrollBounds;
  pointerY: number;
  elapsedMs: number;
  scrollTop: number;
  maximumScrollTop: number;
}

export interface DragAutoScrollResult {
  delta: number;
  speed: number;
  zone: number;
}

const MAXIMUM_ZONE = 192;
const RELATIVE_ZONE = 0.3;
export const DRAG_AUTO_SCROLL_MAXIMUM_ZONE = MAXIMUM_ZONE;
const ENTRY_SPEED = 200;
const MAXIMUM_SPEED = 1000;
const PLATEAU_INSET = 20;
const MAXIMUM_FRAME_MS = 50;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function dragAutoScrollZone(height: number): number {
  return Math.min(Math.max(0, height) * RELATIVE_ZONE, MAXIMUM_ZONE);
}

export function calculateDragAutoScroll(input: DragAutoScrollInput): DragAutoScrollResult {
  const zone = dragAutoScrollZone(input.bounds.height);
  const topDistance = input.pointerY - input.bounds.top;
  const bottomDistance = input.bounds.bottom - input.pointerY;
  let direction = 0;
  let edgeDistance = zone;

  if (topDistance < zone) {
    direction = -1;
    edgeDistance = topDistance;
  } else if (bottomDistance < zone) {
    direction = 1;
    edgeDistance = bottomDistance;
  }

  if (direction === 0) return { delta: 0, speed: 0, zone };

  const progress = clamp((zone - edgeDistance) / Math.max(1, zone - PLATEAU_INSET), 0, 1);
  const speed = direction * (ENTRY_SPEED + (MAXIMUM_SPEED - ENTRY_SPEED) * progress);
  const elapsedSeconds = clamp(input.elapsedMs, 0, MAXIMUM_FRAME_MS) / 1000;
  const requestedDelta = speed * elapsedSeconds;
  const maximumScrollTop = Math.max(0, input.maximumScrollTop);
  const scrollTop = clamp(input.scrollTop, 0, maximumScrollTop);
  const clampedDelta = clamp(requestedDelta, -scrollTop, maximumScrollTop - scrollTop);
  const delta = clampedDelta === 0 ? 0 : clampedDelta;

  return { delta, speed, zone };
}

export interface PointerClientPoint {
  x: number;
  y: number;
}

export function pointerClientPoint(...events: Array<Event | null | undefined>): PointerClientPoint | null {
  for (const event of events) {
    if (!event) continue;
    if ("touches" in event) {
      const touchEvent = event as TouchEvent;
      const touch = touchEvent.touches[0] ?? touchEvent.changedTouches[0];
      if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
        return { x: touch.clientX, y: touch.clientY };
      }
    }
    if ("clientY" in event) {
      const { clientX, clientY } = event as MouseEvent;
      if (Number.isFinite(clientX) && Number.isFinite(clientY)) return { x: clientX, y: clientY };
    }
  }
  return null;
}

export function pointerClientY(...events: Array<Event | null | undefined>): number | null {
  for (const event of events) {
    if (!event) continue;
    if ("touches" in event) {
      const touchEvent = event as TouchEvent;
      const touch = touchEvent.touches[0] ?? touchEvent.changedTouches[0];
      if (touch && Number.isFinite(touch.clientY)) return touch.clientY;
    }
    if ("clientY" in event) {
      const clientY = (event as MouseEvent).clientY;
      if (Number.isFinite(clientY)) return clientY;
    }
  }
  return null;
}

export function isPointOutsideBounds(point: PointerClientPoint, bounds: DOMRectReadOnly): boolean {
  return point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom;
}

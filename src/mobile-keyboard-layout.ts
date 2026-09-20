export interface KeyboardLayoutInput {
  keyboardOcclusion: number;
  hostShrink: number;
  alignmentShortfall: number;
}

export interface KeyboardLayout {
  keyboardClearance: number;
  alignmentClearance: number;
  totalClearance: number;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateKeyboardLayout(input: KeyboardLayoutInput): KeyboardLayout {
  const keyboardClearance = Math.max(
    0,
    finiteNonNegative(input.keyboardOcclusion) - finiteNonNegative(input.hostShrink)
  );
  const alignmentClearance = finiteNonNegative(input.alignmentShortfall);
  return {
    keyboardClearance,
    alignmentClearance,
    totalClearance: keyboardClearance + alignmentClearance
  };
}

export function clampScrollTop(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const maximum = Math.max(0, finiteNonNegative(scrollHeight) - finiteNonNegative(clientHeight));
  return Math.min(Math.max(0, finiteNonNegative(scrollTop)), maximum);
}

const KEYBOARD_THRESHOLD = 48;
const COMFORTABLE_EDGE = 24;

export class MobileKeyboardScroller {
  private readonly baselineFieldHeight: number;
  private readonly baselineViewportBottom: number;
  private activeControl: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private scheduledFrame: number | null = null;
  private delayedAdjustments: number[] = [];
  private closed = false;

  constructor(private readonly fields: HTMLElement) {
    this.baselineFieldHeight = fields.getBoundingClientRect().height;
    this.baselineViewportBottom = this.viewportBottom();
  }

  connect(): void {
    if (!window.matchMedia("(max-width: 700px)").matches) return;
    this.fields.addEventListener("focusin", this.handleFocusIn);
    this.fields.addEventListener("focusout", this.handleFocusOut);
    window.addEventListener("resize", this.scheduleAdjustment);
    window.visualViewport?.addEventListener("resize", this.scheduleAdjustment);
    window.visualViewport?.addEventListener("scroll", this.scheduleAdjustment);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.scheduleAdjustment);
      this.resizeObserver.observe(this.fields);
    }
  }

  disconnect(): void {
    this.closed = true;
    this.fields.removeEventListener("focusin", this.handleFocusIn);
    this.fields.removeEventListener("focusout", this.handleFocusOut);
    window.removeEventListener("resize", this.scheduleAdjustment);
    window.visualViewport?.removeEventListener("resize", this.scheduleAdjustment);
    window.visualViewport?.removeEventListener("scroll", this.scheduleAdjustment);
    this.resizeObserver?.disconnect();
    if (this.scheduledFrame !== null) window.cancelAnimationFrame(this.scheduledFrame);
    for (const timer of this.delayedAdjustments) window.clearTimeout(timer);
    this.fields.style.removeProperty("--taskmate-keyboard-clearance");
  }

  private readonly handleFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches("input, textarea, [contenteditable='true']")) return;
    this.activeControl = target;
    this.scheduleAdjustment();
    for (const delay of [80, 180, 360, 600]) {
      this.delayedAdjustments.push(window.setTimeout(this.scheduleAdjustment, delay));
    }
  };

  private readonly handleFocusOut = (): void => {
    window.setTimeout(() => {
      if (this.closed || this.fields.contains(document.activeElement)) return;
      this.activeControl = null;
      this.scheduleAdjustment();
    }, 0);
  };

  private readonly scheduleAdjustment = (): void => {
    if (this.closed || this.scheduledFrame !== null) return;
    this.scheduledFrame = window.requestAnimationFrame(() => {
      this.scheduledFrame = null;
      this.adjust();
    });
  };

  private adjust(): void {
    const hostShrink = Math.max(0, this.baselineFieldHeight - this.fields.getBoundingClientRect().height);
    const keyboardOcclusion = Math.max(0, this.baselineViewportBottom - this.viewportBottom());
    const keyboardLikelyOpen = keyboardOcclusion >= KEYBOARD_THRESHOLD || hostShrink >= KEYBOARD_THRESHOLD;

    if (!keyboardLikelyOpen || !this.activeControl) {
      this.setClearance(0);
      this.fields.scrollTop = clampScrollTop(
        this.fields.scrollTop,
        this.fields.scrollHeight,
        this.fields.clientHeight
      );
      return;
    }

    const keyboardLayout = calculateKeyboardLayout({
      keyboardOcclusion,
      hostShrink,
      alignmentShortfall: 0
    });
    this.setClearance(keyboardLayout.keyboardClearance);

    window.requestAnimationFrame(() => {
      if (this.closed || !this.activeControl) return;
      const fieldsRect = this.fields.getBoundingClientRect();
      const controlRect = this.activeControl.getBoundingClientRect();
      const visibleTop = fieldsRect.top + COMFORTABLE_EDGE;
      const visibleBottom = Math.min(fieldsRect.bottom, this.viewportBottom()) - COMFORTABLE_EDGE;
      if (visibleBottom <= visibleTop) return;

      let desiredDelta = 0;
      if (controlRect.bottom > visibleBottom || controlRect.top < visibleTop) {
        desiredDelta = (controlRect.top + controlRect.bottom) / 2 - (visibleTop + visibleBottom) / 2;
      }

      if (desiredDelta > 0) {
        const remainingScroll = Math.max(
          0,
          this.fields.scrollHeight - this.fields.clientHeight - this.fields.scrollTop
        );
        const alignmentShortfall = Math.max(0, desiredDelta - remainingScroll);
        const layout = calculateKeyboardLayout({ keyboardOcclusion, hostShrink, alignmentShortfall });
        this.setClearance(layout.totalClearance);
      }

      if (desiredDelta !== 0) this.fields.scrollBy({ top: desiredDelta, behavior: "smooth" });
    });
  }

  private setClearance(value: number): void {
    this.fields.style.setProperty("--taskmate-keyboard-clearance", `${Math.max(0, value)}px`);
  }

  private viewportBottom(): number {
    const viewport = window.visualViewport;
    return viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
  }
}

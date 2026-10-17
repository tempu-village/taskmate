type ReviewPosition =
  | { kind: "scroll"; scrollTop: number }
  | { kind: "anchor"; anchorId: string; offset: number; scrollTop: number };

export function captureReviewPosition(container: HTMLElement, kind: "scroll" | "anchor"): ReviewPosition {
  const scrollTop = Math.max(0, container.scrollTop);
  if (kind === "scroll") return { kind, scrollTop };
  const top = container.getBoundingClientRect().top;
  const anchors = Array.from(container.querySelectorAll<HTMLElement>("[data-review-anchor]"));
  const nearest = anchors.reduce<HTMLElement | null>((best, item) => {
    if (!best) return item;
    return Math.abs(item.getBoundingClientRect().top - top) < Math.abs(best.getBoundingClientRect().top - top) ? item : best;
  }, null);
  const anchorId = nearest?.dataset.reviewAnchor;
  if (!nearest || !anchorId) return { kind: "scroll", scrollTop };
  return { kind, anchorId, offset: nearest.getBoundingClientRect().top - top, scrollTop };
}

export function restoreReviewPosition(container: HTMLElement, position: ReviewPosition | null): void {
  if (!position) return;
  container.scrollTop = position.scrollTop;
  if (position.kind !== "anchor") return;
  const anchor = Array.from(container.querySelectorAll<HTMLElement>("[data-review-anchor]"))
    .find((item) => item.dataset.reviewAnchor === position.anchorId);
  if (!anchor) return;
  const currentOffset = anchor.getBoundingClientRect().top - container.getBoundingClientRect().top;
  container.scrollTop = Math.max(0, position.scrollTop + currentOffset - position.offset);
}

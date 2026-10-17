const TASK_LIST_SCROLL_REGION = ".taskmate-scroll-region";

export function captureTaskListScrollTop(root: ParentNode): number | null {
  const region = root.querySelector<HTMLElement>(TASK_LIST_SCROLL_REGION);
  return region ? Math.max(0, region.scrollTop) : null;
}

export function restoreTaskListScrollTop(root: ParentNode, scrollTop: number | null): void {
  if (scrollTop === null) return;
  const region = root.querySelector<HTMLElement>(TASK_LIST_SCROLL_REGION);
  if (region) region.scrollTop = scrollTop;
}

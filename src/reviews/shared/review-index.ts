import type { InvalidReviewReason, ReviewCatalogEntry, ReviewKind, ReviewLocation, ReviewReference } from "./review-catalog";

// What the owning review Module reports about one of its reviews for the shared list.
export interface ReviewIndexDetails {
  // ISO time; the list shows the newest first.
  sortKey: string;
  // Localized status and count lines.
  lines: string[];
}

export type UnreadableReviewReason = InvalidReviewReason | "unreadable-review";

export type ReviewIndexItem =
  | { type: "review"; ref: ReviewReference; details: ReviewIndexDetails }
  | { type: "invalid"; path: string; reason: UnreadableReviewReason };

export interface ReviewIndexCopy {
  title: string;
  location: Record<ReviewLocation, string>;
  empty: Record<ReviewLocation, string>;
  kind: Record<ReviewKind, string>;
  openAria: (kind: string, id: string) => string;
  invalidTitle: string;
  invalidReason: Record<UnreadableReviewReason, string>;
}

export interface ReviewIndexActions {
  open: (ref: ReviewReference) => void;
  showLocation: (location: ReviewLocation) => void;
}

// Joins catalog entries with the owning Modules' details. A classified file its Module cannot read is listed as
// unreadable rather than hidden, so one bad file never hides the others and is never opened.
export function buildReviewIndex(
  entries: readonly ReviewCatalogEntry[],
  details: (ref: ReviewReference) => ReviewIndexDetails | null
): ReviewIndexItem[] {
  const reviews: Array<Extract<ReviewIndexItem, { type: "review" }>> = [];
  const invalid: Array<Extract<ReviewIndexItem, { type: "invalid" }>> = [];
  for (const entry of entries) {
    if (entry.type === "invalid") {
      invalid.push({ type: "invalid", path: entry.path, reason: entry.reason });
      continue;
    }
    const found = details(entry.ref);
    if (found) reviews.push({ type: "review", ref: entry.ref, details: found });
    else invalid.push({ type: "invalid", path: entry.ref.path, reason: "unreadable-review" });
  }
  reviews.sort((left, right) => right.details.sortKey.localeCompare(left.details.sortKey) || left.ref.id.localeCompare(right.ref.id));
  invalid.sort((left, right) => left.path.localeCompare(right.path));
  return [...reviews, ...invalid];
}

export function renderReviewIndex(
  container: HTMLElement,
  items: readonly ReviewIndexItem[],
  location: ReviewLocation,
  copy: ReviewIndexCopy,
  actions: ReviewIndexActions
): void {
  container.replaceChildren();
  container.classList.add("taskmate-review-index");
  text(container, "h2", copy.title);

  const tabs = element("div", "taskmate-review-index-tabs", container);
  for (const value of ["pending", "history"] as const) {
    const tab = element("button", value === location ? "is-active" : "", tabs);
    tab.type = "button";
    tab.textContent = copy.location[value];
    tab.setAttribute("aria-pressed", String(value === location));
    tab.addEventListener("click", () => actions.showLocation(value));
  }

  const reviews = items.filter((item) => item.type === "review");
  if (reviews.length === 0) text(container, "div", copy.empty[location], "taskmate-empty");
  for (const item of reviews) {
    const open = element("button", "taskmate-review-index-item", container);
    open.type = "button";
    open.setAttribute("aria-label", copy.openAria(copy.kind[item.ref.kind], item.ref.id));
    const identity = element("span", "taskmate-review-index-identity", open);
    text(identity, "span", copy.kind[item.ref.kind], "taskmate-review-index-kind");
    text(identity, "span", item.ref.id);
    for (const line of item.details.lines) text(open, "span", line, "taskmate-review-index-summary");
    open.addEventListener("click", () => actions.open(item.ref));
  }

  const invalid = items.filter((item) => item.type === "invalid");
  if (invalid.length === 0) return;
  const section = element("section", "taskmate-review-index-invalid", container);
  const heading = text(section, "h3", copy.invalidTitle);
  heading.id = "taskmate-review-index-invalid-title";
  section.setAttribute("aria-labelledby", heading.id);
  const list = element("ul", "", section);
  for (const item of invalid) {
    const entry = element("li", "", list);
    text(entry, "code", item.path);
    entry.append(document.createTextNode(`: ${copy.invalidReason[item.reason]}`));
  }
}

// Shown when a review view has no review, for example after Obsidian restores an empty review tab.
export function renderNoOpenReview(container: HTMLElement, message: string, openList: { label: string; onClick: () => void }): void {
  const empty = text(container, "div", message, "taskmate-empty");
  const open = element("button", "", empty);
  open.type = "button";
  open.textContent = openList.label;
  open.addEventListener("click", openList.onClick);
}

function element<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, className: string, parent: HTMLElement): HTMLElementTagNameMap[Tag] {
  const value = document.createElement(tag);
  if (className) value.className = className;
  parent.append(value);
  return value;
}

function text(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, content: string, className = ""): HTMLElement {
  const value = element(tag, className, parent);
  value.textContent = content;
  return value;
}

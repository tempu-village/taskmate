# ADR 0023: Bound task-list titles by character count

Status: Accepted

## Context

TaskMate needs task-list rows to grow with ordinary titles without allowing an exceptionally long title to make the list effectively unbounded. The earlier design showed a title-disclosure action only when rendered text exceeded a fixed number of lines. That condition was not stable across desktop and mobile: Obsidian styles, font metrics, and layout timing affected height measurement, while a resizable desktop window could change the same title between one, two, and many lines without changing its contents.

The list therefore needs one presentation rule that is simple and deterministic on both desktop and mobile. The Task editor still needs to show the complete title so that list presentation never causes data loss.

## Decision

Task lists display at most the first 100 user-perceived characters of a title and append `…` only when the complete title exceeds that limit. The visible text wraps naturally, so the title action grows in height according to the displayed content, but its maximum displayed content is determined solely by character count rather than rendered line count or element height.

TaskMate does not measure title height, observe title resizing, or show an inline `Show full title` action. The complete title remains unchanged in Markdown, search data, actions, and accessible names. Selecting the title opens the Task editor, whose auto-growing multi-line field shows the complete title.

## Considered options

- Conditional disclosure based on rendered line count or height was rejected because the same title can wrap differently when a desktop window is resized and because desktop and mobile rendering produced inconsistent disclosure results.
- Always displaying the complete title in the list was rejected because one exceptionally long title could consume an excessive amount of list space.
- A disclosure action on every title was rejected because it adds unnecessary controls to short titles and makes the common case harder to scan.

## Consequences

- The rule behaves consistently across screen widths without relying on platform-specific geometry.
- List rows retain variable height for readable natural wrapping, but visible title content has a deterministic upper bound.
- Titles longer than 100 user-perceived characters require opening the editor to read the complete text.
- The 100-character limit affects list presentation only; it does not limit title input, storage, or search.

Related: GitHub Issue #31.

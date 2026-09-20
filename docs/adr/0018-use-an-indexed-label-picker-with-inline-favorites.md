# ADR 0018: Use an indexed label picker with inline favorites

Status: Accepted

## Context

The filter modal required users to remember exact label names. A continuously scrolling label list becomes slow as the collection grows, while collapsed initial groups consume space and add an expansion step. Favorites are capped at ten, so a separate management screen would add navigation without improving the common operation.

## Decision

The filter modal opens a two-tab label picker. `Recent & Favorites` presents up to ten favorites, excludes those favorites from the recent section, and then fills that section with up to ten other recently used labels when available. This produces up to twenty distinct suggestions rather than showing the same label twice. `All labels` uses one top index containing only populated Latin-initial, Japanese, and numbers-and-symbols groups. The index stays outside the scroll region so only results scroll.

A label row toggles filter selection and shows both selected styling and a leading check mark. A separate trailing star toggles the global favorite state immediately without changing selection. Favorites are ordered by most recently favorited, capped at ten, and never evicted automatically.

## Considered options

- A continuous alphabetical list was rejected because reaching a late initial requires progressively more scrolling as labels grow.
- Collapsed initial groups were rejected because accordion controls consume space and add an expansion action.
- A separate favorite-management screen was rejected because inline stars make the same bounded operation available where labels are already visible.
- Color-only selection was rejected because selection must remain distinguishable across themes and color-vision differences.

## Consequences

- The filter modal becomes discoverable without changing `TaskFilters`, Task Markdown, or label matching semantics.
- Index controls and the result scroller must remain separate, following ADR 0009's layout boundary.
- Star controls and row selection must be independent pointer and keyboard targets.
- A more elaborate favorite organizer can be added later if manual ordering or bulk management becomes necessary.

Related: GitHub Issue #20.

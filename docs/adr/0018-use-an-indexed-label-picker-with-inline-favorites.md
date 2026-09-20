# ADR 0018: Use an indexed label picker with inline favorites

Status: Accepted

## Context

The filter modal required users to remember exact label names. A continuously scrolling label list becomes slow as the collection grows, while collapsed initial groups consume space and add an expansion step. Favorites are capped at ten, so a separate management screen would add navigation without improving the common operation.

## Decision

The filter modal opens a two-tab label picker. `Recent & Favorites` presents up to ten favorites, excludes those favorites from the recent section, and then fills that section with up to ten other recently used labels when available. This produces up to twenty distinct suggestions rather than showing the same label twice. `All labels` uses one top index containing only populated Latin-initial, Japanese, and numbers-and-symbols groups. The index stays outside the scroll region so only results scroll.

A label row toggles filter selection and shows both selected styling and a leading check mark. A separate trailing star toggles the draft favorite state without changing selection. Both kinds of change remain local to the picker until `Confirm selection` is activated. Closing the picker with its close control or Cancel discards both drafts. The outer Filter modal retains its separate Apply action because confirmation in the picker updates only the Filter draft.

The picker offers only labels that can match the selected completion scope. With `Include completed tasks` off, a label must be assigned to at least one incomplete Task. With it on, labels assigned only to completed Tasks can also appear. Hidden recent or favorite values remain stored and automatically reappear if an eligible Task uses them later. Favorites are ordered by most recently favorited, capped at ten, and never evicted automatically.

## Considered options

- A continuous alphabetical list was rejected because reaching a late initial requires progressively more scrolling as labels grow.
- Collapsed initial groups were rejected because accordion controls consume space and add an expansion action.
- A separate favorite-management screen was rejected because inline stars make the same bounded operation available where labels are already visible.
- Color-only selection was rejected because selection must remain distinguishable across themes and color-vision differences.
- Showing disabled labels with no eligible Tasks was rejected because unusable choices consume scarce space and cannot change the filtered result.
- Persisting picker changes on each click was rejected because the close control would behave like an implicit confirmation and differ from other TaskMate modals.

## Consequences

- The filter modal becomes discoverable without changing `TaskFilters`, Task Markdown, or label matching semantics.
- Index controls and the result scroller must remain separate, following ADR 0009's layout boundary.
- Star controls and row selection must be independent pointer and keyboard targets.
- Filter selection and favorite changes require one explicit picker confirmation and can be cancelled together.
- Recent and favorite storage can retain labels that are temporarily hidden from the picker.
- A more elaborate favorite organizer can be added later if manual ordering or bulk management becomes necessary.

Related: GitHub Issue #20.

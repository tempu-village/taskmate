# ADR 0028: List plan changes separately from the dated working plan

Status: Accepted

## Context

A rolling plan accounts for every incomplete Task, so a working plan often holds twenty or more items while only a few of them change a Task. [Issue #82](https://github.com/tempu-village/taskmate/issues/82) added counts of changed and unchanged items and a change line under every item. In use, the counts said how many items change but not which: the reader still had to scan every item, and the repeated "No change: stays on …", "not included in the review because nothing changes" and per-gap "not scheduled in this plan" lines buried the few changed items.

Splitting the whole plan into "changes", "no change" and "not scheduled" sections would surface the changed items, but each section would then need its own date headings. The same date would appear twice, and a day's Tasks would be split across sections. A day heading carries that day's capacity (`used / available minutes`), which is the sum of changed and unchanged items, so neither section could show whether the day still fits.

The user's goal is to see at a glance which Tasks a plan changes and approve them, while still using the plan to run each day.

## Decision

Render a rolling plan in this order:

1. **What this plan changes** — the summary and the counts, as today.
2. **Changes** — a flat list of only the planned items that change a Task, without date headings. Each line shows the item ID, the Task link, and the change itself, such as `10/28 (Wed) → 10/31 (Sat)` for a moved date, and names the Task change review that includes it. Items are ordered by their planned date. When nothing changes, the section says so in one line.
3. **Working plan** — every planned item grouped under its day heading with that day's capacity, as today. A changed item carries only a short "changed" marker; an unchanged item carries no change line. The working plan no longer repeats "No change: stays on …" or "not included because nothing changes".
4. **Gaps** and **Conflicts** — each section states once, at its top, why its items are not scheduled and that their Tasks do not change, instead of repeating it on every item.

A changed Task therefore appears twice, once as a change to approve and once in its day. Date headings appear only once.

## Considered options

- **Sections by change state, each with its own date headings** was rejected: it duplicates every date heading and splits a day's Tasks, so no section shows the day's capacity.
- **Keep date grouping and only highlight changed items** was rejected: with many items the changed ones still have to be found by scrolling, which is the original problem.
- **Changed items listed first inside each day** was rejected: it still requires reading every day, and the plan's day order no longer matches the intended working order.

## Consequences

- The changed items, the subject of approval, are readable in one short list at the top of the plan regardless of plan size.
- The working plan stays the single place to read each day's work and capacity.
- A changed item's line exists in two sections. Only the working-plan line carries the machine-readable `taskmate-plan-item` comment, so each item is still recorded exactly once.
- The "every item states its change or that it does not change" rule becomes "every changed item states its change; absence of a change marker means no change". The Feature acceptance criterion PLAN-25 changes accordingly, while the changed and unchanged counts must still match the items an all-dates Proposal includes and omits.
- Review omissions other than "nothing changes" (the Task changed after planning, is completed, or no longer exists) and "a new review is needed" remain stated on the item, because they are not implied by the marker.

Related: [Issue #101](https://github.com/tempu-village/taskmate/issues/101), [Task Pilot planning Feature](../features/task-pilot-planning.md), [RFC: Show what plans and reviews change](../rfcs/show-plan-and-review-changes.md).

# ADR 0019: Manage task-attached labels outside filtering

TaskMate keeps Labels attached directly to Tasks instead of introducing a separate label entity or registry. Global rename and deletion therefore operate across every affected Task and reconcile saved recent Labels, favorites, and active filter state; the Adjust menu opens a dedicated management dialog because filtering selects view criteria while label management changes persisted Task data. The manager also exposes values retained only in recent or favorite storage as `Stored only`, so the filter picker can continue hiding choices that cannot match its current completion scope without making stale saved values impossible to remove.

Deletion removes the Label but never the Task, requires confirmation with the affected Task count, and reports partial file-write failures. Renaming into an existing Label merges the values without duplicating the destination on a Task. Creating empty registry entries and adding color, icon, hierarchy, or other label metadata remain out of scope unless TaskMate later adopts a first-class Label entity.


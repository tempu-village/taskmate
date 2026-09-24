# Use row content for drag reordering

Task and Step rows use their content area for drag reordering instead of reserving horizontal space for a visible drag handle. Desktop dragging starts directly, while touch dragging starts after a 250 ms hold; this gesture can remain dedicated to reordering because TaskMate enters multiple selection through a separate explicit action, and automatic sort modes continue to disable Task reordering.

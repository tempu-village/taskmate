# Separate navigation from scrollable content

TaskMate keeps its primary navigation below the Obsidian header, but places the navigation and screen body in separate layout regions so that only the body scrolls. On Android, focusing the search field can automatically scroll that field to the top of its scroll container; when the navigation was sticky inside the same container, the field moved behind it and the user could no longer see what they were typing. A separate scrollable body prevents overlap without guessing Obsidian header, keyboard, theme, or device dimensions.

This refines ADR 0007: the navigation placement remains unchanged, while the earlier choice to make it sticky inside the page's scroll container is superseded.

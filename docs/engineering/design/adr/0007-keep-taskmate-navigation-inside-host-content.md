# ADR 0007: Keep TaskMate navigation inside the host content area

TaskMate places its primary navigation directly below the Obsidian view header instead of anchoring it to the bottom of the screen. Obsidian owns the mobile screen edges and does not expose a stable height for its bottom toolbar, so offsetting TaskMate above that toolbar would be device- and version-dependent; keeping navigation inside the plugin content prevents controls from overlapping and preserves reliable touch targets.

## Considered options

- Bottom navigation with a fixed offset was rejected because the required offset changes with Obsidian, the device, themes, and safe-area configuration.
- A floating navigation bar was rejected because it could still obscure tasks and compete with Obsidian-owned controls.
- A sticky navigation row below the Obsidian header was selected because it stays visible while remaining entirely inside the area TaskMate owns.

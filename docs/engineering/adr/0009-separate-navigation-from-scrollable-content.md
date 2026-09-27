# Separate navigation from scrollable content

TaskMate keeps its primary navigation below the Obsidian header and separates fixed interaction controls from scrollable results. On ordinary screens, the navigation and screen body are separate layout regions. On the search screen, the title and focused search input are also outside the results scroller.

Android diagnostics showed that the software keyboard did not reduce `window.innerHeight` or `visualViewport`. Instead, Obsidian reduced the TaskMate host from about 880 px to 484 px while the child page using `height: 100%` collapsed from about 836 px to 76 px. The host's keyboard accommodation and padding therefore combined with TaskMate's percentage height and subtracted the unavailable region twice. The inputs retained their 44 px height but were clipped below the collapsed child page, which made this look like a navigation overlap.

TaskMate removes host padding from its root with sufficient CSS precedence and uses a column flex layout. The child page fills the host's actual remaining space with flex sizing and `min-height: 0`, rather than resolving another percentage height. Navigation and fixed inputs stay outside their results scrollers. This avoids guessing Obsidian header, keyboard, theme, or device dimensions.

This refines ADR 0007: the navigation placement remains unchanged, while the earlier choices to make navigation or the active search input sticky inside a keyboard-sensitive scroll container are superseded. The earlier overlap hypothesis was incomplete and is replaced by the measured host-versus-child height explanation above.

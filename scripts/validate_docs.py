#!/usr/bin/env python3
"""Check repository Markdown links and specification status fields.

Supports the inline Markdown links and ATX headings used by these docs.
External URLs are not fetched. Acceptance prose and translations still need review.
"""

from pathlib import Path
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent


def prose(text: str) -> str:
    return re.sub(r"^```[^\n]*\n.*?^```\s*$", "", text, flags=re.M | re.S)


def anchors(text: str) -> set[str]:
    found = set(re.findall(r'<[^>]+\bid=[\"\']([^\"\']+)', text))
    counts: dict[str, int] = {}
    for heading in re.findall(r"^#{1,6}\s+(.+)$", prose(text), flags=re.M):
        slug = re.sub(r"[^\w\- ]", "", heading.lower()).replace(" ", "-")
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        found.add(f"{slug}-{count}" if count else slug)
    return found


def main() -> int:
    files = sorted(set(ROOT.glob("*.md")) | set((ROOT / "docs").rglob("*.md"))
                   | set((ROOT / "skills").rglob("*.md")))
    errors = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        for destination in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", prose(text)):
            if re.match(r"^[a-z][a-z0-9+.-]*:", destination, re.I):
                continue
            target, _, fragment = destination.partition("#")
            resolved = (path.parent / unquote(target)).resolve() if target else path
            if not resolved.exists():
                errors.append(f"{path.relative_to(ROOT)}: missing {destination}")
            elif fragment and resolved.suffix == ".md" and unquote(fragment) not in anchors(resolved.read_text(encoding="utf-8")):
                errors.append(f"{path.relative_to(ROOT)}: missing anchor {destination}")
        if path.parent == ROOT / "docs/engineering/specifications" and path.name not in {"README.md", "overview.md"}:
            for field in ("Approval", "Implementation"):
                if not re.search(rf"^{field}: \S", text, flags=re.M):
                    errors.append(f"{path.relative_to(ROOT)}: missing {field} state")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"OK {len(files)} Markdown files: local links, anchors and specification states")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

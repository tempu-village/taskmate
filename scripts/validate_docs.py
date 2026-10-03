#!/usr/bin/env python3
"""Check repository Markdown links, Feature states and RFC references.

Supports the inline Markdown links and ATX headings used by these docs.
External URLs are not fetched. Acceptance prose and translations still need review.
"""

from pathlib import Path
import re
import sys
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
RFC_DIR = ROOT / "docs/engineering/rfcs"
FEATURE_DIR = ROOT / "docs/engineering/features"
RFC_STATUSES = {"draft", "accepted", "implemented", "rejected", "superseded"}


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


def frontmatter(text: str) -> dict[str, str]:
    match = re.match(r"^---\n(.*?)\n---\n", text, flags=re.S)
    if not match:
        return {}
    fields = {}
    for line in match.group(1).splitlines():
        key, separator, value = line.partition(":")
        if separator:
            fields[key.strip()] = value.strip()
    return fields


def metadata_paths(value: str) -> list[str]:
    value = value.strip()
    if value.startswith("[") and value.endswith("]"):
        return [item.strip() for item in value[1:-1].split(",") if item.strip()]
    return [value] if value and value != "null" else []


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
        if path.parent == ROOT / "docs/engineering/features" and path.name not in {"README.md", "overview.md"}:
            for field in ("Approval", "Implementation"):
                if not re.search(rf"^{field}: \S", text, flags=re.M):
                    errors.append(f"{path.relative_to(ROOT)}: missing {field} state")
        if path.parent == RFC_DIR and path.name != "README.md":
            fields = frontmatter(text)
            status = fields.get("status")
            if status not in RFC_STATUSES:
                errors.append(f"{path.relative_to(ROOT)}: invalid or missing RFC status")
            authorities = metadata_paths(fields.get("current-authority", ""))
            if status == "implemented" and not authorities:
                errors.append(f"{path.relative_to(ROOT)}: implemented RFC missing current-authority")
            related = metadata_paths(fields.get("related-features", ""))
            for destination in related:
                resolved = (path.parent / destination).resolve()
                if resolved.parent != FEATURE_DIR:
                    errors.append(
                        f"{path.relative_to(ROOT)}: related-features path is not a Feature {destination}"
                    )
            for destination in authorities + related:
                resolved = (path.parent / destination).resolve()
                if not resolved.exists():
                    errors.append(f"{path.relative_to(ROOT)}: missing metadata path {destination}")
                    continue
                if resolved.parent == FEATURE_DIR:
                    feature_text = resolved.read_text(encoding="utf-8")
                    if path.name not in feature_text:
                        errors.append(
                            f"{resolved.relative_to(ROOT)}: missing backlink to {path.name}"
                        )
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"OK {len(files)} Markdown files: local links, anchors, Feature states and RFC references")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

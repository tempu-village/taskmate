#!/usr/bin/env python3
"""Validate the repository's Agent Skills with no third-party dependencies."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILLS_DIR = ROOT / "skills"
NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SEMVER_RE = re.compile(r'^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$')


def parse_frontmatter(path: Path) -> tuple[dict[str, str], list[str]]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    errors: list[str] = []
    if not lines or lines[0] != "---":
        return {}, ["missing opening YAML delimiter"]

    try:
        end = lines.index("---", 1)
    except ValueError:
        return {}, ["missing closing YAML delimiter"]

    values: dict[str, str] = {}
    in_metadata = False
    for line in lines[1:end]:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line == "metadata:":
            in_metadata = True
            continue
        if in_metadata and line.startswith("  "):
            key, separator, value = line.strip().partition(":")
            if separator:
                values[f"metadata.{key}"] = value.strip().strip('"\'')
            continue
        in_metadata = False
        key, separator, value = line.partition(":")
        if separator:
            values[key.strip()] = value.strip().strip('"\'')

    if not any(line.strip() for line in lines[end + 1 :]):
        errors.append("instruction body is empty")
    return values, errors


def validate_skill(skill_dir: Path) -> list[str]:
    path = skill_dir / "SKILL.md"
    if not path.is_file():
        return ["missing SKILL.md"]

    values, errors = parse_frontmatter(path)
    name = values.get("name", "")
    description = values.get("description", "")
    version = values.get("metadata.version")

    if not name:
        errors.append("missing name")
    elif not NAME_RE.fullmatch(name):
        errors.append(f"invalid name: {name!r}")
    elif name != skill_dir.name:
        errors.append(f"name {name!r} does not match folder {skill_dir.name!r}")

    if not description:
        errors.append("missing description")
    elif len(description) > 1024:
        errors.append("description exceeds 1024 characters")

    if version and not SEMVER_RE.fullmatch(version):
        errors.append(f"metadata.version is not SemVer: {version!r}")

    return errors


def main() -> int:
    if not SKILLS_DIR.is_dir():
        print("ERROR: skills directory does not exist", file=sys.stderr)
        return 1

    skill_dirs = sorted(path for path in SKILLS_DIR.iterdir() if path.is_dir())
    if not skill_dirs:
        print("ERROR: no skill directories found", file=sys.stderr)
        return 1

    failures = 0
    for skill_dir in skill_dirs:
        errors = validate_skill(skill_dir)
        if errors:
            failures += 1
            for error in errors:
                print(f"ERROR {skill_dir.name}: {error}", file=sys.stderr)
        else:
            print(f"OK {skill_dir.name}")

    if failures:
        print(f"\n{failures} skill(s) failed validation.", file=sys.stderr)
        return 1

    print(f"\nValidated {len(skill_dirs)} skill(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

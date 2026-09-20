#!/usr/bin/env python3
"""Validate TaskMate's maintained translations without personal Skill paths."""

from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "README.md"
TRANSLATION = ROOT / "README.ja.md"
PRODUCT_SPEC = ROOT / "docs" / "product-spec.md"
PRODUCT_SPEC_DIVIDER = "\n---\n\n# TaskMate 製品仕様\n"


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def normalized_bytes(path: Path) -> bytes:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n").encode()


def content_structure(text: str) -> tuple[list[int], list[tuple[int, str]], list[tuple[str, str]]]:
    headings: list[int] = []
    lists: list[tuple[int, str]] = []
    fences: list[tuple[str, str]] = []
    lines = text.splitlines()
    fence_info: str | None = None
    fence_body: list[str] = []
    for line in lines:
        fence = re.match(r"^```(.*)$", line)
        if fence:
            if fence_info is None:
                fence_info = fence.group(1)
                fence_body = []
            else:
                fences.append((fence_info, "\n".join(fence_body)))
                fence_info = None
            continue
        if fence_info is not None:
            fence_body.append(line)
            continue
        heading = re.match(r"^(#{1,6})\s+", line)
        if heading:
            headings.append(len(heading.group(1)))
        item = re.match(r"^(\s*)([-+*]|\d+\.)\s+", line)
        if item:
            lists.append((len(item.group(1)), "ordered" if item.group(2).endswith(".") else "unordered"))
    if fence_info is not None:
        fail("document contains an unclosed fenced code block")
    return headings, lists, fences


def check_local_links(path: Path, text: str) -> None:
    for destination in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", text):
        target = destination.split("#", 1)[0]
        if not target or re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I):
            continue
        resolved = (path.parent / target).resolve()
        if not resolved.exists():
            fail(f"broken local link in {path.name}: {destination}")


def main() -> None:
    source = normalized_bytes(SOURCE).decode()
    translation = normalized_bytes(TRANSLATION).decode()
    source_digest = hashlib.sha256(normalized_bytes(SOURCE)).hexdigest()
    digest_match = re.findall(r"<!-- translation-source-sha256: ([0-9a-f]{64}) -->", translation)
    if digest_match != [source_digest]:
        fail("README.ja.md source digest is missing or stale")
    if translation.count("<!-- translation-status: ai-translated -->") != 1:
        fail("README.ja.md must have exactly one ai-translated marker")
    if "翻訳状態：`ai-translated`" not in translation:
        fail("README.ja.md must show its AI translation status to readers")

    source_structure = content_structure(source)
    translation_structure = content_structure(translation)
    if source_structure[0] != translation_structure[0]:
        fail("README heading levels do not correspond")
    if source_structure[1] != translation_structure[1]:
        fail("README list shapes do not correspond")
    if source_structure[2] != translation_structure[2]:
        fail("README fenced code blocks do not correspond")

    check_local_links(SOURCE, source)
    check_local_links(TRANSLATION, translation)
    print("OK README.md and README.ja.md localization")

    product_spec = normalized_bytes(PRODUCT_SPEC).decode()
    if product_spec.count(PRODUCT_SPEC_DIVIDER) != 1:
        fail("product-spec.md must contain exactly one English/Japanese divider")
    english_spec, japanese_body = product_spec.split(PRODUCT_SPEC_DIVIDER)
    japanese_spec = "# TaskMate 製品仕様\n" + japanese_body
    if japanese_spec.count("<!-- translation-status: ai-translated -->") != 1:
        fail("product-spec.md Japanese section must have exactly one ai-translated marker")
    if "英語版が正本です" not in japanese_spec:
        fail("product-spec.md must show its AI translation status to readers")
    english_structure = content_structure(english_spec)
    japanese_structure = content_structure(japanese_spec)
    if english_structure[0] != japanese_structure[0]:
        fail("product specification heading levels do not correspond")
    if english_structure[1] != japanese_structure[1]:
        fail("product specification list shapes do not correspond")
    if english_structure[2] != japanese_structure[2]:
        fail("product specification fenced code blocks do not correspond")
    check_local_links(PRODUCT_SPEC, product_spec)
    print("OK docs/product-spec.md localization")


if __name__ == "__main__":
    main()

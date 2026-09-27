# ADR 0012: Use English-first static localization

## Status

Accepted

## Context

TaskMate needs English and Japanese for a world-facing MVP while remaining local-first, mobile-compatible, and usable without network access. UI text was previously split between Japanese feature screens and English settings, which made fallback behavior, review, and future translation work unreliable.

## Decision

English is the canonical source and unconditional fallback for user-facing UI and documentation. TaskMate ships statically bundled TypeScript catalogs for English and Japanese behind one typed translation interface; feature modules retain stable semantic IDs and request presentation text through that interface. Catalog keys and placeholders must match, blank target messages fall back to non-empty English, and interpolation inserts user values as text rather than HTML.

The persisted language preference is `auto`, `en`, or `ja`. An explicit language wins. Auto mode feature-detects Obsidian's public `getLanguage()` API, maps Japanese variants to Japanese, and falls back to English for unsupported, unavailable, or failing detection. TaskMate keeps its existing minimum Obsidian version because older versions can load safely without that function. Views and settings refresh immediately; command names and the ribbon tooltip require a plugin reload because TaskMate does not depend on private APIs to re-register host-owned UI.

Runtime AI translation, external translation services, telemetry, and network translation are prohibited. AI may prepare development-time Japanese drafts and review terminology or layout, but those translations remain marked `ai-translated` until a person compares the complete current English and Japanese versions. Security, privacy, and permission claims require human verification before release.

## Considered options

- A large runtime i18n dependency was rejected because two static languages do not justify the added size and runtime surface.
- Runtime AI or external translation was rejected because it would add network access, credentials, latency, cost, and privacy risk.
- Private Obsidian locale APIs and browser-language guessing were rejected because they would weaken compatibility and make Auto behavior less predictable.

## Consequences

- Every English UI or user-documentation change must update Japanese in the same change or mark it stale.
- Automated tests enforce catalog shape, placeholders, fallback behavior, locale resolution, and the separation of Japanese UI copy from feature modules.
- English and Japanese must be checked in real desktop and mobile Obsidian because automated tests cannot prove visual or touch usability.
- To add a language, add a catalog with the complete English key shape, extend the stable language preference and resolver, add the setting label, add locale and fallback tests, translate maintained user documentation with honest provenance, and verify desktop and mobile layouts.

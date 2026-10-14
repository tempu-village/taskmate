---
status: implemented
tracking-issue: 52
current-authority: ../features/task-change-review/README.md
related-features:
  - ../features/task-pilot-planning.md
  - ../features/task-change-review/README.md
---

# RFC: Use jsdiff as the diff engine for Task change previews

## Summary

Add a review-before-write flow for Task Pilot changes. The user can inspect many affected Task files in one Obsidian view, switch between deterministic semantic changes and raw Markdown hunks, approve individual changes, and apply only the approved set after stale-snapshot checks.

Use the npm package `diff` (the jsdiff project) as the diff-calculation engine. Keep semantic Task changes, approval state, persistence and Obsidian DOM rendering in TaskMate-owned modules. jsdiff produces structured line hunks and exact patch replay evidence; it does not own the review UI or file writes.

This technology choice is implemented in the current branch. Current behavior is owned by the linked Feature and strict persisted contracts by the Task change Proposal Specification.

## Background / Problem

Before Task Pilot or the plugin changes multiple Task Markdown files, the user should be able to inspect all affected files and changed locations in one scrollable review, similar to a source-control changes view. The proposed flow needs:

- deterministic comparison of original and proposed Markdown;
- file-level and hunk-level navigation for roughly 10–20 small Task files;
- a semantic view of Task fields plus an optional raw Markdown diff;
- per-change approval owned by TaskMate rather than by a generic editor;
- browser-compatible implementation that continues to work in Obsidian mobile;
- no requirement that the Vault is a Git repository;
- stale-snapshot checks before applying any approved change.

TaskMate currently uses plain TypeScript, esbuild and the Obsidian DOM APIs. Its only runtime dependency is SortableJS. The repository's current [architecture](../design/architecture.md) also excludes Node-only runtime behavior because Obsidian mobile does not expose Node or Electron APIs.

## Goals

- Select a focused, maintained diff engine whose output can feed a TaskMate-owned review model and renderer.
- Let users review roughly 10–20 changed Task files in one continuous, navigable Obsidian view.
- Show deterministic semantic and Markdown representations derived from the same original and proposed content.
- Support explicit per-change, per-file and whole-proposal approval without changing canonical Tasks before approval.
- Provide a low-friction path from a Codex result to the applicable Obsidian review.
- Preserve a clean seam between change calculation, presentation, approval and persistence.
- Record meaningful alternatives and the evidence used to compare them.
- Avoid importing a complete code editor merely to render small, read-only Task diffs.

## Non-goals

- Implement the review view in this RFC.
- Treat AI-authored prose as authoritative diff data.
- Use fuzzy patch application as a replacement for snapshot validation.
- Reproduce every VS Code source-control feature.
- Make Git a Vault or plugin-runtime requirement.
- Automatically approve or apply changes when an external review link is opened.
- Add bulk merge, split or deletion without a separate destructive-action design.
- Record exact dependency versions in architecture prose; `package.json` and the lockfile remain authoritative after installation.

## Evaluation criteria

The comparison prioritizes the following constraints:

1. Can compare two in-memory Markdown strings without Git, Node or Electron.
2. Provides line-oriented structured hunks or unified patches.
3. Lets TaskMate own semantic changes, approval controls and Obsidian-native rendering.
4. Works with plain TypeScript and the existing esbuild pipeline.
5. Remains viable on Obsidian mobile.
6. Adds proportionate runtime and maintenance cost for small read-only diffs.
7. Is actively maintained and has clear first-party documentation.

## Alternatives considered

| Candidate | What it provides | Strengths for this use case | Material drawbacks | Assessment |
| --- | --- | --- | --- | --- |
| **jsdiff (`diff`)** | Text/line/word diff, structured hunks, unified patch creation and patch parsing/application | `structuredPatch` exposes line numbers and hunk lines; `diffLines` supports direct string comparison; TypeScript declarations are included; npm reports zero dependencies; current releases target widely available browser features; asynchronous and bounded calculation options are available | It intentionally provides no UI, so TaskMate must render the file list and hunks | **Preferred.** It supplies the missing algorithm while preserving TaskMate's review and presentation seams |
| **diff2html** | Parses Git/unified diff and renders GitHub-like line-by-line or side-by-side HTML, with file list, folding and sticky headers | Closest ready-made visual result to the requested source-control view; TypeScript declarations and browser bundles are available | It consumes an existing Git/unified diff rather than replacing the before/after diff engine; generated HTML/CSS and built-in interaction compete with TaskMate's semantic fields and per-change approval controls; syntax highlighting adds more presentation machinery than Task Markdown needs | Useful as a prototype or optional renderer, but not the core diff engine |
| **CodeMirror `@codemirror/merge`** | Unified and split merge views backed by CodeMirror editor state/view packages | Mature read-only comparison UI; changed chunks, collapsed unchanged regions and large-document viewport rendering are built in | It introduces an editor substrate and several dependencies for a review that is primarily a multi-file list; TaskMate would still need a separate file list, semantic field view and approval model | Consider only if raw Markdown editing or very large files become a requirement |
| **Monaco Editor diff editor** | The browser editor derived from VS Code, including side-by-side diff | Highest fidelity to VS Code and strong editor capabilities | Full editor integration, models, disposal and worker setup are disproportionate; official documentation states that Monaco is not supported in mobile browsers or mobile web frameworks, conflicting with TaskMate's mobile scope | Rejected for this feature |
| **Google diff-match-patch** | Diff, fuzzy match and patch across several languages | Proven text algorithms and fuzzy patch behavior | The official repository was archived and made read-only in August 2024; fuzzy patching conflicts with TaskMate's exact stale-snapshot safety model | Rejected |
| **fast-diff** | Small character-oriented string diff based on diff-match-patch's diff portion | Small interface and focused implementation | Returns character insert/equal/delete tuples, not file/hunk/line structures; TaskMate would need to build line mapping and unified-patch behavior itself | Too low-level for the required review model |
| **Git CLI / `git diff --no-index`** | Native Git diff output across files | Familiar, robust unified diff and no JavaScript algorithm dependency | Vaults need not be Git repositories; spawning Git is unavailable on Obsidian mobile and violates the current browser/public-Obsidian runtime boundary | Rejected as a plugin-runtime dependency; still useful as development-time verification |
| **Custom Myers/LCS implementation** | Complete local control of diff behavior | No third-party runtime package and exact tailoring is possible | Reimplements subtle algorithm, newline, hunk and performance behavior without providing product-specific value; creates more testing and maintenance than the small interface justifies | Rejected unless a verified incompatibility prevents using jsdiff |

## Why jsdiff is preferred

The deciding factor is architectural fit, not visual completeness. The proposed review flow needs a diff-calculation adapter behind a small interface, while TaskMate must retain ownership of:

- semantic Task-field changes;
- stable `T-xx` and `C-xx` review identifiers;
- per-change approval and rejection;
- stale-snapshot detection;
- Obsidian-native file-list and continuous-scroll rendering;
- exact Markdown persistence through the existing repositories.

jsdiff returns structured hunks without imposing an editor, CSS system or approval interaction. This creates leverage at a narrow seam: the implementation can replace jsdiff later without changing callers if TaskMate's internal `DiffDocument` model does not expose jsdiff-specific types.

The proposed adapter interface is conceptually:

```ts
interface DiffEngine {
  compare(original: string, proposed: string): DiffDocument;
}
```

`DiffDocument` should be owned by TaskMate and contain file metadata, old/new line ranges and added/deleted/context lines. It must not alias jsdiff's exported `StructuredPatch` type. This prevents a library choice from leaking through the module seam.

jsdiff's patch-application functions are not the intended persistence path. Before applying approved changes, TaskMate should re-read each file and compare its snapshot with the preview snapshot. A mismatch regenerates the preview instead of applying a fuzzy patch.

## Proposed design

### Modules and seams

1. A pure change-set module accepts typed change requests and produces a `ChangeSet` without writing files.
2. A proposal module applies the `ChangeSet` in memory and captures the complete before/after Markdown evidence.
3. A diff-engine adapter calls jsdiff to convert original/proposed Markdown into TaskMate-owned structured hunks.
4. A review-view module renders the file list, semantic changes and optional Markdown hunks using Obsidian DOM APIs.
5. An approval module records selected TaskMate change IDs, not library hunk objects.
6. The persistence module rechecks snapshots and writes only explicitly approved changes.

The core interface is conceptually:

```ts
interface ChangePreviewer {
  preview(request: TypedChangeRequest): Proposal;
}

interface ApprovedChangeApplier {
  apply(proposalId: string, approvedChangeIds: string[]): ApplyResult;
}
```

Callers must not need to know Markdown rewrite details, jsdiff types or file-write ordering. The review UI must not write Task files directly.

### Review identifiers

- `T-01`, `T-02`, ... identify Tasks within one review session. They never replace canonical Task UUIDs.
- `C-01`, `C-02`, ... identify independently approvable changes.
- `O-01`, `O-02`, ... identify a suggested decision or cleanup order and cannot be confused with Task identifiers.
- Reordering the review does not change its `T-xx` or `C-xx` assignments.

These short, Proposal-local identifiers are also a human communication interface. A user can refer to a specific Task and change as, for example, `T-07 / C-08` in the review screen or a Codex conversation without copying a Task UUID, file path, field value or diff text. `C-xx` therefore uses one sequence across the Proposal, while the displayed `T-xx` provides immediate Task context. The identifiers are unambiguous only together with their Proposal ID and do not become permanent Task or field identities.

### Deterministic change evidence

AI may propose typed intent such as `setDate(taskId, "2026-10-12")` or `replaceLabel(taskId, "brk", "context/break")`. It must not author the authoritative old/new values or diff hunks.

For each affected Task, the proposal pipeline must:

1. read the original Markdown bytes and record a cryptographic snapshot;
2. store the complete original Markdown as review evidence;
3. parse the original using the canonical Task parser;
4. validate and apply the typed `ChangeSet` operation in memory;
5. serialize the proposed Task Markdown without writing it and store the complete result as review evidence;
6. parse the proposed Markdown with the same parser;
7. calculate semantic changes by comparing the two parsed values;
8. calculate raw Markdown hunks by passing the stored original and proposed strings to the diff-engine adapter; and
9. verify that applying the generated exact patch to the original reproduces the proposed bytes.

Before persistence, the applier re-reads every selected Task and compares its snapshot with the preview snapshot. A mismatch marks that Task stale and returns it for a renewed preview. Fuzzy patching must not bypass this check.

This guarantees that both displayed views describe the captured original and proposed files. It does not claim that AI interpreted the user's intent correctly or that parsers contain no defects; schema validation, parser/serializer round-trip tests, exact patch replay and user approval address those separate risks.

### Obsidian review view

The review view is a TaskMate-owned view, not a Markdown note and not a generic code editor. It should provide:

- an affected-file count and approve-all/reject-all actions;
- a file list showing `T-xx`, Task title or file name, and change count;
- navigation from a file-list entry to its continuously scrollable section;
- collapsible file sections with sticky headers;
- per-change `C-xx`, approval control and reason;
- a default semantic view for fields such as date, Priority, title, Labels, Steps and Notes;
- a toggle to the raw Markdown hunks generated from the same original/proposed strings; and
- clear treatment of automatic fields such as `updated-at` so they do not obscure the semantic view.

The first implementation should render ordinary collapsible sections for 10–20 small Task files. Add viewport virtualization only after measurement demonstrates a problem. Keep syntax highlighting out of the initial design because Task Markdown benefits more from readable field-level changes than language-aware code coloring.

### Proposal and approval flow

The intended flow is:

1. Task Pilot inspects canonical Tasks and produces typed change requests.
2. The deterministic proposal pipeline creates a machine-readable `Proposal` without changing canonical Tasks.
3. TaskMate detects or opens that proposal in the review view.
4. The user approves all, approves selected `C-xx` entries, or rejects the proposal.
5. The applier rechecks snapshots, applies only approved changes, validates the resulting Task store and reports succeeded, failed and unapplied changes separately.

`ChangeSet` means the typed change instructions. `Proposal` is the persisted review envelope containing identities, status, the original and proposed Markdown in full, the `ChangeSet`, rationale, approval decisions and the apply result. The duplicated Markdown is immutable review evidence, not master data: it lets TaskMate regenerate an exact library-produced diff, verify that the instructions match the generated/applied content, and preserve the state reviewed even if the canonical Task later changes. The canonical Task Markdown remains the only Task master data.

Raw diff hunks need not be persisted because jsdiff can deterministically regenerate them from the stored before/after Markdown. The exact Proposal schema requires a strict Specification before implementation.

### Context-label normalization

Task Pilot should use `context/break`, not `brk`, for break-suitable Tasks. Existing `brk` labels are migration candidates, never silent rewrites:

- propose removing `brk` and adding `context/break` as one visible change;
- when both labels already exist, remove only `brk`;
- preserve all unrelated labels and Task fields; and
- apply the normalization only after approval and stale-snapshot recheck.

### Codex-to-Obsidian handoff

Task Pilot should invoke a TaskMate-owned Obsidian URI through the operating system after it persists a reviewable Proposal:

```text
obsidian://taskmate-review?vault=<vault-id>&proposal=<proposal-id>&task=<task-uuid>&change=<change-id>
```

The OS invocation brings Obsidian to the foreground. TaskMate's registered protocol handler validates the identifiers, resolves the Proposal only within the configured Proposal folder, opens the review view, and optionally navigates to the stable Task UUID and change ID. It must not trust or accept an arbitrary file path, line number, redirect target or executable action from the URI.

The protocol handler may only reveal a review. Approval and persistence always require an additional explicit action inside TaskMate. The URI contains identifiers only—never Task text, Markdown diffs, credentials or secrets. Obsidian-side pending-review discovery remains the fallback when OS invocation is unavailable or denied.

Task Pilot should invoke the OS using an argument array rather than shell interpolation. The initial desktop adapter may use macOS `open`; Windows and Linux adapters can use their platform launch mechanisms without changing the TaskMate protocol interface.

The spike on 2026-10-12 verified all load-bearing claims on macOS with `Vault3_SandboxScratch`: the custom handler ran while Obsidian was already open, launching the same URI while Obsidian was closed started the app and delivered the handler call, the `vault` parameter selected the intended Vault, and a Task UUID resolved and revealed the intended Task. The throwaway handler was removed after validation.

### Acceptance conditions for the accepted design

- No canonical Task Markdown changes before explicit review approval.
- `T-xx`, `C-xx` and `O-xx` remain distinguishable and stable within a review.
- Semantic and raw Markdown views are calculated from the same original/proposed content without AI-authored diff facts.
- Exact patch replay reproduces the proposed bytes before a proposal is reviewable.
- Individual changes, whole files and the whole proposal can be approved or rejected without hidden members.
- A stale Task is not overwritten and is returned for renewed review.
- Partial write failures identify successes, failures and unapplied changes without claiming atomic success.
- Invoking the TaskMate review URI performs no approval or write.
- Applied Task Markdown passes canonical store validation and preserves unrelated fields and Manual order.

## Technology-document placement

The repository already defines distinct document ownership:

- [Architecture](../design/architecture.md) is the current implementation map. After implementation, it should mention the diff-engine seam and link here, but should not carry the full comparison table.
- This RFC owns the unsettled proposal, alternatives and selection rationale while the feature is under review.
- An ADR is warranted only if the accepted choice becomes hard to reverse and remains surprising despite the adapter seam. The adapter intentionally makes replacement cheaper, so an ADR is not automatically required.
- A future `docs/engineering/design/technology-stack.md` may provide a concise current inventory by category and link to `package.json`, the lockfile, Architecture and relevant RFCs/ADRs. It should not duplicate exact version numbers from manifests.

This placement follows TaskMate's existing documentation architecture and the general pattern seen in mature repositories: architecture documents explain the current system shape, manifests remain the dependency source of truth, and decision records preserve why consequential choices were made.

## Accepted decisions

- **D-01 — Initial mutation scope:** include non-destructive updates to existing Tasks: date, Priority, Labels, title, Steps and Notes. Task creation, completion, deletion, merge and split remain outside this review flow.
- **D-02 — Proposal persistence:** persist Proposals under `TaskMate/Proposals` so Codex and Obsidian can review the same proposal across process or app restarts. A `ChangeSet` is the typed change instruction; a `Proposal` is the review envelope and audit record, not a second Task database.
- **D-03 — Review surface:** use an Obsidian `ItemView` on desktop and a full-screen modal fallback on mobile.
- **D-04 — Proposal lifecycle:** move applied and rejected proposals to a history location and retain them for user-controlled cleanup. If only part of a proposal is approved, close the original with its exact result and generate a new pending proposal for the unapplied changes.
- **D-05 — Direct OS URI invocation:** replace the loopback bridge with Task Pilot directly invoking the TaskMate-owned URI through the operating system. TaskMate validates stable Proposal, Task and change identifiers and opens the review only. This removes the listener, port and bearer-token lifecycle while retaining automatic foreground activation proven by the spike.
- **D-06 — Tracking:** expand Issue #52 and use it as this RFC's tracking Issue. The updated Issue supersedes its earlier conversation-only and narrower mutation scope.
- **D-07 — Performance guardrail:** begin with ordinary rendering and synchronous calculation for the target 10–20 small Task files. Measure representative fixtures before merge, then add bounded or asynchronous calculation only when measured main-thread cost warrants it; do not invent a file-size threshold without evidence.

## Accepted follow-up decisions

- **U-01 — Proposal evidence: B.** Persist the complete before and after Markdown in the Proposal. This enables exact library-based diff regeneration, verifies `ChangeSet` instructions against generated and applied content, preserves the approved historical state after later Task edits, and trades a small amount of duplicate storage for auditability and reproducibility. These copies are immutable review evidence, not master data.
- **U-02 — History retention: A.** Do not delete Proposal history automatically. The user controls cleanup because an automatic age rule could erase the only review evidence before the user finishes an audit or resolves a later discrepancy; local Markdown storage keeps the retention cost visible and manageable.
- **U-03 — Obsidian foreground behavior: A.** After persisting a reviewable Proposal, Task Pilot automatically invokes the TaskMate URI and brings Obsidian forward. This removes the repeated manual handoff that motivated the spike; pending-review discovery remains the failure fallback so invocation failure never loses the Proposal.
- **U-04 — `brk` migration timing: A.** On the next Task review, propose `brk` to `context/break` normalization as an explicit, approvable change. This converges legacy data during an interaction the user is already reviewing without a separate bulk migration or an unrelated silent rewrite.
- **U-05 — Partial-approval identifiers: A.** Close the original Proposal with its exact result. A follow-up Proposal for unapplied changes receives new `C-xx` identifiers and retains references to the originating Proposal and change identifiers. New IDs prevent an old approval from being mistaken for approval of regenerated evidence, while origin references preserve traceability.

## Decision / status

Implemented in the current branch. The product direction, jsdiff choice, D-01 through D-07 and U-01 through U-05 were approved on 2026-10-12. The implementation includes Proposal persistence, deterministic evidence validation, the Review View, approval/history/follow-up handling, Task Pilot Proposal output and direct macOS, Windows, and Linux OS invocation of the TaskMate URI. No release is claimed.

Implementation amendment, 2026-10-14: the user removed the proposed `T-xx` review identifier as redundant. Current Proposals use the canonical Task UUID for machine identity and show the Task title and path for human context; only independently approvable changes receive Proposal-local `C-xx` identifiers. The completed Review View also adds the file list, per-Task change counts and collapsible Task sections described by this RFC. This amendment supersedes the earlier `T-xx` requirements in this historical proposal; the current contract is the linked Specification and Feature.

## Sources

- [jsdiff README and structured patch documentation](https://github.com/kpdecker/jsdiff/blob/master/README.md)
- [npm package `diff`: TypeScript declarations, zero dependencies and release metadata](https://www.npmjs.com/package/diff)
- [diff2html README: supported formats, file list and rendering modes](https://github.com/rtfpessoa/diff2html)
- [CodeMirror merge package](https://www.npmjs.com/package/@codemirror/merge)
- [CodeMirror merge reference](https://codemirror.net/docs/ref/)
- [Monaco Editor documentation](https://microsoft.github.io/monaco-editor/)
- [Google diff-match-patch archived repository](https://github.com/google/diff-match-patch)
- [fast-diff repository](https://github.com/jhchen/fast-diff)
- [Obsidian mobile development constraints](https://docs.obsidian.md/Plugins/Getting%20started/Mobile%20development)
- [Architecture Decision Record guidance and examples](https://github.com/architecture-decision-record/architecture-decision-record)
- [rust-analyzer repository, which links current architecture from its developer manual](https://github.com/rust-lang/rust-analyzer)

## Links

- Tracking Issue: [#52](https://github.com/tempu-village/taskmate/issues/52); its updated scope supersedes the earlier conversation-only proposal rule and narrower mutation scope.
- Current features: [Task Pilot review and capacity planning](../features/task-pilot-planning.md) and [Task change review](../features/task-change-review/README.md)
- Current specification: [Task change Proposal format](../specifications/task-change-proposal-format.md)
- Current design: [Architecture](../design/architecture.md)
- ADRs: None
- Implementation pull request: None
- Release: None
- Verification evidence: Proposal model, repository and renderer tests; Task Pilot planning-store tests; 2026-10-12 macOS URI spike

## 日本語参考

<!-- translation-status: ai-translated -->

> 英語版が正本です。この節はAI翻訳による参考です。

このRFCは、Task PilotがTask Markdownを書き換える前に、複数ファイルの変更案をObsidian上で一覧確認し、変更単位で承認できるReview Viewを提案します。意味的差分と生のMarkdown差分は同じ変更前・変更後データから決定的に生成し、AIが差分の事実情報を作りません。Markdown差分エンジンとしてjsdiff（npm名`diff`）を採用します。RFCは採用済みですが、依存追加や実装は行っていません。

jsdiffを推奨する主な理由は、完成済みの画面を提供するからではありません。TaskMateが必要とする行単位の構造化差分だけを提供し、意味的なTask差分、承認操作、Obsidianらしい表示、snapshot照合、Markdown保存をTaskMate側に残せるからです。TypeScript型を同梱し、npm上の依存がゼロで、GitやNodeを実行せずブラウザ互換のJavaScriptとして利用できます。

`diff2html`はGitHub風表示やファイル一覧を素早く作る用途では有力ですが、入力となるunified diffを別途生成する必要があります。また、TaskMate固有の承認UIを組み込むには既製のHTML/CSSを調整する必要があります。CodeMirror Merge Viewは本格的な編集・大文書比較には有力ですが、10〜20個の小さいTaskファイルを一覧確認する目的にはeditor一式が重めです。MonacoはVS Codeに最も近い一方、公式にモバイルブラウザ非対応であり、TaskMateのモバイル対応と衝突します。Googleのdiff-match-patchは公式repositoryがarchive済みです。Git CLIはVaultがGit repositoryとは限らず、Obsidian mobileから実行できないためruntime候補にはできません。

文書配置については、現在の提案と比較はこのRFCを正本にします。実装後は`docs/engineering/design/architecture.md`へdiff-engine seamの概要だけを追記し、詳細な比較はRFCへのリンクに留めます。TaskMate全体の技術一覧が必要なら、別途`docs/engineering/design/technology-stack.md`を作り、分類・用途・正本へのリンクを短く整理するのが適切です。依存の正確な名前とversionは`package.json`とlockfileを正本とし、手書き一覧へ複製しません。

Codexの表示内では`obsidian://`リンクをクリックできませんでしたが、Task PilotがOS経由でTaskMate独自URIを直接実行するspikeは成功しました。Obsidianの起動中・終了中の両方、Vault指定、Task UUIDによる対象Task表示を確認しています。URIはReview Viewを開くだけとし、承認や変更適用は行いません。`D-05`は「loopback bridge」から「Task PilotがOS経由でTaskMate独自URIを直接実行」へ変更しました。listener、port、token管理を不要にしつつ、spikeで確認した自動前面表示を維持できるためです。`D-01`〜`D-07`は2026-10-12に採用され、現在branchへ実装済みです。Windows／Linuxの起動adapterも実装済みですが、各OSでの実機確認とreleaseはまだありません。

2026-10-14の実装修正では、重複する`T-xx`を不要とするユーザー判断により、Taskの機械的識別には正規のTask UUID、画面上の文脈にはタイトルとパスを使用し、承認可能な変更だけに`C-xx`を付ける形へ変更しました。現在の仕様とFeatureが、このRFC内の以前の`T-xx`記述に優先します。

`ChangeSet`は型付きの変更指示です。`Proposal`は、その`ChangeSet`、変更前後のMarkdown全文、承認内容、適用結果を保持するレビュー証跡です。前後MarkdownはTaskの正本ではなく、jsdiffによる正確な差分再生成、指示と生成・適用結果の照合、後日変更されたTaskに対する承認時点の再確認のために保存します。Proposal履歴は自動削除せず、ObsidianはProposal保存後に自動で前面表示します。`brk`の正規化は次回レビューで明示的に提案し、一部承認後の再提案には新しい`C-xx`を付けて元の識別子への参照を残します。

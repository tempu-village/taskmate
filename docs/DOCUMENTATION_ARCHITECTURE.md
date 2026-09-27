# TaskMate documentation architecture

Status: Active repository policy. [Specifications](engineering/specifications/README.md) own product guarantees.

## Model and ownership

TaskMate uses Pattern B with a two-level, three-area model: the common product contract branches into user guidance and internal design. The directory layout groups specifications and design under `engineering/` for human developers and AI; specifications remain shared authority for user documentation too. The user requested this grouping and the explicit names `specifications`, `design` and `adr`; this replaces the earlier folder arrangement.

| Location | Owns |
| --- | --- |
| `README.md` | Product introduction, installation and short entry links |
| `docs/index.md` | Human navigation |
| `docs/engineering/specifications/overview.md` | Product purpose, principles, non-goals and supported scope |
| `docs/engineering/specifications/` | Feature guarantees, acceptance criteria and approval/implementation status |
| `docs/engineering/design/` | Architecture, data ownership, security and verification |
| `docs/engineering/design/features/` | Feature-specific internal mechanics and failure boundaries |
| `docs/engineering/design/adr/` | Hard-to-reverse decisions, alternatives and consequences |
| `docs/user/` | First-use tutorials, goal-specific How-to and recovery |
| `docs/proposals/` | Substantial proposed changes and their historical context |
| `docs/operations/` | Release and repeatable operational recovery |
| `docs/templates/` | Lightweight authoring shapes for specifications and designs |
| `CONTEXT.md` | Stable domain vocabulary |
| `AGENTS.md` | AI reading routes, hard constraints and verification entry |
| `CONTRIBUTING.md` | Contribution and review workflow |

## Permanent homes

Following [GitHub's content model](https://docs.github.com/en/contributing/style-guide-and-content-model/about-the-content-model#reusing-content), reuse small shared strings deliberately; avoid copying large sections without a reason. For information needed in multiple documents:

1. Identify each document's reader and purpose.
2. Choose one permanent home for the information.
3. Write its complete rule there once.
4. Link to it elsewhere and add only reader-specific explanation.

For a future recurring-task feature, `engineering/specifications/recurring-tasks.md` would own its behavior; a How-to would explain completing it; `engineering/design/features/recurring-tasks.md` would explain calculation and recovery. Recurrence is not currently implemented. Portable Skill schemas retain their existing home; design docs link to them. Markdown is canonical; Word/PDF are derived deliverables and external wikis link here.

## Granularity and growth

A small wording/style/internal refactor normally needs only the existing record and tests. A behavior change needs a focused specification or an update to one. Complex concurrent, security-sensitive or migration work also needs a design document; a hard-to-reverse choice needs an ADR. Large alternatives/discussion belong in a proposal. An Issue owns scope and progress, not a second permanent specification.

Start a feature as one stable Markdown file, using the [feature template](templates/feature-spec.md). Write purpose, guarantees, relevant normal/empty/error/cancel/retry behavior, acceptance and evidence. Add data/privacy/release considerations when they affect the feature. Describe observable behavior and durable constraints; leave line-by-line processing to code.

When a file becomes difficult to read or has independently changing sections, replace `feature.md` with `feature/README.md` and related Markdown files in that single feature folder. The README owns the map; each rule still has one home. Preserve acceptance IDs, update inbound links/anchors, and use Git history instead of dated copies. Create directories only with real content. Use the [design template](templates/design-doc.md) for internal boundaries and failure handling; a design is not mandatory for every feature.

## Approval, implementation and changes

Every feature specification records two independent fields:

- **Approval:** Proposed, Accepted, Rejected or Superseded. Accepted means a documented product decision, not passing tests.
- **Implementation:** Not implemented, Partial or Implemented, with current-branch/release scope and any known gaps.

Carried-forward existing contracts can retain acceptance with their original ADR/spec evidence. A migration must not invent approval for proposed behavior. Keep proposed changes to an existing feature in a clearly marked pending-change section linked to its Issue/proposal; preserve the current guarantee until the implementation change lands. A new accepted but unimplemented feature may have its own specification with that state visible. Track partial implementation per acceptance criterion when needed. Record a release only when verified; merging and releasing differ.

On completion, update implementation state, evidence, affected user/design/operations docs and proposal links in the same PR. Proposals retain discussion history; annotate implemented/superseded/pending status rather than treating historical acceptance checklists as current rules. ADR decisions retain their accepted rationale; a later ADR supersedes an earlier one with links and status metadata.

## Evidence and disagreement

Assign stable local acceptance IDs, such as `IMPORT-01`, where tests or other documents need a precise reference. Link each group to meaningful test files and list required manual scenarios. Use [the verification map](engineering/design/testing.md) for cross-feature coverage and gaps.

Specifications record intended guarantees; code shows implemented behavior; tests demonstrate selected cases. If they disagree, record both claims, evidence and the outstanding decision/fix. Do not change an accepted guarantee merely to make documentation agree with a bug, or claim complete coverage from a passing suite. Pure documentation corrections may use existing accepted decisions plus implementation/tests as evidence.

## Agent reading and maintenance

Start at `AGENTS.md`, then load the relevant specification, design, ADR and evidence only as needed. Human developers and agents share these records. AI may draft specs, find drift/duplicates/broken links and suggest test cases; product value, non-goals, risk acceptance and important trade-offs remain human decisions.

For every change, state documentation impact in the PR: specification, user, design/ADR, operations, evidence, or why none applies. Use the repository checks and [testing guide](engineering/design/testing.md). At least quarterly review indexes for stale claims, missing owners, duplicates, broken links and evidence gaps. Record an identifiable owner where available; do not invent one. Material changes/removals receive human review.

English is canonical. Preserve existing Japanese references and update them with the source; AI translations remain visibly `ai-translated`. New internal design records may be English-only when no maintained translation exists. Check document links and translated structures using repository-owned checks. Keep credentials, private Vault content and unredacted logs out of examples; review publication boundaries when audiences change.

Keep Pattern B in this repository while code and docs change together. Split public user docs into another repository only when release, permissions, localization, build or ownership requires independence. Define canonical contracts, version compatibility and cross-repository link checks before doing so.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

### モデルと配置

Pattern Bの共通製品契約・利用者向け説明・内部設計という2階層3区分を維持します。今回の承認により仕様と設計を`engineering/`へまとめ、`specifications/`、`design/`、`design/adr/`を採用します。仕様は利用者向け文書も参照する共通の正本です。配置と責任は上の表を正本にします。

### 恒久的な置き場所

[GitHubのContent Model](https://docs.github.com/en/contributing/style-guide-and-content-model/about-the-content-model#reusing-content)に従い、各文書の読者と目的を確認し、情報の正本を一つ選び、詳細を一度だけ書き、他からリンクします。短い共通文は意図的に再利用できます。将来の繰り返しタスクなら製品仕様が挙動、How-toが操作、機能設計が計算と復旧を扱います。現時点で繰り返し機能は未実装です。portable Skillのschemaは移さず参照します。Markdownを正本、Word/PDFを派生成果物にします。

### 粒度と分割

小変更は既存文書を更新し、機能変更には仕様、複雑な競合・security・移行には設計、戻しにくい判断にはADRを用意します。大きな検討はProposal、進捗はIssueです。機能仕様は単体Markdownから始め、目的、保証、必要な正常・空・失敗・取消し・再試行、受け入れ条件と検証を書きます。行単位の処理説明はコードへ委ねます。

長く読みにくくなったら`feature.md`を同名フォルダーに分割し、READMEと関連Markdownを一箇所にまとめます。正本と受け入れIDを保ち、全参照とanchorを更新します。空カテゴリや日付別コピーは作りません。仕様・設計のtemplateを用意し、全機能に内部設計を強制しません。

### 状態と更新

承認状態（Proposed / Accepted / Rejected / Superseded）と実装状態（Not implemented / Partial / Implemented）を別々に記録します。承認は製品判断、実装はbranch/releaseの現状です。既存仕様は根拠とともに継承し、未承認の提案を自動承認しません。既存機能への未実装変更は予定節に分けて現行保証を残します。完了時は同じPRで実装状態、検証、操作説明、設計、運用、Proposalリンクを更新します。ADRの採用理由は保持し、新判断で置換します。

### 検証と不一致

必要な箇所に安定した受け入れIDを付け、実際のテストと手動確認へ対応させます。仕様は意図、コードは実装、テストは選択したケースの根拠です。不一致は両方の主張・根拠・必要な判断や修正を[検証方針](engineering/design/testing.md)へ記録します。バグに合わせて承認済み保証を弱めず、成功したテストから全条件を検証済みと推定しません。

### AIと保守

AGENTSから関連仕様、設計、ADR、検証へ必要な分だけ進み、人間とAIで正本を共有します。AIは初稿・不一致・重複・リンク・テスト候補を支援し、製品価値、非対象、重要判断は人間が決めます。PRで文書影響を明記し、四半期ごとに古さ・owner・重複・参照・検証不足を確認します。英語正本と既存日本語参考を同時更新し、AI翻訳を明示します。機密データを例に含めません。公開周期・権限・翻訳・buildが独立するまで同じrepositoryのPattern Bを維持します。

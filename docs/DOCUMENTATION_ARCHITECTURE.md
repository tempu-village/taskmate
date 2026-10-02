# TaskMate documentation architecture

Status: Active repository policy. [Features](engineering/features/README.md) own current capability What and feature-specific How; [Specifications](engineering/specifications/README.md) own strict technical contracts.

## Model and ownership

TaskMate uses a feature-centered engineering model. Feature documents are the shared current authority for user-visible behavior and feature-specific internals. Specifications hold strict reusable contracts, Design holds cross-cutting structure, RFCs preserve substantial-change proposals and implementation-decision history, and ADRs preserve accepted durable rationale.

| Location | Owns |
| --- | --- |
| `README.md` | Product introduction, installation and short entry links |
| `docs/index.md` | Human navigation |
| `docs/engineering/features/overview.md` | Product purpose, principles, non-goals and supported scope |
| `docs/engineering/features/` | Current feature What and feature-specific How, including guarantees, processing, failures and verification |
| `docs/engineering/specifications/` | Strict normative formats, schemas, limits, transitions, compatibility and security contracts |
| `docs/engineering/design/` | Cross-cutting architecture, data ownership, security and verification |
| `docs/engineering/adr/` | Hard-to-reverse decisions, alternatives and consequences |
| `docs/user/` | First-use tutorials, goal-specific How-to and recovery |
| `docs/engineering/rfcs/` | Proposals and decision history from substantial-change review through implementation; not current product authority |
| `docs/operations/` | Release and repeatable operational recovery |
| `docs/templates/` | Lightweight authoring shapes for Features, designs and RFCs |
| `CONTEXT.md` | Stable domain vocabulary |
| `AGENTS.md` | AI reading routes, hard constraints and verification entry |
| `CONTRIBUTING.md` | Contribution and review workflow |

## Permanent homes

Following [GitHub's content model](https://docs.github.com/en/contributing/style-guide-and-content-model/about-the-content-model#reusing-content), reuse small shared strings deliberately; avoid copying large sections without a reason. For information needed in multiple documents:

1. Identify each document's reader and purpose.
2. Choose one permanent home for the information.
3. Write its complete rule there once.
4. Link to it elsewhere and add only reader-specific explanation.

For a future recurring-task feature, `engineering/features/recurring-tasks.md` would own its behavior, calculation, feature-specific failures and verification; a How-to would explain completing it. A shared recurrence file format or state machine would belong in `engineering/specifications/`. Recurrence is not currently implemented. Portable Skill schemas retain their existing home and repository Specifications link to them. Markdown is canonical; Word/PDF are derived deliverables and external wikis link here.

## Granularity and growth

A small wording/style/internal refactor normally needs only the existing record and tests. A behavior or feature-specific processing change updates its Feature. A strict shared contract change also updates its Specification; a cross-cutting architecture change updates Design; a hard-to-reverse choice needs an ADR. A substantial change's problem, design decisions, alternatives, constraints, migration and acceptance conditions belong in an RFC. An Issue owns the change entry point, scope, priority, discussion, progress and PR links; it must not be duplicated in the RFC.

Start a feature as one stable Markdown file, using the [feature template](templates/feature-spec.md). Write it as a standalone current reference for future implementers and maintainers and for users who need exact behavior. Cover purpose, available behavior, guarantees, constraints, persisted representation, relationships to other features, relevant normal/empty/error/cancel/retry behavior, acceptance and evidence. Add data/privacy/release considerations when they affect the feature. Describe observable behavior and durable constraints; leave line-by-line processing to code. There is no line limit; length follows feature complexity.

When a file becomes difficult to read or has independently changing sections, replace `feature.md` with `feature/README.md` and related Markdown files in that single feature folder. The README owns the map; each rule still has one home. Preserve acceptance IDs, update inbound links/anchors, and use Git history instead of dated copies. Create directories only with real content. Use the [design template](templates/design-doc.md) only for cross-cutting internal boundaries.

## Approval, implementation and changes

Every Feature records two independent fields:

- **Approval:** Proposed, Accepted, Rejected or Superseded. Accepted means a documented product decision, not passing tests.
- **Implementation:** Not implemented, Partial or Implemented, with current-branch/release scope and any known gaps.

Carried-forward existing contracts can retain acceptance with their original ADR or evidence. A migration must not invent approval for proposed behavior. Keep proposed changes to an existing Feature in a clearly marked pending-change section linked to its Issue and RFC; preserve the current guarantee until the implementation change lands. Track partial implementation per acceptance criterion when needed. Record a release only when verified; merging and releasing differ.

On completion, update implementation state, evidence, affected user/design/operations docs and RFC links in the same PR. RFCs retain design-review and decision history with `draft`, `accepted`, `implemented`, `rejected` or `superseded` metadata. `accepted` means agreement on direction, not proof of implementation or release and not a guarantee that the final design is identical. Track material implementation departures in an RFC amendment, follow-up RFC or linked implementation PR. For every implemented product RFC, confirm current behavior in implementation, tests and review; create or update the Feature without copying RFC-only background, alternatives, hypotheses or migration history; add reciprocal links and the implementation PR/release when known; then mark the RFC `implemented`. Keep implemented RFCs substantially unchanged as history. Pure Operations or cross-cutting Design RFCs link to that maintained authority instead of inventing a Feature. Historical checklists are not current rules. ADR decisions retain their accepted rationale; a later ADR supersedes an earlier one with links and status metadata.

## Evidence and disagreement

Assign stable local acceptance IDs, such as `IMPORT-01`, where tests or other documents need a precise reference. Link each group to meaningful test files and list required manual scenarios. Use [the verification map](engineering/design/testing.md) for cross-feature coverage and gaps.

Features record intended capability guarantees and feature-specific processing; Specifications record strict technical contracts; code shows implemented behavior; tests demonstrate selected cases. If they disagree, record both claims, evidence and the outstanding decision or fix. Do not change an accepted guarantee merely to make documentation agree with a bug, or claim complete coverage from a passing suite.

## Agent reading and maintenance

Start at `AGENTS.md`, then load the relevant Feature, Specification, Design, ADR and evidence only as needed. Human developers and agents share these records. AI may draft records, find drift/duplicates/broken links and suggest test cases; product value, non-goals, risk acceptance and important trade-offs remain human decisions.

For every change, state documentation impact in the PR: Feature, Specification, user, Design/ADR, operations, evidence, or why none applies. Use the repository checks and [testing guide](engineering/design/testing.md). At least quarterly review indexes for stale claims, missing owners, duplicates, broken links and evidence gaps. Record an identifiable owner where available; do not invent one. Material changes/removals receive human review.

English is canonical. Preserve existing Japanese references and update them with the source; AI translations remain visibly `ai-translated`. New internal design records may be English-only when no maintained translation exists. Check document links and translated structures using repository-owned checks. Keep credentials, private Vault content and unredacted logs out of examples; review publication boundaries when audiences change.

Keep this feature-centered model in this repository while code and docs change together. Split public user docs into another repository only when release, permissions, localization, build or ownership requires independence. Define canonical contracts, version compatibility and cross-repository link checks before doing so.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

### モデルと配置

Feature中心の構成を採用します。Featureは利用者から見たWhatと機能固有のHow、Specificationは厳密な共通契約、Designは横断設計、RFCは大きな変更の提案から実装判断までの履歴、ADRは採用済みの重要な理由を所有します。配置と責任は上の表を正本にします。

### 恒久的な置き場所

[GitHubのContent Model](https://docs.github.com/en/contributing/style-guide-and-content-model/about-the-content-model#reusing-content)に従い、各文書の読者と目的を確認し、情報の正本を一つ選び、詳細を一度だけ書き、他からリンクします。短い共通文は意図的に再利用できます。将来の繰り返しタスクならFeatureが挙動・計算・失敗、How-toが操作、Specificationが共通形式や状態遷移を扱います。現時点で繰り返し機能は未実装です。portable Skillのschemaは移さず参照します。Markdownを正本、Word/PDFを派生成果物にします。

### 粒度と分割

小変更は既存文書を更新し、機能の挙動や固有処理はFeature、厳密な共通契約はSpecification、横断構造はDesign、戻しにくい判断はADRを更新します。大きな変更の問題、設計判断、代替案、制約、移行、受け入れ条件はRFC、変更の入口・範囲・進捗はIssueです。RFCとIssueで要件やチェックリストを二重管理しません。Featureは将来の実装者・保守者と正確な挙動を知りたい利用者が単独で理解できる現行リファレンスとし、利用可能な機能、保証、制約、保存形式、他機能との関係、処理、失敗、受入条件と検証を書きます。行数上限は設けず、機能の複雑さに応じた長さにします。

長く読みにくくなったら`feature.md`を同名フォルダーに分割し、READMEと関連Markdownを一箇所にまとめます。正本と受け入れIDを保ち、全参照とanchorを更新します。空カテゴリや日付別コピーは作りません。内容のない見出しは強制しません。

### 状態と更新

Featureの承認状態（Proposed / Accepted / Rejected / Superseded）と実装状態（Not implemented / Partial / Implemented）を別々に記録します。RFCは`draft` / `accepted` / `implemented` / `rejected` / `superseded`を使い、`accepted`は方針への合意であって、実装・リリース・最終設計との完全一致を保証しません。実装中の重要な差分はRFC追記、後続RFC、または実装PRで追跡可能にします。実装後はコード・テスト・レビューで確定した現行動作をFeatureへ反映し、RFC固有の背景、代替案、仮説、移行経緯は転記せず相互リンクします。実装PRと確認済みリリースを必要に応じて追加してRFCを`implemented`にし、RFC自体は判断履歴として大きく書き換えません。運用または横断設計だけのRFCは、不要なFeatureを作らずOperationsまたはDesignを正本にします。

### 検証と不一致

必要な箇所に安定した受け入れIDを付け、実際のテストと手動確認へ対応させます。FeatureとSpecificationは意図された保証、コードは実装、テストは選択したケースの根拠です。不一致は両方の主張・根拠・必要な判断や修正を[検証方針](engineering/design/testing.md)へ記録します。バグに合わせて承認済み保証を弱めず、成功したテストから全条件を検証済みと推定しません。

### AIと保守

AGENTSから関連Feature、Specification、設計、ADR、検証へ必要な分だけ進み、人間とAIで正本を共有します。AIは初稿・不一致・重複・リンク・テスト候補を支援し、製品価値、非対象、重要判断は人間が決めます。PRで文書影響を明記し、四半期ごとに古さ・owner・重複・参照・検証不足を確認します。英語正本と既存日本語参考を同時更新し、AI翻訳を明示します。機密データを例に含めません。公開周期・権限・翻訳・buildが独立するまで同じrepositoryのFeature中心モデルを維持します。

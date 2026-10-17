# Module boundaries

Status: Current repository policy.

## Goals

Place code that changes for the same reason in the same Module. A Module should give callers substantial behavior through a small Interface, keep implementation knowledge local, and remain testable through the same seam used by production callers.

Organize by product capability and responsibility before technical category. A feature folder may contain Domain, Application, and Adapter files when that makes the feature boundary obvious; it does not need a directory for every conceptual layer.

## Module vocabulary

- **Module**: anything with an Interface and an Implementation, at any scale from a function to a feature folder.
- **Interface**: everything a caller must know to use a Module correctly, including types, invariants, ordering, errors, configuration, and performance constraints. It is not limited to a TypeScript `interface` declaration.
- **Implementation**: code hidden behind a Module's Interface.
- **Seam**: a place where behavior can vary without editing the caller.
- **Adapter**: a concrete implementation that satisfies an Interface at a seam, such as an Obsidian ItemView or Vault-backed repository.

Prefer deep Modules: a small Interface that hides meaningful behavior. Do not add forwarding files, pass-through classes, or speculative abstractions that make the Interface almost as complex as the Implementation.

## Responsibilities and dependency direction

- **UI Adapter** owns ItemView, DOM rendering, UI state, navigation, and translation mapping. It emits intent and does not contain persistence rules.
- **Application** coordinates a use case and its result. Introduce an Application Module only when coordination is substantial enough to hide from callers.
- **Domain** owns pure validation, decisions, calculations, and state transitions. It must not depend on Obsidian, DOM, Vault, or UI state.
- **Persistence Adapter** owns Vault access, path resolution, serialization lifecycle, and guarded writes. It may depend on Domain types and behavior; Domain must not depend on it.
- The composition root constructs concrete Adapters and gives them to callers. It may depend on each Module it wires.

Allowed directions are:

```text
UI Adapter ───────→ Application ───────→ Domain
     │                                      ↑
     └────────────→ Persistence Adapter ────┘

Composition root → UI Adapter / Application / Persistence Adapter
```

Conceptual layers do not require matching folders or TypeScript interfaces. Preserve the direction without creating shallow Modules.

## Public Interface

- Export only values and types used by a caller outside the file.
- Keep helpers and constituent types private when callers can use the exported aggregate without naming them.
- Use explicit imports from the owning file. Do not add wildcard barrel exports that expose an entire directory.
- A compatibility re-export must name its current callers and removal condition in the change record.
- Treat the Module Interface as the test surface. Prefer observable results over assertions against private state.

## TypeScript rules

- Keep ES Modules with `module: ESNext` and `moduleResolution: Bundler`.
- Use `import type` when a dependency is erased at runtime.
- Do not introduce global namespaces.
- Keep the import graph acyclic.
- Prefer a discriminated union with a required `kind` when callers must handle multiple variants. Do not model unrelated variants as one type with many optional fields or methods.
- Do not use `any` or broad type assertions to hide an invalid dependency.

## Interface policy

Introduce a TypeScript interface or injected port only at a real seam:

1. Identify the caller and the knowledge the Interface hides from it.
2. Identify each production or test Adapter that implements the Interface.
3. Confirm the behavior has the same meaning for every Adapter.
4. Apply the deletion test: removing the Interface should make meaningful complexity leak into multiple callers.

One Adapter normally means the seam is hypothetical. Keep the concrete type unless a second production or test Adapter exists or a hard external dependency requires an owned port. A Module may use private internal seams for its own tests without expanding its external Interface.

## Review Modules

Each review kind owns its Domain schema, decisions, persistence lifecycle, and UI details. Task change Proposals and future Source candidate Proposals must remain separate persisted schemas and separate feature Modules.

Place a contract under `src/reviews/shared/` only after at least two review kinds use it with the same meaning. Shared review code must not import a feature-specific review Module. Feature-specific Modules may depend on shared review contracts, but review kinds must not depend on one another.

Potentially shareable concepts include a stable review-kind discriminator, pending/history placement, or a minimal list summary, but only after the implemented callers prove the common semantics. Task change IDs and field approval, stale regeneration, Source candidate provenance and `create / merge / exclude / pending` decisions, screen state, rendering details, and persisted Proposal schemas remain feature-specific.

Do not combine opening a review, making an in-memory decision, and persisting an application result into one Interface merely because they occur in one workflow. Navigation, UI state, Domain decisions, and persistence change for different reasons.

The current implementation has only Task change review, so it lives in `src/reviews/task-change/` and no `shared` Module exists. A future review kind should be added as a sibling Module; adding it must not require changing the Task change Proposal Domain.

## Verification

For a Module-structure change:

1. Run `npm run typecheck`, `npm test`, and `npm run build`.
2. Run the repository-wide Python, Skill, localization, and documentation checks from [Testing](testing.md).
3. Inspect every new export and retain it only when an actual caller exists.
4. Confirm Domain files do not import Obsidian, DOM, or Vault Adapters.
5. Confirm type-only dependencies use `import type`.
6. Confirm feature-specific review Modules do not import one another and `reviews/shared`, if present, does not import them.
7. Run the review Module boundary test, which checks the TypeScript import graph for cycles and forbidden shared-to-feature dependencies.

## Related records

- [Architecture](architecture.md) maps these rules to the current code.
- [Task change review](../features/task-change-review/README.md) owns current review behavior.
- [Task change Proposal format](../specifications/task-change-proposal-format.md) owns the persisted schema and lifecycle contract.
- [RFC 0032](../rfcs/0032-use-jsdiff-for-task-change-preview.md) preserves the implemented diff-engine decision history.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

同じ理由で変更されるコードを同じModuleへ置き、小さいInterfaceの背後へ意味のあるImplementationを隠します。Module、Interface、Implementation、Seam、Adapterは上記の定義で使い、TypeScriptの`interface`宣言だけをInterfaceとは呼びません。

依存はUI AdapterからApplicationとPersistence Adapterへ、ApplicationとPersistence AdapterからDomainへ向けます。DomainはObsidian、DOM、Vault、UI状態へ依存しません。概念上の各責務に対応するフォルダーやinterfaceを機械的に作らず、転送だけの浅いModuleを避けます。

外部で実際に使う値と型だけをexportし、型だけの依存には`import type`を使い、循環依存とwildcard barrel exportを禁止します。複数variantを扱うときは、多数のoptional fieldより必須`kind`を持つ判別可能Unionを優先します。

interfaceまたはportは、呼び出し側、隠す知識、同じ意味を持つ複数Adapter、削除時に複数callerへ漏れる複雑さを説明できる実在のseamにだけ置きます。Adapterが一つだけなら通常は具象型を保ち、テスト用の内部seamを外部Interfaceへ広げません。

各Review種別はDomain schema、判断、永続化、UI詳細を所有します。`src/reviews/shared/`は、実装済みの複数Reviewが同じ意味で使う契約が現れた場合だけ作ります。`shared`から機能固有Reviewへの依存、Review種別間の依存、異なるProposal schemaの統合は禁止します。現在はTask変更Reviewだけなので`src/reviews/task-change/`へ集約し、`shared`は作りません。

構造変更後はrepository指定の全検証に加え、exportのcaller、Domainの依存、`import type`、Review間の依存方向、import cycleを確認します。Review Module boundary testは循環依存と`shared`から機能固有Moduleへの依存を自動確認します。

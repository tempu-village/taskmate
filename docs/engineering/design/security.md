# Security and trust boundaries

Status: Current implementation boundaries; not a third-party security audit.

## Plugin and agent

The plugin uses Vault APIs and local dictionaries. The [storage/privacy contract](../features/storage-and-privacy.md) owns public guarantees. The agent runs with its host's permissions and may use a model service; plugin privacy statements do not cover that service.

Source selection is a strict extraction allowlist. It is not an OS sandbox. In particular, current [source discovery](../features/source-import.md#current-discovery-limitation) reads non-managed Markdown before deciding eligibility. Do not claim that scope filtering provides read isolation.

Task Pilot's Python helper [safe_path](../../../skills/taskpilot/scripts/todo_store.py) resolves paths and rejects paths outside the Vault for operations that use it. This does not provide a distributed lock or remove filesystem races. Use a disposable Vault for adversarial path and concurrent-write checks.

## Writes and recovery

A coverage review and explicit decisions precede promotion. Hash checks reject known stale source/merge snapshots; multi-file promotion is not a transaction. [Source import](../features/source-import.md) records crash/retry limits. Task editor guarded writes protect local content; synchronization-provider conflicts remain outside that boundary. [Edit conflicts](../features/edit-conflicts.md) explains the local checks.

Use sanitized fixtures in examples and tests. Keep credentials, private Vault contents and unredacted logs out of public docs. When changing storage, synchronization, source selection or external services, review disclosure, data preservation and recovery along with functional tests.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

この文書は現在の信頼境界であり、第三者監査ではありません。プラグインとAgentホストの権限・外部サービスを区別します。Source許可リストは抽出範囲であり、OSの読み取り分離ではありません。現在の探索は対象外Markdownも適格性判定のために読みます。

Pythonのsafe_pathは呼出箇所でVault外を拒否しますが、分散ロックや競合の完全防止ではありません。反映前のレビュー・明示判断・ハッシュ確認を保ち、複数ファイルの更新を一括transactionとみなしません。テストと公開例には匿名化したデータを使い、保存・同期・外部サービス変更では情報開示と復旧も確認します。

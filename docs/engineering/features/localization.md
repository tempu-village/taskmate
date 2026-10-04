# Localization

Approval: Accepted — carried forward from the existing product contract.
Implementation: Implemented on the current branch; verification scope is recorded below.

> English is canonical. Japanese is an AI-translated reference.

## Contract

TaskMate supports Auto, English, and Japanese. Auto follows Obsidian's locale when supported and otherwise falls back to English. Changing the setting updates TaskMate views and settings immediately; command names and the ribbon tooltip update after the plugin is reloaded.

TaskMate uses static bundled dictionaries. It does not send vault content to an external translation service. English keys and documentation are canonical, and Japanese must be updated in the same change with an explicit translation status.

## Acceptance and evidence

- I18N-01: Auto uses a supported Obsidian locale or English fallback.
- I18N-02: Changing language refreshes views/settings; commands and ribbon text refresh on reload.

Automated evidence: [i18n.test.ts](../../../test/i18n.test.ts). These tests cover selected behavior, not every UI scenario. Device checks and remaining gaps: [verification](../design/testing.md). Storage syntax: [Task Pilot schema](../../../skills/taskpilot/references/task-schema.md).

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：既存の製品契約から継承した承認済み仕様。実装：現在のブランチに実装済み。検証範囲は上記のテストと[検証方針](../design/testing.md)を参照してください。

### 製品契約

TaskMateは、自動、English、日本語に対応します。自動は、対応している場合はObsidianのロケールに従い、それ以外は英語へフォールバックします。設定変更はTaskMateの画面と設定へ即時反映し、コマンド名とリボンのツールチップはプラグイン再読み込み後に更新します。

TaskMateは、同梱した静的辞書を使います。Vaultの内容を外部翻訳サービスへ送信しません。英語のキーと文書を正本とし、日本語を同じ変更内で、明示的な翻訳状態とともに更新します。

### 受け入れ条件

- I18N-01: 自動では対応するObsidianロケール、または英語を使う。
- I18N-02: 言語変更で画面と設定を更新し、コマンドとリボンは再読込で更新する。

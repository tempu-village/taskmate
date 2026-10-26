# Localization

Approval: Accepted — carried forward from the existing product contract.
Implementation: Implemented on the current branch; verification scope is recorded below.

> English is canonical. Japanese is an AI-translated reference.

## Contract

TaskMate supports Auto, English, and Japanese. Auto follows Obsidian's locale when supported and otherwise falls back to English. Changing the setting updates TaskMate views and settings immediately; command names and the ribbon tooltip update after the plugin is reloaded.

Task Pilot runs outside Obsidian and cannot read Obsidian's language, so TaskMate records it for Task Pilot:

- Each time TaskMate loads in the desktop Obsidian app, it reads Obsidian's language and stores the language Auto resolves to as `desktopLanguage` in its settings file. It writes only when that value changed, so an ordinary start does not modify the synchronized settings file.
- The mobile app never writes `desktopLanguage`, so a phone set to another language does not change it. With several desktops, the one started most recently wins.
- Task Pilot writes text in the explicit English or Japanese setting first, then in `desktopLanguage`. When neither exists the language is unknown: Task Pilot uses the language of clearly single-language selected Sources, or asks the user, and never falls back to English silently. An Import review records the language and how it was decided.
- Obsidian applies a language change by reloading its window. In Obsidian 1.12.7 both the Relaunch button in Settings and the language menu on the vault chooser save the language and reload the app window instead of restarting the application, which is why it is fast. The reload starts Obsidian's code again in that window and loads every enabled plugin anew, so TaskMate reads and records the new language immediately.

TaskMate uses static bundled dictionaries. It does not send vault content to an external translation service. English keys and documentation are canonical, and Japanese must be updated in the same change with an explicit translation status.

## Acceptance and evidence

- I18N-01: Auto uses a supported Obsidian locale or English fallback.
- I18N-02: Changing language refreshes views/settings; commands and ribbon text refresh on reload.
- I18N-03: The desktop app records the language Auto resolves to only when it changes, the mobile app never records it, and Task Pilot uses the explicit setting, then the recorded desktop language, and otherwise reports the language as unknown instead of defaulting to English.

Automated evidence: [i18n.test.ts](../../../test/i18n.test.ts) and Task Pilot's [store tests](../../../skills/taskpilot/tests/test_todo_store.py). These tests cover selected behavior, not every UI scenario. Device checks and remaining gaps: [verification](../design/testing.md). Storage syntax: [Task Pilot schema](../../../skills/taskpilot/references/task-schema.md).

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：既存の製品契約から継承した承認済み仕様。実装：現在のブランチに実装済み。検証範囲は上記のテストと[検証方針](../design/testing.md)を参照してください。

### 製品契約

TaskMateは、自動、English、日本語に対応します。自動は、対応している場合はObsidianのロケールに従い、それ以外は英語へフォールバックします。設定変更はTaskMateの画面と設定へ即時反映し、コマンド名とリボンのツールチップはプラグイン再読み込み後に更新します。

Task PilotはObsidianの外で動くため、Obsidianの言語を読めません。そこでTaskMateがTask Pilotのために記録します：

- パソコン版ObsidianでTaskMateが読み込まれるたびに、Obsidianの言語を読み、「自動」で決まる言語を設定ファイルの`desktopLanguage`に保存します。値が変わったときだけ書き込むため、普段の起動では同期される設定ファイルを変更しません。
- スマホ版は`desktopLanguage`を書き込まないため、別の言語にしたスマホが値を変えることはありません。パソコンが複数ある場合は、最後に起動したパソコンの言語になります。
- Task Pilotは、明示した英語または日本語の設定を最優先し、次に`desktopLanguage`で文を書きます。どちらもなければ言語は「不明」となり、選んだ元ノートが明らかに1つの言語ならその言語を使い、そうでなければ利用者に確認します。黙って英語にはしません。取り込みレビューには、使った言語とその決め方を記録します。
- Obsidianは、ウィンドウを読み込み直して言語の変更を反映します。Obsidian 1.12.7では、設定画面の「再起動」ボタンも、保管庫を選ぶ画面の言語メニューも、言語を保存してアプリのウィンドウを読み込み直すもので、アプリそのものの再起動ではないため速く終わります。読み込み直しでは、そのウィンドウでObsidianのコードが最初から動き、有効なプラグインをすべて新しく読み込むため、TaskMateは新しい言語をすぐに読んで記録します。

TaskMateは、同梱した静的辞書を使います。Vaultの内容を外部翻訳サービスへ送信しません。英語のキーと文書を正本とし、日本語を同じ変更内で、明示的な翻訳状態とともに更新します。

### 受け入れ条件

- I18N-01: 自動では対応するObsidianロケール、または英語を使う。
- I18N-02: 言語変更で画面と設定を更新し、コマンドとリボンは再読込で更新する。
- I18N-03: パソコン版は「自動」で決まる言語を変わったときだけ記録し、スマホ版は記録せず、Task Pilotは明示の設定、記録されたパソコンの言語の順に使い、どちらもなければ英語にせず「不明」と報告する。

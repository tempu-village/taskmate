# TaskMate product specification

> English is the canonical specification. The Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Purpose and authority

TaskMate is a simple, local-first task manager for Obsidian. It provides a focused task interface while keeping Tasks and Projects readable and portable as Markdown files in the user's vault.

This document describes the product behavior supported by the current repository branch. It is the maintained overview of what TaskMate does. More specific records have these roles:

- [CONTEXT.md](../CONTEXT.md) defines stable domain terms.
- [Architecture Decision Records](adr/) explain hard-to-reverse decisions and their rationale.
- GitHub Issues define proposed changes and acceptance criteria.
- Tests are executable contracts for detailed behavior.
- [README.md](../README.md) introduces, installs, and operates the product.

When these records disagree, implementation and tests show the observable current behavior, while an accepted ADR governs the intended architectural direction. The mismatch must be resolved rather than silently copied into this specification.

## Product principles

- Markdown in the vault is the source of truth; TaskMate does not require a hosted account or database.
- The same plugin should work in desktop and mobile Obsidian through public Obsidian and browser APIs.
- Common task operations should remain fast and understandable on a narrow mobile screen.
- One global Manual order is preserved; automatic sorting changes presentation only.
- AI-assisted extraction is optional, staged, and reviewable before it may change canonical Tasks.
- English is the canonical UI and documentation source, with Japanese maintained in the same change.

## Tasks and Projects

### Task

Each Task is stored as one Markdown file. Its frontmatter contains a stable UUID, completion state, optional date, optional Priority from 1 through 3, Labels, optional Project ID, one global manual rank, and creation and update timestamps. The Markdown body contains the Task title and optional notes.

Task filenames are readable and derived from the title. The stable ID is not exposed in the filename. Renaming a Task title may rename its file without changing its identity.

### Project

Each Project is stored as one Markdown file with a stable ID and name. A Task refers to a Project by ID. A Project groups Tasks but does not own their lifecycle.

Renaming a Project preserves its identity. Deleting a Project does not delete its Tasks; affected Tasks become unassigned.

### Label and Priority

A Label is a user-defined cross-project classification attached directly to a Task. TaskMate supports up to 500 distinct Labels. A Priority is optional and uses `P1`, `P2`, or `P3`, where `P1` is highest.

## Main interface

The main navigation has three destinations: Date, Search, and Projects. Filter is not a destination; it modifies the Task list currently being viewed.

### Date

The Date screen has three Smart views in this order:

1. Scheduled: every incomplete Task with a date.
2. All: every incomplete Task, whether or not it has a date.
3. No date: every incomplete Task without a date.

Scheduled includes overdue Tasks and divides the list into Overdue, Today, and Later. Today receives a visible accent so immediate work is easy to recognize without requiring a separate Today view.

### Search

Search matches Task titles, notes, and Labels. Project names are also available as a search path to their Tasks. Up to ten recent search terms are offered for reuse and can be cleared.

### Projects

The Projects screen shows up to five recently used Projects and the complete Project list. Users can add, rename, open, and delete Projects. Opening a Project shows its Task list with the same filter and sorting capabilities used by other Task-result screens.

## Current-list operations

Task-result screens provide an Adjust control rather than permanent controls that consume mobile space.

### Filter

Filter narrows the currently displayed Date, Search, or Project Task set by any combination of Priority, Label, and completion state. The processing order is:

1. Resolve the current screen's Task set.
2. Apply the shared active filters.
3. Apply the selected sort order.
4. Render the result.

Active filters remain in effect while navigating between Task-result screens. The Adjust control shows their count. When filters are active, Clear filters is available directly in the Adjust menu and removes only view state; it never changes Task data.

### Label picker and favorites

Choosing Labels from Filter opens a picker with Recent & Favorites and All labels tabs.

- Recent & Favorites shows up to ten favorite Labels.
- A favorite is excluded from the recent section.
- The recent section is filled with up to ten other recently used Labels when available.
- The tab therefore presents up to twenty distinct suggestions without duplicates.
- Favorites are ordered by most recently favorited, limited to ten, and are never evicted automatically.
- A row selects or deselects a Label for the filter. Selection uses both styling and a check mark.
- A separate star changes the draft favorite state without changing filter selection.
- Confirm selection commits both drafts to the parent Filter dialog. Closing or cancelling the picker discards both kinds of pending change.

All labels provides search and a fixed top index. The index contains only groups that have results: populated Latin initials, Japanese, and numbers-and-symbols. Only the Label results scroll; the index remains available.

With completed Tasks excluded, the picker shows only Labels assigned to at least one incomplete Task. When completed Tasks are included, Labels used only by completed Tasks can also appear. Hidden history and favorites remain stored and can reappear when they become eligible again.

### Label management

Manage labels in the Adjust menu searches the union of Labels attached to Tasks, recent Labels, and favorites. Each Label shows its Task count; a value kept only by recent or favorite storage is marked Stored only.

Renaming replaces the Label on every affected Task, including completed Tasks, and updates recent Labels, favorites, and active filters. Renaming into an existing Label merges the two without creating duplicates. Deleting requires confirmation with the affected count, removes the Label from Tasks and saved UI state, and never deletes a Task. A partial file-write failure identifies the failed Task files instead of reporting complete success.

### Selection and bulk actions

Select Tasks replaces the main navigation with an explicit selection mode. The selectable set is frozen to the Tasks visible when selection begins, and Select all affects only that set.

A single selected Task opens the normal editor. Multiple selected Tasks can change date, Project, Priority, and Labels together. Bulk editing distinguishes keeping a current value from clearing it; Labels are added or removed rather than implicitly replacing every existing Label. Bulk deletion moves the selected Task files to the Obsidian trash after confirmation and reports partial failures.

## Creating and editing Tasks

The Task editor supports title, date, Project, Priority, Labels, and notes. It uses distinct leading icons as compact visual landmarks instead of separate external text-label rows. Project and Priority remain on separate rows and keep small persistent property names inside their selectors. Date shortcuts provide Today, Tomorrow, 7 days later, and No date, followed by a custom date field. The primary save action is visible when the editor opens on mobile, and opening Add Task on mobile does not automatically focus Title or open the keyboard.

The editor suggests up to ten recently saved Labels. Saving a Task updates that history. Selecting a Task title opens the editor. A Task can be completed from its list row, and single-Task deletion is located in the editor action footer with a destructive icon and confirmation.

On a narrow mobile screen, the editor keeps Obsidian's normal size and position until an editable field is focused and keyboard-related shrinkage is detected. It is then fitted and shifted inside TaskMate's measured host region so its action footer remains available above the software keyboard. The field region adds only the remaining clearance not already accommodated by Obsidian or the WebView and scrolls the focused field toward a comfortable visible position when needed. Alignment clearance remains stable while the same field and keyboard stay active, preventing resize observations from repeatedly removing and restoring it. Temporary clearance is removed when the keyboard closes, and the current scroll position is clamped rather than reset.

Task rows and the editor initially show up to three selected Labels. If more exist, a localized N more control reveals every remaining Label by click, tap, or keyboard and can collapse the expanded set again. Expanding this summary changes presentation only and never saves the Task.

## Sorting and manual order

Task lists support Manual, Date, Priority, and Created sorting. Selecting an already active automatic sort toggles ascending and descending order; the active button displays the direction.

Manual order is one global sequence shared across Smart views and other Task lists. Dragging changes that sequence only in Manual sorting. Date, Priority, and Created sorting are display-only and do not rewrite the stored manual rank.

## Layout and mobile behavior

Navigation and other persistent controls are separate siblings of the scrolling result region. TaskMate does not use viewport-fixed or sticky positioning to simulate this boundary. This prevents mobile software-keyboard viewport changes from collapsing or obscuring text inputs and keeps the end of long Task lists above Obsidian's bottom controls.

Controls that must remain available are placed outside the result scroller. Modals may scroll their content while keeping their action footer usable.

## Localization

TaskMate supports Auto, English, and Japanese. Auto follows Obsidian's locale when supported and otherwise falls back to English. Changing the setting updates TaskMate views and settings immediately; command names and the ribbon tooltip update after the plugin is reloaded.

TaskMate uses static bundled dictionaries. It does not send vault content to an external translation service. English keys and documentation are canonical, and Japanese must be updated in the same change with an explicit translation status.

## Storage, privacy, and synchronization

Tasks, Projects, and proposal sessions are stored in configurable folders under `TaskMate` by default. TaskMate uses Obsidian's vault and file-management APIs and has no telemetry, hosted TaskMate account, runtime AI, translation service, or TaskMate synchronization server. Uninstalling the plugin leaves its Markdown data in the vault.

Synchronization is provided by the user's chosen vault synchronization service, not TaskMate. Users should wait for synchronization to finish before editing the same Task on another device. Simultaneous or offline edits to the same file can become provider-managed conflicts; TaskMate does not merge them.

## Optional Agent Skill

The companion Agent Skill is optional and separate from the Obsidian plugin. It reads only explicitly allowlisted source folders or notes, inventories action candidates, and stages proposals before canonical Tasks can be created, merged, or excluded.

Every identified candidate must be accounted for exactly once in a coverage review. The user explicitly approves, revises, or excludes proposals. Proposal sessions retain visible and machine-readable decisions and do not expand the source-note allowlist.

## Supported environments and limitations

- Desktop and Android Obsidian are the verified environments. The code remains mobile-compatible, but iOS device behavior has not yet been verified.
- TaskMate is not yet listed in the Obsidian Community directory.
- Calendar, Kanban, recurrence, and reminders are not part of the current product.
- TaskMate does not provide a synchronization service or automatic conflict merging.
- The optional Agent Skill depends on the permissions and capabilities of its host agent client.

---

# TaskMate 製品仕様

<!-- translation-status: ai-translated -->

> [!NOTE]
> 英語版が正本です。この日本語版はAI生成の参照訳であり、人間による全文レビューはまだ完了していません。

## 目的と文書の位置づけ

TaskMateは、Obsidian向けのシンプルなローカルファースト・タスク管理機能です。集中して操作できるタスク画面を提供しながら、タスクとプロジェクトをユーザーのVault内に読みやすく持ち運び可能なMarkdownファイルとして保持します。

この文書は、現在のリポジトリブランチが対応する製品挙動を記述します。TaskMateが現在何を行うかを示す、保守対象の概要仕様です。より個別の記録は、次の役割を持ちます。

- [CONTEXT.md](../CONTEXT.md)は、安定したドメイン用語を定義します。
- [Architecture Decision Records](adr/)は、元に戻しにくい判断とその理由を説明します。
- GitHub Issueは、変更案と受け入れ条件を定義します。
- テストは、詳細な挙動を実行可能な契約として表します。
- [README.md](../README.md)は、製品の紹介、導入、運用方法を説明します。

これらの記録が一致しない場合、実装とテストは観察可能な現在の挙動を示し、承認済みADRは意図するアーキテクチャ上の方向を定めます。不一致をこの仕様へそのまま転記せず、解消する必要があります。

## 製品原則

- Vault内のMarkdownを正本とし、TaskMate専用のホスト型アカウントやデータベースを必要としません。
- 公開Obsidian APIとブラウザーAPIを使い、同じプラグインをデスクトップ版とモバイル版Obsidianで動作させます。
- 一般的なタスク操作を、幅の狭いモバイル画面でも素早く理解しやすいものにします。
- 手動順は全体で一つだけ保持し、自動並べ替えは表示だけを変更します。
- AIによる抽出は任意機能とし、正本タスクを変更する前に段階化してレビュー可能にします。
- 英語をUIと文書の正本とし、日本語を同じ変更内で保守します。

## タスクとプロジェクト

### タスク

各タスクは、一つのMarkdownファイルとして保存します。フロントマターには、安定したUUID、完了状態、任意の日付、1から3の任意の優先度、ラベル、任意のプロジェクトID、全体で一つの手動順位、作成・更新日時を保存します。Markdown本文には、タスク名と任意のメモを保存します。

タスクのファイル名は読みやすく、タスク名から生成します。安定IDはファイル名に出しません。タスク名を変更してファイル名が変わっても、タスクの同一性は変わりません。

### プロジェクト

各プロジェクトは、安定IDと名称を持つ一つのMarkdownファイルとして保存します。タスクはプロジェクトIDを参照します。プロジェクトはタスクをまとめますが、タスクのライフサイクルを所有しません。

プロジェクト名を変更しても同一性は保たれます。プロジェクトを削除してもタスクは削除せず、対象タスクを未所属にします。

### ラベルと優先度

ラベルは、タスクへ直接付ける、プロジェクトをまたいだユーザー定義の分類です。TaskMateは最大500種類のラベルに対応します。優先度は任意で、`P1`、`P2`、`P3`を使い、`P1`が最高です。

## メイン画面

メインナビゲーションには、日付、検索、プロジェクトの三つがあります。フィルターは移動先ではなく、現在表示中のタスク一覧を修飾します。

### 日付

日付画面には、次の順序で三つのスマートビューがあります。

1. 予定：日付があるすべての未完了タスク。
2. すべて：日付の有無を問わないすべての未完了タスク。
3. 日付なし：日付がないすべての未完了タスク。

予定には期限切れタスクも含め、一覧を期限切れ、今日、今後に分けます。独立した「今日」ビューを設けなくても直近の作業を認識しやすいよう、今日には明確なアクセントを付けます。

### 検索

検索は、タスク名、メモ、ラベルを対象にします。プロジェクト名から、そのタスクへたどることもできます。最近使った検索語を最大10件再利用でき、履歴は消去できます。

### プロジェクト

プロジェクト画面には、最近使ったプロジェクトを最大5件と、全プロジェクトの一覧を表示します。プロジェクトの追加、名称変更、表示、削除ができます。プロジェクトを開くと、他のタスク結果画面と同じフィルターと並べ替えを使えるタスク一覧を表示します。

## 現在の一覧に対する操作

タスク結果画面では、モバイルの表示領域を常時消費する操作欄ではなく、「調整」コントロールを提供します。

### フィルター

フィルターは、現在表示中の日付、検索、プロジェクトのタスク集合を、優先度、ラベル、完了状態の任意の組み合わせで絞り込みます。処理順は次のとおりです。

1. 現在の画面が対象とするタスク集合を求めます。
2. 共有中の有効なフィルターを適用します。
3. 選択中の並べ替えを適用します。
4. 結果を描画します。

有効なフィルターは、タスク結果画面の間を移動しても保持します。「調整」には有効条件数を表示します。フィルターが有効な場合、「フィルターを解除」を調整メニューから直接利用でき、表示状態だけを解除します。タスクデータは変更しません。

### ラベル選択とお気に入り

フィルターでラベルを選ぶと、「最近・お気に入り」と「すべてのラベル」のタブを持つ選択画面を開きます。

- 「最近・お気に入り」には、お気に入りラベルを最大10件表示します。
- お気に入りラベルは、最近使用したラベル欄から除外します。
- 最近使用したラベル欄は、利用可能であれば別のラベルで最大10件まで補います。
- したがって、このタブには重複なしで最大20件の候補を表示します。
- お気に入りは、直近にお気に入り登録した順に並べ、最大10件とし、自動では追い出しません。
- 行を操作すると、フィルター対象のラベルを選択または選択解除します。選択状態は、色だけでなくチェックマークでも示します。
- 独立した星を操作すると、フィルター選択を変えずにお気に入りの下書き状態を切り替えます。
- 「選択を確定」で両方の下書きを親のフィルターダイアログへ反映します。ラベル選択画面を閉じるかキャンセルすると、どちらの未確定変更も破棄します。

「すべてのラベル」には、検索と上部固定の索引を設けます。索引には、結果が存在するラテン文字の頭文字、日本語、数字・記号のグループだけを表示します。ラベル結果だけをスクロールし、索引は利用できる状態を保ちます。

完了済みタスクを除外している場合、少なくとも一つの未完了タスクに付いているラベルだけを表示します。完了済みタスクを含める場合は、完了済みタスクだけに使われているラベルも表示できます。非表示の履歴とお気に入りは保存したままとし、再び対象になれば表示します。

### ラベル管理

「調整」メニューの「ラベル管理」では、タスクに付いたラベル、最近使ったラベル、お気に入りの和集合を検索できます。各ラベルには対象タスク件数を表示し、履歴またはお気に入りだけに残る値は「保存のみ」と示します。

名前変更は完了済みを含むすべての対象タスクでラベルを置き換え、履歴、お気に入り、有効なフィルターも更新します。既存ラベルへの名前変更は重複させずに統合します。削除は対象件数を示して確認し、タスクと保存済みUI状態からラベルを外しますが、タスク自体は削除しません。一部のファイル書き込みに失敗した場合、完全成功として扱わず、失敗したタスクファイルを示します。

### 選択と一括操作

「タスクを選択」は、メインナビゲーションを明示的な選択モードへ置き換えます。選択可能な集合は選択開始時に表示されていたタスクへ固定し、「すべて選択」はその集合だけを対象にします。

選択が1件なら通常の編集画面を開きます。複数件では、日付、プロジェクト、優先度、ラベルをまとめて変更できます。一括編集では、現在値を維持することと値を消すことを区別し、既存ラベルすべてを暗黙に置換せず、追加または削除します。一括削除は、確認後に選択したタスクファイルをObsidianのゴミ箱へ移動し、部分的な失敗を報告します。

## タスクの作成と編集

タスク編集画面では、タスク名、日付、プロジェクト、優先度、ラベル、メモを扱います。外側の説明文字を行ごとに置く代わりに、形の異なる先頭アイコンをコンパクトな目印として使います。プロジェクトと優先度は別々の行にし、選択欄内へ小さい項目名を常に表示します。日付の候補として、今日、明日、7日後、日付なしを表示し、その下に任意の日付欄を設けます。モバイルで編集画面を開いた時点から主要な保存操作を利用でき、追加画面を開いただけではタイトルへ自動フォーカスせず、キーボードも表示しません。

編集画面には、最近保存したラベルを最大10件提示します。タスクを保存すると、この履歴を更新します。タスク名を選ぶと編集画面を開きます。タスク一覧の行から完了にでき、単一タスクの削除は、削除用アイコンと確認を伴う編集画面下部の操作領域に置きます。

幅の狭いモバイル画面では、入力欄へのフォーカスとキーボード由来の領域縮小を検出するまで、Obsidian標準の大きさと位置を維持します。検出後は編集画面全体をTaskMateの実測した親領域内へ収めて移動し、操作フッターをソフトウェアキーボードより上に保ちます。そのうえで、ObsidianまたはWebView側ですでに確保された量を二重に足さず、入力領域へまだ不足する余白だけを加え、必要な場合はフォーカス中の入力欄を見やすい位置へスクロールします。同じ欄とキーボードが有効な間は整列余白を維持し、サイズ監視による余白の削除と再追加の往復を防ぎます。キーボードを閉じると一時余白を削除し、スクロール位置は先頭へ戻さず有効範囲へ収めます。

タスク一覧と編集画面では、選択済みラベルを最初に最大3件表示します。残りがある場合、ローカライズされた「ほかN件」をクリック、タップ、またはキーボードで操作すると、残りをすべて表示し、再び折りたためます。この概要の開閉は表示だけを変更し、タスクを保存しません。

## 並べ替えと手動順

タスク一覧は、手動、日付、優先度、作成日の並べ替えに対応します。有効な自動並べ替えをもう一度選ぶと昇順と降順が切り替わり、有効なボタンに方向を表示します。

手動順は、スマートビューや他のタスク一覧をまたいで共有する一つの並びです。ドラッグは手動並べ替えのときだけ、この並びを変更します。日付、優先度、作成日の並べ替えは表示だけに作用し、保存済みの手動順位を書き換えません。

## レイアウトとモバイル挙動

ナビゲーションなど維持すべき操作領域と、スクロールする結果領域を、兄弟要素として分離します。この境界を見せかけるために、ビューポートへ固定する`fixed`や`sticky`は使いません。これにより、モバイルのソフトウェアキーボードによるビューポート変更で入力欄が潰れたり隠れたりすることを防ぎ、長いタスク一覧の末尾をObsidian下部の操作より上まで移動できます。

常に利用できる必要がある操作は、結果のスクロール領域外に置きます。モーダルは内容をスクロールさせながら、操作フッターを使用可能にできます。

## ローカライズ

TaskMateは、自動、English、日本語に対応します。自動は、対応している場合はObsidianのロケールに従い、それ以外は英語へフォールバックします。設定変更はTaskMateの画面と設定へ即時反映し、コマンド名とリボンのツールチップはプラグイン再読み込み後に更新します。

TaskMateは、同梱した静的辞書を使います。Vaultの内容を外部翻訳サービスへ送信しません。英語のキーと文書を正本とし、日本語を同じ変更内で、明示的な翻訳状態とともに更新します。

## 保存、プライバシー、同期

タスク、プロジェクト、提案セッションは、初期状態では`TaskMate`配下の設定可能なフォルダーへ保存します。TaskMateはObsidianのVault APIとファイル管理APIを使い、テレメトリー、TaskMateのホスト型アカウント、実行時AI、翻訳サービス、TaskMate独自の同期サーバーを持ちません。プラグインをアンインストールしても、MarkdownデータはVaultに残ります。

同期はTaskMateではなく、ユーザーが選んだVault同期サービスが提供します。別の端末で同じタスクを編集する前に、同期完了を待つ必要があります。同じファイルを複数端末で同時またはオフライン編集すると、同期サービス側が扱う競合になる場合があり、TaskMate自身はそれをマージしません。

## 任意のAgent Skill

付属のAgent Skillは任意で、Obsidianプラグインとは独立しています。明示的な許可リストに含まれるソースフォルダーまたはノートだけを読み取り、アクション候補を棚卸しし、正本タスクを作成、統合、除外できるようになる前に提案を段階化します。

識別したすべての候補は、カバレッジレビューで正確に一度ずつ扱う必要があります。ユーザーが提案を明示的に承認、修正、除外します。提案セッションには人が読める判断と機械可読な判断を残し、ソースノートの許可リストを拡大しません。

## 対応環境と制限

- デスクトップ版とAndroid版Obsidianが検証済み環境です。コードはモバイル互換を維持していますが、iOS実機の挙動はまだ検証していません。
- TaskMateは、まだObsidian Communityディレクトリに掲載されていません。
- カレンダー、カンバン、繰り返し、リマインダーは、現在の製品に含まれません。
- TaskMateは、同期サービスや競合の自動マージを提供しません。
- 任意のAgent Skillは、実行元のエージェントクライアントの権限と能力に依存します。

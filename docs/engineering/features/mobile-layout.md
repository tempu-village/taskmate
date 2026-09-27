# Mobile layout

Approval: Accepted — carried forward from the existing product contract.
Implementation: Implemented on the current branch; verification scope is recorded below.

> English is canonical. Japanese is an AI-translated reference.

## Contract

Navigation and other persistent controls are separate siblings of the scrolling result region. TaskMate does not use viewport-fixed or sticky positioning to simulate this boundary. This prevents mobile software-keyboard viewport changes from collapsing or obscuring text inputs and keeps the end of long Task lists above Obsidian's bottom controls.

Task rows remain within the available content width. The displayed title prefix wraps without horizontal overflow; full-title access follows [Task editing](task-editing.md).

Controls that must remain available are placed outside the result scroller. Modals may scroll their content while keeping their action footer usable.

On a narrow mobile screen, the editor keeps Obsidian's normal size and position until an editable field is focused and keyboard-related shrinkage is detected. It is then fitted and shifted inside TaskMate's measured host region so its action footer remains available above the software keyboard. The field region adds only the remaining clearance not already accommodated by Obsidian or the WebView and scrolls the focused field toward a comfortable visible position when needed. Alignment clearance remains stable while the same field and keyboard stay active, preventing resize observations from repeatedly removing and restoring it. Temporary clearance is removed when the keyboard closes, and the current scroll position is clamped rather than reset.

## Acceptance and evidence

- MOBILE-01: Persistent controls remain reachable while results scroll.
- MOBILE-02: Focusing a lower field above a software keyboard does not cause oscillating clearance or reset scroll.

Automated evidence: [mobile-layout.test.ts](../../../test/mobile-layout.test.ts), [mobile-keyboard-layout.test.ts](../../../test/mobile-keyboard-layout.test.ts). These tests cover selected behavior, not every UI scenario. Device checks and remaining gaps: [verification](../design/testing.md). Storage syntax: [Task schema](../../../skills/taskmate/references/task-schema.md).

## Related RFCs

- [RFC 0023: Keep Task editor fields usable above the mobile keyboard](../rfcs/0023-mobile-task-editor-keyboard.md) — implemented; fresh device verification remains pending.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

承認：既存の製品契約から継承した承認済み仕様。実装：現在のブランチに実装済み。検証範囲は上記のテストと[検証方針](../design/testing.md)を参照してください。

### 製品契約

ナビゲーションなど維持すべき操作領域と、スクロールする結果領域を、兄弟要素として分離します。この境界を見せかけるために、ビューポートへ固定する`fixed`や`sticky`は使いません。これにより、モバイルのソフトウェアキーボードによるビューポート変更で入力欄が潰れたり隠れたりすることを防ぎ、長いタスク一覧の末尾をObsidian下部の操作より上まで移動できます。

常に利用できる必要がある操作は、結果のスクロール領域外に置きます。モーダルは内容をスクロールさせながら、操作フッターを使用可能にできます。

幅の狭いモバイル画面では、入力欄へのフォーカスとキーボード由来の領域縮小を検出するまで、Obsidian標準の大きさと位置を維持します。検出後は編集画面全体をTaskMateの実測した親領域内へ収めて移動し、操作フッターをソフトウェアキーボードより上に保ちます。そのうえで、ObsidianまたはWebView側ですでに確保された量を二重に足さず、入力領域へまだ不足する余白だけを加え、必要な場合はフォーカス中の入力欄を見やすい位置へスクロールします。同じ欄とキーボードが有効な間は整列余白を維持し、サイズ監視による余白の削除と再追加の往復を防ぎます。キーボードを閉じると一時余白を削除し、スクロール位置は先頭へ戻さず有効範囲へ収めます。

### 受け入れ条件

- MOBILE-01: 結果をスクロールしても固定操作へ到達できる。
- MOBILE-02: 下の入力欄とキーボードの組合せで余白の振動やスクロールの初期化を起こさない。

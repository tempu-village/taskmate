# P1: Keep Task editor fields usable above the mobile software keyboard

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Prevent the mobile software keyboard from covering the focused field or making the lower Task editor fields unreachable. Treat this as an interaction defect in the shared Add/Edit Task dialog, not as a request to compress the entire form above the keyboard at once.

## Background

Issue #13 made Save visible when the Add Task dialog first opens and separated the scrollable fields from the action footer. On a phone, opening the software keyboard can still occlude lower fields, especially Notes.

Android diagnostics showed a hybrid layout response: browser viewport metrics stayed near 994 px, while Obsidian reduced TaskMate's root from about 880 px to 484 px, a reduction of about 396 px. This proves the host-facing TaskMate region became smaller; it does not prove that Obsidian explicitly calculated and passed a 396 px keyboard height. TaskMate must therefore measure its own resulting geometry instead of assuming either a pure overlay or a fully resized browser viewport.

## Decision

Adopt option A: dynamic clearance plus focus-aware automatic scrolling.

Calculate keyboard-avoidance clearance as the residual occlusion only:

```text
required extra clearance
  = area actually covered by the keyboard
  - amount already accommodated by Obsidian/WebView shrinking
```

Clamp the result to zero. Never add the full keyboard height after the host has already reduced TaskMate's usable region. Keep keyboard-avoidance clearance distinct from the smaller alignment clearance that may be needed to scroll the focused field toward a comfortable visible position.

## Requirements

- Apply the behavior to the shared Add Task and Edit Task dialogs on mobile.
- Keep the existing structure of a scrollable field region and a separate action footer.
- When a text field or text area receives focus, move it toward the vertical center of the visible field region when movement is needed and possible without exposing unnecessary artificial blank space.
- Repeat the adjustment after viewport or modal layout changes settle while the same control remains focused.
- Determine extra keyboard clearance from current geometry and add only the remaining overlap after host/WebView shrinkage.
- Clamp negative residual overlap to zero and do not use a fixed keyboard-height constant.
- Add only the minimum extra alignment clearance needed when the last field otherwise lacks enough scroll range.
- Remove temporary clearance when the keyboard closes.
- After removal, clamp the field scroller to its new maximum valid position without resetting it to the top.
- Keep Save and Cancel outside the field scroller and reachable while editing.
- Feature-detect public browser viewport APIs and provide a safe focus-and-scroll fallback when keyboard geometry is unavailable.
- Do not depend on private Obsidian DOM structure or Electron/Node APIs.
- Preserve desktop behavior and avoid scrolling a field that is already comfortably visible.

## Acceptance criteria

- On Android, focusing Title, Labels, and Notes leaves the focused control visible above the keyboard.
- The implementation does not double-apply the approximately 396 px reduction already observed in the Obsidian host region.
- When 300 px is covered and the host has already accommodated 300 px, keyboard-avoidance clearance is 0 px.
- When 300 px is covered and the host has accommodated 200 px, keyboard-avoidance clearance is 100 px.
- With Notes focused, the field region can scroll far enough to use the active editing area above the keyboard.
- Closing the keyboard removes temporary clearance and leaves no persistent empty gap.
- Closing the keyboard clamps the current scroll position instead of jumping to the top.
- Save and Cancel remain reachable, and desktop behavior does not regress.

## Verification

- Add deterministic tests for residual clearance, minimum alignment clearance, clearing temporary space, and clamping scroll position.
- Keep a layout-boundary test that verifies the action footer remains outside the field scroller.
- Verify manually on Android with Japanese and English keyboards: Title, Labels, multiline Notes, bottom scrolling, keyboard close, and focus changes while the keyboard remains open.
- Verify both Add and Edit dialogs and perform a desktop regression check.
- Run `npm run typecheck`, `npm test`, `npm run build`, the Python behavior tests, and `python3 scripts/validate_skills.py`.

## Out of scope

- Displaying every field simultaneously above the keyboard.
- Redesigning the editor as a multi-step form.
- Depending on a fixed keyboard height or a specific keyboard app.
- Changing Task data or save semantics.

---

<details>
<summary>日本語参考訳</summary>

> この日本語版は英語原本を基にAIで作成されています。人間による全文確認は完了していません。

## 概要

スマホのソフトウェアキーボードにより、フォーカス中の入力欄やタスク編集画面下部を操作できなくなる問題を修正します。フォーム全体を同時にキーボード上へ収める変更ではありません。

## 背景

診断では、ブラウザーの表示高さは約994pxのままなのに、Obsidian内のTaskMateルートは約880pxから484pxへ約396px縮みました。これはTaskMateへ渡る親領域が小さくなった結果を示しますが、Obsidianがキーボード高396pxを明示的に計算したことまでは証明しません。そのため、重なり方式または縮小方式のどちらか一方を決め打ちせず、TaskMate自身から見える実際の座標を使います。

## 判断

A案の「動的な余白＋フォーカスに応じた自動スクロール」を採用します。

```text
必要な追加余白
  ＝ キーボードに実際に隠される量
  − ObsidianやWebViewがすでに縮めた量
```

結果は0未満にしません。Obsidian側ですでに縮小された後に、キーボード全高をもう一度追加しません。また、キーボードとの重なりを避ける余白と、入力欄を見やすい位置へ動かすための最小限の整列余白を区別します。

## 要件

- モバイルのタスク追加・編集で共有するダイアログへ適用する。
- 入力項目だけがスクロールし、保存・キャンセルが外にある現在の構造を維持する。
- 入力欄へフォーカスしたら、不要な大空白を見せない範囲で、必要な場合だけ表示領域の中央付近へ動かす。
- キーボードやモーダルのレイアウト変化が落ち着いた後にも再調整する。
- 現在の実座標から残っている重なりだけを追加余白にする。
- 負の値は0にし、固定のキーボード高さを使わない。
- 最後の入力欄を動かすスクロール量が足りない場合だけ、最小限の整列余白を加える。
- キーボードを閉じたら一時余白を削除する。
- 余白削除後はスクロール位置を新しい最大値以内へ収め、先頭へ戻さない。
- 公開ブラウザーAPIを機能検出し、寸法が得られない場合は安全なフォーカス・スクロールへフォールバックする。
- Obsidianの非公開DOMやElectron／Node APIへ依存しない。
- デスクトップ挙動を維持する。

## 受け入れ条件

- Androidでタイトル、ラベル、メモがキーボードに隠れない。
- Obsidian側ですでに観測された約396pxの縮小を二重に適用しない。
- 隠れる量300px、すでに縮んだ量300pxなら追加余白は0pxになる。
- 隠れる量300px、すでに縮んだ量200pxなら追加余白は100pxになる。
- メモ欄をキーボードより上で操作できる位置までスクロールできる。
- キーボードを閉じると余白が消え、大きな空白が残らない。
- 閉じた際は先頭へ飛ばず、現在位置を有効範囲へ補正する。
- 保存・キャンセルとデスクトップ表示が退行しない。

## 検証方法

- 残余余白、最小整列余白、余白解除、スクロール位置補正の決定的テストを追加する。
- 操作フッターが入力欄スクロール領域の外にあることを維持する。
- Androidの日本語・英語キーボードで、タイトル、ラベル、複数行メモ、最下部、キーボードを閉じた後、キーボードを開いたままのフォーカス移動を確認する。
- 追加・編集とデスクトップを確認する。

## 対象外

- 全項目を同時にキーボード上へ表示すること。
- 複数ステップ形式への再設計。
- 固定キーボード高または特定キーボードアプリへの依存。
- タスクデータや保存処理の変更。

</details>

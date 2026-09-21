# P1: Keep Task editor fields usable above the mobile software keyboard

> English is canonical. The folded Japanese section is an AI-generated reference translation and has not been fully reviewed by a human.

## Summary

Prevent the mobile software keyboard from covering the focused field or making the lower Task editor fields unreachable. Treat this as an interaction defect in the shared Add/Edit Task dialog, not as a request to compress the entire form above the keyboard at once.

## Background

Issue #13 made Save visible when the Add Task dialog first opens and separated the scrollable fields from the action footer. On a phone, opening the software keyboard can still occlude lower fields, especially Notes.

Android diagnostics showed a hybrid layout response: browser viewport metrics stayed near 994 px, while Obsidian reduced TaskMate's root from about 880 px to 484 px, a reduction of about 396 px. This proves the host-facing TaskMate region became smaller; it does not prove that Obsidian explicitly calculated and passed a 396 px keyboard height. TaskMate must therefore measure its own resulting geometry instead of assuming either a pure overlay or a fully resized browser viewport.

The first implementation adjusted only the field scroller. Device verification showed that the entire Obsidian modal remained positioned against the larger browser viewport: the action footer itself could fall behind the keyboard, so neither extra field padding nor field-only scrolling could make Save visible. The complete modal must fit and move inside TaskMate's measured host region before its field scroller is adjusted.

## Root cause of the collapsed opening state

The modal-fitting helper was connected as soon as the Add/Edit dialog opened and immediately scheduled an adjustment. In the affected implementation, every adjustment called `fitModalToAvailableRegion()` before checking whether an editable control was focused or whether keyboard-related shrinkage had actually occurred.

Opening an Obsidian modal is a multi-step layout operation. During that short settling period, TaskMate can observe temporary host and modal bounds that are not the dialog's final keyboard-closed geometry. The helper nevertheless treated that transient measurement as authoritative and wrote two CSS variables:

- `--taskmate-modal-available-height` reduced the modal's `max-height` to the temporarily measured region.
- `--taskmate-modal-shift` moved the complete modal upward so its bottom edge, including Cancel and Save, fitted inside that region.

Because the modal content clips overflow and the action footer is outside the field scroller, an excessively small early height plus the upward shift hid most of the form above the phone's visible area while leaving only the bottom action area near the status bar. This is why the user saw the bottom of the dialog at the very top of the screen. It was not an intentional Android or Obsidian placement rule, and it was distinct from the percentage-height double subtraction recorded in ADR 0009. TaskMate entered its keyboard-fitting path too early, using an unstable opening measurement before there was evidence that the keyboard was active.

The corrective safeguards are:

- Capture the normal available-region baseline before the modal opening layout can change it.
- Do not constrain or move the modal unless an editable control is focused and either viewport occlusion or host shrinkage exceeds the keyboard threshold.
- Call `fitModalToAvailableRegion()` only after those conditions are satisfied.
- Remove both modal-fit CSS variables whenever the keyboard condition is not satisfied.
- Keep a deterministic regression test proving that even a large host-size change cannot constrain the modal without an active editable control.

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
- Constrain and reposition the complete Task modal inside TaskMate's measured host region when that region shrinks, so the action footer remains above the keyboard.
- Do not constrain or reposition the modal before an editable field is focused and keyboard-related occlusion or host shrinkage is detected; transient opening measurements must not collapse the initial dialog.
- When a text field or text area receives focus, move it toward the vertical center of the visible field region when movement is needed and possible without exposing unnecessary artificial blank space.
- Repeat the adjustment after viewport or modal layout changes settle while the same control remains focused.
- Determine extra keyboard clearance from current geometry and add only the remaining overlap after host/WebView shrinkage.
- Clamp negative residual overlap to zero and do not use a fixed keyboard-height constant.
- Add only the minimum extra alignment clearance needed when the last field otherwise lacks enough scroll range.
- While the same field remains focused and the keyboard remains open, retain already-required alignment clearance instead of repeatedly removing and restoring it during resize observations.
- Remove temporary clearance when the keyboard closes.
- After removal, clamp the field scroller to its new maximum valid position without resetting it to the top.
- Keep Save and Cancel outside the field scroller and reachable while editing.
- Feature-detect public browser viewport APIs and provide a safe focus-and-scroll fallback when keyboard geometry is unavailable.
- Do not depend on private Obsidian DOM structure or Electron/Node APIs.
- Preserve desktop behavior and avoid scrolling a field that is already comfortably visible.

## Acceptance criteria

- On Android, focusing Title, Labels, and Notes leaves the focused control visible above the keyboard.
- On Android, Save and Cancel remain visible while the keyboard is open.
- Opening Add or Edit with the keyboard closed shows the complete dialog in its normal Obsidian position rather than collapsing it to the top edge.
- The implementation does not double-apply the approximately 396 px reduction already observed in the Obsidian host region.
- When 300 px is covered and the host has already accommodated 300 px, keyboard-avoidance clearance is 0 px.
- When 300 px is covered and the host has accommodated 200 px, keyboard-avoidance clearance is 100 px.
- With Notes focused, the field region can scroll far enough to use the active editing area above the keyboard.
- Closing the keyboard removes temporary clearance and leaves no persistent empty gap.
- Closing the keyboard clamps the current scroll position instead of jumping to the top.
- Save and Cancel remain reachable, and desktop behavior does not regress.
- Labels, Notes, and their surrounding content remain visually stable without rapid up-and-down movement or motion trails.

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

> 対応範囲：英語版「Summary」の要約

スマホのソフトウェアキーボードにより、フォーカス中の入力欄やタスク編集画面下部を操作できなくなる問題を修正します。フォーム全体を同時にキーボード上へ収める変更ではありません。

## 背景

> 対応範囲：英語版「Background」の要約

診断では、ブラウザーの表示高さは約994pxのままなのに、Obsidian内のTaskMateルートは約880pxから484pxへ約396px縮みました。これはTaskMateへ渡る親領域が小さくなった結果を示しますが、Obsidianがキーボード高396pxを明示的に計算したことまでは証明しません。そのため、重なり方式または縮小方式のどちらか一方を決め打ちせず、TaskMate自身から見える実際の座標を使います。

最初の実装は入力欄のスクロール領域だけを調整しました。しかし端末確認では、Obsidianのモーダル全体が大きいブラウザービューポートを基準とした位置に残り、保存フッター自体がキーボードの背面へ入りました。この状態は入力欄への余白だけでは直らないため、先にモーダル全体をTaskMateの親領域内へ収め、その後に入力欄を調整します。

## 開いた直後に画面が潰れた根本原因

> 対応範囲：英語版「Root cause of the collapsed opening state」の全項目

タスク追加・編集画面を開くと同時に、モーダルの高さと位置を調整する処理を接続し、最初の調整を予約していました。問題のあった実装では、入力欄へフォーカスしているか、キーボード由来の縮小が実際に起きたかを確認する前に、毎回`fitModalToAvailableRegion()`を実行していました。

Obsidianのモーダルは複数段階で配置されるため、開いてから配置が落ち着くまでの短時間、最終的な通常表示とは異なる一時的な親領域・モーダル寸法が観測されることがあります。TaskMateはその一時的な値を確定値として扱い、次のCSS変数を書き込みました。

- `--taskmate-modal-available-height`により、一時的に観測された領域までモーダルの`max-height`を縮めた。
- `--taskmate-modal-shift`により、キャンセル・保存を含む下端をその領域へ収めるため、モーダル全体を上へ移動した。

モーダル本文ははみ出しを隠し、操作フッターは入力欄のスクロール領域外にあります。そのため、誤って小さくした高さと上方向への移動が重なると、フォームの大部分はスマホ画面の上へ隠れ、下端のキャンセル・保存付近だけがステータスバー直下に残りました。AndroidやObsidianが意図的にその位置へ表示したのではなく、TaskMateがキーボードの証拠がない段階で不安定な初期寸法を使い、キーボード対応処理へ早く入りすぎたことが原因です。ADR 0009に記録したパーセント高の二重減算とは別の不具合です。

対策は次のとおりです。

- モーダルを開く処理が寸法へ影響する前に、通常時の利用可能領域を基準値として取得する。
- 入力可能な欄へフォーカスしており、かつビューポートの重なりまたは親領域の縮小がキーボード判定値を超えた場合だけ、モーダルを縮小・移動する。
- 上記条件を満たした後にだけ`fitModalToAvailableRegion()`を実行する。
- キーボード条件を満たさないときは、モーダルの高さ・移動量を指定する二つのCSS変数を削除する。
- 親領域の変化が大きくても、入力欄がアクティブでなければモーダルを制約しないことを決定的な回帰テストで保証する。

## 判断

> 対応範囲：英語版「Decision」の全項目

A案の「動的な余白＋フォーカスに応じた自動スクロール」を採用します。

```text
必要な追加余白
  ＝ キーボードに実際に隠される量
  − ObsidianやWebViewがすでに縮めた量
```

結果は0未満にしません。Obsidian側ですでに縮小された後に、キーボード全高をもう一度追加しません。また、キーボードとの重なりを避ける余白と、入力欄を見やすい位置へ動かすための最小限の整列余白を区別します。

## 要件

> 対応範囲：英語版「Requirements」の全項目

- モバイルのタスク追加・編集で共有するダイアログへ適用する。
- 入力項目だけがスクロールし、保存・キャンセルが外にある現在の構造を維持する。
- TaskMateの親領域が縮んだら、モーダル全体をその領域内へ縮小・移動し、保存・キャンセルをキーボードより上に保つ。
- 入力欄へのフォーカスとキーボード由来の重なりまたは親領域縮小を検出する前は、モーダルを縮小・移動しない。表示開始時の一時的な寸法で初期画面を潰さない。
- 入力欄へフォーカスしたら、不要な大空白を見せない範囲で、必要な場合だけ表示領域の中央付近へ動かす。
- キーボードやモーダルのレイアウト変化が落ち着いた後にも再調整する。
- 現在の実座標から残っている重なりだけを追加余白にする。
- 負の値は0にし、固定のキーボード高さを使わない。
- 最後の入力欄を動かすスクロール量が足りない場合だけ、最小限の整列余白を加える。
- 同じ入力欄へフォーカスしキーボードを開いている間は、サイズ監視のたびに必要済みの整列余白を削除・再追加せず維持する。
- キーボードを閉じたら一時余白を削除する。
- 余白削除後はスクロール位置を新しい最大値以内へ収め、先頭へ戻さない。
- 保存・キャンセルを入力欄のスクロール領域外に置き、編集中も操作できるようにする。
- 公開ブラウザーAPIを機能検出し、寸法が得られない場合は安全なフォーカス・スクロールへフォールバックする。
- Obsidianの非公開DOMやElectron／Node APIへ依存しない。
- デスクトップ挙動を維持し、すでに見やすい位置にある入力欄は動かさない。

## 受け入れ条件

> 対応範囲：英語版「Acceptance criteria」の全項目

- Androidでタイトル、ラベル、メモがキーボードに隠れない。
- Androidでキーボード表示中も保存・キャンセルが見える。
- キーボードを閉じた状態で追加・編集を開くと、上端へ潰れずObsidian標準の位置に画面全体が表示される。
- Obsidian側ですでに観測された約396pxの縮小を二重に適用しない。
- 隠れる量300px、すでに縮んだ量300pxなら追加余白は0pxになる。
- 隠れる量300px、すでに縮んだ量200pxなら追加余白は100pxになる。
- メモ欄をキーボードより上で操作できる位置までスクロールできる。
- キーボードを閉じると余白が消え、大きな空白が残らない。
- 閉じた際は先頭へ飛ばず、現在位置を有効範囲へ補正する。
- 保存・キャンセルとデスクトップ表示が退行しない。
- ラベル、メモ、その周辺が高速で上下せず、残像が見えない。

## 検証方法

> 対応範囲：英語版「Verification」の全項目

- 残余余白、最小整列余白、余白解除、スクロール位置補正の決定的テストを追加する。
- 操作フッターが入力欄スクロール領域の外にあることを維持する。
- Androidの日本語・英語キーボードで、タイトル、ラベル、複数行メモ、最下部、キーボードを閉じた後、キーボードを開いたままのフォーカス移動を確認する。
- 追加・編集とデスクトップを確認する。
- `npm run typecheck`、`npm test`、`npm run build`、Python behavior tests、`python3 scripts/validate_skills.py`を実行する。

## 対象外

> 対応範囲：英語版「Out of scope」の全項目

- 全項目を同時にキーボード上へ表示すること。
- 複数ステップ形式への再設計。
- 固定キーボード高または特定キーボードアプリへの依存。
- タスクデータや保存処理の変更。

</details>

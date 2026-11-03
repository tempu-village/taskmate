---
status: implemented
tracking-issue: 53
current-authority: ../features/filtering-and-sorting.md
related-features:
  - ../features/mobile-layout.md
---

# Add edge auto-scroll to Manual Task reordering

> Record status: Historical — implemented for [#53](https://github.com/tempu-village/taskmate/issues/53). Android device calibration is still pending.
> Current authority: [Navigation, filtering and sorting](../features/filtering-and-sorting.md). The proposal below preserves the decision history.
>
> 記録の状態：#53で実装済みです。Android実機での校正は未完了です。現在の正本は[Navigation, filtering and sorting](../features/filtering-and-sorting.md)で、以下は検討当時の記録として残します。

## Summary

Add vertical edge auto-scroll while a user manually reorders Tasks in a long list. Keep SortableJS as TaskMate's drag-and-drop library, explicitly connect its standard AutoScroll plugin to the Task result scroller, and implement a bounded distance-based speed curve through SortableJS's supported `scrollFn` extension point.

## Background / Problem

TaskMate attaches SortableJS 1.15.7 to `.taskmate-list`, while the vertically scrolling ancestor is `.taskmate-scroll-region`. The current integration does not explicitly configure a scroll target, activation zone, speed, custom scroll function, parent bubbling, or fallback path. On a phone, dragging can therefore fail to move a Task beyond the visible portion of a long list.

Aceituno et al. reverse-engineered 33 edge-scrolling behaviors, surveyed 214 participants, and compared four transfer functions. They found material differences in completion performance, overshooting, perceived workload, control, and consistency. The study establishes that the transfer function and activation geometry are product behavior, but it does not establish universal smartphone constants for TaskMate.

Platform and major-library designs support a distance-based, capped transfer function:

- Apple AppKit scrolls proportionally to pointer distance outside its clip view.
- Android `ItemTouchHelper` increases out-of-bounds scrolling with both distance and dwell time.
- Atlassian's list auto-scroll increases speed toward the edge and reaches its maximum before the final pixel.
- SortableJS AutoScroll can target an `HTMLElement`, force one cross-browser fallback path, and delegate scrolling through `scrollFn`.

## Goals

- Move a Task to an off-screen Manual-order position in one continuous drag.
- Give coarse touch input a reachable activation zone without sacrificing precise placement.
- Start without a speed jump, accelerate predictably, cap speed, and stop immediately.
- Retain a major maintained library for drag recognition, pointer tracking, hit testing, and cleanup.
- Keep the TaskMate-owned speed calculation deterministic and independently testable.
- Preserve normal touch scrolling before the existing 250 ms drag hold activates.

## Non-goals

- Replacing SortableJS or introducing a second drag-and-drop engine.
- Adding inertia after leaving the edge zone or after drop.
- Horizontal Task-list auto-scroll.
- Changing Step reordering in the Task editor.
- Adding the move-to-start and move-to-end commands tracked by Issue #43.
- Treating the initial numeric constants as platform or accessibility standards.

## Alternatives considered

### Keep SortableJS defaults

Rejected. The implicit target and browser-specific native/fallback choice reproduce the failure, and the documented 30 px zone with a fixed step gives TaskMate insufficient control.

### Configure only `scrollSensitivity` and `scrollSpeed`

Rejected as the final design. It preserves a fixed speed throughout the zone, while the research and major list libraries favor precise entry with faster travel closer to the edge.

### Replace SortableJS

Rejected for this change. Atlassian Pragmatic drag and drop is credible, but adopting it would replace TaskMate's established drag lifecycle. dnd-kit and hello-pangea/dnd are React-centered, while TaskMate renders DOM directly. Migration would broaden risk without evidence that replacement is needed.

### Implement dragging entirely in TaskMate

Rejected. It would duplicate mature event, hit-testing, and cleanup behavior. TaskMate should own only its product-specific transfer function.

### SortableJS AutoScroll with a TaskMate adapter

Accepted. SortableJS continues to own dragging. TaskMate explicitly selects its scroll region and supplies only the variable, elapsed-time-based vertical delta through the documented `scrollFn` extension.

## Proposed design

### Library boundary

For every Task list, resolve the nearest `.taskmate-scroll-region` and pass it as `scroll`. Set `forceAutoScrollFallback: true` for one testable WebView and desktop path, and `bubbleScroll: false` so Obsidian's outer view does not scroll. If no Task result scroller exists, disable custom auto-scroll rather than targeting the document.

### Activation geometry

Calculate top and bottom zones from the visible scroller:

```text
zone = clamp(64 CSS px, 15% of scroller height, 96 CSS px)
```

The area between them is neutral. Use the scroller's current bounds, not the browser viewport. The 64–96 px range is an initial TaskMate calibration choice intended to be more reachable by a finger than SortableJS's 30 px default.

### Transfer function

Let `d` be pointer distance from the active edge:

```text
progress = clamp((zone - d) / (zone - 12 CSS px), 0, 1)
speed = direction * 720 CSS px/s * progress²
delta = speed * min(elapsedSeconds, 0.05)
```

Speed is zero at zone entry and quadratic toward the edge. It plateaus 12 px before the physical edge, avoiding pixel-level precision. A 50 ms elapsed-time cap prevents a resumed WebView from jumping. Apply an instant vertical delta; do not queue smooth-scroll animations.

Do not add dwell-time acceleration initially. Device calibration should add it only if distance-based control remains too slow for long travel.

### Lifecycle

- Preserve the 250 ms touch hold and existing touch threshold.
- Start only after SortableJS activates dragging.
- Continue while the pointer remains stationary in an edge zone.
- Produce no movement in the neutral zone or at scroll limits.
- Reset timing on a callback gap so re-entering a zone cannot jump.
- Stop on drop, cancellation, renderer destruction, or loss of the scroll region.
- Keep the existing `onEnd` reorder dispatch as the only persistence path.

### Tests and calibration

Keep geometry and speed in a DOM-independent module. Cover direction, boundaries, neutral zone, monotonic acceleration, maximum-speed plateau, elapsed-time clamping, scroll-limit clamping, pointer/touch coordinates, renderer wiring, missing-scroller behavior, and cleanup.

Android Obsidian verification must measure screen traversal time, one-row stopping ability, accidental activation, re-entry, stationary-pointer continuation, and drop/cancel cleanup. Tune maximum speed first and zone size second. DOM tests cannot prove WebView gesture arbitration.

## Open questions

- Is 720 CSS px/s fast enough for long lists without impairing one-row placement on the target Android device?
- Does forced AutoScroll fallback interact correctly with `touch-action: manipulation` in Obsidian Android?
- Should mouse input eventually use a smaller pointer-type-specific zone?

## Decision / status

Accepted and implemented. Keep SortableJS and use its supported AutoScroll extension with an explicit scroller and TaskMate transfer-function adapter. Numeric calibration and the `touch-action` question remain subject to Android device verification; tune the constants in a follow-up if needed.

## Links

- Tracking Issue: [#53](https://github.com/tempu-village/taskmate/issues/53)
- Current authority: [Navigation, filtering and sorting](../features/filtering-and-sorting.md), [Mobile layout](../features/mobile-layout.md)
- Current specification: None
- Current design: [Testing](../design/testing.md)
- ADRs: [ADR 0009](../adr/0009-separate-navigation-from-scrollable-content.md)
- Implementation pull request: None
- Release: None
- Verification evidence: [drag-auto-scroll.test.ts](../../../test/task-list/drag-auto-scroll.test.ts), [task-list-renderer.test.ts](../../../test/task-list/task-list-renderer.test.ts); Android device verification pending
- Research: [Aceituno et al., The design, use, and performance of edge-scrolling techniques](https://doi.org/10.1016/j.ijhcs.2016.08.001)
- Library: [SortableJS AutoScroll](https://github.com/SortableJS/Sortable/blob/master/plugins/AutoScroll/README.md)
- Platform comparison: [Android `interpolateOutOfBoundsScroll`](https://developer.android.com/reference/androidx/recyclerview/widget/ItemTouchHelper.Callback#interpolateOutOfBoundsScroll(androidx.recyclerview.widget.RecyclerView,int,int,int,long)), [Apple `autoscroll(with:)`](https://developer.apple.com/documentation/appkit/nsview/autoscroll(with:)), [W3C Pointer Events](https://www.w3.org/TR/pointerevents/#the-touch-action-css-property)
- Library comparison: [Atlassian auto scrolling](https://github.com/atlassian/react-beautiful-dnd/blob/master/docs/guides/auto-scrolling.md), [Pragmatic drag and drop](https://github.com/atlassian/pragmatic-drag-and-drop)

## 日本語参考

<!-- translation-status: ai-translated -->

英語版が正本です。

長いTask一覧をManual orderで並べ替える際、ドラッグ中の指をTask結果領域の上下端へ近づけると縦方向へ自動スクロールする提案です。メジャーライブラリであるSortableJSを継続利用し、標準AutoScrollへ`.taskmate-scroll-region`を明示します。ドラッグ認識、タッチ追跡、終了処理は自作せず、TaskMateは公開された`scrollFn`を介した距離連動の速度計算だけを所有します。

研究では33実装の分析、214人の調査、4種類の速度変換の比較から、方式の違いが操作時間、行き過ぎ、負荷感、制御性、一貫性に影響することが示されています。このため固定速度ではなく、上下`clamp(64px, 高さの15%, 96px)`の感知領域、最大720 CSS px/sの二次加速、端から12px手前の最大速度、明確な停止条件を採用します。数値はAndroid版Obsidianで校正する初期値であり、研究上の標準値ではありません。

SortableJSの既定値、固定速度だけの設定、別ライブラリへの全面移行、完全自作を比較し、既存ライブラリの公開拡張点を利用する案を採用しました。最大速度と`touch-action`の組み合わせはAndroid実機で確認し、必要なら後続で数値を調整します。

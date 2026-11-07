# ADR 0030: Keep keyCode 229 to ignore Safari's IME-confirming Enter

Status: Accepted

## Context

The Label input in the Task editor and in bulk editing adds a Label when the user presses Enter. While an IME such as Japanese input is converting text, Enter confirms the conversion and must not add a Label.

The problem affects only iPhone and iPad. Obsidian desktop, including on macOS, is an Electron app and renders with Chromium. Obsidian mobile is a Capacitor app instead of an Electron app, so it renders inside the operating system's WebView: Android's WebView, which is Chromium, and on iOS and iPadOS WebKit's `WKWebView`, the engine behind Safari. Chromium marks the confirming Enter with `isComposing`. WebKit sends it after `compositionend` with `isComposing` false, and its only distinguishing value is `keyCode` 229.

`keyCode` is deprecated, and the Obsidian Community directory review reports its two uses (#120). The project's lint configuration does not allow disabling that rule in code.

## Decision

- Keep `keyCode !== 229` in `shouldCommitLabelOnEnter`, together with `isComposing` and the input's own composition flag.
- Explain the reason in a code comment at each use, and accept the two directory warnings as intentional.

## Considered options

- Removing the `keyCode` check was rejected because a Japanese user on iPhone or iPad would add a half-converted Label with every confirmed conversion.
- Ignoring the first Enter after `compositionend` until the next `keyup` would avoid `keyCode`. It was rejected for now because it depends on the event order of each engine, can only be verified on real Apple devices, and adds state to two inputs without changing what users see.

## Consequences

- The directory review keeps reporting two `keyCode` deprecation warnings.
- The desktop E2E test replays both Chromium's and Safari's IME event sequences, so removing the check fails a test.
- If WebKit starts marking the confirming Enter with `isComposing`, or the directory stops accepting `keyCode`, revisit this decision.

## 日本語参考

<!-- translation-status: ai-translated -->

英語版が正本です。

ラベル入力欄はEnterでラベルを追加しますが、日本語入力の変換を確定するEnterではラベルを追加してはいけません。

この問題が起きるのはiPhoneとiPadだけです。デスクトップ版のObsidianはmacOSでもElectronアプリで、Chromiumで表示します。モバイル版はElectronではなくCapacitorで作られており、OSのWebViewの中で表示します。AndroidのWebViewはChromiumですが、iOSとiPadOSではSafariと同じWebKitの`WKWebView`です。Chromiumは変換確定のEnterに`isComposing`を付けますが、WebKitは変換終了後に`isComposing`なしで送り、区別できるのは`keyCode`の229だけです。そのため、非推奨の`keyCode`による229の判定を残し、各使用箇所のコメントに理由を書き、Communityディレクトリの2件の警告は意図的なものとして受け入れます。

`compositionend`直後の最初のEnterを次の`keyup`まで無視する方法なら`keyCode`を使わずに済みますが、ブラウザごとのイベント順に依存し、Apple実機でしか確かめられないため、今回は採りませんでした。WebKitが確定のEnterに`isComposing`を付けるようになった場合や、ディレクトリが`keyCode`を認めなくなった場合は見直します。

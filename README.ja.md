# TaskMate

[English](README.md) | 日本語

<!-- translation-status: ai-translated -->
<!-- translation-source-sha256: a1b92ee47a81c8e8c7a801030a0ae45b64020c5373de8fbad84f14497d337c35 -->

> 翻訳状態：`ai-translated`
>
> この日本語版は英語版を原本としてAIで翻訳されています。現在は人間による全文確認を完了していません。内容が異なる場合は英語版を正式な情報として扱ってください。

TaskMateは、Obsidian向けのシンプルなローカルファーストのタスク管理ツールです。すべてのタスクとプロジェクトをVault内の読みやすいMarkdownとして保ちながら、Todoistのように目的を絞ったインターフェースを提供します。

TaskMateには、任意で使用できるポータブルなAgent Skillも含まれます。Skillは、明示的に選択したノートから確認可能な提案を作成し、採用する内容をユーザーが判断した後にだけタスクを作成または更新します。

## TaskMateを選ぶ理由

- PC版とモバイル版のObsidianで同じタスク画面を使用できます。
- 他の組み込みビューで順序を失わず、タスクを手動で並べ替えられます。
- タスクを確認・移行・編集可能なMarkdownとして保持できます。
- TaskMateアカウントやホストされたデータベースを作成せずにプラグインを使用できます。
- AIが生成した提案を正式なタスクにする前に確認できます。

## 現在の機能

- 日付、検索、プロジェクトの3つに絞った移動先
- 予定、すべて、日付なしのビューと、予定内の期限切れ・今日・明日以降セクション
- 現在の一覧へフィルターを適用し、明示的なタスク選択を開始できる調整メニュー
- 編集画面での単一タスク削除と、選択モードでの一括編集・一括削除
- 最近の検索語を最大10件保持する検索
- Markdownで保存されるプロジェクト、直近5件の表示、名称変更、安全な削除
- 優先度1〜3と最大500種類のラベル、優先度・ラベル・完了状態によるフィルター
- 今日、明日、7日後、日付なしをワンタップで選べる候補
- 最近保存したラベルを最大10件表示
- 1つの共通手動ドラッグ順と、日付・優先度・作成日による並べ替え
- 英語フォールバックを備えた自動、English、日本語の言語設定
- PC版とモバイル版Obsidianへの対応
- frontmatterに安定したIDを持つ、タスクごとの読みやすいMarkdownファイル
- AI対象フォルダと、ノートごとの追加・除外指定
- エージェントが行動を作成・統合・除外する前の段階的な提案確認

## クイックスタート

1. TaskMateをインストールして有効にします。
2. コマンドパレットを開き、**TaskMate: タスク一覧を開く**を実行します。
3. **＋ 追加**を選択し、タイトルを入力してタスクを保存します。
4. 日付画面で予定、すべて、日付なしのタスクを表示します。現在の一覧を絞り込む、または選択するには調整メニューを使います。
5. **設定 → TaskMate → 言語**で、自動、English、日本語のいずれかを選択します。

言語を変更するとTaskMateのビューと設定画面はすぐに更新されます。コマンド名とリボンの説明を更新するには、プラグインを再読み込みしてください。

## ローカルビルドからインストールする

TaskMateは、まだObsidian Community directoryに掲載されていません。このリポジトリからビルドします。

```bash
npm install
npm run typecheck
npm test
npm run build
```

次のファイルを`<vault>/.obsidian/plugins/taskmate/`へコピーします。

```text
main.js
manifest.json
styles.css
```

Obsidianを再起動し、**設定 → コミュニティプラグイン**を開いてTaskMateを有効にします。リボンアイコンから開くか、コマンドパレットで**TaskMate: タスク一覧を開く**を実行します。

## Obsidian SyncでPCとAndroidから使用する

TaskMateは、Community directoryへ掲載される前でもPCとAndroidで動作します。この手順では、公式の有料サービスであるObsidian Syncを使用します。TaskMate自体は同期機能を提供せず、同期料金も請求しません。

### 1. プラグインの同期を有効にする

PCとAndroidの両方で次の操作をします。

1. **設定 → Sync**を開きます。
2. **保管庫設定の同期（Vault configuration sync）**を開きます。
3. `Installed community plugin list`を有効にします。
4. `Active community plugin list`を有効にします。

`Active community plugin list`を有効にすると、TaskMate以外のコミュニティプラグインについても有効・無効状態が同期されます。

### 2. PC側のVaultへTaskMateを配置する

Obsidian Syncに接続している実際のVaultへローカルビルドを配置します。

```text
Synced vault/
└─ .obsidian/
   └─ plugins/
      └─ taskmate/
         ├─ main.js
         ├─ manifest.json
         └─ styles.css
```

3ファイルは同じ`taskmate`フォルダの直下に置きます。

```text
Correct:   .obsidian/plugins/taskmate/manifest.json
Incorrect: .obsidian/plugins/taskmate/taskmate/manifest.json
```

PC版Obsidianを再起動し、**設定 → コミュニティプラグイン**でTaskMateを有効にします。

### 3. Androidで同期されたプラグインを読み込む

1. PC版Obsidianが**Fully Synced**と表示するまで待ちます。
2. Androidで同じリモートVaultを開きます。
3. Android版Obsidianが**Fully Synced**と表示するまで待ちます。
4. **設定 → コミュニティプラグイン**を開きます。
5. **インストール済みプラグイン（Installed plugins）**を押して、同期されたプラグイン一覧をAndroidに読み込ませます。
6. TaskMateが無効な場合は有効にします。すでに有効な場合は、一度無効にしてから再び有効にします。

同期を待つだけでは、プラグインのファイルが更新されても、実行中のTaskMateコードが再読み込みされない場合があります。確認済みのAndroid手順では、Obsidianを起動したまま、同期後にTaskMateを無効化して再び有効化することで再読み込みします。この手順ではAndroid版Obsidianの完全再起動は不要です。

### 4. 両方の端末を更新する

開発用インストールでは、リポジトリに含まれるローカル配布コマンドを使用できます。初回は、同期中Vaultの絶対パスを渡します。

```bash
npm run deploy -- /absolute/path/to/synced-vault
```

パスはGit管理から除外されたローカルファイルへ保存されます。2回目以降は1つのコマンドで更新できます。

```bash
npm run deploy
```

このコマンドは型チェック、テスト、本番ビルドを実行してから、PC側Vaultの`main.js`、`manifest.json`、`styles.css`を置き換えます。PCとAndroidの両方で**Fully Synced**になった後、Androidのインストール済みプラグイン一覧を開き、TaskMateを一度無効にして再び有効にしてください。同期でファイルが更新され、このプラグイン再読み込みで新しいコードが有効になります。

この同期手順は、PC版Obsidian、Android版Obsidian、公式Obsidian Sync、未公開のTaskMateビルドの組み合わせで確認済みです。iOSはまだ確認していません。

## Agent Skillの対象ノートを選択する

**TaskMate: 現在のフォルダをAI対象にする**を実行するか、**設定 → TaskMate → AI対象フォルダ**でVaultからの相対パスを1行に1フォルダ入力します。

個々のノートでは、フォルダ設定を上書きできます。

```yaml
taskmate-source: true  # include this note anywhere
taskmate-source: false # exclude this note from an included folder
```

処理済みの対象ノートには、出所を示す`taskmate-import-*`プロパティが追加されます。コンテンツハッシュにより、Skill自身が追加したメタデータをユーザーの変更と誤認せず、後から行われた編集を検出できます。

## Agent Skillをインストールして使用する

プラグインはAgent Skillなしでも動作します。AIによるタスク抽出を使用する場合は、Agent Skills互換クライアントへ`skills/taskmate`をインストールします。ローカル開発中は次のようにします。

```bash
mkdir -p "$HOME/.agents/skills"
ln -s "$(pwd)/skills/taskmate" "$HOME/.agents/skills/taskmate"
```

Vaultをエージェントのワークスペースとして開き、次のように依頼します。

```text
$taskmate Review the selected source notes and propose every Todo candidate.
```

Skillは`TaskMate/Proposals/Active`へ提案を書き込み、この段階では正式なタスクを作成しません。会話ですべての候補を確認し、承認、修正、除外のいずれかを明示的に判断します。承認または修正した提案はタスクになります。完了した確認は、人が読める目印と機械可読な判断情報を付けて`TaskMate/Proposals/Archive`へ移動し、手動で削除するまで残ります。

必要に応じて**設定 → TaskMate → 提案フォルダ**から保存先を変更できます。提案フォルダは承認の境界であり、セキュリティ用サンドボックスではなく、対象ノートの許可範囲を広げません。

## 保存場所、プライバシー、権限

- タスクは初期設定で`TaskMate/Tasks`に保存されます。
- プロジェクトは初期設定で`TaskMate/Projects`に保存されます。
- Proposal sessionは初期設定で`TaskMate/Proposals`に保存されます。
- 各フォルダの場所はTaskMateの設定で変更できます。
- プラグインはObsidianのVault APIとファイル管理APIを使い、TaskMateが管理するMarkdownを読み書きします。
- プラグインには、テレメトリ、ホストされたTaskMateアカウント、実行時AI、翻訳サービス、TaskMate独自の同期サーバーはありません。
- プラグインはタスク内容を外部の翻訳サービスへ送信しません。
- 任意のAgent Skillはエージェントクライアントの権限で動作し、Obsidianプラグインとは別のものです。
- プラグインをアンインストールしても、タスク、プロジェクト、提案のMarkdownはVaultに残ります。

公開リリース前に、これらの記述をリリース用ビルドと照合してください。重要なデータにTaskMateを使用する前にVaultをバックアップし、利用する同期サービスの競合処理を理解してください。

## 既知の制限

- 現在のリリースには、カレンダー、カンバン、繰り返し、リマインダーは含まれません。
- TaskMateは独自の無料同期サービスを提供しません。
- 複数端末で同時にオフライン編集した場合、Vaultの同期サービスによって競合として処理される可能性があります。
- Androidでの手順は確認済みですが、iOSはまだ確認していません。
- TaskMateの言語変更後、コマンド名とリボンの説明を更新するにはプラグインの再読み込みが必要です。
- TaskMateはまだObsidian Community directoryから配布されていません。

## トラブルシューティング

タスクは同期されるのにAndroidでTaskMateが表示されない場合は、次をすべて確認してください。

- 両方の端末で`Installed community plugin list`と`Active community plugin list`が有効になっている。
- PC側のプラグインフォルダが、Obsidian Syncに接続した同じVault内にある。
- パスが`.obsidian/plugins/taskmate/`で、`taskmate`フォルダが重複していない。
- `main.js`、`manifest.json`、`styles.css`が存在する。
- 両方の端末で**Fully Synced**と表示されている。
- Androidで**設定 → コミュニティプラグイン → インストール済みプラグイン**を開いた。
- TaskMateがすでに有効だった場合も含め、同期後に一度無効化してから再び有効化した。

バグを報告する際は、TaskMateのバージョン、Obsidianのバージョン、OS、再現手順、必要に応じて個人情報を除いたタスク例を含めてください。Vault内の非公開情報を公開しないでください。

## 翻訳ワークフロー

TaskMateのUIと利用者向け文書では、英語を正式な原本およびフォールバックとします。

1. `src/i18n/en.ts`と英語文書の変更内容を確定します。
2. 同じ変更内で`src/i18n/ja.ts`と日本語文書を更新します。
3. 辞書キー、プレースホルダー、Markdown構造、保護対象の文字列、リンクを検査します。
4. AIが作成または更新した翻訳は`ai-translated`と表示し続けます。
5. 人間が現在の英語と日本語の全文を比較した場合に限り、状態を`human-reviewed`へ変更します。
6. リリース前に実際のPC版とモバイル版Obsidianで両言語を確認します。

日本語だけに機能仕様を追加しないでください。最初に英語を更新し、その後で翻訳します。コード、コマンド、パス、プロパティ名、ID、URLは、ローカライズされたUIで意図的に翻訳済みコマンド名を示す場合を除いて変更しません。

## 開発と検証

```bash
npm run typecheck
npm test
npm run build
python3 -m unittest discover -s skills/taskmate/tests -v
python3 scripts/validate_skills.py
npm run validate:localization
git diff --check
```

生成された`main.js`はビルド成果物です。直接編集しないでください。

## ライセンス

TaskMateは[MIT License](LICENSE)で提供されます。

Copyright (c) 2026 Masashi (Tempu Village)

## Obsidian公式ドキュメント

- [Obsidian Syncの設定と選択同期](https://obsidian.md/help/sync/settings)
- [コミュニティプラグイン](https://obsidian.md/help/community-plugins)

# PCとAndroidでTaskMateを同期する

TaskMateはObsidianの公式コミュニティプラグイン一覧へ公開する前でも、Obsidian Syncを使ってPCとAndroidの両方で利用できます。

必要なのは、次の2つだけです。

1. PCとAndroidでコミュニティプラグインの同期を有効にする
2. PC側の同期中VaultへTaskMateを通常の手動プラグインとして配置する

専用サーバーやAndroid側への個別ダウンロードは必要ありません。

## 1. コミュニティプラグインを同期する

PCとAndroidの**両方**で、次の設定を行います。

1. Obsidianの「設定 → Sync」を開く
2. 「保管庫設定の同期（Vault configuration sync）」を開く
3. 次の2項目を有効にする
   - `Installed community plugin list`
   - `Active community plugin list`
4. Obsidianを完全に終了して再起動する

この設定は端末ごとに必要です。`Installed community plugin list`はインストール済みプラグインを、`Active community plugin list`はプラグインの有効・無効状態を同期します。

> [!NOTE]
> `Active community plugin list`を有効にすると、TaskMate以外のコミュニティプラグインについても有効・無効状態が同期されます。

## 2. PC側へTaskMateを配置する

PC上で、Obsidian Syncに接続している実際のVaultへTaskMateを配置します。公式ストア未掲載プラグインの一般的な手動インストールと同じ方法です。

```text
同期中のVault/
└─ .obsidian/
   └─ plugins/
      └─ taskmate/
         ├─ main.js
         ├─ manifest.json
         └─ styles.css
```

3ファイルは必ず同じ`taskmate`フォルダ直下へ置いてください。

```text
正しい: .obsidian/plugins/taskmate/manifest.json
誤り:   .obsidian/plugins/taskmate/taskmate/manifest.json
```

配置後、PC版Obsidianを再起動し、「設定 → コミュニティプラグイン」からTaskMateを有効にします。

## Androidで使い始める

1. PC側の同期状態が「Fully Synced」になるまで待つ
2. Android版Obsidianで同じリモートVaultを開く
3. Android側も「Fully Synced」になるまで待つ
4. Android版Obsidianを完全に終了して再起動する
5. 「設定 → コミュニティプラグイン」を開く
6. **「インストール済みプラグイン（Installed plugins）」ボタンを押す**
7. 一覧に表示されたTaskMateを有効にする。すでに有効なら、その状態を確認する

これで、TaskMate本体、タスク、プロジェクトをPCとAndroidで利用できます。

> [!IMPORTANT]
> Android側で同期完了を待つだけでは、同期されたTaskMateが端末へ読み込まれない場合があります。「インストール済みプラグイン」ボタンを押して一覧を開く操作まで行ってください。この操作により、同期済みのプラグインがAndroid側へ読み込まれます。

## TaskMateを更新する

TaskMateリポジトリには、検証、ビルド、Vaultへの配置をまとめたスクリプトがあります。初回だけ、同期中Vaultの絶対パスを指定します。

```bash
npm run deploy -- /absolute/path/to/同期中のVault
```

成功したVaultパスは、Git管理されないローカル設定へ保存されます。2回目以降は次の1コマンドだけです。

```bash
npm run deploy
```

スクリプトは型チェック、テスト、本番ビルドを実行してから、PC側の`.obsidian/plugins/taskmate/`にある次の3ファイルを新しいものへ置き換えます。

- `main.js`
- `manifest.json`
- `styles.css`

PC側の同期完了後、Android版Obsidianを再起動すると更新が反映されます。

## 同期されない場合

タスクは同期されるのにTaskMateが表示されない場合は、次を確認してください。

- PCとAndroidの両方で2つのコミュニティプラグイン同期設定が有効か
- TaskMateを置いたVaultと、Obsidian Syncに接続したVaultが同じか
- `taskmate`フォルダが二重になっていないか
- 3ファイルがすべて存在するか
- 両端末が「Fully Synced」になっているか
- 同期後にAndroid版Obsidianを完全終了して再起動したか
- Androidで「設定 → コミュニティプラグイン → インストール済みプラグイン」を開いたか
- Androidのインストール済みプラグイン一覧でTaskMateが有効か

## 確認済みの構成

以下の組み合わせで、TaskMateのプラグイン本体とMarkdownデータがPCからAndroidへ同期され、両方の端末で利用できることを確認しています。

- Obsidian公式のObsidian Sync
- PC版Obsidian
- Android版Obsidian
- 公式ストア未掲載のTaskMateをPC側へ手動配置
- `Installed community plugin list`と`Active community plugin list`を両端末で有効化

## 関連する公式資料

- [Obsidian Syncの設定と選択同期](https://obsidian.md/help/sync/settings)
- [コミュニティプラグインのインストールと有効化](https://obsidian.md/help/community-plugins)

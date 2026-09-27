# Review source notes and create Tasks

Prerequisites: TaskMate in a test Vault, the companion [Skill installed in your agent client](../../../README.md#install-and-use-the-agent-skill), and that client authorized for the Vault. The plugin alone does not run AI. Current use requires identifying the Vault or opening it as the agent workspace; automatic registration is [proposed](../../engineering/features/agent-vault-setup.md).

## Select and request a review

1. Open each intended note in Obsidian and run **TaskMate: Include current note as an AI source**. For a whole folder, use **Include current folder as an AI source** or the TaskMate source-folder setting. Prefer disposable notes for your first run.
2. Ask the agent: “In this Vault, review the TaskMate source notes together, account for every candidate, and stage proposals. Apply label taskmate-e2e to proposed Tasks. Do not promote yet.” If its workspace does not identify the Vault, include the Vault path.
3. Expect an Active review and proposal files, with no new canonical Tasks. Read the review alongside the original notes. Flag omitted actions or incorrect grouping before approving.

## Decide and check

1. Approve by proposal title/ID, for example: “Approve only Send the quotation to Tanaka; leave everything else pending.”
2. Expect only that Task to be created; the review stays Active while others are pending.
3. Approve/revise the remaining actions or explicitly exclude a non-action with a reason. An exclusion is your decision, not an automatic omission.
4. After all decisions, expect the review in Archive. Check the resulting Tasks, Labels, source links and source provenance. If a source changed during review, ask for renewed review before promotion.

You do not need to type the Python helper commands; the Skill uses them internally when available. Current discovery may read non-managed Markdown to check eligibility, even for notes that are not extraction targets. For that boundary and retry limits, read [the import contract](../../engineering/features/source-import.md).

For a multi-note practice scenario, put two independent actions in separate notes and one informational sentence in either note. Confirm staging, partial approval, explicit exclusion and final archival in that order.

## 日本語参考

<!-- translation-status: ai-translated -->

> 翻訳状態：`ai-translated`。英語版が正本です。

前提はテストVaultのTaskMate、Agentクライアントへの[Skill導入](../../../README.md#install-and-use-the-agent-skill)、Vaultへのアクセス権限です。プラグイン単体ではAIを実行しません。現在はVaultを指定するかAgentの作業場所として開きます。自動登録は[提案中](../../engineering/features/agent-vault-setup.md)です。

### 対象を選びレビューする

1. 対象ノートを開き、**TaskMate: 現在のノートをAI対象にする**を実行します。フォルダー単位なら現在のフォルダーをAI対象にするコマンドか設定を使います。初回は使い捨てメモを推奨します。
2. 「このVaultのTaskMate対象メモをまとめてレビューし、全候補を扱って提案をステージしてください。提案するTaskにtaskmate-e2eを付け、まだ正式登録しないでください」と依頼します。作業場所からVaultが決まらなければパスを添えます。
3. Activeのレビューと提案が作成され、正式タスクが増えていないことを確認します。元のメモと照合し、抽出漏れや不適切なまとめ方を修正します。

### 判断して確認する

1. 「田中さんへ見積書を送るだけ承認し、残りは保留」のように件名かIDで指示します。
2. そのTaskだけが作成され、残りがある間はActiveに残ることを確認します。
3. 残りを承認・修正し、行動ではないものは理由を付けて明示的に除外します。
4. 全件判断後にArchiveへ移り、Task、ラベル、Sourceリンクとprovenanceが反映されたことを確認します。Sourceが途中で変わった場合は再レビューします。

Pythonコマンドを手入力する必要はありません。利用可能ならSkillが内部で実行します。現在の探索は適格性判定のため対象外Markdownも読むため、[取り込み仕様](../../engineering/features/source-import.md)の境界を確認してください。練習には2つのメモに独立した行動と情報的な文を置き、ステージ・部分承認・明示除外・全件判断を順に試します。

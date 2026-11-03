# ADR 0028: Run CI on pull requests and main pushes

Status: Accepted

## Context

The CI workflow triggered on every `push` and every `pull_request`. Each push to a branch with an open pull request therefore ran the full verification job twice for the same commit: once on the branch commit and once on the pull request merge ref. Changes reach `main` only through pull requests, so the branch-push run added little information while doubling Actions time and cluttering the Checks list.

## Decision

Run CI on `pull_request` for every pull request, and on `push` only for `main`. Allow `workflow_dispatch` so a branch without a pull request can still be verified on demand. Group runs by ref and cancel an in-progress pull request run when a newer commit is pushed; never cancel `main` push runs.

## Considered options

- Keeping both unrestricted triggers was rejected because it duplicates every pull request run.
- Running only on `push` was rejected because it does not verify the pull request merge result against the current `main`.
- Running only on `pull_request` was rejected because `main` would not be verified after a merge.

## Consequences

- Each pull request commit runs CI once, against the merge result that will land.
- `main` is verified again after each merge, so a broken combination of merged pull requests is still detected.
- A branch pushed without a pull request gets no automatic CI; use the manual run from the Actions page when needed.
- Required status checks keep the same job names, so branch protection continues to work.

## 日本語参考

PRのブランチへpushするたびに、`push`と`pull_request`の両方でCIが同じコミットに対して2回走っていました。変更はPR経由でのみ`main`へ入るため、`pull_request`ではすべてのPRで、`push`では`main`だけでCIを実行します。PRのないブランチは`workflow_dispatch`で手動実行できます。PRに新しいコミットが来たときは古い実行を中止しますが、`main`への実行は中止しません。

Related: [CI workflow](../../../.github/workflows/ci.yml).

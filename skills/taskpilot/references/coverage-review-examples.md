# Coverage review examples

Use these examples after reading the complete eligible source note. Inventory statements before deciding whether to create, merge, or exclude them. Copy each statement exactly as it appears in the note body, preferably as one complete line, so deterministic staging can verify it. Do not shorten or paraphrase it.

## Meeting note

Source:

```text
Prepare the estimate by September 25.
I promised Acme that we would send the revised deck on Friday.
Decision: migrate after approval. Confirm the rollback owner first.
Can Finance approve the budget this week?
The discussion then moved to the Q4 market context.
```

Coverage review:

| Source statement | Candidate treatment | Reason |
| --- | --- | --- |
| `Prepare the estimate by September 25.` | Create | Explicit action and date. |
| `I promised Acme that we would send the revised deck on Friday.` | Create | A promise implies follow-up even though it is phrased as background. |
| `Decision: migrate after approval. Confirm the rollback owner first.` | Create | The decision contains a dependency that must be resolved before execution. |
| `Can Finance approve the budget this week?` | Create | An open question needs an answer or an owner. |
| `The discussion then moved to the Q4 market context.` | No candidate | Connective prose alone does not imply follow-up. |

The last line is not placed in the inventory. Every other exact statement is placed in the inventory and is mapped to exactly one candidate.

## Ambiguous background versus action

Source:

```text
The support contract expires next month.
```

This fact could require renewal, replacement, or an explicit decision. Default to a create candidate such as `Decide how to handle the expiring support contract`. If context shows that no follow-up is desired, keep the statement in the inventory and stage an exclude candidate with the reason. The statement must not disappear merely because it lacks an imperative verb.

By contrast, `The vendor was founded in 2010.` can remain outside the inventory when the surrounding note gives it no decision, risk, dependency, question, or promised follow-up.

## Merge statements serving one outcome

Source:

```text
Draft the renewal proposal.
Add the revised pricing table to the proposal.
```

When both statements serve the same independently completable deliverable, create one candidate titled `Prepare the renewal proposal` and map both exact statements to it. Each inventory statement is still mapped once.

Do not merge merely because statements mention the same project. A user must be able to complete the resulting Task as one action.

## Split statements with different completion boundaries

Source:

```text
Send the draft to Legal on Monday.
Collect executive approval on Friday.
```

Create two candidates. They have different dates and can be completed independently. Combining them would hide the Monday deadline and make completion ambiguous.

## Possible exclusion

Source:

```text
Maybe revisit the color palette someday.
```

This still enters the inventory because it could imply follow-up. If no owner, outcome, or timing can be established, stage an exclude candidate with the reason; the user confirms or changes it in TaskMate. An exclude candidate counts as coverage; silently omitting the statement does not.

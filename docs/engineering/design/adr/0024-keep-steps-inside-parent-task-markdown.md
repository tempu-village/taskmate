# Keep Steps inside the parent Task Markdown

A Step is a lightweight checklist entry that helps complete one parent Task, not an independently managed Task. Store ordered Steps in the parent file under `## Steps`, with optional calendar dates in adjacent `<!-- due: YYYY-MM-DD -->` comments, because this keeps the Markdown portable and avoids introducing child identities, files, Projects, or lifecycle coupling; ordinary prose remains under `## Notes` when the body is split.

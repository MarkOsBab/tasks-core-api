---
name: work-on-tasks
description: Pick pending kanban tasks of the current project from the Core Tasks board (via the core-tasks MCP) and implement them end to end, moving cards and logging progress.
---

# Work on tasks

Implement pending Core Tasks cards for the project this repository belongs to, using the
`core-tasks` MCP server. Works from ANY working copy: the board's projects map to repos via
their registered "Repositorios". If the MCP tools are unavailable, tell the user to run `/mcp`
and authenticate (OAuth browser consent), then stop.

## Flow

1. **Detect the project**: run `git remote get-url origin` (fall back to the repo folder name)
   and call `find_project` with it. If nothing matches, call `find_project` with no arguments,
   show the candidates, and tell the user they can register this repo on the project
   (project form → "Repositorios") so detection is automatic next time.
2. **Pick the work**: call `list_tasks` (default = pending) for that projectId. If the user named
   a task, use that one; otherwise propose the best next card considering priority, board order
   and dependencies. For each candidate, `get_task` and check `aiMetadata.dependsOnTaskIds`: a
   card whose dependencies are not yet in a terminal column is BLOCKED — skip it and say why.
3. **Read the card** (`get_task`): the plain-text description, `aiMetadata.acceptanceCriteria`
   (the definition of done), `aiMetadata.technicalNotes` (implementation hints),
   `aiMetadata.targetRepos` (which working copies the change belongs in) and the checklist.
   Hand-made cards may have `aiMetadata: null` — then the description and checklist are the spec.
4. **Start**: `move_task` the card to the in-progress column (see `list_columns`; the first
   non-terminal column after the backlog).
5. **Implement** in the repo(s) from `targetRepos`. If a target repo is not the current working
   copy, look for a sibling folder with that name; if it is not checked out locally, say so and
   implement only the parts that belong to the current repo. Follow each repo's own CLAUDE.md
   rules. Work through the checklist and acceptance criteria one by one; run the repo's
   typecheck/build (and tests if present) before claiming done.
6. **Log**: `comment_task` with a short summary — what was implemented, key files touched, how
   each acceptance criterion was verified, and anything left open.
7. **Close**: only if every acceptance criterion is verified and the build is green, `move_task`
   to the terminal column. Otherwise leave it in progress and report what is missing.

## Rules

- One card at a time; finish (or explicitly park) before starting the next.
- Never mark a card done with failing builds or unverified criteria.
- Comments on cards are for the team: write them in the card's language (usually Spanish),
  concise and factual.

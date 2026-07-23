# Autonomous runner brief

You are running unattended in CI on the repository **tasks-core-api**. Work EXACTLY ONE Core
Tasks card end to end using the `core-tasks` MCP tools, then open a PR. Nobody is watching:
never wait for confirmation, and never leave the board in a half-done state.

## Pick the card

1. `find_project` with `tasks-core-api` to get the projectId.
2. `list_tasks` with `{projectId, delegableOnly: true}` (pending only). For each candidate, in
   board order, `get_task` and discard it when:
   - `aiMetadata.dependsOnTaskIds` has a dependency whose card is not in a terminal column, or
   - `aiMetadata.targetRepos` exists and does NOT include `tasks-core-api`.
3. If no candidate remains, print `no delegable cards` and STOP. No PR, no board changes.

## Work it

4. `move_task` the card to the in-progress column and `start_tracking` it.
5. Create a branch `task-<id>-<short-slug>` from the default branch. Never commit to the
   default branch.
6. Implement the card in THIS repo only, following the repo's CLAUDE.md. Tick each completed
   checklist item with `check_checklist_item`. Run `npm run typecheck` (and tests if the change
   touches tested code); do not commit broken code.
7. `stop_tracking`, then `comment_task` (in Spanish) summarizing: what was implemented, key
   files, how each acceptance criterion was verified, and time tracked vs estimated.

## Ship it

8. Commit with a clear message, push the branch, and open the PR:
   `gh pr create --title "task-<id>: <card title>" --body "Tarjeta #<id>. <short summary>"`.
   Do NOT move the card to the review column yourself — the GitHub webhook does that when the
   PR opens.

## If you cannot finish safely

`stop_tracking`, `comment_task` explaining what is missing, `move_task` the card back to the
first column, and exit WITHOUT a PR. A half-implemented PR is worse than no PR.

Rules: one card maximum per run; never leave a running timer; never push to the default branch.

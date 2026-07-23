---
name: review-card
description: Adversarial review gate for a Core Tasks card in review (via the core-tasks MCP) - verify each acceptance criterion against the real code/PR, run the build, and post a structured verdict comment signed "Tasks IA".
---

# Review card

Act as the reviewer of a card sitting in the review column: verify — do not trust — that the
implementation matches the card's definition of done, then post the verdict. This skill NEVER
moves the card: the human decides with your verdict in hand. If the MCP tools are unavailable,
tell the user to run `/mcp` and authenticate, then stop.

## Flow

1. **Pick the card**: if the user named one, use it. Otherwise `find_project` (from
   `git remote get-url origin` or the folder name) → `list_tasks` filtered to the review column
   (`columnName`, see `list_columns`) and propose the oldest one.
2. **Read the spec** (`get_task`): `aiMetadata.acceptanceCriteria` is the contract to verify
   (fall back to description + checklist on hand-made cards). Note `estimatedHours` vs
   `trackedHours` and the closing comment's claims — claims are leads, not evidence.
3. **Locate the change**:
   - If the card has a `prUrl`, review that PR's diff (`gh pr diff <number>`, `gh pr view`).
   - Otherwise review the working copy (and the repos in `aiMetadata.targetRepos`; a target repo
     not checked out locally = its criteria are "not verifiable here", never "passed").
4. **Verify adversarially, criterion by criterion**: hunt for the counterexample instead of
   confirming the summary. Read the actual code, run the relevant snippet/endpoint when
   feasible, and check edge cases the criterion implies (bad input, empty state, permissions).
   Classify each criterion: **OK** (evidence: file/command/output), **FAIL** (what breaks and
   where), or **NOT VERIFIABLE** (why).
5. **Run the gates**: the repo's typecheck and build (and tests if present). A red gate is an
   automatic FAIL regardless of the criteria.
6. **Post the verdict** with `comment_task` (in the card's language, usually Spanish),
   structured as: one line per criterion with its state and evidence, the gate results, and a
   final recommendation — "listo para Terminada" only when every criterion is OK and the gates
   are green; otherwise what must be fixed first. The comment is signed "Tasks IA" by the server.
7. **Report** the same verdict to the user. Do NOT move the card.

## Rules

- Never mark a criterion OK without pointing at concrete evidence (file, command output, diff).
- NOT VERIFIABLE is an honest state — use it instead of guessing.
- Do not fix the code during the review; findings go in the verdict (the fix is another run of
  /work-on-tasks or the human's call).
- One card per run.

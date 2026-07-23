---
name: groom-backlog
description: Groom the pending Core Tasks cards of the current project (via the core-tasks MCP) - enrich specs, recalibrate estimates, flag duplicates/oversized/stale cards - and report what changed.
---

# Groom backlog

Leave the pending cards of this repository's project implementation-ready, using the
`core-tasks` MCP server. Enrichment only: this skill NEVER moves, deletes or implements cards.
If the MCP tools are unavailable, tell the user to run `/mcp` and authenticate, then stop.

## Flow

1. **Detect the project**: `git remote get-url origin` (fall back to the repo folder name) →
   `find_project`. If nothing matches, list candidates and stop.
2. **Snapshot the backlog**: `list_tasks` for that projectId (pending). Also `list_tasks` with
   `status: "done"` — the finished cards' `estimatedHours` vs `trackedHours` is the calibration
   baseline for every estimate you touch.
3. **Per pending card** (`get_task`), fix what is missing with `update_task`:
   - **No acceptance criteria** → derive 2–6 verifiable statements from the description and set
     `acceptanceCriteria` (merge semantics: other spec keys survive).
   - **No checklist** → `addChecklistItems` with concrete implementation steps.
   - **No estimate, or one wildly off the real pace** → set `estimatedHours` calibrated against
     the trackedHours of similar finished cards (AI-assisted pace; typical single-feature dev
     cards on this board run well under 1h — never pad to human-scale numbers).
   - **No targetRepos** on a dev card whose repo is obvious → set it.
   - Cards that are pure notes/ideas with no actionable content: do NOT invent a spec — flag
     them in the report instead.
4. **Cross-card checks** (report only, never act on your own):
   - **Duplicates / overlaps**: pairs of cards whose scope collides.
   - **Oversized**: a card that clearly bundles several deliverables → propose the split (titles
     + which parts depend on which); create the split cards with `create_task` +
     `dependsOnTaskIds` ONLY if the user asked for splits.
   - **Stale**: cards untouched for weeks whose context may have expired.
   - **Blocked forever**: `dependsOnTaskIds` pointing at cards that no longer exist or never move.
5. **Report** to the user: per card, what was enriched (criteria/checklist/estimate/repos) and
   the flags raised (duplicate/oversized/stale/blocked) with your recommendation. End with the
   backlog's health in one line.

## Rules

- Enrich, never destroy: no moves, no deletes, no column changes, no unticking checklists.
- Do not touch cards already in progress or review — only the backlog (first column).
- Estimates always calibrated against real trackedHours (`list_tasks` shows both), at
  AI-assisted pace.
- Leave hand-made descriptions intact: enrich via the aiMetadata spec and checklist, do not
  rewrite the user's words unless the description is empty.
- Everything you write on cards (criteria, checklist items) goes in the card's language
  (usually Spanish).

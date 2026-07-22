import { HttpError, unprocessable } from '@/lib/http-error';
import { aiEnabled, aiModel, openaiClient } from '@/lib/ai';
import { prisma } from '@/lib/prisma';
import type { AuthUser } from '@/lib/auth/context';
import { taskService } from '../tasks/task.service';
import type { TaskWithRelations } from '../tasks/task.types';
import { aiContextService, type AiWorkspaceContext } from './ai-context.service';
import type { ApplyDraftInput } from './ai-draft.schema';

/**
 * Machine-readable implementation spec riding on each card. The human reads the HTML
 * description; a coding agent (via the MCP's get_task) reads this instead.
 */
export interface AiDraftMetadata {
  acceptanceCriteria: string[];
  technicalNotes: string | null;
  targetRepos: string[]; // subset of the project's registered repositories
  dependsOnIndexes: number[]; // 0-based indices of drafts in the same batch that go first
}

/** Draft card as returned to the UI: real ids plus display names so chips render with no extra fetches. */
export interface AiTaskDraft {
  title: string;
  description: string;
  priority: string;
  columnId: string;
  columnName: string;
  projectId: string | null;
  projectName: string | null;
  labelIds: string[];
  labels: { id: string; name: string }[];
  assigneeIds: string[];
  assignees: { id: string; name: string }[];
  checklist: string[];
  estimatedHours: number | null;
  reasoning: string;
  aiMetadata: AiDraftMetadata;
}

// Raw model output, constrained by the strict JSON schema below.
interface RawDraft {
  title: string;
  description: string;
  priority: string;
  columnId: string;
  projectId: string | null;
  labelIds: string[];
  assigneeIds: string[];
  checklist: string[];
  estimatedHours: number | null;
  reasoning: string;
  acceptanceCriteria: string[];
  technicalNotes: string | null;
  targetRepos: string[];
  dependsOnIndexes: number[];
}

// OpenAI structured outputs (strict): every property required, additionalProperties false,
// nullability via type arrays. Guarantees parseable JSON in the exact shape below.
const DRAFTS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    drafts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: 'Short imperative card title (max 255 chars).' },
          description: {
            type: 'string',
            description:
              'Simple HTML body (<p>, <ul>, <li>, <strong> only): 1-3 sentences of context plus acceptance criteria. Same language as the input.',
          },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          columnId: { type: 'string', description: 'Id of one of the provided board columns.' },
          projectId: {
            type: ['string', 'null'],
            description: 'Id of one of the provided projects, or null when none applies.',
          },
          labelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ids of existing labels only. Never invent labels.',
          },
          assigneeIds: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Ids of users with EVIDENCE for this card (project membership, matching role or matching history; max 2). Empty if nobody qualifies. Never assign by low workload alone.',
          },
          checklist: {
            type: 'array',
            items: { type: 'string' },
            description: 'Concrete sub-steps, each independently completable (max 15).',
          },
          estimatedHours: {
            type: ['number', 'null'],
            description: 'Effort estimate in hours based on similar tracked tasks; null if unknown.',
          },
          reasoning: {
            type: 'string',
            description:
              'One short sentence, same language as the input, justifying assignee/labels/estimate.',
          },
          acceptanceCriteria: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Verifiable, testable criteria in PLAIN TEXT (2-6). Same content as the description criteria, machine-readable.',
          },
          technicalNotes: {
            type: ['string', 'null'],
            description:
              'Implementation hints for a coding agent: affected modules/endpoints/components, contracts, edge cases. Plain text, same language as the input. Null when trivial.',
          },
          targetRepos: {
            type: 'array',
            items: { type: 'string' },
            description:
              "Which of the card's project registered repositories the work happens in (exact strings from project.repositories). Empty if unclear or the project has none.",
          },
          dependsOnIndexes: {
            type: 'array',
            items: { type: 'integer' },
            description:
              '0-based indexes of OTHER drafts in this same response that must be completed first. Empty when independent.',
          },
        },
        required: [
          'title',
          'description',
          'priority',
          'columnId',
          'projectId',
          'labelIds',
          'assigneeIds',
          'checklist',
          'estimatedHours',
          'reasoning',
          'acceptanceCriteria',
          'technicalNotes',
          'targetRepos',
          'dependsOnIndexes',
        ],
      },
    },
  },
  required: ['drafts'],
} as const;

const SYSTEM_PROMPT = `You are the planning assistant of a small software studio's task-management workspace (clients -> projects -> proposals / kanban tasks).

You receive rough notes (requirements, meeting minutes, a feature dump) and a JSON snapshot of the workspace. Turn the notes into clear, actionable kanban cards.

Rules:
- Split the work into cards of at most ~1 day of effort each; anything bigger becomes several cards or a card with a checklist of sub-steps.
- Titles are short and imperative. Descriptions are SIMPLE HTML (only <p>, <ul>, <li>, <strong>; the app stores rich text as HTML): 1-3 sentences of context plus a short "Criterios de aceptación" / acceptance-criteria list. Write titles, descriptions, checklist items and reasoning in the SAME LANGUAGE as the input notes (default Spanish).
- Study sampleTasks to imitate the team's writing style, label conventions and card granularity.
- labels: pick ONLY from the provided labels (by id). Never invent labels. Prefer labels the team actually uses (higher taskCount).
- assignees: pick at most 2 users per card, and ONLY with EVIDENCE. Each user carries: role (their job), memberProjects (projects they were explicitly assigned to), history (assignedTaskCount, topLabels, trackedHours, recentProjects — what they actually worked on) and openTaskCount (live workload). Qualify candidates in this priority order: (1) members of the card's project (memberProjects), (2) role matching the kind of work, (3) history matching (their topLabels/recentProjects cover the card's labels/project, or they have most of the workspace's activity). NEVER assign a user with no membership, no matching role and an empty history — a low openTaskCount is NOT a reason to assign someone. Use openTaskCount only to break ties BETWEEN qualified candidates. If a single user did practically all the historical work and no one else qualifies, assign that user. If nobody qualifies, leave assigneeIds empty.
- priority: infer from urgency words in the notes and from how similar sample tasks are prioritized; default "medium".
- columnId: use the first non-terminal column (backlog/todo) unless the notes clearly say work is already in progress.
- projectId: match the notes against the provided projects/clients; if a target project id is given in the user message, use exactly that id on every card. Use null when nothing matches.
- estimatedHours: base it on trackedHours of comparable sampleTasks AND the project's own pace (projects[].stats: trackedHours vs estimatedHours, done/open counts); null when there is no comparable signal.
- reasoning: one short sentence explaining why that assignee/estimate (shown to the human reviewer).

Each card also carries a machine-readable spec that a coding agent will use to implement it autonomously:
- acceptanceCriteria: 2-6 verifiable criteria in plain text (no HTML) — concrete enough that an agent can check them off.
- technicalNotes: implementation hints for the agent (likely modules/endpoints/components, API contracts, edge cases, gotchas), inferred from the notes and the workspace. Null only when the card is trivial.
- targetRepos: the exact repository strings from the card's project (projects[].repositories) where the work happens; empty if the project has none registered or it is unclear.
- dependsOnIndexes: 0-based indexes of other drafts in THIS response that must land first (e.g. the API endpoint before the UI screen). Empty when independent.
Do not invent ids: every columnId/projectId/labelId/assigneeId must come from the snapshot.`;

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

class AiDraftService {
  /** Turns rough notes into reviewable draft cards. Nothing is persisted here. */
  async generate(input: string, projectId: string | null): Promise<AiTaskDraft[]> {
    if (!aiEnabled()) throw new HttpError(503, 'AI assistant is not configured.');
    const context = await aiContextService.build();
    if (context.columns.length === 0) {
      throw unprocessable('The global board has no columns to place cards in.');
    }

    const client = await openaiClient();
    const completion = await client.chat.completions.create({
      model: aiModel(),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            `Workspace snapshot:\n${JSON.stringify(context)}`,
            projectId ? `Target project id (pin every card to it): ${projectId}` : null,
            `Notes:\n${input}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'task_drafts', strict: true, schema: DRAFTS_JSON_SCHEMA },
      },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new HttpError(502, 'AI generation returned no content.');
    let parsed: { drafts: RawDraft[] };
    try {
      parsed = JSON.parse(content) as { drafts: RawDraft[] };
    } catch {
      throw new HttpError(502, 'AI generation returned invalid JSON.');
    }
    return this.sanitize(parsed.drafts ?? [], context, projectId);
  }

  /**
   * The model is grounded by the prompt, but ids are still validated defensively against the
   * snapshot: unknown labels/assignees are dropped, an unknown column falls back to the first
   * non-terminal one, and a requested target project always wins.
   */
  private sanitize(
    raw: RawDraft[],
    context: AiWorkspaceContext,
    forcedProjectId: string | null,
  ): AiTaskDraft[] {
    const columns = byId(context.columns);
    const labels = byId(context.labels);
    const users = byId(context.users);
    const projects = byId(context.projects);
    const defaultColumn = context.columns.find((c) => !c.isTerminal) ?? context.columns[0];

    const kept = raw.filter((draft) => draft.title?.trim()).slice(0, 30);
    return kept.map((draft, index) => {
        const column = columns.get(draft.columnId) ?? defaultColumn;
        const projectIdValue = forcedProjectId ?? draft.projectId;
        const project =
          projectIdValue != null ? (projects.get(projectIdValue) ?? null) : null;
        const draftLabels = [...new Set(draft.labelIds ?? [])]
          .map((id) => labels.get(id))
          .filter((label): label is NonNullable<typeof label> => label != null);
        const draftAssignees = [...new Set(draft.assigneeIds ?? [])]
          .map((id) => users.get(id))
          .filter((user): user is NonNullable<typeof user> => user != null)
          .slice(0, 2);
        // targetRepos must be repositories actually registered on the card's project.
        const projectRepos = new Set(project?.repositories ?? []);
        const targetRepos = [...new Set(draft.targetRepos ?? [])]
          .filter((repo) => projectRepos.has(repo))
          .slice(0, 5);
        const dependsOnIndexes = [...new Set(draft.dependsOnIndexes ?? [])]
          .filter((i) => Number.isInteger(i) && i >= 0 && i < kept.length && i !== index)
          .slice(0, 10);

        return {
          title: draft.title.trim().slice(0, 255),
          description: draft.description ?? '',
          priority: ['low', 'medium', 'high', 'urgent'].includes(draft.priority)
            ? draft.priority
            : 'medium',
          columnId: column.id,
          columnName: column.name,
          projectId: project?.id ?? null,
          projectName: project?.name ?? null,
          labelIds: draftLabels.map((label) => label.id),
          labels: draftLabels.map((label) => ({ id: label.id, name: label.name })),
          assigneeIds: draftAssignees.map((user) => user.id),
          assignees: draftAssignees.map((user) => ({ id: user.id, name: user.name })),
          checklist: (draft.checklist ?? [])
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 15),
          estimatedHours:
            typeof draft.estimatedHours === 'number' && draft.estimatedHours > 0
              ? Math.round(draft.estimatedHours * 10) / 10
              : null,
          reasoning: draft.reasoning ?? '',
          aiMetadata: {
            acceptanceCriteria: (draft.acceptanceCriteria ?? [])
              .map((c) => c.trim())
              .filter(Boolean)
              .slice(0, 10),
            technicalNotes: draft.technicalNotes?.trim() || null,
            targetRepos,
            dependsOnIndexes,
          },
        };
      });
  }

  /**
   * Persists reviewed drafts. Goes through taskService.create so every task invariant (position,
   * WIP limits, projectId denormalization, m2m connects, assignment notifications) applies; the
   * checklist rides on afterwards. Sequential on purpose: positions are computed per column.
   */
  async apply(drafts: ApplyDraftInput[], user: AuthUser): Promise<TaskWithRelations[]> {
    const created: TaskWithRelations[] = [];
    for (const draft of drafts) {
      const meta = draft.aiMetadata;
      const task = await taskService.create(
        {
          columnId: draft.columnId,
          projectId: draft.projectId ?? null,
          title: draft.title,
          description: draft.description ?? null,
          priority: draft.priority,
          assigneeIds: draft.assigneeIds ?? [],
          labelIds: draft.labelIds ?? [],
          // dependsOnIndexes stays out: it only means something inside this batch, so it is
          // resolved to real task ids in the second pass below.
          ...(meta
            ? {
                aiMetadata: {
                  acceptanceCriteria: meta.acceptanceCriteria ?? [],
                  technicalNotes: meta.technicalNotes ?? null,
                  targetRepos: meta.targetRepos ?? [],
                },
              }
            : {}),
        },
        user,
      );
      const items = (draft.checklist ?? []).map((title) => title.trim()).filter(Boolean);
      if (items.length > 0) {
        await prisma.checklistItem.createMany({
          data: items.map((title, index) => ({ taskId: task.id, title, position: index })),
        });
      }
      created.push(task);
    }
    // Second pass: batch-relative dependency indexes -> real created-task ids (forward
    // references included, hence after every card exists).
    for (let i = 0; i < drafts.length; i++) {
      const meta = drafts[i].aiMetadata;
      const indexes = (meta?.dependsOnIndexes ?? []).filter(
        (index) => index !== i && index < created.length,
      );
      if (!meta || indexes.length === 0) continue;
      await prisma.task.update({
        where: { id: created[i].id },
        data: {
          aiMetadata: {
            acceptanceCriteria: meta.acceptanceCriteria ?? [],
            technicalNotes: meta.technicalNotes ?? null,
            targetRepos: meta.targetRepos ?? [],
            dependsOnTaskIds: indexes.map((index) => String(created[index].id)),
          },
        },
      });
    }
    return created;
  }
}

export const aiDraftService = new AiDraftService();

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { HttpError, unauthorized } from '@/lib/http-error';
import type { AuthUser } from '@/lib/auth/context';
import { TASK_PRIORITY } from '../tasks/task.schema';
import { mcpService } from './mcp.service';

/**
 * Tool surface of the Core Tasks MCP (`/api/mcp`). Read tools return raw JSON for the calling
 * agent to reason over (no LLM in the loop here — that keeps latency at query speed); mutations
 * are scoped to the board workflow — creating a card, moving it, commenting, ticking checklist
 * items and the user's timer — and attributed to the token's user where the domain records
 * authorship.
 */

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown) {
  const message =
    err instanceof HttpError
      ? err.errors
        ? `${err.message} ${JSON.stringify(err.errors)}`
        : err.message
      : err instanceof Error
        ? err.message
        : 'Unexpected error.';
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

/** The verified MCP bearer token carries the acting user's id (set in the route's withMcpAuth). */
function authUserFrom(authInfo: AuthInfo | undefined): AuthUser {
  const raw = authInfo?.extra?.['userId'];
  if (typeof raw !== 'string') throw unauthorized();
  try {
    return { id: BigInt(raw) };
  } catch {
    throw unauthorized();
  }
}

export function registerMcpTools(server: McpServer): void {
  server.registerTool(
    'find_project',
    {
      description:
        'Resolve which Core Tasks project a git repository belongs to, or search projects by name/client. ' +
        'Pass repoUrl (a git remote URL or the repo folder name, e.g. "core-tasks-ui") to detect the project ' +
        'for the working copy you are in. With no arguments it lists every project. Returns project ids, ' +
        'members with roles, registered repositories and open (pending) task counts.',
      inputSchema: {
        repoUrl: z.string().max(500).optional().describe('Git remote URL or repo folder name to match'),
        query: z.string().max(255).optional().describe('Free-text search over project and client names'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ repoUrl, query }) => {
      try {
        return jsonResult(await mcpService.findProjects(repoUrl ?? null, query ?? null));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'list_tasks',
    {
      description:
        'List kanban tasks. By default returns PENDING tasks (cards in non-terminal columns), ordered by ' +
        'board column and position. Filter by projectId (from find_project), column name, assignee ' +
        '(name or email fragment) or title search. Each card carries estimatedHours AND trackedHours — ' +
        'list done/reviewed cards to calibrate a new estimate against real durations. Use get_task for ' +
        'the full implementation-ready detail.',
      inputSchema: {
        projectId: z.string().optional().describe('Scope to one project (id from find_project)'),
        status: z.enum(['pending', 'done', 'all']).optional().describe('Default: pending'),
        columnName: z.string().optional().describe('Exact column name, case-insensitive'),
        assignee: z.string().optional().describe('Assignee name or email fragment'),
        search: z.string().optional().describe('Task title search'),
        limit: z.number().int().min(1).max(100).optional().describe('Max results, default 50'),
        delegableOnly: z
          .boolean()
          .optional()
          .describe('Only cards flagged aiDelegable (opted-in for the autonomous AI runner)'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        return jsonResult(await mcpService.listTasks(args));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_task',
    {
      description:
        'Get the full detail of one task: plain-text description, acceptance checklist, labels, assignees ' +
        'with roles, recent comments, estimated vs tracked hours and the project (with its registered ' +
        'repositories). This is the card an agent should read before implementing it.',
      inputSchema: { taskId: z.string().describe('Task id') },
      annotations: { readOnlyHint: true },
    },
    async ({ taskId }) => {
      try {
        return jsonResult(await mcpService.getTask(taskId));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'create_task',
    {
      description:
        'Create a new card on the kanban board, attributed to the MCP token\'s user. Use it to capture ' +
        'a requirement as a card before implementing it, or to log follow-up work discovered while on ' +
        'another card (link it via dependsOnTaskIds). The column defaults to the first (backlog) column. ' +
        'acceptanceCriteria/technicalNotes/targetRepos are stored as the card\'s machine-readable spec ' +
        '(aiMetadata, shown by get_task). The result includes the checklist item ids for check_checklist_item.',
      inputSchema: {
        title: z.string().min(1).max(255).describe('Card title'),
        description: z.string().max(20000).optional().describe('Card description (plain text)'),
        projectId: z
          .string()
          .optional()
          .describe('Project to tag the card with (id from find_project)'),
        column: z
          .string()
          .optional()
          .describe('Target column name or id (see list_columns); default: first column'),
        priority: z.enum(TASK_PRIORITY).optional().describe('Default: medium'),
        estimatedHours: z
          .number()
          .min(0)
          .optional()
          .describe(
            'Estimate at AI-assisted pace CALIBRATED against history: check estimatedHours vs ' +
              'trackedHours of similar finished cards (list_tasks) first — typical dev cards have ' +
              'really taken well under 1h, so do not pad to human-scale numbers',
          ),
        dueDate: z.string().optional().describe('Due date, DD/MM/YYYY or YYYY-MM-DD'),
        assignToMe: z
          .boolean()
          .optional()
          .describe('Assign the card to the MCP token\'s user (default false)'),
        aiDelegable: z
          .boolean()
          .optional()
          .describe('Flag the card as delegable: the autonomous AI runner may pick it up unattended (default false)'),
        checklist: z
          .array(z.string().min(1).max(255))
          .max(50)
          .optional()
          .describe('Initial checklist item titles, in order'),
        acceptanceCriteria: z
          .array(z.string().max(500))
          .max(30)
          .optional()
          .describe('Definition of done, one verifiable statement per entry'),
        technicalNotes: z.string().max(5000).optional().describe('Implementation hints for the agent'),
        targetRepos: z
          .array(z.string().max(255))
          .max(10)
          .optional()
          .describe('Repository names the change belongs in (see the project\'s repositories)'),
        dependsOnTaskIds: z
          .array(z.string())
          .max(20)
          .optional()
          .describe('Existing task ids this card is blocked by until they reach the done column'),
      },
      annotations: { destructiveHint: false },
    },
    async (args, extra) => {
      try {
        return jsonResult(await mcpService.createTask(args, authUserFrom(extra.authInfo)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'update_task',
    {
      description:
        'Update fields of an existing card and/or append checklist items. Only the fields you pass ' +
        'are touched; the aiMetadata spec keys (acceptanceCriteria, technicalNotes, targetRepos, ' +
        'dependsOnTaskIds) MERGE into the existing spec without clobbering unsent keys. Use it to ' +
        'groom cards: enrich the spec, recalibrate estimatedHours against trackedHours of similar ' +
        'finished cards, or flag a card aiDelegable. Moving between columns stays in move_task.',
      inputSchema: {
        taskId: z.string().describe('Task id'),
        title: z.string().min(1).max(255).optional().describe('New card title'),
        description: z
          .string()
          .max(20000)
          .optional()
          .describe('Replaces the card description (plain text)'),
        priority: z.enum(TASK_PRIORITY).optional(),
        estimatedHours: z
          .number()
          .min(0)
          .optional()
          .describe(
            'New estimate at AI-assisted pace, calibrated against the trackedHours of similar ' +
              'finished cards (list_tasks shows estimated vs tracked)',
          ),
        dueDate: z.string().optional().describe('Due date, DD/MM/YYYY or YYYY-MM-DD'),
        aiDelegable: z
          .boolean()
          .optional()
          .describe('Whether the autonomous AI runner may pick this card up unattended'),
        acceptanceCriteria: z
          .array(z.string().max(500))
          .max(30)
          .optional()
          .describe('Replaces the spec\'s definition of done (other spec keys survive)'),
        technicalNotes: z.string().max(5000).optional().describe('Implementation hints for the agent'),
        targetRepos: z
          .array(z.string().max(255))
          .max(10)
          .optional()
          .describe('Repository names the change belongs in'),
        dependsOnTaskIds: z
          .array(z.string())
          .max(20)
          .optional()
          .describe('Existing task ids this card is blocked by'),
        addChecklistItems: z
          .array(z.string().min(1).max(255))
          .max(50)
          .optional()
          .describe('Appended to the end of the checklist; titles it already has are skipped'),
      },
      annotations: { destructiveHint: false },
    },
    async (args, extra) => {
      try {
        return jsonResult(await mcpService.updateTask(args, authUserFrom(extra.authInfo)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'move_task',
    {
      description:
        'Move a task to another kanban column (e.g. to "in progress" when starting work, or to the done ' +
        'column when finished). Accepts the column name (case-insensitive) or its id; the card lands at ' +
        'the end of the target column. Column WIP limits are enforced (422-style error when full).',
      inputSchema: {
        taskId: z.string().describe('Task id'),
        column: z.string().describe('Target column name or id (see list_columns)'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ taskId, column }) => {
      try {
        return jsonResult(await mcpService.moveTask(taskId, column));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'comment_task',
    {
      description:
        'Add a plain-text comment to a task, displayed as authored by "Tasks IA" (the MCP token\'s user ' +
        'stays as the underlying author for permissions). Use it to log what was implemented, decisions ' +
        'taken, or questions for the team. Assignees and the card creator are notified.',
      inputSchema: {
        taskId: z.string().describe('Task id'),
        body: z.string().min(1).max(10000).describe('Comment text (plain text)'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ taskId, body }, extra) => {
      try {
        return jsonResult(await mcpService.commentTask(taskId, body, authUserFrom(extra.authInfo)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'check_checklist_item',
    {
      description:
        'Tick or untick one checklist item of a task (set done true/false). Item ids come from ' +
        'get_task\'s checklist. Call it as you complete each item while implementing a card so the ' +
        'board reflects real progress; the result includes the checklist done/total counts.',
      inputSchema: {
        taskId: z.string().describe('Task id'),
        itemId: z.string().describe('Checklist item id (from get_task)'),
        done: z.boolean().describe('true to tick, false to untick'),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ taskId, itemId, done }) => {
      try {
        return jsonResult(await mcpService.setChecklistItem(taskId, itemId, done));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'start_tracking',
    {
      description:
        'Start the time-tracking timer on a task, attributed to the MCP token\'s user. Call it when you ' +
        'begin implementing a card (right after moving it to in progress) so tracked hours reflect the ' +
        'real work time. One running timer per user: starting here auto-stops any other running timer ' +
        '(the result reports which one). Pair with stop_tracking when you finish or pause.',
      inputSchema: {
        taskId: z.string().describe('Task id'),
        description: z
          .string()
          .max(1000)
          .optional()
          .describe('Optional note for the timesheet entry (e.g. "AI agent implementation")'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ taskId, description }, extra) => {
      try {
        return jsonResult(
          await mcpService.startTracking(taskId, description ?? null, authUserFrom(extra.authInfo)),
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'stop_tracking',
    {
      description:
        'Stop the MCP user\'s running time-tracking timer and get the session and task totals (compare ' +
        'with the task\'s estimatedHours). Pass taskId to assert the timer belongs to that task, or omit ' +
        'it to stop whatever is running. Having no running timer is a normal outcome, not an error.',
      inputSchema: {
        taskId: z.string().optional().describe('Task id the running timer should belong to (optional)'),
      },
      annotations: { destructiveHint: false },
    },
    async ({ taskId }, extra) => {
      try {
        return jsonResult(await mcpService.stopTracking(taskId ?? null, authUserFrom(extra.authInfo)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'add_learning',
    {
      description:
        'Record ONE durable, non-obvious fact about a project (institutional memory): a gotcha, a ' +
        'constraint, a decision that future work must respect. Call it when closing a card whose ' +
        'implementation surprised you. Future agents see these in get_task (projectLearnings) and ' +
        'find_project, so write facts that stay true — never session trivia, never anything already ' +
        'documented in the repo\'s CLAUDE.md. Exact duplicates on the same project are not re-inserted.',
      inputSchema: {
        projectId: z.string().describe('Project id (from find_project)'),
        body: z
          .string()
          .min(10)
          .max(2000)
          .describe('The fact, one or two sentences, in the project\'s language (usually Spanish)'),
        taskId: z.string().optional().describe('Card that produced the learning (optional)'),
      },
      annotations: { destructiveHint: false },
    },
    async (args, extra) => {
      try {
        return jsonResult(await mcpService.addLearning(args, authUserFrom(extra.authInfo)));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_project_summary',
    {
      description:
        'Overview of one project: status, members with roles, estimated vs tracked hours, task counts by ' +
        'column and by assignee, every proposal with amount/currency/status (the budget picture), and a ' +
        'data-driven `forecast` (remaining estimated hours corrected by the real tracked/estimated ratio, ' +
        'recent velocity and projected finish date — no LLM, pure history). Use this to answer questions ' +
        'about project health, budgets, workload and delivery dates.',
      inputSchema: { projectId: z.string().describe('Project id (from find_project)') },
      annotations: { readOnlyHint: true },
    },
    async ({ projectId }) => {
      try {
        return jsonResult(await mcpService.getProjectSummary(projectId));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'list_columns',
    {
      description:
        'List the columns of the (single, global) kanban board in order, with WIP limits, task counts and ' +
        'which column is terminal (done). Useful before move_task.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        return jsonResult(await mcpService.listColumns());
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

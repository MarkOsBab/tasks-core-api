import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { HttpError, unauthorized } from '@/lib/http-error';
import type { AuthUser } from '@/lib/auth/context';
import { mcpService } from './mcp.service';

/**
 * Tool surface of the Core Tasks MCP (`/api/mcp`). Read tools return raw JSON for the calling
 * agent to reason over (no LLM in the loop here — that keeps latency at query speed); the only
 * mutations are moving a card and commenting, both attributed to the token's user.
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
        '(name or email fragment) or title search. Use get_task for the full implementation-ready detail.',
      inputSchema: {
        projectId: z.string().optional().describe('Scope to one project (id from find_project)'),
        status: z.enum(['pending', 'done', 'all']).optional().describe('Default: pending'),
        columnName: z.string().optional().describe('Exact column name, case-insensitive'),
        assignee: z.string().optional().describe('Assignee name or email fragment'),
        search: z.string().optional().describe('Task title search'),
        limit: z.number().int().min(1).max(100).optional().describe('Max results, default 50'),
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
        'with roles, recent comments, tracked hours and the project (with its registered repositories). ' +
        'This is the card an agent should read before implementing it.',
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
        'Add a plain-text comment to a task, attributed to the MCP token\'s user. Use it to log what was ' +
        'implemented, decisions taken, or questions for the team. Assignees and the card creator are notified.',
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
    'get_project_summary',
    {
      description:
        'Overview of one project: status, members with roles, estimated vs tracked hours, task counts by ' +
        'column and by assignee, and every proposal with amount/currency/status (the budget picture). ' +
        'Use this to answer questions about project health, budgets and workload.',
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

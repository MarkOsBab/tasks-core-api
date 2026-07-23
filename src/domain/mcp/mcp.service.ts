import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { htmlToText } from '@/lib/html-text';
import { toBigIntOrUndefined } from '@/lib/ids';
import { notFound, unprocessable } from '@/lib/http-error';
import { dmy, dmyHms, strId } from '@/resources/serialize';
import type { AuthUser } from '@/lib/auth/context';
import { taskService } from '../tasks/task.service';
import { checklistItemService } from '../checklist-items/checklist-item.service';
import { commentService } from '../comments/comment.service';
import { timeEntryService } from '../time-entries/time-entry.service';
import { buildTaskLink } from '../notifications/notification.service';

/**
 * Data layer behind the MCP tools (`/api/mcp`). Every method returns plain JSON-safe objects
 * (ids via strId, dates via dmy/dmyHms) meant to be read by an LLM agent, so payloads stay
 * compact: lists carry names instead of nested entities, HTML descriptions become plain text.
 * Mutations go through the existing domain services (WIP limits, positions, notifications).
 */

function fullName(user: { name: string; lastName: string | null }): string {
  return `${user.name} ${user.lastName ?? ''}`.trim();
}

/** Lowercases and strips protocol/`git@`/`www.`/`.git` so URL variants of a repo compare equal. */
function normalizeRepo(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.git$/, '')
    .replace(/^git@([^:]+):/, '$1/')
    .replace(/^[a-z+]+:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

function repoBasename(normalized: string): string {
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
}

/** Full normalized equality, or same trailing repo name ("core-tasks-ui" matches any host/owner). */
function repoMatches(stored: string, input: string): boolean {
  const a = normalizeRepo(stored);
  const b = normalizeRepo(input);
  if (a === '' || b === '') return false;
  return a === b || repoBasename(a) === repoBasename(b);
}

function parseId(value: string, label: string): bigint {
  const id = toBigIntOrUndefined(value);
  if (id === undefined) throw unprocessable(`Invalid ${label}: "${value}".`);
  return id;
}

const HOURS = (seconds: number) => Math.round((seconds / 3600) * 100) / 100;
const elapsed = (start: Date) => Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));

class McpService {
  /**
   * Maps a working copy (or a free-text query) to its project. Match order: registered
   * repositories (Project.repositories), then a name heuristic (project name slug vs repo name).
   * With no arguments it lists every project.
   */
  async findProjects(repoUrl: string | null, query: string | null) {
    const where: Prisma.ProjectWhereInput = { deletedAt: null };
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { client: { name: { contains: query, mode: 'insensitive' } } },
      ];
    }
    const projects = await prisma.project.findMany({
      where,
      include: { client: true, members: true },
      orderBy: { name: 'asc' },
    });

    let matched = projects;
    let matchedBy: 'repository' | 'name-heuristic' | 'query' | 'all' = query ? 'query' : 'all';
    if (repoUrl) {
      matched = projects.filter((p) => p.repositories.some((r) => repoMatches(r, repoUrl)));
      matchedBy = 'repository';
      if (matched.length === 0) {
        // Fallback: "core-tasks-ui" should still find the "Core Tasks" project.
        const base = repoBasename(normalizeRepo(repoUrl));
        matched = projects.filter((p) => {
          const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          return slug !== '' && (base.startsWith(slug) || slug.startsWith(base));
        });
        matchedBy = 'name-heuristic';
      }
    }

    const counts =
      matched.length > 0
        ? await prisma.task.groupBy({
            by: ['projectId'],
            where: {
              deletedAt: null,
              projectId: { in: matched.map((p) => p.id) },
              column: { isTerminal: false },
            },
            _count: { _all: true },
          })
        : [];
    const openByProject = new Map(counts.map((c) => [String(c.projectId), c._count._all]));

    return {
      matchedBy,
      projects: matched.map((p) => ({
        id: strId(p.id),
        name: p.name,
        client: p.client && !p.client.deletedAt ? p.client.name : null,
        status: p.status,
        estimatedHours: p.estimatedHours === null ? null : Number(p.estimatedHours),
        repositories: p.repositories,
        members: p.members.filter((u) => !u.deletedAt).map((u) => ({
          id: strId(u.id),
          name: fullName(u),
          role: u.role,
        })),
        openTaskCount: openByProject.get(String(p.id)) ?? 0,
      })),
    };
  }

  /** Compact task list; `status` defaults to pending (non-terminal columns). */
  async listTasks(args: {
    projectId?: string;
    status?: 'pending' | 'done' | 'all';
    columnName?: string;
    assignee?: string;
    search?: string;
    limit?: number;
  }) {
    const where: Prisma.TaskWhereInput = { deletedAt: null };
    if (args.projectId) where.projectId = parseId(args.projectId, 'projectId');
    const column: Prisma.BoardColumnWhereInput = {};
    const status = args.status ?? 'pending';
    if (status !== 'all') column.isTerminal = status === 'done';
    if (args.columnName) column.name = { equals: args.columnName, mode: 'insensitive' };
    if (Object.keys(column).length > 0) where.column = column;
    if (args.assignee) {
      where.assignees = {
        some: {
          deletedAt: null,
          OR: [
            { name: { contains: args.assignee, mode: 'insensitive' } },
            { lastName: { contains: args.assignee, mode: 'insensitive' } },
            { email: { contains: args.assignee, mode: 'insensitive' } },
          ],
        },
      };
    }
    if (args.search) where.title = { contains: args.search, mode: 'insensitive' };

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const tasks = await prisma.task.findMany({
      where,
      include: {
        column: true,
        project: true,
        labels: true,
        assignees: true,
        checklistItems: { where: { deletedAt: null } },
      },
      orderBy: [{ column: { position: 'asc' } }, { position: 'asc' }],
      take: limit,
    });

    return {
      count: tasks.length,
      truncated: tasks.length === limit,
      tasks: tasks.map((t) => ({
        id: strId(t.id),
        title: t.title,
        column: t.column.name,
        priority: t.priority,
        project: t.project && !t.project.deletedAt ? t.project.name : null,
        dueDate: dmy(t.dueDate),
        labels: t.labels.filter((l) => !l.deletedAt).map((l) => l.name),
        assignees: t.assignees.filter((u) => !u.deletedAt).map((u) => fullName(u)),
        checklist: {
          done: t.checklistItems.filter((c) => c.done).length,
          total: t.checklistItems.length,
        },
        estimatedHours: t.estimatedHours === null ? null : Number(t.estimatedHours),
        link: buildTaskLink(t),
      })),
    };
  }

  /** Full card detail, implementation-ready: plain-text description, checklist, comments, time. */
  async getTask(taskId: string) {
    const id = parseId(taskId, 'taskId');
    const task = await prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: {
        column: true,
        project: { include: { client: true } },
        assignees: true,
        createdBy: true,
        labels: true,
        checklistItems: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: { user: true },
        },
        timeEntries: { where: { deletedAt: null, endedAt: { not: null } } },
      },
    });
    if (!task) throw notFound();

    const project = task.project && !task.project.deletedAt ? task.project : null;
    const client = project?.client && !project.client.deletedAt ? project.client : null;
    const trackedSeconds = task.timeEntries.reduce((sum, e) => sum + (e.durationSeconds ?? 0), 0);

    return {
      id: strId(task.id),
      title: task.title,
      description: htmlToText(task.description),
      column: task.column.name,
      columnIsTerminal: task.column.isTerminal,
      priority: task.priority,
      project: project ? { id: strId(project.id), name: project.name, repositories: project.repositories } : null,
      client: client?.name ?? null,
      dueDate: dmy(task.dueDate),
      labels: task.labels.filter((l) => !l.deletedAt).map((l) => l.name),
      assignees: task.assignees.filter((u) => !u.deletedAt).map((u) => ({
        id: strId(u.id),
        name: fullName(u),
        role: u.role,
      })),
      createdBy: task.createdBy && !task.createdBy.deletedAt ? fullName(task.createdBy) : null,
      createdAt: dmy(task.createdAt),
      // Machine-readable spec of AI-generated cards: acceptanceCriteria, technicalNotes,
      // targetRepos and dependsOnTaskIds (implement those first). Null on hand-made cards.
      aiMetadata: task.aiMetadata ?? null,
      checklist: task.checklistItems.map((c) => ({
        id: strId(c.id),
        title: c.title,
        done: c.done,
      })),
      comments: task.comments
        .filter((c) => !c.user.deletedAt)
        .map((c) => ({
          author: fullName(c.user),
          at: dmyHms(c.createdAt),
          body: c.body,
        })),
      // Estimate assumes AI-assisted implementation (agent codes, human reviews); compare with
      // trackedHours to know how much budget is left.
      estimatedHours: task.estimatedHours === null ? null : Number(task.estimatedHours),
      trackedHours: HOURS(trackedSeconds),
      link: buildTaskLink(task),
    };
  }

  /**
   * Starts the acting user's timer on a task. One running timer per user: the service
   * auto-closes whatever else was running, and the result says so for transparency.
   */
  async startTracking(taskId: string, description: string | null, user: AuthUser) {
    const id = parseId(taskId, 'taskId');
    const task = await prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!task) throw notFound();

    const previous = await timeEntryService.findRunning(user.id);
    const entry = await timeEntryService.start(user.id, id, description);
    return {
      taskId: strId(id),
      title: task.title,
      startedAt: dmyHms(entry.startedAt),
      description: entry.description,
      previousTimerStopped:
        previous === null
          ? null
          : {
              taskId: strId(previous.taskId),
              title: previous.task.title,
              trackedHours: HOURS(elapsed(previous.startedAt)),
            },
    };
  }

  /**
   * Stops the acting user's running timer. With a taskId it must match that task; without one
   * it stops whatever is running. Not having a timer is a normal outcome, not an error.
   */
  async stopTracking(taskId: string | null, user: AuthUser) {
    const running = await timeEntryService.findRunning(user.id);
    if (!running) {
      return { stopped: false, message: 'No running timer for this user.' };
    }
    if (taskId != null && parseId(taskId, 'taskId') !== running.taskId) {
      return {
        stopped: false,
        message: `The running timer is on another task ("${running.task.title}", id ${strId(running.taskId)}). Call stop_tracking without taskId to stop it.`,
      };
    }
    const entry = await timeEntryService.stop(user.id, running.taskId);
    if (!entry) return { stopped: false, message: 'No running timer for this user.' };

    const total = await prisma.timeEntry.aggregate({
      _sum: { durationSeconds: true },
      where: { deletedAt: null, endedAt: { not: null }, taskId: running.taskId },
    });
    return {
      stopped: true,
      taskId: strId(running.taskId),
      title: running.task.title,
      startedAt: dmyHms(entry.startedAt),
      endedAt: dmyHms(entry.endedAt),
      sessionHours: HOURS(entry.durationSeconds ?? 0),
      taskTrackedHours: HOURS(total._sum.durationSeconds ?? 0),
    };
  }

  /** Moves a card to a column (by name or id) landing at the end; WIP limits still apply. */
  async moveTask(taskId: string, column: string) {
    const existing = await taskService.find(taskId);
    if (!existing) throw notFound();

    const isNumeric = /^\d+$/.test(column.trim());
    const target = isNumeric
      ? await prisma.boardColumn.findFirst({ where: { id: BigInt(column.trim()) } })
      : await prisma.boardColumn.findFirst({
          where: { name: { equals: column.trim(), mode: 'insensitive' }, board: { projectId: null } },
        });
    if (!target) {
      const columns = await prisma.boardColumn.findMany({
        where: { board: { projectId: null } },
        orderBy: { position: 'asc' },
      });
      throw unprocessable(
        `Unknown column "${column}". Available columns: ${columns.map((c) => c.name).join(', ')}.`,
      );
    }

    const position = await prisma.task.count({
      where: { columnId: target.id, deletedAt: null, id: { not: existing.id } },
    });
    const moved = await taskService.move(existing, strId(target.id), position);
    return {
      id: strId(moved.id),
      title: moved.title,
      column: target.name,
      columnIsTerminal: target.isTerminal,
      position: moved.position,
    };
  }

  /**
   * Ticks or unticks one checklist item of a task. Unknown item ids answer with the task's
   * current checklist so the agent can self-correct without a second get_task round-trip.
   */
  async setChecklistItem(taskId: string, itemId: string, done: boolean) {
    const tId = parseId(taskId, 'taskId');
    const iId = parseId(itemId, 'itemId');
    const task = await prisma.task.findFirst({ where: { id: tId, deletedAt: null } });
    if (!task) throw notFound();

    const item = await prisma.checklistItem.findFirst({
      where: { id: iId, taskId: tId, deletedAt: null },
    });
    if (!item) {
      const items = await prisma.checklistItem.findMany({
        where: { taskId: tId, deletedAt: null },
        orderBy: { position: 'asc' },
      });
      const listing =
        items.length === 0
          ? 'the task has no checklist items'
          : `items: ${items.map((c) => `${strId(c.id)}=${JSON.stringify(c.title)}`).join(', ')}`;
      throw unprocessable(`No checklist item "${itemId}" on task ${strId(tId)} (${listing}).`);
    }

    const updated = await checklistItemService.update(item, { done });
    const items = await prisma.checklistItem.findMany({
      where: { taskId: tId, deletedAt: null },
    });
    return {
      taskId: strId(tId),
      task: task.title,
      itemId: strId(updated.id),
      title: updated.title,
      done: updated.done,
      checklist: {
        done: items.filter((c) => c.done).length,
        total: items.length,
      },
    };
  }

  /** Adds a comment as the authenticated MCP user (assignees/creator get notified as usual). */
  async commentTask(taskId: string, body: string, user: AuthUser) {
    const id = parseId(taskId, 'taskId');
    const task = await prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!task) throw notFound();
    const created = await commentService.create({ taskId: strId(id), body }, user);
    return {
      id: strId(created.id),
      taskId: strId(id),
      author: fullName(created.user),
      at: dmyHms(created.createdAt),
      body: created.body,
    };
  }

  /** Project overview: proposals (budget), task stats by column/assignee, tracked vs estimate. */
  async getProjectSummary(projectId: string) {
    const id = parseId(projectId, 'projectId');
    const project = await prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: true,
        members: true,
        proposals: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!project) throw notFound();

    const tasks = await prisma.task.findMany({
      where: { projectId: id, deletedAt: null },
      include: { column: true, assignees: true },
    });
    const tracked = await prisma.timeEntry.aggregate({
      _sum: { durationSeconds: true },
      where: { deletedAt: null, endedAt: { not: null }, task: { projectId: id, deletedAt: null } },
    });

    const byColumn = new Map<string, number>();
    const byAssignee = new Map<string, number>();
    let openTasks = 0;
    let doneTasks = 0;
    for (const task of tasks) {
      byColumn.set(task.column.name, (byColumn.get(task.column.name) ?? 0) + 1);
      if (task.column.isTerminal) doneTasks += 1;
      else {
        openTasks += 1;
        for (const user of task.assignees) {
          if (user.deletedAt) continue;
          const name = fullName(user);
          byAssignee.set(name, (byAssignee.get(name) ?? 0) + 1);
        }
      }
    }

    return {
      id: strId(project.id),
      name: project.name,
      client: project.client && !project.client.deletedAt ? project.client.name : null,
      status: project.status,
      description: htmlToText(project.description),
      repositories: project.repositories,
      startDate: dmy(project.startDate),
      endDate: dmy(project.endDate),
      estimatedHours: project.estimatedHours === null ? null : Number(project.estimatedHours),
      trackedHours: HOURS(tracked._sum.durationSeconds ?? 0),
      members: project.members.filter((u) => !u.deletedAt).map((u) => ({
        id: strId(u.id),
        name: fullName(u),
        role: u.role,
      })),
      tasks: {
        open: openTasks,
        done: doneTasks,
        byColumn: Object.fromEntries(byColumn),
        openByAssignee: Object.fromEntries(byAssignee),
      },
      proposals: project.proposals.map((p) => ({
        id: strId(p.id),
        title: p.title,
        status: p.status,
        amount: p.amount === null ? null : Number(p.amount),
        currency: p.currency,
        sentAt: dmy(p.sentAt),
        validUntil: dmy(p.validUntil),
      })),
    };
  }

  /** Columns of the single global board, with live task counts (the whole workflow lives here). */
  async listColumns() {
    const columns = await prisma.boardColumn.findMany({
      where: { board: { projectId: null } },
      orderBy: { position: 'asc' },
    });
    const counts = columns.length
      ? await prisma.task.groupBy({
          by: ['columnId'],
          where: { deletedAt: null, columnId: { in: columns.map((c) => c.id) } },
          _count: { _all: true },
        })
      : [];
    const byColumn = new Map(counts.map((c) => [String(c.columnId), c._count._all]));
    return {
      columns: columns.map((c) => ({
        id: strId(c.id),
        name: c.name,
        position: c.position,
        isTerminal: c.isTerminal,
        wipLimit: c.wipLimit,
        taskCount: byColumn.get(String(c.id)) ?? 0,
      })),
    };
  }
}

export const mcpService = new McpService();

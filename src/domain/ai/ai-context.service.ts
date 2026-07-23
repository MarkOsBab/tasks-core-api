import { prisma } from '@/lib/prisma';
import { strId } from '@/resources/serialize';

/**
 * Compact workspace snapshot fed to the LLM so drafts land on real ids: board columns, labels,
 * users (with live workload), projects and a sample of recent tasks/proposals that teaches the
 * model the team's writing style, label usage, specialization per user and real effort (tracked
 * time) for estimates. Read-only direct-Prisma service (dashboard-style, no repository).
 */
export interface AiWorkspaceContext {
  columns: { id: string; name: string; isTerminal: boolean; position: number }[];
  labels: { id: string; name: string; taskCount: number }[];
  users: {
    id: string;
    name: string;
    role: string | null;
    memberProjects: { id: string; name: string }[];
    openTaskCount: number;
    history: {
      assignedTaskCount: number; // across the recent-task window (any column)
      topLabels: string[]; // labels this user actually worked with, most frequent first
      trackedHours: number; // hours they logged in that window
      recentProjects: string[]; // project names they touched
    };
  }[];
  projects: {
    id: string;
    name: string;
    clientName: string | null;
    status: string;
    repositories: string[];
    estimatedHours: number | null;
    // Per-project aggregates: real pace (tracked vs estimate), label taxonomy and who
    // actually contributed — grounds both estimates and per-project assignment.
    stats: {
      openTasks: number;
      doneTasks: number;
      trackedHours: number;
      topLabels: string[];
      contributors: string[];
    };
  }[];
  sampleTasks: {
    title: string;
    priority: string;
    column: string;
    project: string | null;
    labels: string[];
    assignees: string[];
    checklistSize: number;
    estimatedHours: number | null;
    trackedHours: number | null;
  }[];
  // Ground truth for calibrating estimatedHours: cards that carry BOTH an estimate and real
  // closed tracked time. Review-column cards count too — moving to done often lags the finish.
  estimation: {
    samples: {
      title: string;
      column: string;
      done: boolean;
      project: string | null;
      labels: string[];
      estimatedHours: number;
      trackedHours: number;
    }[];
    medianTrackedToEstimateRatio: number | null; // <1 = past estimates ran high by that factor
  };
  proposals: { title: string; status: string; project: string | null; summary: string | null }[];
}

const SAMPLE_TASKS = 40;
const SAMPLE_PROPOSALS = 12;
const ESTIMATION_SAMPLES = 30;
// Wider window than the prompt sample: per-user history (specialization, tracked hours) is
// aggregated in JS over these and only the aggregates reach the prompt.
const HISTORY_TASKS = 200;

function trackedHours(entries: { startedAt: Date; endedAt: Date | null }[]): number | null {
  let seconds = 0;
  for (const entry of entries) {
    if (entry.endedAt) {
      seconds += Math.max(0, (entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000);
    }
  }
  return seconds > 0 ? Math.round((seconds / 3600) * 10) / 10 : null;
}

interface UserHistoryBucket {
  assignedTaskCount: number;
  labelCounts: Map<string, number>;
  trackedSeconds: number;
  projects: Set<string>;
}

interface ProjectStatsBucket {
  openTasks: number;
  doneTasks: number;
  trackedSeconds: number;
  labelCounts: Map<string, number>;
  contributors: Set<string>;
}

class AiContextService {
  async build(): Promise<AiWorkspaceContext> {
    const [
      globalBoard,
      labels,
      users,
      projects,
      tasks,
      proposals,
      historyTasks,
      projectTasks,
      estimationTasks,
    ] = await Promise.all([
      // Single-board model: only the global board exists; its columns are the valid targets.
      prisma.board.findFirst({
        where: { projectId: null },
        include: { columns: { orderBy: { position: 'asc' } } },
      }),
      prisma.label.findMany({
        include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        include: {
          memberProjects: true,
          _count: {
            select: {
              // Live workload = assigned tasks not yet in a terminal (done) column.
              assignedTasks: { where: { deletedAt: null, column: { isTerminal: false } } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.project.findMany({
        where: { status: { in: ['draft', 'active'] } },
        include: { client: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
        take: SAMPLE_TASKS,
        include: {
          column: true,
          project: true,
          labels: true,
          assignees: true,
          timeEntries: { where: { deletedAt: null } },
          checklistItems: { where: { deletedAt: null } },
        },
      }),
      prisma.proposal.findMany({
        orderBy: { createdAt: 'desc' },
        take: SAMPLE_PROPOSALS,
        include: { project: true },
      }),
      prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
        take: HISTORY_TASKS,
        select: {
          assignees: { select: { id: true } },
          labels: { select: { name: true, deletedAt: true } },
          project: { select: { name: true, deletedAt: true } },
          timeEntries: {
            where: { deletedAt: null },
            select: { userId: true, startedAt: true, endedAt: true },
          },
        },
      }),
      // Every live task of the visible (draft/active) projects, minimal select: aggregated in
      // JS into per-project stats (pace, taxonomy, contributors) — only aggregates hit the prompt.
      prisma.task.findMany({
        where: { deletedAt: null, project: { status: { in: ['draft', 'active'] } } },
        select: {
          projectId: true,
          column: { select: { isTerminal: true } },
          labels: { select: { name: true, deletedAt: true } },
          assignees: { select: { name: true, lastName: true, deletedAt: true } },
          timeEntries: {
            where: { deletedAt: null },
            select: { startedAt: true, endedAt: true },
          },
        },
      }),
      // Estimation ground truth: cards with an estimate AND at least one closed time entry,
      // regardless of column (a review-column card is already implemented — waiting for the
      // move to done would starve the calibration of exactly the freshest signal).
      prisma.task.findMany({
        where: {
          deletedAt: null,
          estimatedHours: { not: null },
          timeEntries: { some: { deletedAt: null, endedAt: { not: null } } },
        },
        orderBy: { updatedAt: 'desc' },
        take: ESTIMATION_SAMPLES,
        select: {
          title: true,
          estimatedHours: true,
          column: { select: { name: true, isTerminal: true } },
          project: { select: { name: true, deletedAt: true } },
          labels: { select: { name: true, deletedAt: true } },
          timeEntries: {
            where: { deletedAt: null },
            select: { startedAt: true, endedAt: true },
          },
        },
      }),
    ]);

    // Per-user history over the recent-task window: who actually did what kind of work
    // (labels), where (projects) and how much (tracked hours). This is what grounds the
    // model's assignee choice — workload alone must never drive an assignment.
    const historyByUser = new Map<string, UserHistoryBucket>();
    const bucket = (userId: string): UserHistoryBucket => {
      const existing = historyByUser.get(userId);
      if (existing) return existing;
      const fresh: UserHistoryBucket = {
        assignedTaskCount: 0,
        labelCounts: new Map(),
        trackedSeconds: 0,
        projects: new Set(),
      };
      historyByUser.set(userId, fresh);
      return fresh;
    };
    for (const task of historyTasks) {
      const taskLabels = task.labels.filter((l) => !l.deletedAt).map((l) => l.name);
      const projectName = task.project && !task.project.deletedAt ? task.project.name : null;
      for (const assignee of task.assignees) {
        const b = bucket(strId(assignee.id));
        b.assignedTaskCount += 1;
        for (const label of taskLabels) {
          b.labelCounts.set(label, (b.labelCounts.get(label) ?? 0) + 1);
        }
        if (projectName) b.projects.add(projectName);
      }
      for (const entry of task.timeEntries) {
        if (!entry.endedAt) continue;
        bucket(strId(entry.userId)).trackedSeconds += Math.max(
          0,
          (entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000,
        );
      }
    }

    // Per-project aggregates over ALL live tasks of the visible projects.
    const statsByProject = new Map<string, ProjectStatsBucket>();
    const projectBucket = (projectId: string): ProjectStatsBucket => {
      const existing = statsByProject.get(projectId);
      if (existing) return existing;
      const fresh: ProjectStatsBucket = {
        openTasks: 0,
        doneTasks: 0,
        trackedSeconds: 0,
        labelCounts: new Map(),
        contributors: new Set(),
      };
      statsByProject.set(projectId, fresh);
      return fresh;
    };
    for (const task of projectTasks) {
      if (task.projectId == null) continue;
      const b = projectBucket(strId(task.projectId));
      if (task.column.isTerminal) b.doneTasks += 1;
      else b.openTasks += 1;
      for (const label of task.labels) {
        if (label.deletedAt) continue;
        b.labelCounts.set(label.name, (b.labelCounts.get(label.name) ?? 0) + 1);
      }
      for (const user of task.assignees) {
        if (user.deletedAt) continue;
        b.contributors.add(`${user.name} ${user.lastName ?? ''}`.trim());
      }
      for (const entry of task.timeEntries) {
        if (!entry.endedAt) continue;
        b.trackedSeconds += Math.max(
          0,
          (entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000,
        );
      }
    }

    // Per-card tracked/estimated ratios; the median (robust to outliers) tells the model how
    // far off past estimates ran so new ones can be scaled to the real pace.
    const estimationSamples = estimationTasks
      .map((task) => ({
        title: task.title,
        column: task.column.name,
        done: task.column.isTerminal,
        project: task.project && !task.project.deletedAt ? task.project.name : null,
        labels: task.labels.filter((l) => !l.deletedAt).map((l) => l.name),
        estimatedHours: Number(task.estimatedHours),
        trackedHours: trackedHours(task.timeEntries) ?? 0,
      }))
      .filter((sample) => sample.estimatedHours > 0 && sample.trackedHours > 0);
    const ratios = estimationSamples
      .map((sample) => sample.trackedHours / sample.estimatedHours)
      .sort((a, b) => a - b);
    const medianRatio =
      ratios.length === 0
        ? null
        : Math.round(
            (ratios.length % 2 === 1
              ? ratios[(ratios.length - 1) / 2]
              : (ratios[ratios.length / 2 - 1] + ratios[ratios.length / 2]) / 2) * 100,
          ) / 100;

    return {
      columns: (globalBoard?.columns ?? []).map((column) => ({
        id: strId(column.id),
        name: column.name,
        isTerminal: column.isTerminal,
        position: column.position,
      })),
      labels: labels.map((label) => ({
        id: strId(label.id),
        name: label.name,
        taskCount: label._count.tasks,
      })),
      users: users.map((user) => {
        const history = historyByUser.get(strId(user.id));
        return {
          id: strId(user.id),
          name: `${user.name} ${user.lastName ?? ''}`.trim(),
          role: user.role,
          // R4: nested include bypasses the soft-delete extension — guard trashed projects by hand.
          memberProjects: user.memberProjects
            .filter((project) => !project.deletedAt)
            .map((project) => ({ id: strId(project.id), name: project.name })),
          openTaskCount: user._count.assignedTasks,
          history: {
            assignedTaskCount: history?.assignedTaskCount ?? 0,
            topLabels: history
              ? [...history.labelCounts.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([name]) => name)
              : [],
            trackedHours: history
              ? Math.round((history.trackedSeconds / 3600) * 10) / 10
              : 0,
            recentProjects: history ? [...history.projects].slice(0, 5) : [],
          },
        };
      }),
      projects: projects.map((project) => {
        const stats = statsByProject.get(strId(project.id));
        return {
          id: strId(project.id),
          name: project.name,
          // R4: nested include bypasses the soft-delete extension — guard trashed clients by hand.
          clientName: project.client && !project.client.deletedAt ? project.client.name : null,
          status: project.status,
          repositories: project.repositories,
          estimatedHours: project.estimatedHours === null ? null : Number(project.estimatedHours),
          stats: {
            openTasks: stats?.openTasks ?? 0,
            doneTasks: stats?.doneTasks ?? 0,
            trackedHours: stats ? Math.round((stats.trackedSeconds / 3600) * 10) / 10 : 0,
            topLabels: stats
              ? [...stats.labelCounts.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([name]) => name)
              : [],
            contributors: stats ? [...stats.contributors].slice(0, 8) : [],
          },
        };
      }),
      sampleTasks: tasks.map((task) => ({
        title: task.title,
        priority: task.priority,
        column: task.column.name,
        project: task.project && !task.project.deletedAt ? task.project.name : null,
        labels: task.labels.filter((l) => !l.deletedAt).map((l) => l.name),
        assignees: task.assignees
          .filter((u) => !u.deletedAt)
          .map((u) => `${u.name} ${u.lastName ?? ''}`.trim()),
        checklistSize: task.checklistItems.length,
        estimatedHours: task.estimatedHours === null ? null : Number(task.estimatedHours),
        trackedHours: trackedHours(task.timeEntries),
      })),
      estimation: {
        samples: estimationSamples,
        medianTrackedToEstimateRatio: medianRatio,
      },
      proposals: proposals.map((proposal) => ({
        title: proposal.title,
        status: proposal.status,
        project:
          proposal.project && !proposal.project.deletedAt ? proposal.project.name : null,
        summary: proposal.description ? proposal.description.slice(0, 300) : null,
      })),
    };
  }
}

export const aiContextService = new AiContextService();

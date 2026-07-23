import { prisma } from '@/lib/prisma';
import { dmyHms, strId } from '@/resources/serialize';

// What did the AI actually do? Aggregates the viaAgent trail (timers started by MCP
// start_tracking, comments signed "Tasks IA", cards created by create_task, recorded learnings)
// against human activity over a date range. Plain math over the DB, no LLM.

const RECENT_PER_TYPE = 10;
const RECENT_LIMIT = 20;

const HOURS = (seconds: number) => Math.round((seconds / 3600) * 100) / 100;

export interface AiActivityItem {
  type: 'tracking' | 'comment' | 'card' | 'learning';
  at: string | null; // d/m/Y H:i:s
  taskId: string | null;
  taskTitle: string | null;
  detail: string | null; // hours for tracking, excerpt for comments/learnings, title for cards
}

class AiActivityService {
  async build(from: Date, to: Date) {
    const range = { gte: from, lte: to };
    const closedEntry = { deletedAt: null, endedAt: { not: null }, startedAt: range } as const;

    const [aiTracked, humanTracked, aiSessions, aiComments, aiCards, aiLearnings] =
      await Promise.all([
        prisma.timeEntry.aggregate({
          _sum: { durationSeconds: true },
          where: { ...closedEntry, viaAgent: true },
        }),
        prisma.timeEntry.aggregate({
          _sum: { durationSeconds: true },
          where: { ...closedEntry, viaAgent: false },
        }),
        prisma.timeEntry.count({ where: { ...closedEntry, viaAgent: true } }),
        prisma.comment.count({ where: { deletedAt: null, viaAgent: true, createdAt: range } }),
        prisma.task.count({ where: { deletedAt: null, viaAgent: true, createdAt: range } }),
        prisma.projectLearning.count({
          where: { deletedAt: null, viaAgent: true, createdAt: range },
        }),
      ]);

    const [recentEntries, recentComments, recentCards, recentLearnings] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { deletedAt: null, endedAt: { not: null }, viaAgent: true, startedAt: range },
        orderBy: { startedAt: 'desc' },
        take: RECENT_PER_TYPE,
        include: { task: true },
      }),
      prisma.comment.findMany({
        where: { deletedAt: null, viaAgent: true, createdAt: range },
        orderBy: { createdAt: 'desc' },
        take: RECENT_PER_TYPE,
        include: { task: true },
      }),
      prisma.task.findMany({
        where: { deletedAt: null, viaAgent: true, createdAt: range },
        orderBy: { createdAt: 'desc' },
        take: RECENT_PER_TYPE,
      }),
      prisma.projectLearning.findMany({
        where: { deletedAt: null, viaAgent: true, createdAt: range },
        orderBy: { createdAt: 'desc' },
        take: RECENT_PER_TYPE,
        include: { project: true },
      }),
    ]);

    const excerpt = (text: string) => (text.length > 140 ? `${text.slice(0, 137)}...` : text);
    const stamp = (value: Date | null | undefined) => value?.getTime() ?? 0;
    const recent: (AiActivityItem & { sortKey: number })[] = [
      ...recentEntries.map((entry) => ({
        type: 'tracking' as const,
        at: dmyHms(entry.startedAt),
        taskId: strId(entry.taskId),
        taskTitle: entry.task.title,
        detail: `${HOURS(entry.durationSeconds ?? 0)}h`,
        sortKey: stamp(entry.startedAt),
      })),
      ...recentComments.map((comment) => ({
        type: 'comment' as const,
        at: dmyHms(comment.createdAt),
        taskId: strId(comment.taskId),
        taskTitle: comment.task.title,
        detail: excerpt(comment.body),
        sortKey: stamp(comment.createdAt),
      })),
      ...recentCards.map((task) => ({
        type: 'card' as const,
        at: dmyHms(task.createdAt),
        taskId: strId(task.id),
        taskTitle: task.title,
        detail: null,
        sortKey: stamp(task.createdAt),
      })),
      ...recentLearnings.map((learning) => ({
        type: 'learning' as const,
        at: dmyHms(learning.createdAt),
        taskId: learning.taskId != null ? strId(learning.taskId) : null,
        taskTitle: learning.project.name,
        detail: excerpt(learning.body),
        sortKey: stamp(learning.createdAt),
      })),
    ];
    recent.sort((a, b) => b.sortKey - a.sortKey);

    const aiHours = HOURS(aiTracked._sum.durationSeconds ?? 0);
    const humanHours = HOURS(humanTracked._sum.durationSeconds ?? 0);
    return {
      hours: {
        ai: aiHours,
        human: humanHours,
        total: Math.round((aiHours + humanHours) * 100) / 100,
      },
      counts: {
        trackingSessions: aiSessions,
        comments: aiComments,
        cardsCreated: aiCards,
        learnings: aiLearnings,
      },
      recent: recent.slice(0, RECENT_LIMIT).map(({ sortKey: _sortKey, ...item }) => item),
    };
  }
}

export const aiActivityService = new AiActivityService();

import { prisma } from '@/lib/prisma';

export interface DashboardStats {
  totalClients: number;
  activeProjects: number;
  pendingProposals: number;
  openTasks: number;
  tasksByStatus: {
    todo: number;
    inProgress: number;
    review: number;
    done: number;
  };
}

// Counts hit prisma directly (no repository); soft-deleted rows are already
// filtered out by the prisma soft-delete extension.
class DashboardService {
  async stats(): Promise<DashboardStats> {
    const [totalClients, activeProjects, pendingProposals, openTasks, taskGroups] =
      await Promise.all([
        prisma.client.count(),
        prisma.project.count({ where: { status: 'active' } }),
        prisma.proposal.count({ where: { status: 'sent' } }),
        prisma.task.count({ where: { status: { not: 'done' } } }),
        prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);

    const byStatus = new Map(taskGroups.map((group) => [group.status, group._count._all]));

    return {
      totalClients,
      activeProjects,
      pendingProposals,
      openTasks,
      tasksByStatus: {
        todo: byStatus.get('todo') ?? 0,
        inProgress: byStatus.get('in_progress') ?? 0,
        review: byStatus.get('review') ?? 0,
        done: byStatus.get('done') ?? 0,
      },
    };
  }
}

export const dashboardService = new DashboardService();

import { prisma } from '@/lib/prisma';

export interface DashboardStats {
  totalClients: number;
  activeProjects: number;
  pendingProposals: number;
  openTasks: number;
  tasksByColumn: { label: string; count: number }[];
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
        // "open" = not in a terminal (done) column, whatever it is named per board.
        prisma.task.count({ where: { column: { isTerminal: false } } }),
        prisma.task.groupBy({ by: ['columnId'], _count: { _all: true } }),
      ]);

    // Resolve column names and aggregate by name (default columns share names across boards).
    const columnIds = taskGroups.map((group) => group.columnId);
    const columns = columnIds.length
      ? await prisma.boardColumn.findMany({
          where: { id: { in: columnIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(columns.map((column) => [column.id, column.name]));

    const countsByName = new Map<string, number>();
    for (const group of taskGroups) {
      const label = nameById.get(group.columnId) ?? '—';
      countsByName.set(label, (countsByName.get(label) ?? 0) + group._count._all);
    }
    const tasksByColumn = [...countsByName.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    return { totalClients, activeProjects, pendingProposals, openTasks, tasksByColumn };
  }
}

export const dashboardService = new DashboardService();

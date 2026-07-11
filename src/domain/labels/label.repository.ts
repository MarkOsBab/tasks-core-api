import type { Prisma, Label } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BaseRepository, type ModelDelegate } from '../base/base.repository';

export class LabelRepository extends BaseRepository<Label> {
  constructor() {
    super(prisma.label as unknown as ModelDelegate<Label>, {
      searchable: ['name'],
      sortable: ['id', 'name', 'createdAt'],
    });
  }

  /** Colors already taken (soft-deleted rows included on purpose: their color may come back). */
  async usedColors(): Promise<Array<string | null>> {
    const rows = await prisma.$queryRaw<Array<{ color: string | null }>>`
      SELECT DISTINCT color FROM labels WHERE color IS NOT NULL`;
    return rows.map((row) => row.color);
  }

  /** Flat options for /labels/select: ?q on name (insensitive), ordered by name, top 50. */
  selectOptions(q: string | null): Promise<Label[]> {
    const where: Prisma.LabelWhereInput = q ? { name: { contains: q, mode: 'insensitive' } } : {};
    return prisma.label.findMany({ where, orderBy: { name: 'asc' }, take: 50 });
  }
}

export const labelRepository = new LabelRepository();

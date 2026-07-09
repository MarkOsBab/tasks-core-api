import { Prisma, type Client } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BaseRepository, type ModelDelegate } from '../base/base.repository';

function applyClientFilters(filters: Record<string, string>): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  return where;
}

export class ClientRepository extends BaseRepository<Client> {
  constructor() {
    super(prisma.client as unknown as ModelDelegate<Client>, {
      searchable: ['name', 'company', 'email'],
      sortable: ['id', 'name', 'company', 'status', 'createdAt'],
      applyFilters: applyClientFilters,
    });
  }

  /** Colors already taken (soft-deleted rows included on purpose: their color may come back). */
  async usedColors(): Promise<Array<string | null>> {
    const rows = await prisma.$queryRaw<Array<{ color: string | null }>>`
      SELECT DISTINCT color FROM clients WHERE color IS NOT NULL`;
    return rows.map((row) => row.color);
  }

  /** Active only, ?q on name/company (insensitive), ordered by name, top 50. */
  selectOptions(q: string | null): Promise<Client[]> {
    const where: Prisma.ClientWhereInput = q
      ? {
          status: 'active',
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { company: { contains: q, mode: 'insensitive' } },
          ],
        }
      : { status: 'active' };
    return prisma.client.findMany({ where, orderBy: { name: 'asc' }, take: 50 });
  }
}

export const clientRepository = new ClientRepository();

import { Prisma, PrismaClient } from '@prisma/client';

const SOFT_DELETE_MODELS = new Set(['Client', 'Project', 'Proposal', 'Task', 'TimeEntry', 'Comment', 'Label', 'ChecklistItem']);
const READ_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (SOFT_DELETE_MODELS.has(model) && READ_OPERATIONS.has(operation)) {
          const current = (args ?? {}) as { where?: Record<string, unknown> };
          const next = { ...current, where: { ...(current.where ?? {}), deletedAt: null } };
          return query(next);
        }
        return query(args);
      },
    },
  },
});

function makeClient() {
  return new PrismaClient({ log: ['warn', 'error'] }).$extends(softDeleteExtension);
}

type ExtendedClient = ReturnType<typeof makeClient>;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedClient };

export const prisma: ExtendedClient = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Raw existence check that BYPASSES the soft-delete extension (Laravel-style unique/exists,
// which sees soft-deleted rows too). table/column MUST be compile-time constants: they are
// interpolated with Prisma.raw (Postgres lowercase identifiers, no quoting needed).
export async function rawExists(
  table: string,
  column: string,
  value: string,
  exceptId?: bigint,
): Promise<boolean> {
  const except = exceptId != null ? Prisma.sql`AND id <> ${exceptId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<Array<{ c: bigint }>>(
    Prisma.sql`SELECT COUNT(*) AS c FROM ${Prisma.raw(table)} WHERE ${Prisma.raw(column)} = ${value} ${except}`,
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

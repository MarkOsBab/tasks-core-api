import { describe, expect, it, vi } from 'vitest';
import { BaseRepository, type ModelDelegate } from '@/domain/base/base.repository';

type Row = { id: bigint };

function makeRepository(config = {}) {
  const delegate = {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
  return {
    delegate,
    repository: new BaseRepository<Row>(delegate as unknown as ModelDelegate<Row>, {
      searchable: ['name', 'email'],
      sortable: ['id', 'createdAt'],
      ...config,
    }),
  };
}

describe('paginate', () => {
  it('translates page/size into skip/take and counts with the same where', async () => {
    const { repository, delegate } = makeRepository();
    await repository.paginate({}, 3, 25);
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 25, orderBy: { id: 'desc' } }),
    );
    expect(delegate.count).toHaveBeenCalledWith({ where: {} });
  });

  it('builds an insensitive OR search over the searchable columns', async () => {
    const { repository, delegate } = makeRepository();
    await repository.paginate({ search: 'foo' }, 1, 10);
    expect(delegate.findMany.mock.calls[0][0].where).toEqual({
      AND: [
        {
          OR: [
            { name: { contains: 'foo', mode: 'insensitive' } },
            { email: { contains: 'foo', mode: 'insensitive' } },
          ],
        },
      ],
    });
  });

  it('combines applyFilters output with the search', async () => {
    const { repository, delegate } = makeRepository({
      applyFilters: (filters: Record<string, string>) =>
        filters.status ? { status: filters.status } : {},
    });
    await repository.paginate({ status: 'active', search: 'foo' }, 1, 10);
    const where = delegate.findMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0]).toEqual({ status: 'active' });
  });

  it('matches sort[field] against the whitelist via snake_case', async () => {
    const { repository, delegate } = makeRepository();
    await repository.paginate({ 'sort[created_at]': 'DESC' }, 1, 10);
    expect(delegate.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
  });

  it('supports the flat sort/order params', async () => {
    const { repository, delegate } = makeRepository();
    await repository.paginate({ sort: 'createdAt', order: 'desc' }, 1, 10);
    expect(delegate.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
  });
});

describe('find / create / update / softDelete', () => {
  it('find returns null on a non-numeric id without hitting the delegate', async () => {
    const { repository, delegate } = makeRepository();
    await expect(repository.find('not-a-number')).resolves.toBeNull();
    expect(delegate.findFirst).not.toHaveBeenCalled();
  });

  it('find queries by BigInt id with the configured include', async () => {
    const { repository, delegate } = makeRepository({ include: { rel: true } });
    await repository.find('7');
    expect(delegate.findFirst).toHaveBeenCalledWith({
      where: { id: 7n },
      include: { rel: true },
    });
  });

  it('softDelete stamps deletedAt instead of deleting', async () => {
    const { repository, delegate } = makeRepository();
    await expect(repository.softDelete(7n)).resolves.toBe(true);
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: 7n },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

import { snake } from '@/lib/str';

export interface ModelDelegate<T> {
  findMany(args?: unknown): Promise<T[]>;
  count(args?: unknown): Promise<number>;
  findFirst(args?: unknown): Promise<T | null>;
  create(args: unknown): Promise<T>;
  update(args: unknown): Promise<T>;
}

export type SortDirection = 'asc' | 'desc';
// Array form lets repositories override the fallback with a multi-key order.
export type OrderBy = Record<string, SortDirection> | Record<string, SortDirection>[];

export interface RepositoryConfig {
  searchable?: string[]; // Prisma fields for ?search= (OR contains, insensitive)
  sortable?: string[]; // whitelist for sort[field]=asc|desc, matched via snake()
  include?: Record<string, unknown>; // Prisma eager-load
  applyFilters?: (filters: Record<string, string>) => Record<string, unknown>;
}

export interface PaginateResult<T> {
  items: T[];
  total: number;
}

const BRACKET_SORT_PATTERN = /^sort\[(.+)\]$/;

export class BaseRepository<T extends { id: bigint }> {
  constructor(
    protected readonly delegate: ModelDelegate<T>,
    protected readonly config: RepositoryConfig = {},
  ) {}

  protected buildWhere(filters: Record<string, string>): Record<string, unknown> {
    const and: Record<string, unknown>[] = [];
    const filterWhere = this.config.applyFilters?.(filters);
    if (filterWhere && Object.keys(filterWhere).length > 0) and.push(filterWhere);
    const search = this.buildSearch(filters);
    if (search) and.push(search);
    return and.length > 0 ? { AND: and } : {};
  }

  protected buildSearch(filters: Record<string, string>): Record<string, unknown> | null {
    const term = filters.search;
    const columns = this.config.searchable ?? [];
    if (!term || columns.length === 0) return null;
    return {
      OR: columns.map((column) => ({ [column]: { contains: term, mode: 'insensitive' } })),
    };
  }

  protected buildOrderBy(filters: Record<string, string>): OrderBy {
    // core-generic-table sends sort[field]=asc|desc; only whitelisted fields apply.
    for (const [key, value] of Object.entries(filters)) {
      const match = BRACKET_SORT_PATTERN.exec(key);
      if (!match) continue;
      const field = this.matchSortable(match[1]);
      if (!field) continue;
      return { [field]: value.toLowerCase() === 'desc' ? 'desc' : 'asc' };
    }
    const sortInput = filters.sort ?? filters.sortBy;
    const order: SortDirection =
      String(filters.order ?? filters.sortDir ?? 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    if (sortInput) {
      const field = this.matchSortable(sortInput);
      if (field) return { [field]: order };
    }
    return this.defaultOrderBy(filters);
  }

  /** Fallback order; repositories may override (e.g. tasks by position within a project). */
  protected defaultOrderBy(_filters: Record<string, string>): OrderBy {
    return { id: 'desc' };
  }

  protected matchSortable(input: string): string | undefined {
    const wanted = snake(input);
    return (this.config.sortable ?? []).find((candidate) => snake(candidate) === wanted);
  }

  async paginate(
    filters: Record<string, string>,
    page: number,
    size: number,
  ): Promise<PaginateResult<T>> {
    const where = this.buildWhere(filters);
    const orderBy = this.buildOrderBy(filters);
    const [items, total] = await Promise.all([
      this.delegate.findMany({
        where,
        orderBy,
        include: this.config.include,
        skip: (page - 1) * size,
        take: size,
      }),
      this.delegate.count({ where }),
    ]);
    return { items, total };
  }

  async find(id: string): Promise<T | null> {
    let bigId: bigint;
    try {
      bigId = BigInt(id);
    } catch {
      return null; // non-numeric id -> 404
    }
    return this.delegate.findFirst({ where: { id: bigId }, include: this.config.include });
  }

  create(data: Record<string, unknown>): Promise<T> {
    return this.delegate.create({ data, include: this.config.include });
  }

  update(id: bigint, data: Record<string, unknown>): Promise<T> {
    return this.delegate.update({ where: { id }, data, include: this.config.include });
  }

  async softDelete(id: bigint): Promise<boolean> {
    await this.delegate.update({ where: { id }, data: { deletedAt: new Date() } });
    return true;
  }
}

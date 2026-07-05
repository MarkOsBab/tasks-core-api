export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface ListQuery {
  page: number;
  size: number;
  filters: Record<string, string>; // every flat query param; repositories pick search/sort + own filters
}

function toInt(value: string | undefined, fallback: string): number {
  const parsed = parseInt(value ?? fallback, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function parseListQuery(url: URL): ListQuery {
  const filters = Object.fromEntries(url.searchParams.entries());
  const page = Math.max(1, toInt(filters.page, '1'));
  const size = Math.max(1, Math.min(toInt(filters.size, String(DEFAULT_PAGE_SIZE)), MAX_PAGE_SIZE));
  return { page, size, filters };
}

// Exact envelope consumed by core-generic-table. page_count = max(1, ceil(total/size)).
export function paginated<T>(items: T[], total: number, page: number, size: number): Response {
  return Response.json({
    data: items,
    total_items: total,
    page,
    size,
    page_count: Math.max(1, Math.ceil(total / size)),
  });
}

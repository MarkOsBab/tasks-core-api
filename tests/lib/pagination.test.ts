import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, paginated, parseListQuery } from '@/lib/pagination';

describe('parseListQuery', () => {
  it('defaults to page 1 and size 25', () => {
    const query = parseListQuery(new URL('http://localhost/api/tasks'));
    expect(query.page).toBe(1);
    expect(query.size).toBe(DEFAULT_PAGE_SIZE);
    expect(query.filters).toEqual({});
  });

  it('clamps size to the maximum and page to a minimum of 1', () => {
    const query = parseListQuery(new URL('http://localhost/api/tasks?page=-3&size=5000'));
    expect(query.page).toBe(1);
    expect(query.size).toBe(MAX_PAGE_SIZE);
  });

  it('falls back to safe values on non-numeric input', () => {
    const query = parseListQuery(new URL('http://localhost/api/tasks?page=abc&size=abc'));
    expect(query.page).toBe(1);
    expect(query.size).toBe(1);
  });

  it('exposes every flat query param as a filter', () => {
    const query = parseListQuery(
      new URL('http://localhost/api/tasks?projectId=8&search=foo&sort[title]=asc'),
    );
    expect(query.filters['projectId']).toBe('8');
    expect(query.filters['search']).toBe('foo');
    expect(query.filters['sort[title]']).toBe('asc');
  });
});

describe('paginated', () => {
  it('returns the exact envelope consumed by core-generic-table', async () => {
    const response = paginated([{ id: '1' }, { id: '2' }], 205, 1, 25);
    await expect(response.json()).resolves.toEqual({
      data: [{ id: '1' }, { id: '2' }],
      total_items: 205,
      page: 1,
      size: 25,
      page_count: 9,
    });
  });

  it('never reports less than one page', async () => {
    const response = paginated([], 0, 1, 25);
    const body = await response.json();
    expect(body.page_count).toBe(1);
  });
});

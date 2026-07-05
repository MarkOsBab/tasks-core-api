import type { BaseRepository } from './base.repository';

export abstract class BaseService<T extends { id: bigint }> {
  protected constructor(protected readonly repository: BaseRepository<T>) {}

  list(filters: Record<string, string>, page: number, size: number) {
    return this.repository.paginate(filters, page, size);
  }

  find(id: string): Promise<T | null> {
    return this.repository.find(id);
  }

  async create(data: Record<string, unknown>): Promise<T> {
    return this.repository.create(await this.prepare(data, null));
  }

  async update(existing: T, data: Record<string, unknown>): Promise<T> {
    return this.repository.update(existing.id, await this.prepare(data, existing));
  }

  delete(existing: T): Promise<boolean> {
    return this.repository.softDelete(existing.id);
  }

  /** Per-resource input mapping hook (default: identity). */
  protected prepare(
    data: Record<string, unknown>,
    _existing: T | null,
  ): Promise<Record<string, unknown>> | Record<string, unknown> {
    return data;
  }
}

import type { AuthUser } from '@/lib/auth/context';
import type { BaseRepository } from './base.repository';

export abstract class BaseService<T extends { id: bigint }> {
  protected constructor(protected readonly repository: BaseRepository<T>) {}

  list(filters: Record<string, string>, page: number, size: number) {
    return this.repository.paginate(filters, page, size);
  }

  find(id: string): Promise<T | null> {
    return this.repository.find(id);
  }

  async create(data: Record<string, unknown>, user?: AuthUser): Promise<T> {
    return this.repository.create(await this.prepare(data, null, user));
  }

  async update(existing: T, data: Record<string, unknown>, user?: AuthUser): Promise<T> {
    return this.repository.update(existing.id, await this.prepare(data, existing, user));
  }

  delete(existing: T): Promise<boolean> {
    return this.repository.softDelete(existing.id);
  }

  /** Per-resource input mapping hook (default: identity). `user` is the authed caller. */
  protected prepare(
    data: Record<string, unknown>,
    _existing: T | null,
    _user?: AuthUser,
  ): Promise<Record<string, unknown>> | Record<string, unknown> {
    return data;
  }
}

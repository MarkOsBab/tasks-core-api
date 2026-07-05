import type { NextRequest } from 'next/server';
import { notFound } from '@/lib/http-error';
import { paginated, parseListQuery } from '@/lib/pagination';
import { withAuth, withRoute, type RouteHandler } from '@/lib/route';
import type { BaseService } from './base.service';

type ResourceFn<T> = (model: T) => unknown;
type AsyncSchema = { parseAsync(data: unknown): Promise<Record<string, unknown>> };

async function readBody(req: NextRequest): Promise<unknown> {
  return req.json().catch(() => ({})); // invalid body => {} => Zod 422, never a 500
}

export function listHandler<T extends { id: bigint }>(
  service: BaseService<T>,
  resource: ResourceFn<T>,
): RouteHandler {
  return withRoute(
    withAuth(async (req) => {
      const { page, size, filters } = parseListQuery(new URL(req.url));
      const { items, total } = await service.list(filters, page, size);
      return paginated(items.map(resource), total, page, size);
    }),
  );
}

export function createHandler<T extends { id: bigint }>(
  service: BaseService<T>,
  resource: ResourceFn<T>,
  schema: AsyncSchema,
): RouteHandler {
  return withRoute(
    withAuth(async (req) => {
      const data = await schema.parseAsync(await readBody(req));
      const created = await service.create(data);
      return Response.json(resource(created), { status: 201 });
    }),
  );
}

export function showHandler<T extends { id: bigint }>(
  service: BaseService<T>,
  resource: ResourceFn<T>,
): RouteHandler {
  return withRoute(
    withAuth(async (_req, ctx) => {
      const { id } = await ctx.params;
      const model = await service.find(id);
      if (!model) throw notFound();
      return Response.json(resource(model));
    }),
  );
}

// Validates BEFORE the 404 lookup (Laravel FormRequest order). The schema is built with the
// route id so unique checks ignore the current row.
export function updateHandler<T extends { id: bigint }>(
  service: BaseService<T>,
  resource: ResourceFn<T>,
  schemaFor: (id: string) => AsyncSchema,
): RouteHandler {
  return withRoute(
    withAuth(async (req, ctx) => {
      const { id } = await ctx.params;
      const data = await schemaFor(id).parseAsync(await readBody(req));
      const existing = await service.find(id);
      if (!existing) throw notFound();
      const updated = await service.update(existing, data);
      return Response.json(resource(updated));
    }),
  );
}

export function destroyHandler<T extends { id: bigint }>(service: BaseService<T>): RouteHandler {
  return withRoute(
    withAuth(async (_req, ctx) => {
      const { id } = await ctx.params;
      const existing = await service.find(id);
      if (!existing) throw notFound();
      await service.delete(existing);
      return new Response(null, { status: 204 });
    }),
  );
}

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from './http-error';
import { zodToHttpError } from './zod-error';
import { getAuthUser, type AuthUser } from './auth/context';

// Next 15 passes route params as a Promise; static routes receive an empty object.
export type RouteContext = { params: Promise<Record<string, string>> };

export type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<Response>;
export type AuthedRouteHandler = (
  req: NextRequest,
  ctx: RouteContext,
  user: AuthUser,
) => Promise<Response>;

export function withRoute(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        const httpError = zodToHttpError(err);
        return Response.json(httpError.body, { status: httpError.status });
      }
      if (err instanceof HttpError) {
        return Response.json(err.body, { status: err.status });
      }
      console.error('[api] unhandled error:', err);
      return Response.json({ message: 'Server Error.' }, { status: 500 });
    }
  };
}

export function withAuth(handler: AuthedRouteHandler): RouteHandler {
  return async (req, ctx) => {
    const user = await getAuthUser(req);
    return handler(req, ctx, user);
  };
}

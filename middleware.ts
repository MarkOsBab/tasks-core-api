import { NextResponse, type NextRequest } from 'next/server';

/**
 * CORS for /api/*: origins from CORS_ALLOWED_ORIGINS (comma-separated) plus the localhost
 * pattern; all methods; reflected request headers; no credentials (the core-tasks-ui
 * authenticates with a Bearer token, not cookies).
 */
const LOCALHOST_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  const allowList = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (allowList.includes(origin) || LOCALHOST_PATTERN.test(origin)) {
    return origin;
  }
  return null;
}

function applyCorsHeaders(req: NextRequest, headers: Headers): void {
  const origin = resolveAllowedOrigin(req.headers.get('origin'));
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    req.headers.get('access-control-request-headers') || 'Authorization, Content-Type, Accept',
  );
  headers.set('Access-Control-Max-Age', '0');
}

export function middleware(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    const headers = new Headers();
    applyCorsHeaders(req, headers);
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  applyCorsHeaders(req, response.headers);
  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};

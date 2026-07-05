import { unauthorized } from '../http-error';
import { verifyToken } from './jwt';

// Identity carried by every authenticated request. Only the user id travels in the JWT, so the
// hot path stays DB-free: handlers that need full user fields (e.g. /me) load them explicitly.
export type AuthUser = { id: bigint };

export async function getAuthUser(req: Request): Promise<AuthUser> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) throw unauthorized();
  const token = header.slice(7).trim();
  if (!token) throw unauthorized();
  let sub: string;
  try {
    ({ sub } = await verifyToken(token));
  } catch {
    throw unauthorized();
  }
  try {
    return { id: BigInt(sub) };
  } catch {
    throw unauthorized();
  }
}

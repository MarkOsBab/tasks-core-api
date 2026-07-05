import { compactVerify, SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { env, intEnv } from '../env';

const secretKey = () => new TextEncoder().encode(env('JWT_SECRET'));
const ttlSeconds = () => intEnv('JWT_TTL', 60) * 60;
const refreshTtlSeconds = () => intEnv('JWT_REFRESH_TTL', 20160) * 60;
const issuer = () => env('APP_URL', 'core-tasks');

export interface IssuedToken {
  token: string;
  expiresIn: number; // seconds until expiration
}

// originalIat keeps the refresh window anchored to the first login (non-sliding).
export async function signToken(
  userId: string | bigint | number,
  originalIat?: number,
): Promise<IssuedToken> {
  const now = Math.floor(Date.now() / 1000);
  const iat = originalIat ?? now;
  const expiresIn = ttlSeconds();
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(String(userId))
    .setIssuer(issuer())
    .setIssuedAt(iat)
    .setNotBefore(iat)
    .setExpirationTime(now + expiresIn)
    .setJti(randomUUID())
    .sign(secretKey());
  return { token, expiresIn };
}

export async function verifyToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
  if (!payload.sub) throw new Error('Token missing subject');
  return { sub: String(payload.sub) };
}

// Refresh: verifies the signature WITHOUT enforcing exp (compactVerify), checks
// now <= iat + refresh_ttl and re-signs preserving the original iat.
export async function refreshToken(token: string): Promise<IssuedToken> {
  let claims: { sub?: unknown; iat?: unknown };
  let alg: string | undefined;
  try {
    const result = await compactVerify(token, secretKey());
    alg = result.protectedHeader.alg;
    claims = JSON.parse(new TextDecoder().decode(result.payload));
  } catch {
    throw new Error('Invalid token signature');
  }
  if (alg !== 'HS256') throw new Error('Unexpected token algorithm');
  const sub = claims.sub;
  const iat = claims.iat;
  if (typeof sub !== 'string' && typeof sub !== 'number') throw new Error('Token missing subject');
  if (typeof iat !== 'number') throw new Error('Token missing iat');
  const now = Math.floor(Date.now() / 1000);
  if (now > iat + refreshTtlSeconds()) throw new Error('Refresh window expired');
  return signToken(String(sub), iat);
}

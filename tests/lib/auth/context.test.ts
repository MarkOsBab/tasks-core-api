import { describe, expect, it } from 'vitest';
import { getAuthUser } from '@/lib/auth/context';
import { signToken } from '@/lib/auth/jwt';
import { HttpError } from '@/lib/http-error';

function request(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/tasks', { headers });
}

const UNAUTHORIZED = { status: 401, message: 'Unauthenticated.' };

describe('getAuthUser', () => {
  it('rejects a request without an Authorization header', async () => {
    await expect(getAuthUser(request())).rejects.toMatchObject(UNAUTHORIZED);
    await expect(getAuthUser(request())).rejects.toBeInstanceOf(HttpError);
  });

  it('rejects a non-bearer scheme', async () => {
    await expect(getAuthUser(request({ Authorization: 'Basic abc' }))).rejects.toMatchObject(
      UNAUTHORIZED,
    );
  });

  it('rejects an empty bearer token', async () => {
    await expect(getAuthUser(request({ Authorization: 'Bearer   ' }))).rejects.toMatchObject(
      UNAUTHORIZED,
    );
  });

  it('rejects a malformed token', async () => {
    await expect(
      getAuthUser(request({ Authorization: 'Bearer not-a-jwt' })),
    ).rejects.toMatchObject(UNAUTHORIZED);
  });

  it('rejects a valid token whose subject is not numeric', async () => {
    const { token } = await signToken('not-a-number');
    await expect(
      getAuthUser(request({ Authorization: `Bearer ${token}` })),
    ).rejects.toMatchObject(UNAUTHORIZED);
  });

  it('resolves the user id from a valid token, case-insensitively', async () => {
    const { token } = await signToken(9n);
    await expect(getAuthUser(request({ Authorization: `Bearer ${token}` }))).resolves.toEqual({
      id: 9n,
    });
    await expect(getAuthUser(request({ authorization: `bearer ${token}` }))).resolves.toEqual({
      id: 9n,
    });
  });
});

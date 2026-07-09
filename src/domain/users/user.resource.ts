import type { User } from '@prisma/client';
import { dmyHms, strId } from '@/resources/serialize';
import { userResource as authUserResource } from '@/resources/user.resource';

// Panel shape = auth shape + createdAt. Password NEVER leaves the API.
export function userResource(user: User) {
  return {
    ...authUserResource(user),
    createdAt: dmyHms(user.createdAt),
  };
}

// Select contract: flat array of { label, value, data? } (no pagination).
export function userSelectResource(user: Pick<User, 'id' | 'name' | 'lastName'>) {
  return {
    label: `${user.name} ${user.lastName ?? ''}`.trim(),
    value: strId(user.id),
  };
}

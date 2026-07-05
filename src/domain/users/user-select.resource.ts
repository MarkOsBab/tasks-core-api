import type { User } from '@prisma/client';
import { strId } from '@/resources/serialize';

// Select contract: flat array of { label, value, data? } (no pagination).
export function userSelectResource(user: Pick<User, 'id' | 'name' | 'lastName'>) {
  return {
    label: `${user.name} ${user.lastName ?? ''}`.trim(),
    value: strId(user.id),
  };
}

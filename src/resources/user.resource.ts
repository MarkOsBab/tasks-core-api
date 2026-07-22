import type { User } from '@prisma/client';
import { strId } from './serialize';

export function userResource(user: User) {
  return {
    id: strId(user.id),
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    image: user.image,
    role: user.role,
  };
}

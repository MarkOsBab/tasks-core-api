import type { User } from '@prisma/client';
import { dmyHms, strId } from '@/resources/serialize';
import { userResource as authUserResource } from '@/resources/user.resource';
import type { UserWithProjects } from './user.types';

// Panel shape = auth shape + createdAt + project memberships. Password NEVER leaves the API.
export function userResource(user: UserWithProjects) {
  // R4: the implicit m2m pivot does not filter soft-deletes — drop trashed projects by hand.
  const projects = user.memberProjects.filter((project) => !project.deletedAt);
  return {
    ...authUserResource(user),
    projects: projects.map((project) => ({ id: strId(project.id), name: project.name })),
    projectIds: projects.map((project) => strId(project.id)),
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

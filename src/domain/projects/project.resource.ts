import type { Project } from '@prisma/client';
import { dmy, strId } from '@/resources/serialize';
import type { ProjectWithClient } from './project.types';

export function projectResource(project: ProjectWithClient) {
  return {
    id: strId(project.id),
    clientId: strId(project.clientId),
    // The soft-delete extension does not filter nested includes: guard trashed clients by hand.
    clientName: project.client && !project.client.deletedAt ? project.client.name : null,
    name: project.name,
    description: project.description,
    color: project.color,
    estimatedHours: project.estimatedHours === null ? null : Number(project.estimatedHours),
    repositories: project.repositories ?? [],
    trackedSeconds: project.trackedSeconds ?? 0,
    status: project.status,
    startDate: dmy(project.startDate),
    endDate: dmy(project.endDate),
    createdAt: dmy(project.createdAt),
  };
}

export function projectSelectResource(
  project: Pick<Project, 'id' | 'name' | 'clientId' | 'color'>,
) {
  return {
    label: project.name,
    value: strId(project.id),
    data: { clientId: strId(project.clientId), color: project.color },
  };
}

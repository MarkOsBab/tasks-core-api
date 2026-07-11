import type { Label } from '@prisma/client';
import { dmyHms, strId } from '@/resources/serialize';

export function labelResource(label: Label) {
  return {
    id: strId(label.id),
    name: label.name,
    color: label.color,
    createdAt: dmyHms(label.createdAt),
  };
}

export function labelSelectResource(label: Pick<Label, 'id' | 'name' | 'color'>) {
  return {
    label: label.name,
    value: strId(label.id),
    data: { color: label.color },
  };
}

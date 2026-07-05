import type { Client } from '@prisma/client';
import { dmyHms, strId } from '@/resources/serialize';

export function clientResource(client: Client) {
  return {
    id: strId(client.id),
    name: client.name,
    company: client.company,
    email: client.email,
    phone: client.phone,
    notes: client.notes,
    status: client.status,
    createdAt: dmyHms(client.createdAt),
  };
}

export function clientSelectResource(client: Pick<Client, 'id' | 'name' | 'company'>) {
  return {
    label: client.name,
    value: strId(client.id),
    data: { company: client.company },
  };
}

import { z } from 'zod';
import {
  nullableEmail,
  nullableString,
  optionalEnum,
  optionalRequiredString,
  reqString,
} from '@/lib/validation';

const STATUS = ['active', 'inactive'] as const;

export const storeClientSchema = z.object({
  name: reqString('name', 255),
  company: nullableString('company', 255),
  email: nullableEmail('email'),
  phone: nullableString('phone', 255),
  notes: nullableString('notes'),
  status: optionalEnum('status', STATUS), // omitted -> Prisma default(active)
});

// Factory kept for the updateHandler contract; clients have no unique columns to except.
export function updateClientSchema(_id: string) {
  return z.object({
    name: optionalRequiredString('name', 255),
    company: nullableString('company', 255),
    email: nullableEmail('email'),
    phone: nullableString('phone', 255),
    notes: nullableString('notes'),
    status: optionalEnum('status', STATUS),
  });
}

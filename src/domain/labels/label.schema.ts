import { z } from 'zod';
import { nullableHexColor, optionalRequiredString, reqString } from '@/lib/validation';

export const storeLabelSchema = z.object({
  name: reqString('name', 255),
  color: nullableHexColor('color'), // omitted -> auto-assigned in the service
});

// Factory to match the updateHandler contract; labels have no unique checks so id is unused.
export function updateLabelSchema(_id: string) {
  return z.object({
    name: optionalRequiredString('name', 255),
    color: nullableHexColor('color'),
  });
}

import type { Label } from '@prisma/client';
import { nextUniqueColor } from '@/lib/colors';
import { BaseService } from '../base/base.service';
import { LabelRepository, labelRepository } from './label.repository';

class LabelService extends BaseService<Label> {
  constructor(private readonly labels: LabelRepository) {
    super(labels);
  }

  selectOptions(q: string | null) {
    return this.labels.selectOptions(q);
  }

  protected async prepare(
    data: Record<string, unknown>,
    existing: Label | null,
  ): Promise<Record<string, unknown>> {
    const prepared = { ...data };
    if (prepared.color === '') prepared.color = null;
    // New labels get a distinguishable tag color automatically (still user-customizable).
    if (!existing && prepared.color == null) {
      prepared.color = nextUniqueColor(await this.labels.usedColors());
    }
    return prepared;
  }
}

export const labelService = new LabelService(labelRepository);

import type { Client } from '@prisma/client';
import { nextUniqueColor } from '@/lib/colors';
import { BaseService } from '../base/base.service';
import { ClientRepository, clientRepository } from './client.repository';

class ClientService extends BaseService<Client> {
  constructor(private readonly clients: ClientRepository) {
    super(clients);
  }

  selectOptions(q: string | null) {
    return this.clients.selectOptions(q);
  }

  protected async prepare(
    data: Record<string, unknown>,
    existing: Client | null,
  ): Promise<Record<string, unknown>> {
    const prepared = { ...data };
    if (prepared.color === '') prepared.color = null;
    // New clients get a distinguishable tag color automatically (still user-customizable).
    if (!existing && prepared.color == null) {
      prepared.color = nextUniqueColor(await this.clients.usedColors());
    }
    return prepared;
  }
}

export const clientService = new ClientService(clientRepository);

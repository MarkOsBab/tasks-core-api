import type { Client } from '@prisma/client';
import { BaseService } from '../base/base.service';
import { ClientRepository, clientRepository } from './client.repository';

class ClientService extends BaseService<Client> {
  constructor(private readonly clients: ClientRepository) {
    super(clients);
  }

  selectOptions(q: string | null) {
    return this.clients.selectOptions(q);
  }
}

export const clientService = new ClientService(clientRepository);

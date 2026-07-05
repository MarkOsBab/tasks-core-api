import { createHandler, listHandler } from '@/domain/base/crud-routes';
import { clientResource } from '@/domain/clients/client.resource';
import { storeClientSchema } from '@/domain/clients/client.schema';
import { clientService } from '@/domain/clients/client.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = listHandler(clientService, clientResource);
export const POST = createHandler(clientService, clientResource, storeClientSchema);

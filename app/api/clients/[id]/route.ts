import { destroyHandler, showHandler, updateHandler } from '@/domain/base/crud-routes';
import { clientResource } from '@/domain/clients/client.resource';
import { updateClientSchema } from '@/domain/clients/client.schema';
import { clientService } from '@/domain/clients/client.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(clientService, clientResource);
export const PUT = updateHandler(clientService, clientResource, updateClientSchema);
export const PATCH = updateHandler(clientService, clientResource, updateClientSchema);
export const DELETE = destroyHandler(clientService);

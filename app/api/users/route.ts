import { createHandler, listHandler } from '@/domain/base/crud-routes';
import { userResource } from '@/domain/users/user.resource';
import { storeUserSchema } from '@/domain/users/user.schema';
import { userService } from '@/domain/users/user.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = listHandler(userService, userResource);
export const POST = createHandler(userService, userResource, storeUserSchema);

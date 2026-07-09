import { showHandler, updateHandler } from '@/domain/base/crud-routes';
import { userResource } from '@/domain/users/user.resource';
import { updateUserSchema } from '@/domain/users/user.schema';
import { userService } from '@/domain/users/user.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// No DELETE: users have no soft delete and own tasks/time entries history.
export const GET = showHandler(userService, userResource);
export const PUT = updateHandler(userService, userResource, updateUserSchema);
export const PATCH = updateHandler(userService, userResource, updateUserSchema);

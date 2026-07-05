import { createHandler, listHandler } from '@/domain/base/crud-routes';
import { taskResource } from '@/domain/tasks/task.resource';
import { storeTaskSchema } from '@/domain/tasks/task.schema';
import { taskService } from '@/domain/tasks/task.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = listHandler(taskService, taskResource);
export const POST = createHandler(taskService, taskResource, storeTaskSchema);

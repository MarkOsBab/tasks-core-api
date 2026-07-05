import { destroyHandler, showHandler, updateHandler } from '@/domain/base/crud-routes';
import { taskResource } from '@/domain/tasks/task.resource';
import { updateTaskSchema } from '@/domain/tasks/task.schema';
import { taskService } from '@/domain/tasks/task.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(taskService, taskResource);
export const PUT = updateHandler(taskService, taskResource, updateTaskSchema);
export const PATCH = updateHandler(taskService, taskResource, updateTaskSchema);
export const DELETE = destroyHandler(taskService);

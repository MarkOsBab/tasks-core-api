import { destroyHandler, showHandler, updateHandler } from '@/domain/base/crud-routes';
import { checklistItemResource } from '@/domain/checklist-items/checklist-item.resource';
import { updateChecklistItemSchema } from '@/domain/checklist-items/checklist-item.schema';
import { checklistItemService } from '@/domain/checklist-items/checklist-item.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(checklistItemService, checklistItemResource);
export const PUT = updateHandler(checklistItemService, checklistItemResource, updateChecklistItemSchema);
export const PATCH = updateHandler(checklistItemService, checklistItemResource, updateChecklistItemSchema);
export const DELETE = destroyHandler(checklistItemService);

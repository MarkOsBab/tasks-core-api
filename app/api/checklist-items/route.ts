import { createHandler, listHandler } from '@/domain/base/crud-routes';
import { checklistItemResource } from '@/domain/checklist-items/checklist-item.resource';
import { storeChecklistItemSchema } from '@/domain/checklist-items/checklist-item.schema';
import { checklistItemService } from '@/domain/checklist-items/checklist-item.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = listHandler(checklistItemService, checklistItemResource);
export const POST = createHandler(checklistItemService, checklistItemResource, storeChecklistItemSchema);

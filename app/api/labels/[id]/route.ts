import { destroyHandler, showHandler, updateHandler } from '@/domain/base/crud-routes';
import { labelResource } from '@/domain/labels/label.resource';
import { updateLabelSchema } from '@/domain/labels/label.schema';
import { labelService } from '@/domain/labels/label.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(labelService, labelResource);
export const PUT = updateHandler(labelService, labelResource, updateLabelSchema);
export const PATCH = updateHandler(labelService, labelResource, updateLabelSchema);
export const DELETE = destroyHandler(labelService);

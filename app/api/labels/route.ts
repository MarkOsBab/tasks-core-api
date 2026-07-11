import { createHandler, listHandler } from '@/domain/base/crud-routes';
import { labelResource } from '@/domain/labels/label.resource';
import { storeLabelSchema } from '@/domain/labels/label.schema';
import { labelService } from '@/domain/labels/label.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = listHandler(labelService, labelResource);
export const POST = createHandler(labelService, labelResource, storeLabelSchema);

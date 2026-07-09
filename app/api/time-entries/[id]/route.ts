import { destroyHandler, showHandler, updateHandler } from '@/domain/base/crud-routes';
import { timeEntryResource } from '@/domain/time-entries/time-entry.resource';
import { updateTimeEntrySchema } from '@/domain/time-entries/time-entry.schema';
import { timeEntryService } from '@/domain/time-entries/time-entry.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = showHandler(timeEntryService, timeEntryResource);
export const PUT = updateHandler(timeEntryService, timeEntryResource, updateTimeEntrySchema);
export const DELETE = destroyHandler(timeEntryService);

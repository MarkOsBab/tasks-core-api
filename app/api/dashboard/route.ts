import { withAuth, withRoute } from '@/lib/route';
import { dashboardService } from '@/domain/dashboard/dashboard.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withRoute(withAuth(async () => Response.json(await dashboardService.stats())));

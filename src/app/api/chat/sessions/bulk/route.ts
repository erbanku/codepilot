import { NextRequest } from 'next/server';
import { bulkUpdateSessionStatus, bulkDeleteSessions } from '@/lib/db';
import { serverErrorResponse } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ids } = body as { action: string; ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }

    if (action === 'archive') {
      const count = bulkUpdateSessionStatus(ids, 'archived');
      return Response.json({ success: true, count });
    }

    if (action === 'delete') {
      const count = bulkDeleteSessions(ids);
      return Response.json({ success: true, count });
    }

    return Response.json({ error: `Unknown action: ${action}. Use "archive" or "delete".` }, { status: 400 });
  } catch (error) {
    return serverErrorResponse('POST /api/chat/sessions/bulk', error);
  }
}

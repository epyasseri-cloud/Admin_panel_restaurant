import { createServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { corsHeaders, errorResponse, jsonResponse, preflightResponse } from '../_shared/response.ts';

type AuditEventType =
  | 'menu_item_created'
  | 'menu_item_updated'
  | 'menu_item_deleted'
  | 'menu_item_availability_changed'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'price_changed'
  | 'bulk_exclusion'
  | 'settings_updated';

interface AuditLogRow {
  id: string;
  user_id: string | null;
  event_type: AuditEventType;
  resource_type: string;
  resource_id: string;
  changes: Record<string, unknown>;
  reason: string | null;
  created_at: string;
}

function getRouteSegments(req: Request): string[] {
  const { pathname } = new URL(req.url);
  const segments = pathname.split('/').filter(Boolean);
  const functionIndex = segments.indexOf('audit-log');

  return functionIndex >= 0 ? segments.slice(functionIndex + 1) : [];
}

function toAuditLog(row: AuditLogRow) {
  return {
    id: row.id,
    user_id: row.user_id ?? 'system',
    event_type: row.event_type,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    changes: row.changes ?? {},
    reason: row.reason ?? undefined,
    created_at: row.created_at,
  };
}

function csvEscape(value: unknown): string {
  const normalized = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
}

async function requireAdmin(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  const serviceClient = createServiceClient();

  if (error || !user) {
    return {
      supabase: null,
      response: errorResponse('unauthorized', 'Unauthorized', 401, error),
    };
  }

  const { data: profile, error: profileError } = await serviceClient
    .schema('app')
    .from('user_profiles')
    .select('id, role, is_active')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return {
      supabase: null,
      response: errorResponse('profile_not_found', 'Profile not found', 404, profileError?.message),
    };
  }

  if (profile.is_active === false || profile.role !== 'admin') {
    return {
      supabase: null,
      response: errorResponse('forbidden', 'Admin access required', 403),
    };
  }

  return {
    supabase: serviceClient,
    response: null,
  };
}

function applyFilters(
  query: ReturnType<ReturnType<typeof createServiceClient>['schema']>['from'],
  url: URL
) {
  const fromDate = url.searchParams.get('from_date')?.trim();
  const toDate = url.searchParams.get('to_date')?.trim();
  const eventType = url.searchParams.get('event_type')?.trim();
  const userId = url.searchParams.get('user_id')?.trim();
  const resourceType = url.searchParams.get('resource_type')?.trim();

  let nextQuery = query;

  if (fromDate) {
    nextQuery = nextQuery.gte('created_at', `${fromDate}T00:00:00.000Z`);
  }

  if (toDate) {
    nextQuery = nextQuery.lte('created_at', `${toDate}T23:59:59.999Z`);
  }

  if (eventType) {
    nextQuery = nextQuery.eq('event_type', eventType);
  }

  if (userId) {
    nextQuery = nextQuery.eq('user_id', userId);
  }

  if (resourceType) {
    nextQuery = nextQuery.eq('resource_type', resourceType);
  }

  return nextQuery;
}

async function listAuditLogs(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const url = new URL(req.url);
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '20') || 20, 1), 500);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .schema('app')
    .from('audit_logs')
    .select('id, user_id, event_type, resource_type, resource_id, changes, reason, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false });

  query = applyFilters(query, url);

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return errorResponse('audit_logs_fetch_failed', 'Failed to load audit logs', 500, error.message);
  }

  const items = ((data ?? []) as AuditLogRow[]).map(toAuditLog);
  const total = count ?? items.length;

  return jsonResponse({
    data: items,
    total,
    page,
    limit,
    total_pages: Math.max(Math.ceil(total / limit), 1),
  });
}

async function getAuditLog(req: Request, id: string) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const { data, error } = await supabase
    .schema('app')
    .from('audit_logs')
    .select('id, user_id, event_type, resource_type, resource_id, changes, reason, created_at')
    .eq('id', id)
    .single();

  if (error || !data) {
    return errorResponse('audit_log_not_found', 'Audit log not found', 404, error?.message);
  }

  return jsonResponse(toAuditLog(data as AuditLogRow));
}

async function exportAuditLogs(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const url = new URL(req.url);

  let query = supabase
    .schema('app')
    .from('audit_logs')
    .select('id, user_id, event_type, resource_type, resource_id, changes, reason, created_at')
    .order('created_at', { ascending: false });

  query = applyFilters(query, url);

  const { data, error } = await query;

  if (error) {
    return errorResponse('audit_logs_export_failed', 'Failed to export audit logs', 500, error.message);
  }

  const rows = (data ?? []) as AuditLogRow[];
  const header = ['id', 'user_id', 'event_type', 'resource_type', 'resource_id', 'changes', 'reason', 'created_at'];
  const csvLines = [header.join(',')];

  for (const row of rows) {
    csvLines.push(
      [
        row.id,
        row.user_id ?? 'system',
        row.event_type,
        row.resource_type,
        row.resource_id,
        row.changes,
        row.reason ?? '',
        row.created_at,
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  return new Response(csvLines.join('\n'), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="audit-log.csv"',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse();
  }

  const segments = getRouteSegments(req);

  if (req.method === 'GET' && segments.length === 0) {
    return listAuditLogs(req);
  }

  if (req.method === 'GET' && segments.length === 1) {
    return getAuditLog(req, segments[0]);
  }

  if (req.method === 'GET' && segments.length === 2 && segments[0] === 'export' && segments[1] === 'csv') {
    return exportAuditLogs(req);
  }

  return errorResponse('not_found', 'Route not found', 404, {
    method: req.method,
    path: segments,
  });
});
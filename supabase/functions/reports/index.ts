import { createServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { corsHeaders, errorResponse, jsonResponse, preflightResponse } from '../_shared/response.ts';

type ReportGroupBy = 'date' | 'table' | 'waiter' | 'dish';

interface OrderRow {
  id: string;
  waiter_id: string;
  table_id: string | null;
  created_at: string;
  total_amount: number;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  price: number;
  qty: number;
}

interface WaiterRow {
  id: string;
  name: string;
}

interface DetailRow {
  id: string;
  name: string;
  quantity: number;
  total_revenue: number;
  percentage_of_total: number;
}

function getRouteSegments(req: Request): string[] {
  const { pathname } = new URL(req.url);
  const segments = pathname.split('/').filter(Boolean);
  const functionIndex = segments.indexOf('reports');
  return functionIndex >= 0 ? segments.slice(functionIndex + 1) : [];
}

function toDateStart(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function toDateEnd(value: string) {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

function csvEscape(value: unknown): string {
  const normalized = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
}

function sanitizePdfText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?');
}

function createSimplePdf(lines: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const contentLines = ['BT', '/F1 12 Tf', '50 760 Td'];

  for (const line of lines) {
    contentLines.push(`(${sanitizePdfText(line)}) Tj`);
    contentLines.push('T*');
  }

  contentLines.push('ET');
  const streamContent = contentLines.join('\n');
  const streamLength = encoder.encode(streamContent).length;

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${streamLength} >> stream\n${streamContent}\nendstream\nendobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const objectText of objects) {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${objectText}\n`;
  }

  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return encoder.encode(pdf);
}

function asPercent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Number(((value / total) * 100).toFixed(2));
}

async function requireAdmin(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  const supabase = createServiceClient();

  if (error || !user) {
    return {
      supabase: null,
      response: errorResponse('unauthorized', 'Unauthorized', 401, error),
    };
  }

  const { data: profile, error: profileError } = await supabase
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
    supabase,
    response: null,
  };
}

function ensureValidGroupBy(value: string | null): ReportGroupBy {
  if (value === 'date' || value === 'table' || value === 'waiter' || value === 'dish') {
    return value;
  }
  return 'date';
}

async function fetchReportData(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return { response: auth.response, data: null };
  }

  const supabase = auth.supabase;
  const url = new URL(req.url);
  const fromDate = url.searchParams.get('from_date');
  const toDate = url.searchParams.get('to_date');
  const groupBy = ensureValidGroupBy(url.searchParams.get('group_by'));
  const waiterId = url.searchParams.get('waiter_id')?.trim();
  const tableId = url.searchParams.get('table_id')?.trim();
  const dishId = url.searchParams.get('dish_id')?.trim();

  if (!fromDate || !toDate) {
    return {
      response: errorResponse('validation_error', 'from_date and to_date are required', 422),
      data: null,
    };
  }

  let ordersQuery = supabase
    .schema('app')
    .from('orders')
    .select('id, waiter_id, table_id, created_at, total_amount')
    .gte('created_at', toDateStart(fromDate))
    .lte('created_at', toDateEnd(toDate))
    .order('created_at', { ascending: false });

  if (waiterId) {
    ordersQuery = ordersQuery.eq('waiter_id', waiterId);
  }

  if (tableId) {
    ordersQuery = ordersQuery.eq('table_id', tableId);
  }

  const { data: ordersData, error: ordersError } = await ordersQuery;
  if (ordersError) {
    return {
      response: errorResponse('reports_orders_fetch_failed', 'Failed to load orders for report', 500, ordersError.message),
      data: null,
    };
  }

  const orders = (ordersData ?? []) as OrderRow[];
  const orderIds = orders.map((order) => order.id);

  if (orderIds.length === 0) {
    return {
      response: null,
      data: {
        period: `${fromDate}..${toDate}`,
        group_by: groupBy,
        total_orders: 0,
        total_revenue: 0,
        items_sold: 0,
        details: [] as DetailRow[],
      },
    };
  }

  let itemsQuery = supabase
    .schema('app')
    .from('order_items')
    .select('id, order_id, menu_item_id, name, price, qty')
    .in('order_id', orderIds);

  if (dishId) {
    itemsQuery = itemsQuery.or(`menu_item_id.eq.${dishId},id.eq.${dishId}`);
  }

  const { data: itemsData, error: itemsError } = await itemsQuery;
  if (itemsError) {
    return {
      response: errorResponse('reports_items_fetch_failed', 'Failed to load order items for report', 500, itemsError.message),
      data: null,
    };
  }

  const items = (itemsData ?? []) as OrderItemRow[];

  const waiterIds = Array.from(new Set(orders.map((o) => o.waiter_id)));
  const { data: waiterData } = await supabase
    .schema('app')
    .from('user_profiles')
    .select('id, name')
    .in('id', waiterIds);

  const waiterNames = new Map<string, string>();
  for (const waiter of (waiterData ?? []) as WaiterRow[]) {
    waiterNames.set(waiter.id, waiter.name);
  }

  const orderMap = new Map<string, OrderRow>();
  for (const order of orders) {
    orderMap.set(order.id, order);
  }

  const detailsMap = new Map<string, { id: string; name: string; quantity: number; total_revenue: number }>();
  let itemsSold = 0;

  for (const item of items) {
    const order = orderMap.get(item.order_id);
    if (!order) {
      continue;
    }

    let key = '';
    let name = '';

    if (groupBy === 'date') {
      const date = new Date(order.created_at).toISOString().slice(0, 10);
      key = date;
      name = date;
    } else if (groupBy === 'table') {
      key = order.table_id || 'Sin mesa';
      name = order.table_id || 'Sin mesa';
    } else if (groupBy === 'waiter') {
      key = order.waiter_id;
      name = waiterNames.get(order.waiter_id) || 'Mesero';
    } else {
      key = item.menu_item_id || item.id;
      name = item.name;
    }

    const existing = detailsMap.get(key) || { id: key, name, quantity: 0, total_revenue: 0 };
    existing.quantity += item.qty;
    existing.total_revenue += Number(item.price) * item.qty;
    detailsMap.set(key, existing);
    itemsSold += item.qty;
  }

  const totalRevenue = Array.from(detailsMap.values()).reduce((sum, row) => sum + row.total_revenue, 0);

  const details: DetailRow[] = Array.from(detailsMap.values())
    .map((row) => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      total_revenue: Number(row.total_revenue.toFixed(2)),
      percentage_of_total: asPercent(row.total_revenue, totalRevenue),
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue);

  return {
    response: null,
    data: {
      period: `${fromDate}..${toDate}`,
      group_by: groupBy,
      total_orders: orders.length,
      total_revenue: Number(totalRevenue.toFixed(2)),
      items_sold: itemsSold,
      details,
    },
  };
}

async function getReport(req: Request) {
  const result = await fetchReportData(req);
  if (result.response) {
    return result.response;
  }
  return jsonResponse(result.data);
}

async function getReportStats(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const period = new URL(req.url).searchParams.get('period') || 'month';
  const now = new Date();
  const from = new Date(now);

  if (period === 'week') {
    from.setDate(now.getDate() - 7);
  } else if (period === 'year') {
    from.setFullYear(now.getFullYear() - 1);
  } else {
    from.setMonth(now.getMonth() - 1);
  }

  const { data: rows, error } = await auth.supabase
    .schema('app')
    .from('orders')
    .select('id, status, total_amount, created_at')
    .gte('created_at', from.toISOString())
    .lte('created_at', now.toISOString());

  if (error) {
    return errorResponse('reports_stats_failed', 'Failed to load sales stats', 500, error.message);
  }

  const list = rows ?? [];
  const totalOrders = list.length;
  const totalRevenue = list.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);

  return jsonResponse({
    period,
    total_orders: totalOrders,
    total_revenue: Number(totalRevenue.toFixed(2)),
    average_ticket: totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0,
  });
}

async function exportReportCsv(req: Request) {
  const result = await fetchReportData(req);
  if (result.response) {
    return result.response;
  }

  const report = result.data;
  const lines = ['id,name,quantity,total_revenue,percentage_of_total'];

  for (const detail of report.details as DetailRow[]) {
    lines.push(
      [detail.id, detail.name, detail.quantity, detail.total_revenue, detail.percentage_of_total]
        .map(csvEscape)
        .join(',')
    );
  }

  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="sales-report.csv"',
    },
  });
}

async function exportReportPdf(req: Request) {
  const result = await fetchReportData(req);
  if (result.response) {
    return result.response;
  }

  const report = result.data;
  const pdfBytes = createSimplePdf([
    'Sales Report',
    `Period: ${report.period}`,
    `Total orders: ${report.total_orders}`,
    `Total revenue: ${report.total_revenue}`,
    `Items sold: ${report.items_sold}`,
  ]);

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="sales-report.pdf"',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse();
  }

  if (req.method !== 'GET') {
    return errorResponse('method_not_allowed', 'Only GET is allowed', 405);
  }

  const segments = getRouteSegments(req);

  if (segments.length === 0) {
    return getReport(req);
  }

  if (segments.length === 1 && segments[0] === 'stats') {
    return getReportStats(req);
  }

  if (segments.length === 2 && segments[0] === 'export' && segments[1] === 'csv') {
    return exportReportCsv(req);
  }

  if (segments.length === 2 && segments[0] === 'export' && segments[1] === 'pdf') {
    return exportReportPdf(req);
  }

  return errorResponse('not_found', 'Route not found', 404, { method: req.method, path: segments });
});

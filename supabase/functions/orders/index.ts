import { createServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { errorResponse, jsonResponse, preflightResponse } from '../_shared/response.ts';

type UserRole = 'waiter' | 'kitchen' | 'manager' | 'admin';
type OrderStatus = 'pendiente' | 'en_preparacion' | 'listo' | 'servido' | 'cancelado';

interface UserProfile {
  id: string;
  role: UserRole;
  is_active: boolean;
}

interface OrderItemInput {
  id?: string;
  menu_item_id?: string;
  name?: string;
  price?: number;
  qty?: number;
}

interface CreateOrderBody {
  id?: string;
  table_id?: string;
  customer_name?: string;
  items?: OrderItemInput[];
  status?: OrderStatus;
}

interface UpdateStatusBody {
  status?: OrderStatus;
}

interface OrderRow {
  id: string;
  external_id: string | null;
  waiter_id: string;
  table_id: string | null;
  customer_name: string | null;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  price: number;
  qty: number;
}

function getRouteSegments(req: Request): string[] {
  const { pathname } = new URL(req.url);
  const segments = pathname.split('/').filter(Boolean);
  const functionIndex = segments.indexOf('orders');
  return functionIndex >= 0 ? segments.slice(functionIndex + 1) : [];
}

function isActiveFilter(value: string | null) {
  return value === '1' || value === 'true' || value === 'yes';
}

function normalizeId(row: OrderRow) {
  return row.external_id || row.id;
}

async function requireProfile(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  const supabase = createServiceClient();

  if (error || !user) {
    return {
      supabase: null,
      profile: null,
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
      profile: null,
      response: errorResponse('profile_not_found', 'Profile not found', 404, profileError?.message),
    };
  }

  if ((profile as UserProfile).is_active === false) {
    return {
      supabase: null,
      profile: null,
      response: errorResponse('forbidden', 'Inactive user', 403),
    };
  }

  return {
    supabase,
    profile: profile as UserProfile,
    response: null,
  };
}

async function resolveOrderIds(
  supabase: ReturnType<typeof createServiceClient>,
  identifier: string
) {
  const { data } = await supabase
    .schema('app')
    .from('orders')
    .select('id')
    .or(`id.eq.${identifier},external_id.eq.${identifier}`)
    .limit(1);

  return (data ?? [])[0]?.id as string | undefined;
}

async function loadOrderItems(
  supabase: ReturnType<typeof createServiceClient>,
  orderIds: string[]
) {
  if (orderIds.length === 0) {
    return new Map<string, OrderItemRow[]>();
  }

  const { data, error } = await supabase
    .schema('app')
    .from('order_items')
    .select('id, order_id, menu_item_id, name, price, qty')
    .in('order_id', orderIds)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<string, OrderItemRow[]>();
  for (const item of (data ?? []) as OrderItemRow[]) {
    const list = grouped.get(item.order_id) ?? [];
    list.push(item);
    grouped.set(item.order_id, list);
  }

  return grouped;
}

async function loadOrders(
  supabase: ReturnType<typeof createServiceClient>,
  queryBuilder: ReturnType<ReturnType<typeof createServiceClient>['schema']>['from']
) {
  const { data, error } = await queryBuilder;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as OrderRow[];
  const orderIds = rows.map((row) => row.id);
  const itemsByOrder = await loadOrderItems(supabase, orderIds);

  return rows.map((row) => ({
    id: normalizeId(row),
    db_id: row.id,
    waiter_id: row.waiter_id,
    table_id: row.table_id ?? undefined,
    customer_name: row.customer_name ?? undefined,
    status: row.status,
    total_amount: Number(row.total_amount),
    created_at: row.created_at,
    updated_at: row.updated_at,
    items: (itemsByOrder.get(row.id) ?? []).map((item) => ({
      id: item.menu_item_id || item.id,
      name: item.name,
      price: Number(item.price),
      qty: item.qty,
    })),
  }));
}

async function listOrders(req: Request) {
  const auth = await requireProfile(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase, profile } = auth;
  const url = new URL(req.url);
  const waiterIdParam = url.searchParams.get('waiter_id')?.trim();
  const onlyActive = isActiveFilter(url.searchParams.get('active'));

  let query = supabase
    .schema('app')
    .from('orders')
    .select('id, external_id, waiter_id, table_id, customer_name, status, total_amount, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (profile.role === 'waiter') {
    query = query.eq('waiter_id', profile.id);
  } else if (waiterIdParam) {
    query = query.eq('waiter_id', waiterIdParam);
  }

  if (onlyActive) {
    query = query.in('status', ['pendiente', 'en_preparacion', 'listo']);
  }

  try {
    const orders = await loadOrders(supabase, query);
    return jsonResponse(orders);
  } catch (error) {
    return errorResponse(
      'orders_fetch_failed',
      'Failed to load orders',
      500,
      error instanceof Error ? error.message : error
    );
  }
}

async function getOrderById(req: Request, identifier: string) {
  const auth = await requireProfile(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase, profile } = auth;
  const orderId = await resolveOrderIds(supabase, identifier);

  if (!orderId) {
    return errorResponse('order_not_found', 'Order not found', 404);
  }

  let query = supabase
    .schema('app')
    .from('orders')
    .select('id, external_id, waiter_id, table_id, customer_name, status, total_amount, created_at, updated_at')
    .eq('id', orderId)
    .limit(1);

  if (profile.role === 'waiter') {
    query = query.eq('waiter_id', profile.id);
  }

  try {
    const orders = await loadOrders(supabase, query);
    if (!orders[0]) {
      return errorResponse('order_not_found', 'Order not found', 404);
    }
    return jsonResponse(orders[0]);
  } catch (error) {
    return errorResponse(
      'order_fetch_failed',
      'Failed to load order',
      500,
      error instanceof Error ? error.message : error
    );
  }
}

function sanitizeItems(items: OrderItemInput[] | undefined) {
  return (items ?? [])
    .filter((item) => item && typeof item.qty === 'number' && item.qty > 0)
    .map((item) => ({
      menu_item_id: item.menu_item_id || item.id || null,
      name: (item.name || '').trim() || 'Item',
      price: Number(item.price ?? 0),
      qty: Math.max(1, Math.floor(item.qty ?? 1)),
    }))
    .filter((item) => item.price >= 0);
}

async function createOrder(req: Request) {
  const auth = await requireProfile(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase, profile } = auth;

  if (!['waiter', 'admin', 'manager'].includes(profile.role)) {
    return errorResponse('forbidden', 'Role cannot create orders', 403);
  }

  let body: CreateOrderBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  const items = sanitizeItems(body.items);
  if (items.length === 0) {
    return errorResponse('validation_error', 'items is required', 422);
  }

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const { data: createdOrder, error: orderError } = await supabase
    .schema('app')
    .from('orders')
    .insert({
      external_id: body.id?.trim() || null,
      waiter_id: profile.id,
      table_id: body.table_id?.trim() || null,
      customer_name: body.customer_name?.trim() || null,
      status: body.status ?? 'pendiente',
      total_amount: Number(totalAmount.toFixed(2)),
    })
    .select('id')
    .single();

  if (orderError || !createdOrder) {
    return errorResponse('order_create_failed', 'Failed to create order', 500, orderError?.message);
  }

  const { error: itemError } = await supabase
    .schema('app')
    .from('order_items')
    .insert(
      items.map((item) => ({
        order_id: createdOrder.id,
        menu_item_id: item.menu_item_id,
        name: item.name,
        price: item.price,
        qty: item.qty,
      }))
    );

  if (itemError) {
    await supabase.schema('app').from('orders').delete().eq('id', createdOrder.id);
    return errorResponse('order_items_create_failed', 'Failed to create order items', 500, itemError.message);
  }

  const { error: auditError } = await supabase.schema('app').from('audit_logs').insert({
    user_id: profile.id,
    event_type: 'order_created',
    resource_type: 'order',
    resource_id: createdOrder.id,
    changes: {
      total_amount: Number(totalAmount.toFixed(2)),
      item_count: items.length,
      status: body.status ?? 'pendiente',
    },
  });

  if (auditError) {
    console.warn('[orders] audit insert failed:', auditError.message);
  }

  return getOrderById(req, createdOrder.id);
}

async function updateOrderStatus(req: Request, identifier: string) {
  const auth = await requireProfile(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase, profile } = auth;
  const orderId = await resolveOrderIds(supabase, identifier);

  if (!orderId) {
    return errorResponse('order_not_found', 'Order not found', 404);
  }

  let body: UpdateStatusBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  if (!body.status) {
    return errorResponse('validation_error', 'status is required', 422);
  }

  if (!['pendiente', 'en_preparacion', 'listo', 'servido', 'cancelado'].includes(body.status)) {
    return errorResponse('validation_error', 'Invalid order status', 422);
  }

  const { data: targetOrder, error: targetError } = await supabase
    .schema('app')
    .from('orders')
    .select('id, waiter_id')
    .eq('id', orderId)
    .single();

  if (targetError || !targetOrder) {
    return errorResponse('order_not_found', 'Order not found', 404, targetError?.message);
  }

  if (profile.role === 'waiter' && targetOrder.waiter_id !== profile.id) {
    return errorResponse('forbidden', 'Waiter can update only own orders', 403);
  }

  if (profile.role === 'kitchen' && !['en_preparacion', 'listo', 'cancelado'].includes(body.status)) {
    return errorResponse('forbidden', 'Kitchen role cannot assign that status', 403);
  }

  const { error: updateError } = await supabase
    .schema('app')
    .from('orders')
    .update({ status: body.status })
    .eq('id', orderId);

  if (updateError) {
    return errorResponse('order_status_update_failed', 'Failed to update order status', 500, updateError.message);
  }

  const { error: auditError } = await supabase.schema('app').from('audit_logs').insert({
    user_id: profile.id,
    event_type: 'order_status_updated',
    resource_type: 'order',
    resource_id: orderId,
    changes: {
      status: body.status,
    },
  });

  if (auditError) {
    console.warn('[orders] audit insert failed:', auditError.message);
  }

  return getOrderById(req, orderId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse();
  }

  const segments = getRouteSegments(req);

  if (req.method === 'GET' && segments.length === 0) {
    return listOrders(req);
  }

  if (req.method === 'GET' && segments.length === 1) {
    return getOrderById(req, segments[0]);
  }

  if (req.method === 'POST' && segments.length === 0) {
    return createOrder(req);
  }

  if (req.method === 'PATCH' && segments.length === 1) {
    return updateOrderStatus(req, segments[0]);
  }

  if (req.method === 'PATCH' && segments.length === 2 && segments[1] === 'status') {
    return updateOrderStatus(req, segments[0]);
  }

  return errorResponse('not_found', 'Route not found', 404, {
    method: req.method,
    path: segments,
  });
});

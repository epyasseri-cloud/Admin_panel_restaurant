import { createServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { errorResponse, jsonResponse, preflightResponse } from '../_shared/response.ts';

type UserRole = 'waiter' | 'kitchen' | 'manager' | 'admin';
type OrderStatus = 'pendiente' | 'en_preparacion' | 'listo' | 'servido' | 'cancelado';

const EDITABLE_STATUSES: OrderStatus[] = ['pendiente', 'en_preparacion'];

interface UserProfile {
  id: string;
  role: UserRole;
  is_active: boolean;
}

interface OrderItemInput {
  id?: string | number | null;
  menu_item_id?: string | null;
  name?: string;
  price?: number | null;
  qty?: number;
  notes?: string | null;
  extras?: string[];
  exclusions?: string[];
  allergyNotes?: string | null;
  kitchenNotes?: string | null;
  allergy_notes?: string | null;
  kitchen_notes?: string | null;
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

interface EditItemsBody {
  items?: OrderItemInput[];
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
  extras: string[];
  exclusions: string[];
  allergy_notes: string | null;
  kitchen_notes: string | null;
  notes: string | null;
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

function parseTextSegment(notes: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = notes.match(new RegExp(`${escaped}:\\s*([^|]+)`, 'i'));
  return match ? match[1].trim() : null;
}

function parseCsvSegment(notes: string, label: string): string[] {
  const value = parseTextSegment(notes, label);
  if (!value) return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

function buildNotes(extras: string[], exclusions: string[], allergy: string, kitchenNote: string): string {
  const parts: string[] = [];
  if (extras.length > 0) parts.push(`Extras: ${extras.join(', ')}`);
  if (exclusions.length > 0) parts.push(`Sin: ${exclusions.join(', ')}`);
  if (allergy) parts.push(`Alergia: ${allergy}`);
  if (kitchenNote) parts.push(`Nota: ${kitchenNote}`);
  return parts.join(' | ');
}

interface NormalizedItem {
  menu_item_id: string | null;
  name: string;
  price: number;
  qty: number;
  extras: string[];
  exclusions: string[];
  allergy_notes: string;
  kitchen_notes: string;
  notes: string;
}

function normalizeItem(item: OrderItemInput): NormalizedItem {
  const rawNotes = item.notes || '';

  const extras =
    Array.isArray(item.extras) && item.extras.length > 0
      ? item.extras
      : parseCsvSegment(rawNotes, 'Extras');

  const exclusions =
    Array.isArray(item.exclusions) && item.exclusions.length > 0
      ? item.exclusions
      : parseCsvSegment(rawNotes, 'Sin');

  const allergy = (
    item.allergyNotes ||
    item.allergy_notes ||
    parseTextSegment(rawNotes, 'Alergia') ||
    ''
  ).trim();

  const kitchenNote = (
    item.kitchenNotes ||
    item.kitchen_notes ||
    parseTextSegment(rawNotes, 'Nota') ||
    ''
  ).trim();

  const notes = buildNotes(extras, exclusions, allergy, kitchenNote) || rawNotes;

  const rawId = item.menu_item_id || item.id;
  const menuItemId = rawId != null ? String(rawId) : null;

  return {
    menu_item_id: menuItemId,
    name: (item.name || '').trim() || 'Item',
    price: Number(item.price ?? 0),
    qty: Math.max(1, Math.floor(Number(item.qty ?? 1))),
    extras,
    exclusions,
    allergy_notes: allergy,
    kitchen_notes: kitchenNote,
    notes,
  };
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
    .select('id, order_id, menu_item_id, name, price, qty, extras, exclusions, allergy_notes, kitchen_notes, notes')
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

function serializeItem(item: OrderItemRow) {
  const extras = Array.isArray(item.extras) ? item.extras : [];
  const exclusions = Array.isArray(item.exclusions) ? item.exclusions : [];
  const allergy = item.allergy_notes || '';
  const kitchenNote = item.kitchen_notes || '';
  const notes = item.notes || buildNotes(extras, exclusions, allergy, kitchenNote);

  return {
    id: item.menu_item_id || item.id,
    name: item.name,
    price: Number(item.price),
    qty: item.qty,
    extras,
    exclusions,
    allergyNotes: allergy,
    allergy_notes: allergy,
    kitchenNotes: kitchenNote,
    kitchen_notes: kitchenNote,
    notes,
  };
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
    items: (itemsByOrder.get(row.id) ?? []).map(serializeItem),
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

function sanitizeItems(items: OrderItemInput[] | undefined): NormalizedItem[] {
  return (items ?? [])
    .filter((item) => item && typeof item.qty === 'number' && item.qty > 0 && item.name)
    .map(normalizeItem)
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
        extras: item.extras,
        exclusions: item.exclusions,
        allergy_notes: item.allergy_notes || null,
        kitchen_notes: item.kitchen_notes || null,
        notes: item.notes || null,
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
    .update({ status: body.status, updated_by: profile.id })
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

async function editOrderItems(req: Request, identifier: string) {
  const auth = await requireProfile(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase, profile } = auth;

  if (!['waiter', 'admin', 'manager', 'kitchen'].includes(profile.role)) {
    return errorResponse('forbidden', 'Role cannot edit order items', 403);
  }

  const orderId = await resolveOrderIds(supabase, identifier);
  if (!orderId) {
    return errorResponse('order_not_found', 'Order not found', 404);
  }

  const { data: targetOrder, error: targetError } = await supabase
    .schema('app')
    .from('orders')
    .select('id, waiter_id, status')
    .eq('id', orderId)
    .single();

  if (targetError || !targetOrder) {
    return errorResponse('order_not_found', 'Order not found', 404, targetError?.message);
  }

  if (profile.role === 'waiter' && targetOrder.waiter_id !== profile.id) {
    return errorResponse('forbidden', 'Waiter can edit only own orders', 403);
  }

  // 409 Conflict when order is in a non-editable state (not 422)
  if (!EDITABLE_STATUSES.includes(targetOrder.status as OrderStatus)) {
    return errorResponse('order_not_editable', `Order cannot be edited in status "${targetOrder.status}"`, 409);
  }

  let body: EditItemsBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  const items = sanitizeItems(body.items);
  if (items.length === 0) {
    return errorResponse('validation_error', 'items must be a non-empty array with name and qty >= 1', 422);
  }

  // Replace all items atomically (delete + re-insert)
  const { error: deleteError } = await supabase
    .schema('app')
    .from('order_items')
    .delete()
    .eq('order_id', orderId);

  if (deleteError) {
    return errorResponse('order_edit_failed', 'Failed to replace order items', 500, deleteError.message);
  }

  const { error: insertError } = await supabase
    .schema('app')
    .from('order_items')
    .insert(
      items.map((item) => ({
        order_id: orderId,
        menu_item_id: item.menu_item_id,
        name: item.name,
        price: item.price,
        qty: item.qty,
        extras: item.extras,
        exclusions: item.exclusions,
        allergy_notes: item.allergy_notes || null,
        kitchen_notes: item.kitchen_notes || null,
        notes: item.notes || null,
      }))
    );

  if (insertError) {
    return errorResponse('order_edit_failed', 'Failed to insert updated items', 500, insertError.message);
  }

  const newTotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const { error: updateError } = await supabase
    .schema('app')
    .from('orders')
    .update({ total_amount: Number(newTotal.toFixed(2)), updated_by: profile.id })
    .eq('id', orderId);

  if (updateError) {
    console.warn('[orders] total recalc failed:', updateError.message);
  }

  const { error: auditError } = await supabase.schema('app').from('audit_logs').insert({
    user_id: profile.id,
    event_type: 'order_items_edited',
    resource_type: 'order',
    resource_id: orderId,
    changes: { item_count: items.length, total_amount: Number(newTotal.toFixed(2)) },
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

  // PATCH /orders/:id/status → always update status
  if (req.method === 'PATCH' && segments.length === 2 && segments[1] === 'status') {
    return updateOrderStatus(req, segments[0]);
  }

  // PATCH (or PUT) /orders/:id → dispatch based on body: items → edit, status → status update
  if ((req.method === 'PATCH' || req.method === 'PUT') && segments.length === 1) {
    const cloned = req.clone();
    let body: Record<string, unknown> = {};
    try {
      body = await cloned.json();
    } catch {
      // fall through
    }
    if (Array.isArray(body.items)) {
      return editOrderItems(req, segments[0]);
    }
    return updateOrderStatus(req, segments[0]);
  }

  // PATCH /orders/:id/update → edit items (extra compatibility route for frontend fallback)
  if (req.method === 'PATCH' && segments.length === 2 && segments[1] === 'update') {
    return editOrderItems(req, segments[0]);
  }

  return errorResponse('not_found', 'Route not found', 404, {
    method: req.method,
    path: segments,
  });
});

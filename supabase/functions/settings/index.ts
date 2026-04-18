import { createServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { errorResponse, jsonResponse, preflightResponse } from '../_shared/response.ts';

type OperatingDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

interface SettingsRow {
  id: string;
  restaurant_name: string;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

interface OperatingHourRow {
  id: string;
  day: OperatingDay;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface TableRow {
  id: string;
  number: number;
  name: string;
  capacity: number;
  is_active: boolean;
}

interface SettingsBody {
  restaurant_name?: string;
  currency?: string;
  timezone?: string;
  operating_hours?: Array<{
    day: OperatingDay;
    open_time: string;
    close_time: string;
    is_closed?: boolean;
  }>;
  tables?: Array<{
    id?: string;
    number: number;
    name: string;
    capacity: number;
    is_active?: boolean;
  }>;
}

interface TableBody {
  number?: number;
  name?: string;
  capacity?: number;
  is_active?: boolean;
}

function getRouteSegments(req: Request): string[] {
  const { pathname } = new URL(req.url);
  const segments = pathname.split('/').filter(Boolean);
  const functionIndex = segments.indexOf('settings');

  return functionIndex >= 0 ? segments.slice(functionIndex + 1) : [];
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

async function loadSettingsBundle(supabase: ReturnType<typeof createServiceClient>) {
  const { data: settings, error: settingsError } = await supabase
    .schema('app')
    .from('restaurant_settings')
    .select('id, restaurant_name, currency, timezone, created_at, updated_at')
    .limit(1)
    .single();

  if (settingsError || !settings) {
    throw new Error(settingsError?.message ?? 'Restaurant settings not found');
  }

  const [{ data: operatingHours, error: operatingHoursError }, { data: tables, error: tablesError }] = await Promise.all([
    supabase
      .schema('app')
      .from('operating_hours')
      .select('id, day, open_time, close_time, is_closed')
      .order('day', { ascending: true }),
    supabase
      .schema('app')
      .from('restaurant_tables')
      .select('id, number, name, capacity, is_active')
      .order('number', { ascending: true }),
  ]);

  if (operatingHoursError) {
    throw new Error(operatingHoursError.message);
  }

  if (tablesError) {
    throw new Error(tablesError.message);
  }

  return {
    id: (settings as SettingsRow).id,
    restaurant_name: (settings as SettingsRow).restaurant_name,
    currency: (settings as SettingsRow).currency,
    timezone: (settings as SettingsRow).timezone,
    operating_hours: (operatingHours ?? []) as OperatingHourRow[],
    tables: (tables ?? []) as TableRow[],
    created_at: (settings as SettingsRow).created_at,
    updated_at: (settings as SettingsRow).updated_at,
  };
}

async function getSettings(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  try {
    const payload = await loadSettingsBundle(auth.supabase);
    return jsonResponse(payload);
  } catch (error) {
    const details = error instanceof Error ? error.message : error;
    return errorResponse('settings_fetch_failed', 'Failed to load settings', 500, details);
  }
}

async function patchSettings(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  let body: SettingsBody;

  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  const updatePayload: Record<string, unknown> = {};
  if (body.restaurant_name !== undefined) {
    updatePayload.restaurant_name = body.restaurant_name.trim();
  }
  if (body.currency !== undefined) {
    updatePayload.currency = body.currency.trim().toUpperCase();
  }
  if (body.timezone !== undefined) {
    updatePayload.timezone = body.timezone.trim();
  }

  if (Object.keys(updatePayload).length > 0) {
    const { data: existingSettings, error: settingsLookupError } = await supabase
      .schema('app')
      .from('restaurant_settings')
      .select('id')
      .limit(1)
      .single();

    if (settingsLookupError || !existingSettings) {
      return errorResponse('settings_not_found', 'Restaurant settings not found', 404, settingsLookupError?.message);
    }

    const { error: updateSettingsError } = await supabase
      .schema('app')
      .from('restaurant_settings')
      .update(updatePayload)
      .eq('id', existingSettings.id);

    if (updateSettingsError) {
      return errorResponse('settings_update_failed', 'Failed to update restaurant settings', 500, updateSettingsError.message);
    }
  }

  if (body.operating_hours !== undefined) {
    const { error: deleteHoursError } = await supabase
      .schema('app')
      .from('operating_hours')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteHoursError) {
      return errorResponse('operating_hours_replace_failed', 'Failed to reset operating hours', 500, deleteHoursError.message);
    }

    if (body.operating_hours.length > 0) {
      const { error: insertHoursError } = await supabase
        .schema('app')
        .from('operating_hours')
        .insert(
          body.operating_hours.map((item) => ({
            day: item.day,
            open_time: item.open_time,
            close_time: item.close_time,
            is_closed: item.is_closed ?? false,
          }))
        );

      if (insertHoursError) {
        return errorResponse('operating_hours_replace_failed', 'Failed to save operating hours', 500, insertHoursError.message);
      }
    }
  }

  if (body.tables !== undefined) {
    const { error: deleteTablesError } = await supabase
      .schema('app')
      .from('restaurant_tables')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteTablesError) {
      return errorResponse('tables_replace_failed', 'Failed to reset restaurant tables', 500, deleteTablesError.message);
    }

    if (body.tables.length > 0) {
      const { error: insertTablesError } = await supabase
        .schema('app')
        .from('restaurant_tables')
        .insert(
          body.tables.map((table) => ({
            number: table.number,
            name: table.name.trim(),
            capacity: table.capacity,
            is_active: table.is_active ?? true,
          }))
        );

      if (insertTablesError) {
        return errorResponse('tables_replace_failed', 'Failed to save restaurant tables', 500, insertTablesError.message);
      }
    }
  }

  return getSettings(req);
}

async function createTable(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  let body: TableBody;

  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  if (typeof body.number !== 'number' || !body.name?.trim() || typeof body.capacity !== 'number') {
    return errorResponse('validation_error', 'number, name and capacity are required', 422);
  }

  const { data, error } = await supabase
    .schema('app')
    .from('restaurant_tables')
    .insert({
      number: body.number,
      name: body.name.trim(),
      capacity: body.capacity,
      is_active: body.is_active ?? true,
    })
    .select('id, number, name, capacity, is_active')
    .single();

  if (error || !data) {
    return errorResponse('table_create_failed', 'Failed to create table', 500, error?.message);
  }

  return jsonResponse(data as TableRow, 201);
}

async function updateTable(req: Request, tableId: string) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  let body: TableBody;

  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  const updatePayload: Record<string, unknown> = {};
  if (body.number !== undefined) {
    updatePayload.number = body.number;
  }
  if (body.name !== undefined) {
    updatePayload.name = body.name.trim();
  }
  if (body.capacity !== undefined) {
    updatePayload.capacity = body.capacity;
  }
  if (body.is_active !== undefined) {
    updatePayload.is_active = body.is_active;
  }

  const { data, error } = await supabase
    .schema('app')
    .from('restaurant_tables')
    .update(updatePayload)
    .eq('id', tableId)
    .select('id, number, name, capacity, is_active')
    .single();

  if (error || !data) {
    return errorResponse('table_update_failed', 'Failed to update table', 500, error?.message);
  }

  return jsonResponse(data as TableRow);
}

async function deleteTable(req: Request, tableId: string) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const { error } = await supabase
    .schema('app')
    .from('restaurant_tables')
    .delete()
    .eq('id', tableId);

  if (error) {
    return errorResponse('table_delete_failed', 'Failed to delete table', 500, error.message);
  }

  return jsonResponse({ success: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse();
  }

  const segments = getRouteSegments(req);

  if (req.method === 'GET' && segments.length === 0) {
    return getSettings(req);
  }

  if (req.method === 'PATCH' && segments.length === 0) {
    return patchSettings(req);
  }

  if (req.method === 'POST' && segments.length === 1 && segments[0] === 'tables') {
    return createTable(req);
  }

  if (req.method === 'PUT' && segments.length === 2 && segments[0] === 'tables') {
    return updateTable(req, segments[1]);
  }

  if (req.method === 'DELETE' && segments.length === 2 && segments[0] === 'tables') {
    return deleteTable(req, segments[1]);
  }

  return errorResponse('not_found', 'Route not found', 404, {
    method: req.method,
    path: segments,
  });
});
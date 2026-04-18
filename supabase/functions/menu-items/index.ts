import { createServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { errorResponse, jsonResponse, preflightResponse } from '../_shared/response.ts';

interface IngredientInput {
  name: string;
  allergen?: boolean;
}

interface MenuItemInput {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  image?: string;
  estimated_prep_time?: number;
  ingredients?: IngredientInput[];
  available?: boolean;
}

interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image: string | null;
  estimated_prep_time: number | null;
  available: boolean;
  created_at: string;
  updated_at: string;
}

interface IngredientRow {
  id: string;
  menu_item_id: string;
  name: string;
  allergen: boolean;
}

const menuItemColumns = 'id, name, description, price, category, image, estimated_prep_time, available, created_at, updated_at';

function getRouteSegments(req: Request): string[] {
  const { pathname } = new URL(req.url);
  const segments = pathname.split('/').filter(Boolean);
  const functionIndex = segments.indexOf('menu-items');

  return functionIndex >= 0 ? segments.slice(functionIndex + 1) : [];
}

async function requireUser(req: Request) {
  const serviceClient = createServiceClient();
  const { user, error } = await getAuthenticatedUser(req);

  if (error || !user) {
    return {
      supabase: null,
      response: errorResponse('unauthorized', 'Unauthorized', 401, error),
      user: null,
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
      user: null,
    };
  }

  if (profile.is_active === false || profile.role !== 'admin') {
    return {
      supabase: null,
      response: errorResponse('forbidden', 'Admin access required', 403),
      user: null,
    };
  }

  return { supabase: serviceClient, response: null, user };
}

function toMenuItem(row: MenuItemRow, ingredients: IngredientRow[]) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    price: row.price,
    category: row.category,
    image: row.image ?? undefined,
    estimated_prep_time: row.estimated_prep_time ?? undefined,
    ingredients: ingredients.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      allergen: ingredient.allergen,
    })),
    available: row.available,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadIngredients(supabase: ReturnType<typeof createUserClient>, menuItemIds: string[]) {
  if (menuItemIds.length === 0) {
    return new Map<string, IngredientRow[]>();
  }

  const { data, error } = await supabase
    .schema('app')
    .from('menu_item_ingredients')
    .select('id, menu_item_id, name, allergen')
    .in('menu_item_id', menuItemIds)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  const grouped = new Map<string, IngredientRow[]>();
  for (const ingredient of (data ?? []) as IngredientRow[]) {
    const existing = grouped.get(ingredient.menu_item_id) ?? [];
    existing.push(ingredient);
    grouped.set(ingredient.menu_item_id, existing);
  }

  return grouped;
}

async function listMenuItems(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const url = new URL(req.url);
  const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '20') || 20, 1), 100);
  const search = url.searchParams.get('search')?.trim();
  const category = url.searchParams.get('category')?.trim();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .schema('app')
    .from('menu_items')
    .select(menuItemColumns, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error, count } = await query;

  if (error) {
    return errorResponse('menu_items_fetch_failed', 'Failed to load menu items', 500, error.message);
  }

  const rows = (data ?? []) as MenuItemRow[];

  try {
    const ingredientsByMenuItem = await loadIngredients(supabase, rows.map((row) => row.id));
    const items = rows.map((row) => toMenuItem(row, ingredientsByMenuItem.get(row.id) ?? []));
    const total = count ?? rows.length;

    return jsonResponse({
      data: items,
      total,
      page,
      limit,
      total_pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (ingredientError) {
    const details = ingredientError instanceof Error ? ingredientError.message : ingredientError;
    return errorResponse('menu_item_ingredients_fetch_failed', 'Failed to load menu item ingredients', 500, details);
  }
}

async function getCategories(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const { data, error } = await supabase
    .schema('app')
    .from('menu_items')
    .select('category')
    .order('category', { ascending: true });

  if (error) {
    return errorResponse('categories_fetch_failed', 'Failed to load menu categories', 500, error.message);
  }

  const categories = Array.from(new Set((data ?? []).map((row) => row.category).filter(Boolean)));
  return jsonResponse(categories);
}

async function getMenuItem(req: Request, id: string) {
  const auth = await requireUser(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const { data, error } = await supabase
    .schema('app')
    .from('menu_items')
    .select(menuItemColumns)
    .eq('id', id)
    .single();

  if (error || !data) {
    return errorResponse('menu_item_not_found', 'Menu item not found', 404, error?.message);
  }

  try {
    const ingredientsByMenuItem = await loadIngredients(supabase, [id]);
    return jsonResponse(toMenuItem(data as MenuItemRow, ingredientsByMenuItem.get(id) ?? []));
  } catch (ingredientError) {
    const details = ingredientError instanceof Error ? ingredientError.message : ingredientError;
    return errorResponse('menu_item_ingredients_fetch_failed', 'Failed to load menu item ingredients', 500, details);
  }
}

function normalizeIngredientPayload(ingredients: IngredientInput[] | undefined) {
  return (ingredients ?? [])
    .filter((ingredient) => ingredient.name?.trim())
    .map((ingredient) => ({
      name: ingredient.name.trim(),
      allergen: ingredient.allergen ?? false,
    }));
}

async function createMenuItem(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  let body: MenuItemInput;

  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  if (!body.name?.trim() || typeof body.price !== 'number' || !body.category?.trim()) {
    return errorResponse('validation_error', 'name, price and category are required', 422);
  }

  const insertPayload = {
    name: body.name.trim(),
    description: body.description?.trim() || null,
    price: body.price,
    category: body.category.trim(),
    image: body.image?.trim() || null,
    estimated_prep_time: body.estimated_prep_time ?? null,
    available: body.available ?? true,
  };

  const { data, error } = await supabase
    .schema('app')
    .from('menu_items')
    .insert(insertPayload)
    .select(menuItemColumns)
    .single();

  if (error || !data) {
    return errorResponse('menu_item_create_failed', 'Failed to create menu item', 500, error?.message);
  }

  const ingredients = normalizeIngredientPayload(body.ingredients);
  if (ingredients.length > 0) {
    const { error: ingredientError } = await supabase
      .schema('app')
      .from('menu_item_ingredients')
      .insert(ingredients.map((ingredient) => ({ ...ingredient, menu_item_id: data.id })));

    if (ingredientError) {
      return errorResponse('menu_item_ingredients_create_failed', 'Failed to save menu item ingredients', 500, ingredientError.message);
    }
  }

  return getMenuItem(req, data.id);
}

async function updateMenuItem(req: Request, id: string) {
  const auth = await requireUser(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  let body: MenuItemInput;

  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  const updatePayload: Record<string, unknown> = {};

  if (body.name !== undefined) {
    updatePayload.name = body.name.trim();
  }
  if (body.description !== undefined) {
    updatePayload.description = body.description.trim() || null;
  }
  if (body.price !== undefined) {
    updatePayload.price = body.price;
  }
  if (body.category !== undefined) {
    updatePayload.category = body.category.trim();
  }
  if (body.image !== undefined) {
    updatePayload.image = body.image.trim() || null;
  }
  if (body.estimated_prep_time !== undefined) {
    updatePayload.estimated_prep_time = body.estimated_prep_time;
  }
  if (body.available !== undefined) {
    updatePayload.available = body.available;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase
      .schema('app')
      .from('menu_items')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      return errorResponse('menu_item_update_failed', 'Failed to update menu item', 500, error.message);
    }
  }

  if (body.ingredients !== undefined) {
    const { error: deleteIngredientsError } = await supabase
      .schema('app')
      .from('menu_item_ingredients')
      .delete()
      .eq('menu_item_id', id);

    if (deleteIngredientsError) {
      return errorResponse('menu_item_ingredients_delete_failed', 'Failed to replace menu item ingredients', 500, deleteIngredientsError.message);
    }

    const normalizedIngredients = normalizeIngredientPayload(body.ingredients);
    if (normalizedIngredients.length > 0) {
      const { error: insertIngredientsError } = await supabase
        .schema('app')
        .from('menu_item_ingredients')
        .insert(normalizedIngredients.map((ingredient) => ({ ...ingredient, menu_item_id: id })));

      if (insertIngredientsError) {
        return errorResponse('menu_item_ingredients_create_failed', 'Failed to save menu item ingredients', 500, insertIngredientsError.message);
      }
    }
  }

  return getMenuItem(req, id);
}

async function deleteMenuItem(req: Request, id: string) {
  const auth = await requireUser(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const { error } = await supabase
    .schema('app')
    .from('menu_items')
    .delete()
    .eq('id', id);

  if (error) {
    return errorResponse('menu_item_delete_failed', 'Failed to delete menu item', 500, error.message);
  }

  return jsonResponse({ success: true });
}

async function updateAvailability(req: Request, id: string) {
  const auth = await requireUser(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  let body: { available?: boolean };

  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  if (typeof body.available !== 'boolean') {
    return errorResponse('validation_error', 'available must be a boolean', 422);
  }

  const { error } = await supabase
    .schema('app')
    .from('menu_items')
    .update({ available: body.available })
    .eq('id', id);

  if (error) {
    return errorResponse('menu_item_availability_update_failed', 'Failed to update availability', 500, error.message);
  }

  return getMenuItem(req, id);
}

async function bulkUpdateAvailability(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  let body: { category?: string; available?: boolean };

  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  if (!body.category?.trim() || typeof body.available !== 'boolean') {
    return errorResponse('validation_error', 'category and available are required', 422);
  }

  const { data, error } = await supabase
    .schema('app')
    .from('menu_items')
    .update({ available: body.available })
    .eq('category', body.category.trim())
    .select('id');

  if (error) {
    return errorResponse('menu_items_bulk_update_failed', 'Failed to update category availability', 500, error.message);
  }

  return jsonResponse({ updated: (data ?? []).length });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse();
  }

  const segments = getRouteSegments(req);

  if (req.method === 'GET' && segments.length === 0) {
    return listMenuItems(req);
  }

  if (req.method === 'GET' && segments.length === 1 && segments[0] === 'categories') {
    return getCategories(req);
  }

  if (req.method === 'GET' && segments.length === 1) {
    return getMenuItem(req, segments[0]);
  }

  if (req.method === 'POST' && segments.length === 0) {
    return createMenuItem(req);
  }

  if (req.method === 'POST' && segments.length === 1 && segments[0] === 'upload') {
    return errorResponse('not_implemented', 'Image upload is not implemented yet', 501);
  }

  if (req.method === 'PUT' && segments.length === 1) {
    return updateMenuItem(req, segments[0]);
  }

  if (req.method === 'DELETE' && segments.length === 1) {
    return deleteMenuItem(req, segments[0]);
  }

  if (req.method === 'PATCH' && segments.length === 2 && segments[1] === 'availability') {
    return updateAvailability(req, segments[0]);
  }

  if (
    req.method === 'PATCH' &&
    segments.length === 2 &&
    segments[0] === 'bulk' &&
    segments[1] === 'availability'
  ) {
    return bulkUpdateAvailability(req);
  }

  return errorResponse('not_found', 'Route not found', 404, {
    method: req.method,
    path: segments,
  });
});
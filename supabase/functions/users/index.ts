import { createServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { errorResponse, jsonResponse, preflightResponse } from '../_shared/response.ts';

type UserRole = 'waiter' | 'kitchen' | 'manager' | 'admin';

interface UserProfileRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateUserBody {
  email?: string;
  name?: string;
  role?: UserRole;
  password?: string;
}

interface UpdateUserBody {
  name?: string;
  role?: UserRole;
  is_active?: boolean;
}

function getRouteSegments(req: Request): string[] {
  const { pathname } = new URL(req.url);
  const segments = pathname.split('/').filter(Boolean);
  const functionIndex = segments.indexOf('users');

  return functionIndex >= 0 ? segments.slice(functionIndex + 1) : [];
}

function generateTemporaryPassword() {
  return `Tmp${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}!`;
}

function toUser(profile: UserProfileRow) {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    is_active: profile.is_active,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

async function requireAdmin(req: Request) {
  const { user, error } = await getAuthenticatedUser(req);
  const serviceClient = createServiceClient();

  if (error || !user) {
    return {
      supabase: null,
      user: null,
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
      user: null,
      response: errorResponse('profile_not_found', 'Profile not found', 404, profileError?.message),
    };
  }

  if (profile.is_active === false || profile.role !== 'admin') {
    return {
      supabase: null,
      user: null,
      response: errorResponse('forbidden', 'Admin access required', 403),
    };
  }

  return {
    supabase: serviceClient,
    user,
    response: null,
  };
}

async function listUsers(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const url = new URL(req.url);
  const role = url.searchParams.get('role')?.trim() as UserRole | null;
  const pageParam = url.searchParams.get('page');
  const limitParam = url.searchParams.get('limit');
  const paginated = pageParam !== null || limitParam !== null;

  let query = supabase
    .schema('app')
    .from('user_profiles')
    .select('id, email, name, role, is_active, created_at, updated_at', {
      count: paginated ? 'exact' : undefined,
    })
    .order('created_at', { ascending: false });

  if (role) {
    query = query.eq('role', role);
  }

  if (paginated) {
    const page = Math.max(Number(pageParam ?? '1') || 1, 1);
    const limit = Math.min(Math.max(Number(limitParam ?? '20') || 20, 1), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);

    if (error) {
      return errorResponse('users_fetch_failed', 'Failed to load users', 500, error.message);
    }

    const items = ((data ?? []) as UserProfileRow[]).map(toUser);
    const total = count ?? items.length;

    return jsonResponse({
      data: items,
      total,
      page,
      limit,
      total_pages: Math.max(Math.ceil(total / limit), 1),
    });
  }

  const { data, error } = await query;

  if (error) {
    return errorResponse('users_fetch_failed', 'Failed to load users', 500, error.message);
  }

  return jsonResponse(((data ?? []) as UserProfileRow[]).map(toUser));
}

async function getUserById(req: Request, id: string) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const { data, error } = await supabase
    .schema('app')
    .from('user_profiles')
    .select('id, email, name, role, is_active, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) {
    return errorResponse('user_not_found', 'User not found', 404, error?.message);
  }

  return jsonResponse(toUser(data as UserProfileRow));
}

async function createUser(req: Request) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  let body: CreateUserBody;

  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  if (!body.email?.trim() || !body.name?.trim() || !body.role) {
    return errorResponse('validation_error', 'email, name and role are required', 422);
  }

  const password = body.password?.trim() || generateTemporaryPassword();

  const { data: createdAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
    email: body.email.trim(),
    password,
    email_confirm: true,
    user_metadata: {
      name: body.name.trim(),
      role: body.role,
    },
  });

  if (createAuthError || !createdAuthUser.user) {
    return errorResponse('user_create_failed', 'Failed to create auth user', 500, createAuthError?.message);
  }

  const { data: profile, error: profileError } = await supabase
    .schema('app')
    .from('user_profiles')
    .insert({
      id: createdAuthUser.user.id,
      email: body.email.trim(),
      name: body.name.trim(),
      role: body.role,
      is_active: true,
    })
    .select('id, email, name, role, is_active, created_at, updated_at')
    .single();

  if (profileError || !profile) {
    await supabase.auth.admin.deleteUser(createdAuthUser.user.id).catch(() => undefined);
    return errorResponse('profile_create_failed', 'Failed to create user profile', 500, profileError?.message);
  }

  return jsonResponse(
    {
      ...toUser(profile as UserProfileRow),
      temporary_password: password,
    },
    201
  );
}

async function updateUser(req: Request, id: string) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  let body: UpdateUserBody;

  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  const updatePayload: Record<string, unknown> = {};
  if (body.name !== undefined) {
    updatePayload.name = body.name.trim();
  }
  if (body.role !== undefined) {
    updatePayload.role = body.role;
  }
  if (body.is_active !== undefined) {
    updatePayload.is_active = body.is_active;
  }

  if (Object.keys(updatePayload).length === 0) {
    return getUserById(req, id);
  }

  const { error } = await supabase
    .schema('app')
    .from('user_profiles')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    return errorResponse('user_update_failed', 'Failed to update user', 500, error.message);
  }

  return getUserById(req, id);
}

async function deleteUser(req: Request, id: string) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const { error } = await supabase.auth.admin.deleteUser(id);

  if (error) {
    return errorResponse('user_delete_failed', 'Failed to delete user', 500, error.message);
  }

  return jsonResponse({ success: true });
}

async function resetPassword(req: Request, id: string) {
  const auth = await requireAdmin(req);
  if (auth.response) {
    return auth.response;
  }

  const { supabase } = auth;
  const temporaryPassword = generateTemporaryPassword();

  const { error } = await supabase.auth.admin.updateUserById(id, {
    password: temporaryPassword,
  });

  if (error) {
    return errorResponse('password_reset_failed', 'Failed to reset password', 500, error.message);
  }

  return jsonResponse({ temporary_password: temporaryPassword });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse();
  }

  const segments = getRouteSegments(req);

  if (req.method === 'GET' && segments.length === 0) {
    return listUsers(req);
  }

  if (req.method === 'GET' && segments.length === 1) {
    return getUserById(req, segments[0]);
  }

  if (req.method === 'POST' && segments.length === 0) {
    return createUser(req);
  }

  if (req.method === 'PUT' && segments.length === 1) {
    return updateUser(req, segments[0]);
  }

  if (req.method === 'DELETE' && segments.length === 1) {
    return deleteUser(req, segments[0]);
  }

  if (req.method === 'POST' && segments.length === 2 && segments[1] === 'reset-password') {
    return resetPassword(req, segments[0]);
  }

  return errorResponse('not_found', 'Route not found', 404, {
    method: req.method,
    path: segments,
  });
});
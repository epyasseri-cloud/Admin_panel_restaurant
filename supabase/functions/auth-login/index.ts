import { createServiceClient } from '../_shared/supabase.ts';
import { errorResponse, preflightResponse, successResponse } from '../_shared/response.ts';

interface LoginBody {
  email?: string;
  password?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse();
  }

  if (req.method === 'GET') {
    return successResponse(
      {
        status: 'ok',
        function: 'auth-login',
        expected_method: 'POST',
      },
      'health_check'
    );
  }

  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Only POST is allowed', 405, {
      received_method: req.method,
    });
  }

  let body: LoginBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  if (!body.email || !body.password) {
    return errorResponse('validation_error', 'email and password are required', 422);
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error || !data.user || !data.session) {
    return errorResponse('invalid_credentials', 'Invalid credentials', 401, error?.message);
  }

  const { data: profile, error: profileError } = await supabase
    .schema('app')
    .from('user_profiles')
    .select('id, email, name, role, is_active')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    return errorResponse('profile_not_found', 'User profile not found in app.user_profiles', 403, profileError?.message);
  }

  if (profile.is_active === false) {
    return errorResponse('user_inactive', 'User is inactive', 403);
  }

  if (profile.role !== 'admin') {
    return errorResponse('role_forbidden', 'Admin role is required', 403, { role: profile.role });
  }

  return successResponse(
    {
      token: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: 'Bearer',
      },
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
      },
    },
    'login_success'
  );
});

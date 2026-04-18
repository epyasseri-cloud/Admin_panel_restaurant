import { createUserClient } from '../_shared/supabase.ts';
import { errorResponse, successResponse } from '../_shared/response.ts';

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return errorResponse('method_not_allowed', 'Only GET is allowed', 405);
  }

  const supabase = createUserClient(req);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse('unauthorized', 'Unauthorized', 401, authError?.message);
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, email, name, role, is_active')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return errorResponse('profile_not_found', 'Profile not found', 404, error?.message);
  }

  if (profile.role !== 'admin' || profile.is_active === false) {
    return errorResponse('forbidden', 'Admin access required', 403);
  }

  return successResponse(
    {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
    },
    'ok'
  );
});

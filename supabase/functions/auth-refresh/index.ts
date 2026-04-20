import { createServiceClient } from '../_shared/supabase.ts';
import { errorResponse, preflightResponse, successResponse } from '../_shared/response.ts';

interface RefreshBody {
  refresh_token?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse();
  }

  if (req.method === 'GET') {
    return successResponse(
      {
        status: 'ok',
        function: 'auth-refresh',
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

  let body: RefreshBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  if (!body.refresh_token) {
    return errorResponse('validation_error', 'refresh_token is required', 422);
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: body.refresh_token,
  });

  if (error || !data.session) {
    return errorResponse('invalid_refresh_token', 'Unable to refresh session', 401, error?.message);
  }

  return successResponse(
    {
      token: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: 'Bearer',
      },
    },
    'refresh_success'
  );
});

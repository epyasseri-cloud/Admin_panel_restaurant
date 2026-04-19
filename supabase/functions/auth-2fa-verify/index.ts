import { createServiceClient, getAuthenticatedUser } from '../_shared/supabase.ts';
import { errorResponse, preflightResponse, successResponse } from '../_shared/response.ts';

interface VerifyBody {
  challenge_id?: string;
  totp_code?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse();
  }

  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Only POST is allowed', 405);
  }

  const { user, error: authError } = await getAuthenticatedUser(req);

  if (authError || !user) {
    return errorResponse('unauthorized', 'Unauthorized', 401, authError);
  }

  let body: VerifyBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  if (!body.challenge_id || !body.totp_code) {
    return errorResponse('validation_error', 'challenge_id and totp_code are required', 422);
  }

  if (!/^\d{6}$/.test(body.totp_code)) {
    return errorResponse('invalid_totp_code', 'totp_code must be a 6-digit code', 422);
  }

  const supabase = createServiceClient();

  const { data: challenge, error: challengeError } = await supabase
    .schema('app')
    .from('two_factor_challenges')
    .select('id, challenge_id, user_id, action, expires_at, consumed_at')
    .eq('challenge_id', body.challenge_id)
    .eq('user_id', user.id)
    .single();

  if (challengeError || !challenge) {
    return errorResponse('challenge_not_found', 'Challenge not found', 404, challengeError?.message);
  }

  if (challenge.consumed_at) {
    return errorResponse('challenge_already_used', 'Challenge already consumed', 409);
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return errorResponse('challenge_expired', 'Challenge expired', 410);
  }

  const { error: consumeError } = await supabase
    .schema('app')
    .from('two_factor_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', challenge.id)
    .is('consumed_at', null);

  if (consumeError) {
    return errorResponse('challenge_consume_failed', 'Could not consume challenge', 500, consumeError.message);
  }

  return successResponse(
    {
      success: true,
      message: '2FA verification completed',
      challenge_id: challenge.challenge_id,
      action: challenge.action,
    },
    'two_factor_verified'
  );
});

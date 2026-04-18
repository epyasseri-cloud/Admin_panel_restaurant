import { createServiceClient, createUserClient } from '../_shared/supabase.ts';
import { errorResponse, successResponse } from '../_shared/response.ts';

interface ChallengeBody {
  action?: string;
}

function generateChallengeId() {
  return crypto.randomUUID().replace(/-/g, '');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Only POST is allowed', 405);
  }

  const userClient = createUserClient(req);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return errorResponse('unauthorized', 'Unauthorized', 401, userError?.message);
  }

  let body: ChallengeBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'Invalid JSON body', 400);
  }

  if (!body.action) {
    return errorResponse('validation_error', 'action is required', 422);
  }

  const challengeId = generateChallengeId();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const adminClient = createServiceClient();
  const { error } = await adminClient.from('two_factor_challenges').insert({
    challenge_id: challengeId,
    user_id: user.id,
    action: body.action,
    expires_at: expiresAt,
  });

  if (error) {
    return errorResponse('challenge_create_failed', 'Could not create challenge', 500, error.message);
  }

  return successResponse(
    {
      challenge_id: challengeId,
      action: body.action,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    'challenge_created',
    201
  );
});

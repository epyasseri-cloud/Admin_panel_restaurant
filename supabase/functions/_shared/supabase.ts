import { createClient } from 'jsr:@supabase/supabase-js@2';

export function createUserClient(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';

  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  );
}

export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');

  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

export async function getAuthenticatedUser(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    return {
      user: null,
      error: 'Missing bearer token',
    };
  }

  const serviceClient = createServiceClient();
  const {
    data: { user },
    error,
  } = await serviceClient.auth.getUser(token);

  return {
    user,
    error: error?.message ?? null,
  };
}

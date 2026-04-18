export interface ApiErrorPayload {
  code: string;
  details?: unknown;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-timestamp',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

export function preflightResponse(): Response {
  return new Response('ok', {
    status: 200,
    headers: {
      ...corsHeaders,
    },
  });
}

export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function successResponse<T>(data: T, message = 'ok', status = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      message,
      error: null,
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): Response {
  const error: ApiErrorPayload = { code, details };

  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      message,
      error,
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

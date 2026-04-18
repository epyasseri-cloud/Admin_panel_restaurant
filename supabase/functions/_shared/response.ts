export interface ApiErrorPayload {
  code: string;
  details?: unknown;
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
        'Content-Type': 'application/json',
      },
    }
  );
}

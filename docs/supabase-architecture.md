# Arquitectura Recomendada: Supabase + Edge Functions (Gratis)

Este documento implementa la opcion recomendada para el Modulo 3:

- Base de datos: Supabase PostgreSQL
- API: Supabase Edge Functions
- Contrato de respuesta: Opcion B (`success`, `data`, `message`, `error`)

## 1) Estructura creada

- `supabase/config.toml`
- `supabase/migrations/20260418_000001_module3_schema.sql`
- `supabase/functions/_shared/response.ts`
- `supabase/functions/_shared/supabase.ts`
- `supabase/functions/auth-login/index.ts`
- `supabase/functions/auth-me/index.ts`
- `supabase/functions/auth-2fa-challenge/index.ts`

## 2) Modelo de datos inicial

El esquema `app` incluye:

- `user_profiles`
- `menu_items`
- `menu_item_ingredients`
- `restaurant_settings`
- `operating_hours`
- `restaurant_tables`
- `audit_logs`
- `two_factor_challenges`

Incluye:

- trigger `updated_at`
- funciones `app.current_user_role()` y `app.is_admin()`
- RLS habilitado con politicas admin para operaciones de gestion

## 3) Convencion Opcion B

Respuesta exitosa:

```json
{
  "success": true,
  "data": {},
  "message": "ok",
  "error": null
}
```

Respuesta con error:

```json
{
  "success": false,
  "data": null,
  "message": "Validation failed",
  "error": {
    "code": "validation_error",
    "details": {}
  }
}
```

## 4) Variables requeridas para funciones

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 5) Siguiente implementacion recomendada (orden)

1. `auth-2fa-verify`
2. `users-list`, `users-create`, `users-update`, `users-delete`
3. `menu-items-list`, `menu-items-create`, `menu-items-update`, `menu-items-delete`
4. `settings-get`, `settings-patch`, `settings-table-*`
5. `reports-generate`, `reports-export-*`
6. `audit-list`, `audit-export`

## 6) Nota de integracion con frontend actual

El frontend actualmente espera respuestas planas en varios servicios (`return response.data`).
Al adoptar Opcion B en API central, el cliente debe normalizar `response.data.data` o usar un interceptor que desempaquete el envelope.

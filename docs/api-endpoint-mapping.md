# Mapeo de Endpoints Frontend (Modulo 3)

Este documento alinea los servicios del frontend con el contrato propuesto en `docs/openapi.module3.yaml`.

## AuthService

- login(email, password) -> POST /auth/login
- logout() -> POST /auth/logout
- verifyToken() -> GET /auth/me
- createTwoFactorChallenge(action) -> POST /auth/2fa/challenge
- verifyTwoFactor({ challenge_id, totp_code }) -> POST /auth/2fa/verify
- setupTwoFactor() -> POST /auth/2fa/setup
- confirmTwoFactorSetup(totp_code) -> POST /auth/2fa/confirm
- disableTwoFactor(totp_code) -> POST /auth/2fa/disable

## MenuItemService

- getMenuItems(page, limit) -> GET /menu-items?page=&limit=
- searchMenuItems(query, category) -> GET /menu-items?search=&category=
- getMenuItemById(id) -> GET /menu-items/{id}
- createMenuItem(data) -> POST /menu-items
- createMenuItemWithImage(data, file) -> POST /menu-items/upload (multipart/form-data)
- updateMenuItem(id, data) -> PUT /menu-items/{id}
- deleteMenuItem(id) -> DELETE /menu-items/{id}
- updateAvailability(id, available, reason) -> PATCH /menu-items/{id}/availability
- bulkUpdateAvailability(category, available) -> PATCH /menu-items/bulk/availability
- getCategories() -> GET /menu-items/categories

## UserService

- getUsers(page, limit, role) -> GET /users?page=&limit=&role=
- getUserById(id) -> GET /users/{id}
- createUser(data) -> POST /users
- updateUser(id, data) -> PUT /users/{id}
- deleteUser(id) -> DELETE /users/{id}
- resetPassword(userId) -> POST /users/{id}/reset-password
- getWaiters() -> GET /users?role=waiter

## SettingsService

- getSettings() -> GET /settings
- updateRestaurantName(name) -> PATCH /settings
- updateOperatingHours(hours) -> PATCH /settings
- updateTables(tables) -> PATCH /settings
- createTable(table) -> POST /settings/tables
- updateTable(tableId, updates) -> PUT /settings/tables/{id}
- deleteTable(tableId) -> DELETE /settings/tables/{id}

## ReportService

- generateReport(filter) -> GET /reports?from_date=&to_date=&group_by=&waiter_id=&table_id=&dish_id=
- exportReportCSV(filter) -> GET /reports/export/csv
- exportReportPDF(filter) -> GET /reports/export/pdf
- getSalesStats(period) -> GET /reports/stats?period=

## AuditLogService

- getAuditLogs(page, limit, filter) -> GET /audit-log?page=&limit=&from_date=&to_date=&event_type=&user_id=&resource_type=
- getAuditLogById(id) -> GET /audit-log/{id}
- exportAuditLogs(filter) -> GET /audit-log/export/csv

## Observaciones para API central

- Estandarizar envelope de respuesta: decidir entre respuesta plana o `{ success, data, message }` para todos los endpoints.
- Exportaciones CSV/PDF: el cliente actual usa `apiClient.get`; para mayor robustez conviene soportar `responseType: blob` en backend y cliente.
- Errores: definir contrato unificado para 400/401/403/404/422/500 con codigo interno y mensaje.
- 2FA: acordar expiracion del challenge y codigos de error para challenge expirado o invalido.
- Auditoria: validar que `X-User-ID` y `X-Timestamp` se acepten/validen del lado backend o se ignoren de forma segura.

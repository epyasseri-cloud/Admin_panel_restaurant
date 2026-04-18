# Supabase Setup Paso a Paso

Esta guia cubre la configuracion completa para este proyecto:

- Frontend React (Vite)
- Base de datos y migraciones
- Auth
- Edge Functions
- Secrets seguros (Opcion B de envelope API)

## 0) Recomendacion de seguridad antes de empezar

Como ya compartiste una service role key, es recomendable rotarla antes de produccion.

En Supabase Dashboard:

1. Entra al proyecto.
2. Ve a Settings > API.
3. Ubica la seccion Project API keys.
4. Rota la secret key y reemplazala en tus secretos de servidor.

Nunca uses la secret key en frontend.

## 1) Paneles de Supabase que vas a usar

Dentro de tu proyecto en https://supabase.com/dashboard/project/cohlhobfkbzpqtcaqqxb:

1. Settings > API
	Aqui copias URL del proyecto y keys.
2. SQL Editor
	Aqui ejecutas SQL manual y verificaciones.
3. Authentication > Providers
	Aqui habilitas Email/Password.
4. Authentication > URL Configuration
	Aqui configuras Site URL y Redirect URLs.
5. Edge Functions
	Aqui revisas deploy y logs de funciones.
6. Database > Tables
	Aqui verificas que las tablas se hayan creado.

## 2) Configuracion Frontend (ya aplicada en el proyecto)

Archivo local del proyecto:

- [ .env.local ](.env.local)

Debe contener:

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_API_BASE_URL (apuntando a /functions/v1 si usas Edge Functions)

Referencia de variables ejemplo:

- [ .env.example ](.env.example)

Cliente Supabase usado por frontend:

- [ src/lib/supabase.ts ](src/lib/supabase.ts)

## 3) Configurar Auth en Supabase Dashboard

En Authentication > Providers:

1. Habilita Email provider.
2. Confirma que Allow email signups este activado para entorno dev.

En Authentication > URL Configuration:

1. Site URL: http://localhost:5173
2. Additional Redirect URLs: agrega http://localhost:5173

## 4) Aplicar esquema de base de datos

Tienes migracion inicial en:

- [ supabase/migrations/20260418_000001_module3_schema.sql ](supabase/migrations/20260418_000001_module3_schema.sql)

Opcion A (recomendada con CLI):

1. Instala Supabase CLI.

	Windows (elige una):

	- Winget: winget install Supabase.CLI
	- Scoop: scoop install supabase
	- Chocolatey: choco install supabase

	Verifica instalacion:

	- supabase --version

2. En terminal del proyecto ejecuta:
	supabase login
3. Vincula proyecto:
	supabase link --project-ref cohlhobfkbzpqtcaqqxb
4. Aplica migraciones remotas:
	supabase db push

Opcion B (manual):

1. Abre SQL Editor en dashboard.
2. Pega el contenido de la migracion.
3. Ejecuta Run.
4. Verifica tablas en Database > Tables (schema app).

## 5) Configurar secrets para Edge Functions

No guardar estos valores en .env.local del frontend.

En terminal local del proyecto:

1. Login y link si no lo hiciste:
	supabase login
	supabase link --project-ref cohlhobfkbzpqtcaqqxb

2. Registra secretos:
	Nota: no intentes setear variables que empiecen por SUPABASE_.
	Esos nombres son reservados por Supabase y el CLI los bloquea.

	Si necesitas secretos propios, usa prefijos de aplicacion (ejemplo APP_):
	supabase secrets set APP_ENV=dev
	supabase secrets set APP_JWT_AUDIENCE=admin-panel

3. Lista secretos cargados:
	supabase secrets list

En Edge Functions desplegadas, Supabase ya inyecta automaticamente:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

## 6) Deploy de Edge Functions base

Funciones preparadas en:

- [ supabase/functions/auth-login/index.ts ](supabase/functions/auth-login/index.ts)
- [ supabase/functions/auth-me/index.ts ](supabase/functions/auth-me/index.ts)
- [ supabase/functions/auth-2fa-challenge/index.ts ](supabase/functions/auth-2fa-challenge/index.ts)

Utilidades compartidas:

- [ supabase/functions/_shared/response.ts ](supabase/functions/_shared/response.ts)
- [ supabase/functions/_shared/supabase.ts ](supabase/functions/_shared/supabase.ts)

Deploy:

1. supabase functions deploy auth-login --no-verify-jwt
2. supabase functions deploy auth-me
3. supabase functions deploy auth-2fa-challenge

Inspeccion de logs:

1. Supabase Dashboard > Edge Functions > selecciona funcion > Logs
2. O CLI: supabase functions logs --name auth-login

## 7) Prueba rapida de conectividad

1. Levanta frontend:
	npm run dev
2. Intenta login desde UI.
3. Si falla:
	- revisa variables en .env.local
	- revisa Auth provider y URL configuration
	- revisa logs de Edge Functions

Prueba directa en PowerShell para auth-login (evita problemas de escape de curl):

1. Define headers y body:

   $headers = @{ apikey = "TU_PUBLISHABLE_KEY" }
   $body = @{ email = "TU_EMAIL"; password = "TU_PASSWORD" } | ConvertTo-Json

2. Ejecuta request:

   Invoke-RestMethod -Method POST -Uri "https://cohlhobfkbzpqtcaqqxb.supabase.co/functions/v1/auth-login" -Headers $headers -ContentType "application/json" -Body $body

3. Si sale 400, ejecuta este bloque para ver el body real del error:

	try {
	  Invoke-RestMethod -Method POST -Uri "https://cohlhobfkbzpqtcaqqxb.supabase.co/functions/v1/auth-login" -Headers $headers -ContentType "application/json" -Body $body
	} catch {
	  $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
	  $reader.BaseStream.Position = 0
	  $reader.DiscardBufferedData()
	  $responseBody = $reader.ReadToEnd()
	  Write-Host "HTTP Status:" $_.Exception.Response.StatusCode.value__
	  Write-Host "Response Body:" $responseBody
	}

4. Tambien puedes usar version one-line (sin saltos) para evitar que PowerShell interprete parametros por separado:

	Invoke-RestMethod -Method POST -Uri "https://cohlhobfkbzpqtcaqqxb.supabase.co/functions/v1/auth-login" -Headers @{apikey="TU_PUBLISHABLE_KEY"} -ContentType "application/json" -Body (@{email="TU_EMAIL";password="TU_PASSWORD"} | ConvertTo-Json)

## 8) Donde vive cada tipo de clave

Frontend:

- permitido: publishable key
- prohibido: service role key

Servidor/Edge Functions:

- permitido: service role key

## 9) Checklist final

1. Frontend compila con npm run build.
2. Tablas del schema app creadas.
3. Auth Email activado.
4. Secrets cargados en Supabase.
5. Edge Functions desplegadas.
6. Login devuelve envelope Opcion B (success, data, message, error).

# Admin Restaurant - Módulo 3: Panel de Administración

Panel de administración completo para gestión de restaurantes, incluyendo CRUD de menú, gestión de usuarios, configuración, reportes y auditoría.

## Características Principales

### CRUD de Ítems del Menú (RF-10, RF-11)
- Crear, leer, actualizar y eliminar ítems del menú
- Gestión de disponibilidad base de ítems
- Upload de imágenes
- Gestión de ingredientes con alérgenos
- Filtros y búsqueda avanzada
- 2FA requerido para cambios de precio

### Gestión de Usuarios (RF-12b)
- CRUD completo de usuarios
- Asignación de roles (mesero, cocina, gerente, admin)
- Generación de contraseñas temporales
- 2FA requerido para eliminación de usuarios

### Configuración (RF-12c)
- Configuración de horarios de operación
- Gestión de mesas del restaurante
- Configuración de moneda y zona horaria

### Reportes (RF-12a)
- Reportes de ventas por periodo
- Agrupación por: fecha, mesa, mesero, platillo
- Visualización con gráficos interactivos
- Exportación a CSV y PDF

### Auditoría (RF-12d, RF-14)
- Historial completo de cambios
- Filtros por fecha, usuario, tipo de evento
- Exportación de registros
- Registro automático de todas las acciones

### Autenticación y Seguridad (RNF-11, RNF-12, RNF-13)
- JWT basado en autenticación
- HTTPS requerido
- 2FA (TOTP) para acciones críticas

## Stack Tecnológico

- **Frontend**: React 19 + Vite
- **Lenguaje**: TypeScript
- **Formularios**: React Hook Form + Zod
- **UI Components**: shadcn/ui + Radix UI
- **Tablas**: TanStack Table
- **Gráficos**: Recharts
- **Estado**: Zustand
- **HTTP Client**: Axios
- **Enrutamiento**: React Router v7
- **Estilos**: Tailwind CSS
- **Testing**: Vitest + React Testing Library

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
npm run test
npx vitest run
npm run build
```

## Pruebas Implementadas

Se agregó una base de pruebas unitarias para revisión funcional antes de la integración con API central y base de datos.

- `src/services/menu-item.service.test.ts`: pruebas de CRUD de menú y categorías con mocks de API.
- `src/services/user.service.test.ts`: pruebas de gestión de usuarios y reset de contraseña.
- `src/services/auth.service.test.ts`: pruebas de login, verificación de token y flujo 2FA.
- `src/utils/validation.schemas.test.ts`: validaciones de formularios críticos con Zod.
- `src/store/auth.store.test.ts`: estado de autenticación (setUser/logout).

Resultado actual de ejecución:

- **Test Files**: 5 passed
- **Tests**: 22 passed

## Estructura del Proyecto

```
src/
├── components/
│   ├── ui/                 # Componentes UI base
│   ├── layout/             # Layout components
│   ├── auth/               # Autenticación
│   └── menu-items/         # Menú
├── pages/                  # Páginas
├── services/               # Servicios API
├── store/                  # Estado (Zustand)
├── types/                  # TypeScript types
├── utils/                  # Utilidades
└── test/                   # Testing
```

## Variables de Entorno

```
VITE_API_BASE_URL=https://api.restaurant.local
```

## Licencia

Propietario - Restaurant Admin System

# Alcance de tests unitarios — primera iteración

Documento de alcance para la introducción de tests unitarios en `tasks-core-api`.
Define qué módulos entran en la primera iteración, con qué prioridad y con qué objetivo
de cobertura. El tooling (framework, mocks, scripts, CI) se define e implementa en las
tarjetas siguientes del board (tareas #30 y #31).

## Objetivo

Cubrir con tests unitarios **deterministas y sin dependencias externas** (DB y servicios
externos mockeados) la lógica de negocio crítica de la API: autenticación, autorización
y las operaciones principales de tareas. Los tests de integración/E2E contra una DB real
quedan explícitamente **fuera** de esta iteración.

## Inventario de módulos

La API se organiza en capas por recurso (ver [CLAUDE.md](../CLAUDE.md), R1):
`app/api/**/route.ts` → `src/domain/<res>/{service,repository,resource,schema}` sobre
`src/domain/base/` + helpers de `src/lib/`.

| Área | Módulos | Endpoints principales |
|---|---|---|
| Auth | `src/lib/auth/{jwt,password,context,reset-token}`, `src/domain/auth/*` | `POST /api/auth/login`, `me`, `refresh`, `logout`, `forgot-password`, `reset-password`, `mcp-token` |
| OAuth (MCP) | `src/domain/oauth/*` | `POST /api/oauth/register`, `GET /api/oauth/authorize`, `POST /api/oauth/code`, `POST /api/oauth/token` |
| Tasks | `src/domain/tasks/*` | CRUD `/api/tasks`, `POST /api/tasks/{id}/move`, `select` |
| Time entries | `src/domain/time-entries/*` | `/api/time-entries`, `GET /running`, `POST /api/tasks/{id}/time/start|stop` |
| Board columns | `src/domain/board-columns/*` | CRUD, `POST /{id}/move`, `DELETE ?moveToColumnId=` |
| Users | `src/domain/users/*` | CRUD, invitación por email, `POST /{id}/reset-password`, soft delete con tombstone |
| Base + lib | `src/domain/base/*`, `src/lib/{pagination,filters,validation,ids,str,html-text,colors}` | transversal a todos los recursos |
| Resto | clients, projects, proposals, boards, labels, comments, checklist-items, attachments, notifications, dashboard, ai, mcp | CRUD estándar / features no críticas |

## Priorización

### P1 — Críticos (obligatorios en esta iteración)

1. **Autenticación** (`src/lib/auth/*` + `src/domain/auth/*`)
   - Firma y verificación de JWT (`signToken`/`verifyToken`/`signMcpToken`): expiración,
     algoritmo, subject; `refreshToken` con ventana anclada al `iat` original.
   - Login: credenciales inválidas, usuario soft-deleted, usuario sin password (invitado
     que aún no la definió).
   - Forgot/reset password: respuesta 200 sin user enumeration, token single-use
     (sha256 + TTL), 422 con token inválido/expirado/usado.
2. **Autorización / permisos**
   - `getAuthUser` (`src/lib/auth/context.ts`): header ausente, formato inválido, token
     inválido → 401 `{ "message": "Unauthenticated." }`.
   - Reglas de negocio con permiso duro: start de timer solo para asignados (403),
     borrar el propio usuario autenticado (422).
   - OAuth del MCP: PKCE S256 obligatorio, validación de `redirect_uri`, code de 5 min,
     errores shape RFC 6749.
3. **Operaciones principales de tareas** (`src/domain/tasks/task.service.ts` + schema)
   - Create/update: validación Zod (campos requeridos, enums de prioridad, `assigneeIds`),
     estampado de `createdById`, resolución de posición en columna.
   - `move`: reordenamiento dentro y entre columnas, respeto del WIP limit (error 422 al
     estar llena), preservación del tag `projectId`.
   - Serialización (`task.resource.ts`): `id` string, fechas `d/m/Y H:i:s`, agregados de
     tracking (`trackedSeconds`, `runningEntries`), guardas de soft delete en relaciones.

### P2 — Alta prioridad (entran si no comprometen la fecha)

- **Time entries** (`time-entry.service.ts`): un timer por user (start auto-cierra el
  anterior), cálculo de `durationSeconds` en stop, filtros de duración/fechas.
- **Base layer** (`base.repository.ts`, `base.service.ts`, `crud-routes.ts`): paginación
  (clamp de `size`, `page_count`), `searchable/sortable/applyFilters`, formato de listado
  `{ data, total_items, page, size, page_count }`.
- **Users** (`user.service.ts`): create sin password + invitación, update con password
  vacía = no cambiarla, soft delete con tombstone de email, unicidad de email (422).
- **Board columns**: move/reorden y delete con reasignación de tareas.
- **Helpers de `src/lib`**: `pagination`, `validation`, `ids`, `str`, `html-text`,
  `colors` (funciones puras, alto retorno por test).

### P3 — Fuera del alcance de esta iteración

- CRUD estándar de clients, projects, proposals, boards, labels, comments,
  checklist-items (lo cubre la base layer testeada en P2).
- `attachments` (storage), `notifications`, `dashboard` (counts agregados).
- Generación IA (`ai/*`): solo se testeará la sanitización de drafts contra el snapshot
  si sobra tiempo; la llamada a OpenAI queda mockeada/fuera.
- Servidor MCP (`mcp-server.ts`): el wiring del SDK queda fuera; `mcp.service.ts` puede
  testearse más adelante como capa de datos.
- Rutas `app/api/**/route.ts` (wire-up fino) e integración con Prisma/Postgres real:
  se cubrirán con tests de integración en una iteración futura.

## Cobertura objetivo por módulo

Medida sobre statements/branches con la herramienta de coverage del framework elegido
(tarea #30). Los umbrales aplican **solo a los módulos incluidos**, no al repo entero.

| Módulo | Prioridad | Cobertura objetivo |
|---|---|---|
| `src/lib/auth/**` | P1 | ≥ 90% |
| `src/domain/auth/**` | P1 | ≥ 85% |
| `src/domain/oauth/**` | P1 | ≥ 85% |
| `src/domain/tasks/**` (service + schema + resource) | P1 | ≥ 85% |
| `src/domain/time-entries/**` | P2 | ≥ 80% |
| `src/domain/base/**` | P2 | ≥ 80% |
| `src/domain/users/**` | P2 | ≥ 75% |
| `src/domain/board-columns/**` | P2 | ≥ 75% |
| `src/lib/{pagination,validation,ids,str,html-text,colors}.ts` | P2 | ≥ 90% |
| Resto (P3) | P3 | sin objetivo en esta iteración |

Gate global sugerido para CI en esta iteración: **≥ 80% sobre el conjunto P1** (falla el
build por debajo). Los umbrales P2 son objetivo, no gate, hasta que ese código tenga sus
tests.

## Lineamientos técnicos (input para las tareas #30 y #31)

- **Determinismo**: mockear Prisma en la capa repository (los services se testean con
  repositorios falsos), `Date`/timers fake donde haya TTLs (JWT, reset tokens), y
  mockear mailer (SES), storage (Supabase) y OpenAI.
- **Framework sugerido**: Jest o Vitest con soporte TS nativo; la decisión final es de
  la tarea #30 (Vitest encaja bien con el stack ESM/TS del repo, Jest es el estándar
  más difundido — evaluar fricción con `jose`/ESM al configurar).
- Los tests viven junto al código (`*.test.ts` por módulo) o en `tests/` espejando
  `src/` — definir en la tarea #30 y mantener un solo criterio.
- Nada de red ni DB real en unit tests; los tests deben poder correr offline.

## Acceso

Este documento vive en el repo (`docs/unit-testing-scope.md`) y se referencia desde el
[README](../README.md). Cualquier ajuste de alcance se acuerda en el board (proyecto
Core Tasks) y se refleja acá.

# Core Tasks API — Reglas del proyecto

API **Next.js exclusiva** del panel `core-tasks-ui`. Next funciona **solo como API**
(App Router, sin páginas React). Este archivo es la fuente de verdad para Claude Code.

## Stack

- **Next.js 15** (App Router) — rutas en `app/api/**`, todo `runtime='nodejs'` + `dynamic='force-dynamic'`.
- **Prisma 6** sobre **Postgres de Supabase** (runtime por transaction pooler `:6543` con
  `pgbouncer=true`; migraciones por session pooler `:5432` vía `DIRECT_URL`).
- **Auth: JWT HS256** con `jose` (login/me/refresh/logout stateless) + `bcryptjs`.
- **Validación: Zod** (`parseAsync`, errores 422 shape Laravel).
- Dominio: **clients → projects → (boards → columnas) → proposals/tasks** + users (solo auth y
  select). Cada project tiene un board (1:1) + hay un board global; las tasks viven en columnas.

## Comandos

```bash
npm run dev              # next dev -> http://localhost:3002
npm run build            # prisma generate && next build
npm run typecheck        # tsc --noEmit
npx prisma migrate dev   # nueva migración (usa DIRECT_URL)
npm run db:seed          # seed idempotente
```

Usuario admin sembrado: **admin@coretasks.com / password**.

> El host directo `db.<ref>.supabase.co` es IPv6-only: desde redes sin IPv6 usar los
> hosts pooler (ver `.env.example`). La contraseña va **percent-encoded** en la URL.

---

## Contrato con el core-tasks-ui (NO romper)

### 1. Listados → formato paginado exacto

```json
{ "data": [ ... ], "total_items": 205, "page": 1, "size": 25, "page_count": 9 }
```

- Params: `?page=&size=` (+ filtros camelCase, `search`, `sort[<campo>]=asc|desc`).
- `size` clampeado a 100; `page_count = max(1, ceil(total/size))`; fallback `{ id: 'desc' }`.

### 2. Single / create / update → entidad plana con `id` string

Nunca `{ data: {...} }`. `id` siempre string (`strId`), nunca BigInt crudo (Response.json
lanza) ni `Decimal` como string donde va number. Fechas: `d/m/Y` (date) y `d/m/Y H:i:s`
(datetime), getters UTC.

### 3. Selects → `GET /<recurso>/select?q=`

Array **plano** (sin paginación): `[{ "label": "...", "value": "1", "data": { ... } }]`.
`take: 50`, filtro `?q` insensitive, solo registros activos cuando aplique.

### 4. camelCase afuera, snake_case adentro

La UI manda/espera **camelCase** (`clientId`, `startDate`). La DB es snake_case: lo absorbe
el schema de Prisma con `@map`. Los filtros de query también llegan **camelCase**.

### 5. Auth

- `POST /api/auth/login` `{ email, password }` → `{ token, token_type, expires_in, user }`.
- `GET /api/auth/me`, `POST /api/auth/refresh` (ventana anclada al `iat`), `POST /api/auth/logout`.
- Todo lo demás exige `Authorization: Bearer` → 401 `{ "message": "Unauthenticated." }`.

### 6. Errores

422 `{ message, errors: { campo: ["msg"] } }` (Zod, keys camelCase) · 404
`{ message: "Resource not found." }` · 500 `{ message: "Server Error." }`.

---

## Reglas (obligatorias)

### R1. Capas por recurso — siempre

`app/api/<res>/route.ts` (wire-up finito) → `src/domain/base/crud-routes.ts` (handlers
genéricos) → `<res>.service.ts` (extiende `BaseService`, hook `prepare()`) →
`<res>.repository.ts` (extiende `BaseRepository`: `searchable/sortable/include/applyFilters`)
→ `<res>.resource.ts` (serializer puro) + `<res>.schema.ts` (Zod store/update).
Nunca saltear capas; Prisma solo se toca en repositorios (excepción: `DashboardService`
con counts agregados).

### R2. Un dominio por recurso, reutilizá lo base

CRUD/paginación/serialización ya lo resuelven `crud-routes`/`BaseService`/`BaseRepository`.
Si un patrón nuevo es transversal, va a la base, no copiado por recurso.

### R3. Validación Zod por recurso

`store` y `update` en `<res>.schema.ts`; los update son **factory** `updateXSchema(id)` para
uniques con `exceptId`. Enums con `z.enum` (lowercase, idénticos a los de la UI). Body con
`req.json().catch(() => ({}))` — body inválido = 422, nunca 500.

### R4. Soft deletes

`Client/Project/Proposal/Task` usan `deleted_at`. La query extension de `src/lib/prisma.ts`
inyecta `deletedAt: null` en reads — pero **no alcanza los include anidados**: toda relación
eager-loaded se guarda a mano en el resource. `DELETE` = update de `deletedAt`.

### R5. Acciones especiales en el servicio

No-CRUD (ej. `POST /api/tasks/[id]/move`) = método del servicio del recurso con su ruta
propia y schema Zod dedicado. Mutaciones multi-fila en `$transaction`.

### R6. Auth en toda ruta nueva

`withRoute(withAuth(handler))` — el user llega como 3er parámetro. Solo `auth/login` y
`auth/refresh` quedan públicas.

### R7. Todo en inglés

Archivos, clases, variables, endpoints y responses. Español solo en las traducciones
de la UI (viven en su repo).

### R8. Nunca `migrate dev` sin querer contra prod

La DB es el Supabase real. Migraciones nuevas: `npx prisma migrate dev` (crea y aplica vía
`DIRECT_URL`) con intención explícita. Jamás `db push`.

---

## Estructura

```
app/api/                       # rutas (auth, clients, projects, boards, board-columns, proposals, tasks, users/select, dashboard)
middleware.ts                  # CORS para /api/* (CORS_ALLOWED_ORIGINS + localhost)
src/
  lib/                         # prisma (singleton + soft-delete ext + rawExists), pagination,
                               # route (withRoute/withAuth), http-error, zod-error, validation,
                               # filters, ids, str, env, auth/{jwt,password,context}
  resources/                   # serialize (fechas/strId) + user.resource
  domain/
    base/                      # base.repository, base.service, crud-routes
    auth/  clients/  projects/  boards/  board-columns/  proposals/  tasks/  users/  dashboard/
prisma/schema.prisma  prisma/seed.mjs
```

## Recursos

| Recurso   | Endpoint base    | Extra                                  |
|-----------|------------------|----------------------------------------|
| Auth      | `/api/auth/*`    | login/me/refresh/logout                |
| Clients   | `/api/clients`   | `GET /api/clients/select?q=`           |
| Projects  | `/api/projects`  | `select?q=&clientId=`; filtros clientId/status |
| Proposals | `/api/proposals` | filtros projectId/status; sentAt auto al pasar a `sent` |
| Boards    | `/api/boards`    | `select?q=`; filtros `projectId`/`scope=global`; 1 por proyecto + 1 global; columnas embebidas |
| Columns   | `/api/board-columns` | filtro `boardId`; `POST /{id}/move` (reordena); `DELETE ?moveToColumnId=` (reasigna tareas antes de borrar) |
| Tasks     | `/api/tasks`     | `POST /api/tasks/{id}/move` (`columnId`+position, reordena columna); filtros projectId/boardId/columnId/priority/assigneeId |
| Users     | `/api/users/select` | solo select (asignación de tareas)  |
| Dashboard | `/api/dashboard` | counts (`totalClients`, `activeProjects`, `pendingProposals`, `openTasks`, `tasksByColumn`) |

> Relaciones: un **project** tiene un **board** (1:1) y existe un **board global** (sin project).
> Cada board tiene **columnas** configurables (`BoardColumn`, una `isTerminal` marca "done" para el
> dashboard). Una **task** vive en una **columna** (`columnId`; el enum `status` fue **reemplazado**),
> con `projectId` opcional (denormalizado del board de la columna) y `assignee` (user) opcional.
> Enums lowercase compartidos con la UI: client `active|inactive`; project
> `draft|active|paused|completed|archived`; proposal `draft|sent|accepted|rejected`; task priority
> `low|medium|high|urgent`. Las columnas ya **no** son un enum: se gestionan por board.

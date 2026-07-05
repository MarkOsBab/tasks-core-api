# Core Tasks API

Next.js 15 (App Router, API-only) + Prisma 6 sobre Supabase Postgres. Backend exclusivo de
[`core-tasks-ui`](../core-tasks-ui). Dominio: clients → projects → proposals / tasks, con
auth JWT.

## Setup

```bash
cp .env.example .env   # completar credenciales de Supabase y JWT_SECRET
npm install            # corre prisma generate (postinstall)
npx prisma migrate deploy
npm run db:seed        # admin@coretasks.com / password
npm run dev            # http://localhost:3002
```

Sin Supabase a mano: `docker run -d --name core-tasks-db -e POSTGRES_PASSWORD=postgres \
-e POSTGRES_DB=core_tasks -p 5433:5432 postgres:16-alpine` y usar las URLs locales
comentadas en `.env.example`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | API en `http://localhost:3002` |
| `npm run build` | `prisma generate && next build` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:seed` | seed idempotente |

Contrato, reglas y estructura: ver [CLAUDE.md](CLAUDE.md).

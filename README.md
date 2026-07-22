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
| `npm test` | tests unitarios (Vitest, una pasada) |
| `npm run test:watch` | tests en modo watch |
| `npm run test:coverage` | tests + reporte de cobertura (`coverage/`) |
| `npm run db:seed` | seed idempotente |

## Tests unitarios

Vitest (`vitest.config.ts`), sin red ni DB real: `tests/setup.ts` fija un entorno
determinista y las dependencias externas se mockean (`tests/helpers/prisma-mock.ts` para
Prisma; SES/OpenAI/Supabase con `vi.mock` por test). Los tests viven en `tests/`
espejando `src/` (`tests/lib/auth/jwt.test.ts` cubre `src/lib/auth/jwt.ts`). Solo hace
falta `npm install` previo — no requieren `.env` ni servicios levantados. CI
(`.github/workflows/ci.yml`) corre typecheck + tests en cada push/PR a `main`.

Contrato, reglas y estructura: ver [CLAUDE.md](CLAUDE.md).
Alcance de tests unitarios: ver [docs/unit-testing-scope.md](docs/unit-testing-scope.md).

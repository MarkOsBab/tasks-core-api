-- Enable Row Level Security on every table in public schema.
--
-- This app only talks to Postgres via Prisma, authenticated as the `postgres` role
-- (owner of every table below). Table owners bypass RLS regardless of policies, so
-- this is a no-op for Prisma at runtime. What it actually does is close off Supabase's
-- auto-generated PostgREST API: with RLS disabled, the `anon`/`authenticated` roles used
-- by that API can read/write these tables directly if someone has the project's anon key.
-- No policies are added for anon/authenticated, so once RLS is on, PostgREST access to
-- these tables is denied by default.
--
-- `_prisma_migrations` gets RLS enabled too, but outside of this migration (applied via
-- `prisma db execute` directly) since Prisma's shadow database can't validate an ALTER
-- on its own internal tracking table mid-migration-history.

ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."boards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."board_columns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."proposals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."time_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

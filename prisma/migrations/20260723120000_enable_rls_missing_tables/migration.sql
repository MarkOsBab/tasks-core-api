-- Backfill Row Level Security on three tables whose creating migrations forgot to enable it,
-- flagged by the Supabase linter (rls_disabled_in_public). This matches every other table
-- (see 20260710092608_enable_row_level_security).
--
-- Prisma runs as the table owner and bypasses RLS at runtime, so this is a no-op for the app.
-- With no anon/authenticated policies added, it denies Supabase's PostgREST API access by default.
--
--   task_attachments   -> 20260722100432_task_attachments
--   _ProjectMembers    -> 20260722131703_user_role_project_members (Prisma implicit m2m join table)
--   project_learnings  -> 20260723111211_project_learnings

ALTER TABLE "public"."task_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_ProjectMembers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."project_learnings" ENABLE ROW LEVEL SECURITY;

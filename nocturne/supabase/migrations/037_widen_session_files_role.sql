-- 037_widen_session_files_role.sql
-- Widens the session_files.role CHECK constraint to include 'handwritten'.
--
-- Root cause: migration 021 created the constraint with only ('slide', 'audio', 'guide').
-- Migration 036 added handwritten file support but never updated this constraint,
-- causing every session_files insert with role='handwritten' to fail with
-- 23514 check_violation. The error was silently swallowed in upload.ts, so the
-- session was created but had no files linked — appearing broken to the user.

ALTER TABLE public.session_files
  DROP CONSTRAINT session_files_role_check;

ALTER TABLE public.session_files
  ADD CONSTRAINT session_files_role_check
  CHECK (role IN ('slide', 'audio', 'guide', 'handwritten'));

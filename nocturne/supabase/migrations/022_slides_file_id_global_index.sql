-- ── 1. Add file_id ────────────────────────────────────────────────────────────
-- Tracks which source PDF each slide row came from.
-- SET NULL on delete so slide text is retained even if the file row is removed.

ALTER TABLE public.slides
  ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES public.files(id) ON DELETE SET NULL;

-- ── 2. Add global_slide_index ─────────────────────────────────────────────────
-- The cumulative 1-based slide position across all source PDFs for the session,
-- ordered by session_files.order_index then page within each file.
-- This is the canonical "slide N" reference used in sync_map, flashcard
-- citations, and Ask-tab citations — not raw page_number, which is only
-- meaningful within the scope of a single source PDF.

ALTER TABLE public.slides
  ADD COLUMN IF NOT EXISTS global_slide_index integer;

-- ── 3. Backfill file_id ───────────────────────────────────────────────────────
-- All existing sessions are single-source (one PDF per session).
-- Use DISTINCT ON to pick the earliest uploaded PDF per session as the source.

UPDATE public.slides s
SET file_id = sub.file_id
FROM (
  SELECT DISTINCT ON (f.session_id)
    f.session_id,
    f.id AS file_id
  FROM public.files f
  WHERE f.file_type = 'pdf'
    AND f.session_id IS NOT NULL
  ORDER BY f.session_id, f.uploaded_at ASC
) sub
WHERE sub.session_id = s.session_id
  AND s.file_id IS NULL;

-- ── 4. Backfill global_slide_index ────────────────────────────────────────────
-- All existing sessions are single-source, so global_slide_index == page_number.
-- New multi-source sessions will have global_slide_index computed by the
-- extractor at insert time.

UPDATE public.slides
SET global_slide_index = page_number
WHERE global_slide_index IS NULL;

-- ── 5. Enforce NOT NULL now that every row has a value ────────────────────────

ALTER TABLE public.slides
  ALTER COLUMN global_slide_index SET NOT NULL;

-- ── 6. Index for sync-engine query (session ordered by global_slide_index) ────

CREATE INDEX IF NOT EXISTS slides_session_global_idx
  ON public.slides (session_id, global_slide_index);

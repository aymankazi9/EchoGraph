-- Add kind column to keywords.
-- Possible values: definition, equation, process, structure, principle.
-- NULL on pre-migration rows; populated by the extraction API going forward.
ALTER TABLE public.keywords
  ADD COLUMN IF NOT EXISTS kind text;

COMMENT ON COLUMN public.keywords.kind IS
  'Semantic category of the keyword set by the extraction LLM. '
  'One of: definition, equation, process, structure, principle. '
  'NULL for rows created before this migration or for synthetic/anki keywords.';

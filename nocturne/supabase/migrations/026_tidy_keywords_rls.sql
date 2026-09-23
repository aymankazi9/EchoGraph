-- Tidy RLS policies on keywords.
--
-- Before this migration keywords had six policies:
--
--   "Users can manage own keywords"  ALL / authenticated
--     qual + with_check: user_id = auth.uid()
--     → strict superset of the four operation-specific policies below;
--       adds nothing but extra matching work on every query.
--
--   "keywords: own rows only"        ALL / public
--     qual + with_check: EXISTS (SELECT 1 FROM sessions s
--                                WHERE s.id = keywords.session_id
--                                  AND s.user_id = auth.uid())
--     → correct semantically, but a per-row subquery join when a direct
--       user_id = auth.uid() check is equivalent (user_id is always set
--       to the inserting user) and matches the pattern used everywhere else.
--
-- After:
--   Drop "Users can manage own keywords" entirely.
--   Replace "keywords: own rows only" with a direct user_id check,
--   keeping the same policy name so dependent tooling / dashboards
--   see a consistent name rather than a new one.

DROP POLICY IF EXISTS "Users can manage own keywords" ON public.keywords;

DROP POLICY IF EXISTS "keywords: own rows only" ON public.keywords;
CREATE POLICY "keywords: own rows only"
  ON public.keywords
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

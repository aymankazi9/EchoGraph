CREATE TABLE IF NOT EXISTS public.sync_map (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  map_encrypted text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sync_map_session_id_key ON public.sync_map (session_id);

ALTER TABLE public.sync_map ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sync_map' AND policyname = 'sync_map: own rows only'
  ) THEN
    CREATE POLICY "sync_map: own rows only"
      ON public.sync_map FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.sessions s
          WHERE s.id = sync_map.session_id AND s.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.sessions s
          WHERE s.id = sync_map.session_id AND s.user_id = auth.uid()
        )
      );
  END IF;
END $$;

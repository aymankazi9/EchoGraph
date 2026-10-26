-- 040_llm_usage.sql
-- Logs every Anthropic API call: tokens consumed, latency, and status.
-- No prompt or response content is stored here — only usage metadata.
-- Used for cost attribution, prompt iteration baselines, and anomaly detection.

CREATE TABLE public.llm_usage (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  session_id    uuid        REFERENCES public.sessions (id) ON DELETE SET NULL,
  route         text        NOT NULL,
  model         text        NOT NULL,
  input_tokens  integer     NOT NULL,
  output_tokens integer     NOT NULL,
  latency_ms    integer     NOT NULL,
  status        text        NOT NULL DEFAULT 'ok'
                              CHECK (status IN ('ok', 'error')),
  error_code    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Per-user chronological index: covers billing and usage dashboards.
CREATE INDEX llm_usage_user_created_idx
  ON public.llm_usage (user_id, created_at DESC);

-- Per-session index: covers session-level cost attribution.
CREATE INDEX llm_usage_session_idx
  ON public.llm_usage (session_id)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own llm_usage"
  ON public.llm_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read own llm_usage"
  ON public.llm_usage FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.llm_usage IS
  'Per-call Anthropic API usage log. No prompt or response content is stored.';

COMMENT ON COLUMN public.llm_usage.route IS
  'Identifying name for the route that triggered the call, e.g. "extract/keywords".';

COMMENT ON COLUMN public.llm_usage.error_code IS
  'Set on status=error: "http_429", "http_500", "network_error", etc.';

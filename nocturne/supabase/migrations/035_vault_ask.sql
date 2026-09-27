-- 035: Vault-level Ask.
-- A single conversation per user (no session_id, no course_id — full vault scope).
-- Citations appear as inline text in responses: [Session Title, Slide N].
-- No cited_slide_indices column — citations are embedded in the answer text.

CREATE TABLE IF NOT EXISTS public.vault_ask_conversations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vault_ask_messages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid        NOT NULL
    REFERENCES public.vault_ask_conversations(id) ON DELETE CASCADE,
  role              text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content_encrypted text        NOT NULL,
  iv                text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_ask_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_ask_messages      ENABLE ROW LEVEL SECURITY;

-- vault_ask_conversations: direct user_id check
CREATE POLICY "vault_ask_conversations: select own"
  ON public.vault_ask_conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "vault_ask_conversations: insert own"
  ON public.vault_ask_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vault_ask_conversations: delete own"
  ON public.vault_ask_conversations FOR DELETE
  USING (user_id = auth.uid());

-- vault_ask_messages: ownership derived through parent conversation
CREATE POLICY "vault_ask_messages: select own"
  ON public.vault_ask_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vault_ask_conversations c
      WHERE c.id = vault_ask_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "vault_ask_messages: insert own"
  ON public.vault_ask_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vault_ask_conversations c
      WHERE c.id = vault_ask_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS vault_ask_conversations_user_id_idx
  ON public.vault_ask_conversations (user_id);

CREATE INDEX IF NOT EXISTS vault_ask_messages_conversation_id_idx
  ON public.vault_ask_messages (conversation_id, created_at);

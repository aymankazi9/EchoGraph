-- Ask tab: one conversation per session, many messages per conversation.
-- content_encrypted uses encryptText() format ("ctB64:ivB64") so iv is always NULL
-- from the current client — included per spec for future use.

CREATE TABLE IF NOT EXISTS public.ask_conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ask_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid        NOT NULL REFERENCES public.ask_conversations(id) ON DELETE CASCADE,
  role                text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content_encrypted   text        NOT NULL,
  iv                  text,
  cited_slide_indices integer[]   NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ask_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ask_messages      ENABLE ROW LEVEL SECURITY;

-- ask_conversations: direct user_id check
CREATE POLICY "ask_conversations: select own"
  ON public.ask_conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ask_conversations: insert own"
  ON public.ask_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ask_conversations: delete own"
  ON public.ask_conversations FOR DELETE
  USING (user_id = auth.uid());

-- ask_messages: ownership derived through the parent conversation
CREATE POLICY "ask_messages: select own"
  ON public.ask_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ask_conversations c
      WHERE c.id = ask_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "ask_messages: insert own"
  ON public.ask_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ask_conversations c
      WHERE c.id = ask_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS ask_conversations_session_id_idx
  ON public.ask_conversations (session_id);

CREATE INDEX IF NOT EXISTS ask_messages_conversation_id_idx
  ON public.ask_messages (conversation_id, created_at);

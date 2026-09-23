-- Aggregate all encrypted payload bytes for a given user.
-- Counts files.size_bytes (raw) + files.iv (separate column) + octet_length of every
-- encrypted text column across slides, transcript_words, keywords, flashcards,
-- session_notes, and ask_messages. IV is embedded in the ciphertext for all text
-- columns except files.iv, so no separate iv count is needed for those tables.
--
-- Used by layout.tsx (sidebar storage indicator) and vault/settings/page.tsx.
-- SECURITY DEFINER so the function can always read all tables regardless of
-- the caller's RLS context.

CREATE OR REPLACE FUNCTION public.get_user_storage_bytes(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- files: raw binary size + separate IV stored as base64 text
    COALESCE((
      SELECT SUM(COALESCE(f.size_bytes, 0) + octet_length(COALESCE(f.iv, '')))
      FROM files f
      WHERE f.user_id = p_user_id
    ), 0)

    -- slides: text_encrypted (IV embedded in "ctB64:ivB64", no separate column)
    + COALESCE((
      SELECT SUM(octet_length(COALESCE(s.text_encrypted, '')))
      FROM slides s
      JOIN sessions sess ON sess.id = s.session_id
      WHERE sess.user_id = p_user_id
    ), 0)

    -- transcript_words: word_encrypted (IV embedded, no separate column)
    + COALESCE((
      SELECT SUM(octet_length(COALESCE(tw.word_encrypted, '')))
      FROM transcript_words tw
      JOIN sessions sess ON sess.id = tw.session_id
      WHERE sess.user_id = p_user_id
    ), 0)

    -- keywords: term_encrypted (IV embedded, no separate column)
    + COALESCE((
      SELECT SUM(octet_length(COALESCE(k.term_encrypted, '')))
      FROM keywords k
      JOIN sessions sess ON sess.id = k.session_id
      WHERE sess.user_id = p_user_id
    ), 0)

    -- flashcards: front + back encrypted (IV embedded, no separate column)
    + COALESCE((
      SELECT SUM(
        octet_length(COALESCE(fc.front_encrypted, '')) +
        octet_length(COALESCE(fc.back_encrypted, ''))
      )
      FROM flashcards fc
      JOIN sessions sess ON sess.id = fc.session_id
      WHERE sess.user_id = p_user_id
    ), 0)

    -- session_notes: content_encrypted (IV embedded; separate iv column is always NULL)
    + COALESCE((
      SELECT SUM(octet_length(COALESCE(sn.content_encrypted, '')))
      FROM session_notes sn
      WHERE sn.user_id = p_user_id
    ), 0)

    -- ask_messages: content_encrypted (IV embedded; separate iv column is always NULL)
    + COALESCE((
      SELECT SUM(octet_length(COALESCE(am.content_encrypted, '')))
      FROM ask_messages am
      JOIN ask_conversations ac ON ac.id = am.conversation_id
      WHERE ac.user_id = p_user_id
    ), 0)
$$;

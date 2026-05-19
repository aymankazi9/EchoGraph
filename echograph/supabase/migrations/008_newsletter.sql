-- Newsletter rate limiting
-- No RLS: written exclusively by Edge Functions using the service role key.
-- Raw IPs are never stored — only SHA-256 hashes for privacy compliance.
CREATE TABLE newsletter_rate_limits (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash      text        NOT NULL,
  attempted_at timestamptz DEFAULT now()
);
CREATE INDEX ON newsletter_rate_limits (ip_hash, attempted_at);

-- Double opt-in confirmation tokens
-- No RLS: read and written exclusively by Edge Functions using the service role key.
-- One row per email (UNIQUE). Pending confirmations are replaced on re-subscribe.
CREATE TABLE newsletter_confirmations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email      text        NOT NULL UNIQUE,
  confirmed  boolean     DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '24 hours'
);
CREATE INDEX ON newsletter_confirmations (token);
CREATE INDEX ON newsletter_confirmations (email, confirmed);

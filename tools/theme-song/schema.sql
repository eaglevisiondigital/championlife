-- REVIEW ONLY. Apply manually to a NEW, dedicated counter database after approval.
-- Not a Supabase migration; no automatic install/build hook. Never use a ministry database.
BEGIN;
CREATE ROLE theme_song_counter NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE SCHEMA theme_song;
REVOKE ALL ON SCHEMA theme_song FROM PUBLIC;
CREATE TABLE theme_song.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('production','deploy-preview')),
  enabled boolean NOT NULL DEFAULT false
);
-- Owner must install the reviewed environment UUID and enable explicitly; initially no row.
CREATE TABLE theme_song.totals (
  kind text PRIMARY KEY CHECK (kind IN ('play','download','giving')),
  total bigint NOT NULL DEFAULT 0 CHECK (total >= 0)
);
INSERT INTO theme_song.totals(kind) VALUES ('play'),('download'),('giving');
CREATE TABLE theme_song.sessions (
  id uuid PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '2 hours')
);
CREATE TABLE theme_song.events (
  session_id uuid NOT NULL REFERENCES theme_song.sessions(id) ON DELETE CASCADE,
  kind text NOT NULL REFERENCES theme_song.totals(kind),
  PRIMARY KEY (session_id, kind)
);
CREATE TABLE theme_song.rate_windows (
  network_hash text NOT NULL CHECK (length(network_hash) = 64),
  minute timestamptz NOT NULL,
  starts integer NOT NULL DEFAULT 0,
  events integer NOT NULL DEFAULT 0,
  PRIMARY KEY(network_hash, minute)
);
CREATE INDEX ON theme_song.sessions(expires_at);
CREATE INDEX ON theme_song.rate_windows(minute);
REVOKE ALL ON ALL TABLES IN SCHEMA theme_song FROM PUBLIC;
GRANT USAGE ON SCHEMA theme_song TO theme_song_counter;
GRANT SELECT ON theme_song.installation TO theme_song_counter;
GRANT SELECT,UPDATE ON theme_song.totals TO theme_song_counter;
GRANT SELECT,INSERT,DELETE ON theme_song.sessions,theme_song.events TO theme_song_counter;
GRANT SELECT,INSERT,UPDATE,DELETE ON theme_song.rate_windows TO theme_song_counter;
ALTER TABLE theme_song.installation ENABLE ROW LEVEL SECURITY;
CREATE POLICY counter_config ON theme_song.installation FOR SELECT TO theme_song_counter USING (true);
ALTER TABLE theme_song.totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY counter_totals ON theme_song.totals TO theme_song_counter USING (true) WITH CHECK (true);
ALTER TABLE theme_song.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY counter_sessions ON theme_song.sessions TO theme_song_counter USING (true) WITH CHECK (true);
ALTER TABLE theme_song.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY counter_events ON theme_song.events TO theme_song_counter USING (true) WITH CHECK (true);
ALTER TABLE theme_song.rate_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY counter_rate ON theme_song.rate_windows TO theme_song_counter USING (true) WITH CHECK (true);
COMMIT;
-- Separate approval: create a TLS login inheriting ONLY theme_song_counter (never owner),
-- no public/API schema exposure. Set connection default search_path to pg_catalog.

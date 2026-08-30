-- À exécuter une fois sur ta base Postgres (Railway, Render, Supabase, etc.)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  verbes JSONB NOT NULL DEFAULT '[]',
  noms JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Suivi simple du nombre d'analyses par jour, pour limiter les coûts d'API
-- tant que l'app est financée par la publicité plutôt que par des abonnements.
CREATE TABLE IF NOT EXISTS usage_daily (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id);

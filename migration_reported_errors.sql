-- À exécuter UNE FOIS sur ta base, comme les migrations précédentes.

CREATE TABLE IF NOT EXISTS reported_errors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  word_type TEXT NOT NULL, -- 'verbe' ou 'nom'
  row_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

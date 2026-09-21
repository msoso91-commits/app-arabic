-- À exécuter UNE FOIS sur ta base, comme les migrations précédentes.

CREATE TABLE IF NOT EXISTS word_reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
  word_type TEXT NOT NULL, -- 'verbe' ou 'nom'
  mot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nouveau', -- 'nouveau' | 'a_revoir' | 'maitrise'
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, page_id, word_type, mot)
);

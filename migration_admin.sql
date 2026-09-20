-- À exécuter UNE FOIS sur ta base, comme les migrations précédentes.

ALTER TABLE reported_errors ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT false;

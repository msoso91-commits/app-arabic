-- À exécuter UNE FOIS sur ta base existante (celle qui a déjà la table users)
-- pour ajouter le suivi des abonnements sans tout recréer.

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'free';

# Backend — Analyseur de page arabe

## Ce que fait ce backend
- Création de compte / connexion (email + mot de passe, sécurisé avec bcrypt + JWT)
- Analyse d'une page (photo → appel sécurisé à l'API Claude, ta clé API n'est jamais visible du navigateur)
- Sauvegarde et récupération des pages analysées, par utilisateur
- Limite de 20 analyses/jour par utilisateur (à ajuster dans `routes/pages.js`), pour maîtriser le coût d'API tant que le modèle repose sur la publicité plutôt que sur des abonnements payants

## Installation en local
```bash
npm install
cp .env.example .env   # puis remplis les valeurs
```
Crée les tables une seule fois sur ta base Postgres :
```bash
psql "$DATABASE_URL" -f schema.sql
```
Lance le serveur :
```bash
npm run dev
```

## Déploiement (le plus simple pour démarrer)
1. **Base de données** : crée un projet Postgres gratuit sur [Railway](https://railway.app), [Render](https://render.com) ou [Supabase](https://supabase.com). Récupère l'URL de connexion (`DATABASE_URL`).
2. **Hébergement du serveur** : déploie ce dossier sur Railway ou Render (les deux détectent automatiquement un projet Node.js). Renseigne les variables d'environnement du fichier `.env.example` dans leur interface.
3. **Exécute `schema.sql`** une fois sur ta base, via l'interface web de ton hébergeur ou en local avec `psql`.
4. Note l'URL publique de ton backend (ex: `https://ton-app.up.railway.app`) — c'est elle que le frontend appellera.

## Connecter le frontend (l'artifact React)
Dans le frontend, remplace les appels directs à `api.anthropic.com` par des appels à ton backend :
- `POST https://ton-backend.com/api/auth/signup` `{ email, password }`
- `POST https://ton-backend.com/api/auth/login` `{ email, password }`
- `POST https://ton-backend.com/api/pages/analyze` `{ imageBase64, mediaType }` avec le header `Authorization: Bearer <token>`
- `GET https://ton-backend.com/api/pages` (historique)
- `DELETE https://ton-backend.com/api/pages/:id`

Stocke le `token` reçu à la connexion (par ex. dans le state React ou un cookie) et renvoie-le dans le header `Authorization` de chaque requête protégée.

## Publicité (monétisation choisie)
Ce backend ne gère pas la publicité — elle s'intègre côté frontend (ex: Google AdSense pour le web, Google AdMob pour une app mobile). Aucune clé secrète n'est nécessaire côté serveur pour ça. Garde en tête que le revenu publicitaire dépend fortement du volume de trafic : il faut souvent des dizaines de milliers de vues par mois pour un revenu significatif.

## Sécurité et RGPD — points à ne pas sauter avant l'ouverture au public
- Change absolument `JWT_SECRET` par une valeur longue et aléatoire.
- Restreins `cors()` à ton seul nom de domaine frontend en production.
- Ajoute une page de politique de confidentialité et un moyen pour l'utilisateur de supprimer son compte et ses données.
- Envisage un hébergeur de base de données situé en Europe si tes utilisateurs sont majoritairement européens.

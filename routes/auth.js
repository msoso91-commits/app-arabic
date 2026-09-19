const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Stripe = require("stripe");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { sendPasswordResetEmail } = require("../mailer");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/signup", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Adresse email invalide." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Un compte existe déjà avec cet email." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase(), passwordHash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors de la création du compte." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis." });
  }

  try {
    const result = await pool.query("SELECT id, email, password_hash FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Email ou mot de passe incorrect." });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Email ou mot de passe incorrect." });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors de la connexion." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, email, created_at FROM users WHERE id = $1", [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Utilisateur introuvable." });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Changement de mot de passe : vérifie l'ancien avant d'appliquer le nouveau.
router.patch("/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Mot de passe actuel et nouveau mot de passe requis." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
  }

  try {
    const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Mot de passe actuel incorrect." });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, req.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors du changement de mot de passe." });
  }
});

// Demande de réinitialisation : génère un token temporaire et envoie l'email.
// Répond toujours pareil, que l'email existe ou non, pour ne pas révéler
// quels emails ont un compte (sécurité).
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email requis." });

  try {
    const result = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = result.rows[0];

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
      await pool.query("UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3", [
        token,
        expires,
        user.id,
      ]);
      const resetUrl = `${process.env.FRONTEND_URL}?reset_token=${token}`;
      await sendPasswordResetEmail(email.toLowerCase(), resetUrl).catch((err) => console.error("Erreur envoi email:", err));
    }

    res.json({ message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Applique le nouveau mot de passe si le token est valide et pas expiré.
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: "Token et nouveau mot de passe requis." });
  if (newPassword.length < 8) return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });

  try {
    const result = await pool.query(
      "SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > now()",
      [token]
    );
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: "Lien invalide ou expiré. Refais une demande." });

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [newHash, user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Suppression définitive du compte (RGPD). Annule d'abord tout abonnement
// Stripe actif pour éviter un prélèvement après la suppression.
router.delete("/account", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT stripe_customer_id FROM users WHERE id = $1", [req.userId]);
    const customerId = result.rows[0]?.stripe_customer_id;

    if (customerId) {
      try {
        const subs = await stripe.subscriptions.list({ customer: customerId, status: "active" });
        for (const sub of subs.data) {
          await stripe.subscriptions.cancel(sub.id);
        }
      } catch (err) {
        console.error("Erreur annulation abonnement Stripe lors de la suppression:", err);
      }
    }

    // Les pages et l'historique d'usage sont supprimés automatiquement
    // (ON DELETE CASCADE défini dans le schéma).
    await pool.query("DELETE FROM users WHERE id = $1", [req.userId]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors de la suppression du compte." });
  }
});

module.exports = router;

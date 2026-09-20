const express = require("express");
const Stripe = require("stripe");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Crée une session de paiement Stripe pour l'abonnement mensuel (4,99€/mois)
router.post("/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const userResult = await pool.query("SELECT id, email, stripe_customer_id FROM users WHERE id = $1", [
      req.userId,
    ]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      customerId = customer.id;
      await pool.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, user.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      managed_payments: { enabled: false },
      allow_promotion_codes: true, // affiche le champ "Code promo" sur la page de paiement
      success_url: `${process.env.FRONTEND_URL}?subscription=success`,
      cancel_url: `${process.env.FRONTEND_URL}?subscription=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de créer la session de paiement." });
  }
});

// Ouvre le portail client Stripe (gérer le moyen de paiement, résilier l'abonnement, voir les factures)
router.post("/create-portal-session", requireAuth, async (req, res) => {
  try {
    const userResult = await pool.query("SELECT stripe_customer_id FROM users WHERE id = $1", [req.userId]);
    const customerId = userResult.rows[0]?.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: "Aucun abonnement associé à ce compte." });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.FRONTEND_URL,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible d'ouvrir la gestion d'abonnement." });
  }
});

// Renvoie le statut d'abonnement courant de l'utilisateur connecté
router.get("/status", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT subscription_status FROM users WHERE id = $1", [req.userId]);
    res.json({ status: result.rows[0]?.subscription_status || "free" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Webhook Stripe : reçoit les événements de paiement pour mettre à jour l'abonnement.
// IMPORTANT : cette route doit recevoir le corps BRUT (pas du JSON parsé) — voir index.js.
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Signature webhook invalide :", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "customer.subscription.updated") {
      const customerId = event.data.object.customer;
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, limit: 1 });
      const isActive = subscriptions.data.some((s) => s.status === "active" || s.status === "trialing");
      await pool.query("UPDATE users SET subscription_status = $1 WHERE stripe_customer_id = $2", [
        isActive ? "active" : "canceled",
        customerId,
      ]);
    }

    if (event.type === "customer.subscription.deleted") {
      const customerId = event.data.object.customer;
      await pool.query("UPDATE users SET subscription_status = 'canceled' WHERE stripe_customer_id = $1", [
        customerId,
      ]);
    }

    res.json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur de traitement du webhook.");
  }
});

module.exports = router;

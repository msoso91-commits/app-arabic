const pool = require("../db");

// Restreint l'accès aux routes admin au seul compte dont l'email correspond
// à la variable d'environnement ADMIN_EMAIL. À utiliser après requireAuth.
async function requireAdmin(req, res, next) {
  try {
    const result = await pool.query("SELECT email FROM users WHERE id = $1", [req.userId]);
    const email = result.rows[0]?.email;
    if (!email || email.toLowerCase() !== (process.env.ADMIN_EMAIL || "").toLowerCase()) {
      return res.status(403).json({ error: "Accès refusé." });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
}

module.exports = { requireAdmin };

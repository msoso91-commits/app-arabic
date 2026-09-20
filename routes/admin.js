const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");

const router = express.Router();

router.get("/reports", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.word_type, r.row_data, r.resolved, r.created_at, u.email
       FROM reported_errors r
       JOIN users u ON u.id = r.user_id
       ORDER BY r.resolved ASC, r.created_at DESC
       LIMIT 200`
    );
    res.json({ reports: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.patch("/reports/:id", requireAuth, requireAdmin, async (req, res) => {
  const { resolved } = req.body || {};
  try {
    await pool.query("UPDATE reported_errors SET resolved = $1 WHERE id = $2", [!!resolved, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;

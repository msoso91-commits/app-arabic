const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Nombre d'analyses gratuites par jour et par utilisateur.
// Important tant que le modèle économique repose sur la publicité :
// chaque analyse a un coût d'API réel, il faut donc une limite.
const DAILY_LIMIT = 3;

const ANALYSIS_PROMPT =
  "Tu es un expert en grammaire arabe. Lis le texte arabe visible sur cette image de page de livre. " +
  "Identifie au maximum 15 verbes et 15 noms/mots notables parmi les plus fréquents ou importants de la page " +
  "(ignore les particules, prépositions courantes). Ne dépasse jamais 15 de chaque, même si la page en contient plus. " +
  "Pour chaque verbe donne : sa forme trouvée, le passé (3e pers. masc. sing.), le présent (3e pers. masc. sing.), " +
  "l'impératif (2e pers. masc. sing.), le masdar (nom d'action, écrit avec le tanwîn fath / double fatha ـً à la fin quand la forme le permet), " +
  "et une traduction française courte (1 à 3 mots) du verbe à l'infinitif. " +
  "Pour chaque nom donne : le mot, un synonyme, un contraire (ou vide si non pertinent), le pluriel, " +
  "et une traduction française courte (1 à 3 mots). " +
  "Pour chaque verbe, reste cohérent sur le schème verbal (la forme dérivée : I, II, III, IV...) : si le verbe existe sous plusieurs formes proches avec un sens similaire, choisis-en UNE SEULE et utilise-la pour le passé, le présent, l'impératif ET le masdar — ne mélange jamais deux formes différentes dans la même ligne. " +
  "Si tu n'es pas sûr d'une forme, indique '?' plutôt que d'inventer. Reste très concis, pas de commentaire. " +
  "Réponds UNIQUEMENT avec un objet JSON strict compact, sans texte avant/après, sans balises markdown, au format exact: " +
  '{"verbes":[{"mot":"","passe":"","present":"","imperatif":"","masdar":"","traduction":""}],"noms":[{"mot":"","synonyme":"","contraire":"","pluriel":"","traduction":""}]}';

async function checkAndIncrementQuota(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await pool.query(
    `INSERT INTO usage_daily (user_id, day, count) VALUES ($1, $2, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET count = usage_daily.count + 1
     RETURNING count`,
    [userId, today]
  );
  return result.rows[0].count;
}

router.post("/analyze", requireAuth, async (req, res) => {
  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: "Image manquante." });
  }

  try {
    const userResult = await pool.query("SELECT subscription_status FROM users WHERE id = $1", [req.userId]);
    const isSubscribed = userResult.rows[0]?.subscription_status === "active";
    let usedToday = 0;

    if (!isSubscribed) {
      usedToday = await checkAndIncrementQuota(req.userId);
      if (usedToday > DAILY_LIMIT) {
        return res.status(429).json({
          error: `Limite de ${DAILY_LIMIT} analyses par jour atteinte. Passe à l'abonnement pour un usage illimité, ou réessaie demain.`,
        });
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: ANALYSIS_PROMPT },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(502).json({ error: data.error.message || "Erreur de l'API Claude." });

    const text = data.content.map((b) => b.text || "").join("\n");
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      if (data.stop_reason === "max_tokens") {
        return res.status(422).json({ error: "La réponse a été coupée (page trop dense). Essaie une portion plus courte." });
      }
      return res.status(422).json({ error: "Réponse illisible, réessaie l'analyse." });
    }

    const saved = await pool.query(
      "INSERT INTO pages (user_id, verbes, noms) VALUES ($1, $2, $3) RETURNING id, titre, verbes, noms, created_at",
      [req.userId, JSON.stringify(parsed.verbes || []), JSON.stringify(parsed.noms || [])]
    );

    res.json({
      page: saved.rows[0],
      remainingToday: isSubscribed ? null : Math.max(0, DAILY_LIMIT - usedToday),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur pendant l'analyse." });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, titre, verbes, noms, created_at FROM pages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
      [req.userId]
    );
    res.json({ pages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Renomme une page sauvegardée.
router.patch("/:id", requireAuth, async (req, res) => {
  const { titre } = req.body || {};
  if (typeof titre !== "string") {
    return res.status(400).json({ error: "Titre invalide." });
  }
  try {
    const result = await pool.query(
      "UPDATE pages SET titre = $1 WHERE id = $2 AND user_id = $3 RETURNING id, titre",
      [titre.trim().slice(0, 100), req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Page introuvable." });
    res.json({ page: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM pages WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Signale une ligne (verbe ou nom) comme incorrecte, pour amélioration continue.
router.post("/report-error", requireAuth, async (req, res) => {
  const { wordType, row } = req.body || {};
  if (!wordType || !row) return res.status(400).json({ error: "Données de signalement invalides." });

  try {
    await pool.query("INSERT INTO reported_errors (user_id, word_type, row_data) VALUES ($1, $2, $3)", [
      req.userId,
      wordType,
      JSON.stringify(row),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

module.exports = router;

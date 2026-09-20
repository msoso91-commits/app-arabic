require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const pagesRoutes = require("./routes/pages");
const billingRoutes = require("./routes/billing");
const adminRoutes = require("./routes/admin");

const app = express();

app.use(cors()); // en production, restreins à ton propre domaine frontend

// Le webhook Stripe a besoin du corps BRUT de la requête pour vérifier la signature,
// donc cette route est montée AVANT express.json() qui parserait/modifierait le corps.
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "12mb" })); // les photos en base64 peuvent être volumineuses

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/pages", pagesRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));

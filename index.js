require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const pagesRoutes = require("./routes/pages");

const app = express();

app.use(cors()); // en production, restreins à ton propre domaine frontend
app.use(express.json({ limit: "12mb" })); // les photos en base64 peuvent être volumineuses

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/pages", pagesRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));

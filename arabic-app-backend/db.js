const { Pool } = require("pg");

// DATABASE_URL est fournie automatiquement par la plupart des hébergeurs
// (Railway, Render, Supabase) une fois la base Postgres créée.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

module.exports = pool;

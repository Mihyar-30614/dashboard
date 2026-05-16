import pg from "pg";

const { Pool } = pg;

export const dbPool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "dashboard",
  user: process.env.DB_USER || "dashboard",
  password: process.env.DB_PASSWORD || "",
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function query(text, params) {
  return dbPool.query(text, params);
}

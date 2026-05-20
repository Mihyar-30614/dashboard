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

dbPool.on("error", (err) => console.error("dbPool error", err.message));

const TRANSIENT_CODES = new Set(["57P01", "57P02", "57P03", "08000", "08001", "08003", "08004", "08006", "08007", "08P01"]);

export async function query(text, params, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await dbPool.query(text, params);
    } catch (err) {
      const transient = TRANSIENT_CODES.has(err.code);
      if (!transient || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
}

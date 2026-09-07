import { Pool } from "pg";

// A single shared pool for the whole admin panel. Reads DATABASE_URL from
// .env.local — same Supabase Postgres instance the Python backend uses.
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set. Copy .env.local.example to .env.local and fill it in.");
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

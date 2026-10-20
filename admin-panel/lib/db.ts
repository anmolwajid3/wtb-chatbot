import { Pool } from "pg";

// A single shared pool for the whole admin panel. Reads DATABASE_URL from
// .env.local — same Supabase Postgres instance the Python backend uses.
let pool: Pool | null = null;

function poolOptions(connectionString: string) {
  // Supabase (and most hosted Postgres) require TLS. Local Postgres usually does not.
  const needsSsl =
    /supabase\.(co|com)/i.test(connectionString) ||
    /sslmode=require/i.test(connectionString) ||
    process.env.DATABASE_SSL === "true";

  return {
    connectionString,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

export function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set. Copy .env.local.example to .env.local and fill it in.");
    }
    pool = new Pool(poolOptions(process.env.DATABASE_URL));
  }
  return pool;
}

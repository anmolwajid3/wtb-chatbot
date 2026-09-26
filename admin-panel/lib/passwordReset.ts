import crypto from "crypto";
import { getPool } from "./db";

export function newResetToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function storeReset(kind: "staff" | "profile", accountId: string, tokenHash: string) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO password_resets (account_kind, account_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 hour')`,
    [kind, accountId, tokenHash]
  );
}

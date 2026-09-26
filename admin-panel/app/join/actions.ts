"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export async function requestProfile(formData: FormData) {
  try {
    await ensureSchema();
  } catch {
    redirect("/login?error=db");
  }

  const organizationId = String(formData.get("organization_id") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const note = String(formData.get("note") || "").trim();

  if (!organizationId || !name || !email || !username || password.length < 8) {
    redirect("/join?error=invalid");
  }

  const pool = getPool();
  const company = await pool.query(
    `SELECT id, name, status FROM organizations WHERE id = $1`,
    [organizationId]
  );
  const organization = company.rows[0];
  if (!organization || organization.status !== "active") redirect("/join?error=closed");

  const taken = await pool.query(
    `SELECT 1 FROM coach_accounts WHERE username = $1
     UNION ALL
     SELECT 1 FROM profile_requests WHERE username = $1 AND status = 'pending'`,
    [username]
  );
  if (taken.rows.length > 0) redirect("/join?error=taken");

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO profile_requests (organization_id, name, email, username, password_hash, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [organizationId, name, email, username, passwordHash, note || null]
  );
  redirect(`/join?sent=${encodeURIComponent(organization.name)}`);
}

"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE } from "@/lib/brand";
import { COACH_SESSION_COOKIE, createCoachSessionToken } from "@/lib/coachSession";
import { getPool } from "@/lib/db";
import { hashResetToken, newResetToken, storeReset } from "@/lib/passwordReset";
import { ensureSchema } from "@/lib/schema";
import { createStaffSessionToken, type StaffRole } from "@/lib/session";

function signInPath(next: string) {
  return next === "/admin" ? "/admin" : "/login";
}

async function ready(next = "/login") {
  try {
    await ensureSchema();
  } catch {
    redirect(`${signInPath(next)}?error=db`);
  }
}

export async function loginAsStaff(formData: FormData) {
  const door = String(formData.get("door") || "");
  const next = signInPath(String(formData.get("next") || "/login"));
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  await ready(next);

  const pool = getPool();
  const result = await pool.query(
    `SELECT id, email, name, password_hash, role, organization_id FROM users WHERE email = $1`,
    [email]
  );
  const user = result.rows[0];
  const matches = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !matches) redirect(`${next}?error=1`);

  if (door === "lab" && user.role !== "super_admin") redirect(`${next}?error=usecompany`);
  if (door === "company" && user.role === "super_admin") redirect(`${next}?error=uselab`);

  const token = createStaffSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as StaffRole,
    organizationId: user.organization_id,
  });
  const cookieStore = await cookies();
  cookieStore.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/home");
}

export async function loginAsProfile(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) redirect("/login?error=1");
  await ready();

  const pool = getPool();
  const result = await pool.query(
    `SELECT ca.id AS account_id, ca.password_hash, ca.must_change_password, ca.coach_id, c.coach_name
     FROM coach_accounts ca
     JOIN coaches c ON c.id = ca.coach_id
     WHERE ca.username = $1`,
    [username]
  );
  const account = result.rows[0];
  if (!account || !(await bcrypt.compare(password, account.password_hash))) {
    redirect("/login?error=1");
  }

  const token = createCoachSessionToken({
    coachAccountId: account.account_id,
    coachId: account.coach_id,
    coachName: account.coach_name,
  });
  const cookieStore = await cookies();
  cookieStore.set(COACH_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  if (account.must_change_password) redirect("/coach-portal/change-password");
  redirect("/coach-portal");
}

export async function requestPasswordReset(formData: FormData) {
  const kind = String(formData.get("kind") || "staff");
  const identifier = String(formData.get("identifier") || "").trim();
  if (!identifier) redirect("/login/forgot?error=missing");
  await ready();

  const pool = getPool();
  let accountId: string | null = null;
  let accountKind: "staff" | "profile" = "staff";
  if (kind === "profile") {
    const found = await pool.query(`SELECT id FROM coach_accounts WHERE username = $1`, [identifier]);
    accountId = found.rows[0]?.id ?? null;
    accountKind = "profile";
  } else {
    const found = await pool.query(`SELECT id FROM users WHERE email = $1`, [identifier.toLowerCase()]);
    accountId = found.rows[0]?.id ?? null;
    accountKind = "staff";
  }
  if (!accountId) redirect("/login/forgot?error=missing");

  const { token, tokenHash } = newResetToken();
  await storeReset(accountKind, accountId, tokenHash);
  redirect(`/login/forgot?ready=${encodeURIComponent(token)}`);
}

export async function completePasswordReset(formData: FormData) {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 8 || password !== confirm) {
    redirect(`/login/reset?token=${encodeURIComponent(token)}&error=short`);
  }
  await ready();

  const pool = getPool();
  const found = await pool.query(
    `SELECT id, account_kind, account_id FROM password_resets
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [hashResetToken(token)]
  );
  const row = found.rows[0];
  if (!row) redirect("/login/reset?error=bad");

  const passwordHash = await bcrypt.hash(password, 10);
  if (row.account_kind === "profile") {
    await pool.query(
      `UPDATE coach_accounts SET password_hash = $1, must_change_password = false WHERE id = $2`,
      [passwordHash, row.account_id]
    );
  } else {
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, row.account_id]);
  }
  await pool.query(`UPDATE password_resets SET used_at = now() WHERE id = $1`, [row.id]);
  redirect("/login/reset?done=1");
}

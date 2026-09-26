"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { ORG_COOKIE, STARTER_GUARDRAILS, STARTER_TONE } from "@/lib/brand";
import { getPool } from "@/lib/db";
import { planCredits } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function createCompany(formData: FormData) {
  const workspace = await getWorkspace();
  if (!workspace || workspace.session.role !== "super_admin") redirect("/home");

  const name = String(formData.get("name") || "").trim();
  const slug = slugify(String(formData.get("slug") || "") || name);
  const profileLabel = String(formData.get("profile_label") || "Guide").trim() || "Guide";
  const profileLabelPlural = String(formData.get("profile_label_plural") || "Guides").trim() || "Guides";
  const adminName = String(formData.get("admin_name") || "").trim();
  const adminEmail = String(formData.get("admin_email") || "").trim().toLowerCase();
  const adminPassword = String(formData.get("admin_password") || "");
  const plan = String(formData.get("plan") || "free");
  const creditLimit = planCredits(plan);

  if (!name || !slug || !adminName || !adminEmail || adminPassword.length < 6) {
    redirect("/companies?error=1");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const org = await client.query(
      `INSERT INTO organizations (name, slug, profile_label, profile_label_plural, plan, credit_limit)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [name, slug, profileLabel, profileLabelPlural, plan === "pro" || plan === "enterprise" ? plan : "free", creditLimit]
    );
    const organizationId = org.rows[0].id as string;
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await client.query(
      `INSERT INTO users (organization_id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, 'org_admin')`,
      [organizationId, adminEmail, adminName, passwordHash]
    );
    await client.query(
      `INSERT INTO tone_settings (name, description_text, organization_id) VALUES ('default_voice', $1, $2)`,
      [STARTER_TONE, organizationId]
    );
    for (const rule of STARTER_GUARDRAILS) {
      await client.query(
        `INSERT INTO guardrails (rule_text, category, organization_id) VALUES ($1, $2, $3)`,
        [rule.rule_text, rule.category, organizationId]
      );
    }
    await client.query("COMMIT");

    const cookieStore = await cookies();
    cookieStore.set(ORG_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch {
    await client.query("ROLLBACK");
    redirect("/companies?error=taken");
  } finally {
    client.release();
  }

  redirect("/home");
}

export async function openCompany(formData: FormData) {
  const workspace = await getWorkspace();
  if (!workspace || workspace.session.role !== "super_admin") redirect("/home");
  const id = String(formData.get("id") || "");
  if (!id) redirect("/companies");
  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/home");
}

const STATUSES = ["active", "archived", "held", "removed"] as const;

export async function setCompanyStatus(formData: FormData) {
  const workspace = await getWorkspace();
  if (!workspace || workspace.session.role !== "super_admin") redirect("/home");
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) redirect("/companies");
  const pool = getPool();
  await pool.query(`UPDATE organizations SET status = $1 WHERE id = $2`, [status, id]);
  redirect("/companies");
}

export async function updateCompany(formData: FormData) {
  const workspace = await getWorkspace();
  if (!workspace || workspace.session.role !== "super_admin") redirect("/home");
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const slug = slugify(String(formData.get("slug") || "") || name);
  const profileLabel = String(formData.get("profile_label") || "Guide").trim() || "Guide";
  const profileLabelPlural = String(formData.get("profile_label_plural") || "Guides").trim() || "Guides";
  const plan = String(formData.get("plan") || "free");
  const safePlan = plan === "pro" || plan === "enterprise" ? plan : "free";
  if (!id || !name || !slug) redirect("/companies?error=1");
  const pool = getPool();
  try {
    await pool.query(
      `UPDATE organizations
       SET name = $1, slug = $2, profile_label = $3, profile_label_plural = $4, plan = $5, credit_limit = $6
       WHERE id = $7`,
      [name, slug, profileLabel, profileLabelPlural, safePlan, planCredits(safePlan), id]
    );
  } catch {
    redirect("/companies?error=taken");
  }
  redirect("/companies");
}

export async function closeCompany() {
  const workspace = await getWorkspace();
  if (!workspace || workspace.session.role !== "super_admin") redirect("/home");
  const cookieStore = await cookies();
  cookieStore.delete(ORG_COOKIE);
  redirect("/companies");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";

async function requireOrgAdmin() {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (workspace.session.role !== "super_admin" && workspace.session.role !== "org_admin") redirect("/home");
  if (!workspace.organization) redirect("/members?need=1");
  return workspace;
}

export async function addMember(formData: FormData) {
  const workspace = await requireOrgAdmin();
  const organization = workspace.organization;
  if (!organization) redirect("/members?need=1");

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const requested = String(formData.get("role") || "viewer");
  const role = ["viewer", "analyst", "editor", "org_admin"].includes(requested) ? requested : "viewer";
  if (!name || !email || password.length < 6) redirect("/members?error=1");

  const pool = getPool();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (organization_id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [organization.id, email, name, passwordHash, role]
    );
  } catch {
    redirect("/members?error=taken");
  }
  revalidatePath("/members");
}

export async function removeMember(formData: FormData) {
  const workspace = await requireOrgAdmin();
  const organization = workspace.organization;
  if (!organization) return;
  const id = String(formData.get("id") || "");
  if (!id || id === workspace.session.userId) return;
  const pool = getPool();
  await pool.query(
    `DELETE FROM users WHERE id = $1 AND organization_id = $2 AND role <> 'super_admin'`,
    [id, organization.id]
  );
  revalidatePath("/members");
}

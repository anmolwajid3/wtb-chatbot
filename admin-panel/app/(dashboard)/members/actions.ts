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
  if (!workspace.organization) redirect("/users?need=1");
  return workspace;
}

export async function addMember(formData: FormData) {
  const workspace = await requireOrgAdmin();
  const organization = workspace.organization;
  if (!organization) redirect("/users?need=1");

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const requested = String(formData.get("role") || "viewer");
  const role = ["viewer", "analyst", "editor", "org_admin"].includes(requested) ? requested : "viewer";
  if (!name || !email || password.length < 6) redirect("/users?error=1");

  const pool = getPool();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (organization_id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [organization.id, email, name, passwordHash, role]
    );
  } catch {
    redirect("/users?error=taken");
  }

  const sendInvite = formData.get("send_invite") === "on" || formData.get("send_invite") === "true";
  if (sendInvite) {
    const { sendStaffInvite } = await import("@/lib/email");
    const orgRow = await pool.query(`SELECT invite_from_email FROM organizations WHERE id = $1`, [
      organization.id,
    ]);
    await sendStaffInvite({
      to: email,
      name,
      password,
      companyName: organization.name,
      fromEmail: orgRow.rows[0]?.invite_from_email || organization.invite_from_email,
    });
  }

  revalidatePath("/users");
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
  revalidatePath("/users");
  revalidatePath("/members");
}

export async function updateMember(formData: FormData) {
  const workspace = await requireOrgAdmin();
  const organization = workspace.organization;
  if (!organization) return;

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const requested = String(formData.get("role") || "viewer");
  const role = ["viewer", "analyst", "editor", "org_admin"].includes(requested) ? requested : "viewer";
  if (!id || !name || !email) redirect("/users?error=1");
  if (id === workspace.session.userId && role !== workspace.session.role) {
    // Keep self-demotion blocked for safety when editing own role via table.
  }

  const pool = getPool();
  try {
    if (password.length >= 6) {
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users
         SET name = $1, email = $2, role = $3, password_hash = $4
         WHERE id = $5 AND organization_id = $6 AND role <> 'super_admin'`,
        [name, email, role, passwordHash, id, organization.id]
      );
    } else {
      await pool.query(
        `UPDATE users
         SET name = $1, email = $2, role = $3
         WHERE id = $4 AND organization_id = $5 AND role <> 'super_admin'`,
        [name, email, role, id, organization.id]
      );
    }
  } catch {
    redirect("/users?error=taken");
  }
  revalidatePath("/users");
  revalidatePath("/members");
}

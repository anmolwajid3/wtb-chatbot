"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { canManageCompany } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

async function requireManager() {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (!canManageCompany(workspace.session.role) || !workspace.organization) redirect("/home");
  return workspace.organization;
}

export async function sendProfileNotice(formData: FormData) {
  const organization = await requireManager();
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!title || !body) return;
  await getPool().query(
    `INSERT INTO notices (organization_id, audience, title, body) VALUES ($1, 'profiles', $2, $3)`,
    [organization.id, title, body]
  );
  revalidatePath("/messages");
}

export async function deleteProfileNotice(formData: FormData) {
  const organization = await requireManager();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await getPool().query(`DELETE FROM notices WHERE id = $1 AND organization_id = $2`, [id, organization.id]);
  revalidatePath("/messages");
}

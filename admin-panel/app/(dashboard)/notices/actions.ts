"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";

async function requireLab() {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (workspace.session.role !== "super_admin") redirect("/home");
  return workspace;
}

export async function sendPlatformNotice(formData: FormData) {
  await requireLab();
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const audience = String(formData.get("audience") || "both");
  if (!title || !body || !["companies", "profiles", "both"].includes(audience)) return;
  await getPool().query(
    `INSERT INTO notices (organization_id, audience, title, body) VALUES (NULL, $1, $2, $3)`,
    [audience, title, body]
  );
  revalidatePath("/notices");
}

export async function deletePlatformNotice(formData: FormData) {
  await requireLab();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await getPool().query(`DELETE FROM notices WHERE id = $1 AND organization_id IS NULL`, [id]);
  revalidatePath("/notices");
}

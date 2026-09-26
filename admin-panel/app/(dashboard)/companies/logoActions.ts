"use server";

import { mkdir, readdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { canManageCompany } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function allowedOrganization(organizationId: string) {
  const workspace = await getWorkspace();
  if (!workspace || !organizationId) return null;
  if (workspace.session.role === "super_admin") return workspace;
  if (canManageCompany(workspace.session.role) && workspace.organization?.id === organizationId) return workspace;
  return null;
}

async function clearLogoFiles(organizationId: string) {
  const dir = path.join(process.cwd(), "public", "logos");
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  await Promise.all(
    names
      .filter((name) => name.startsWith(`${organizationId}.`))
      .map((name) => unlink(path.join(dir, name)).catch(() => undefined))
  );
}

export async function saveCompanyLogo(formData: FormData) {
  const organizationId = String(formData.get("organization_id") || "");
  const workspace = await allowedOrganization(organizationId);
  if (!workspace) redirect("/home");
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return;
  const ext = TYPES[file.type];
  if (!ext || file.size > MAX_BYTES) return;

  const dir = path.join(process.cwd(), "public", "logos");
  await mkdir(dir, { recursive: true });
  await clearLogoFiles(organizationId);
  await writeFile(path.join(dir, `${organizationId}.${ext}`), Buffer.from(await file.arrayBuffer()));
  const logoUrl = `/logos/${organizationId}.${ext}?v=${Date.now()}`;
  await getPool().query(`UPDATE organizations SET logo_url = $1 WHERE id = $2`, [logoUrl, organizationId]);
  revalidatePath("/home");
  revalidatePath("/companies");
}

export async function removeCompanyLogo(formData: FormData) {
  const organizationId = String(formData.get("organization_id") || "");
  const workspace = await allowedOrganization(organizationId);
  if (!workspace) redirect("/home");
  await clearLogoFiles(organizationId);
  await getPool().query(`UPDATE organizations SET logo_url = NULL WHERE id = $1`, [organizationId]);
  revalidatePath("/home");
  revalidatePath("/companies");
}

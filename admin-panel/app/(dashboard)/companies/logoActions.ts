"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getPool } from "@/lib/db";
import { canManageCompany } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

const MAX_BYTES = 2 * 1024 * 1024;
const LOGO_BUCKET = "company-logos";
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function getStorageClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to upload logos"
    );
  }
  return createClient(url, serviceKey);
}

async function allowedOrganization(organizationId: string) {
  const workspace = await getWorkspace();
  if (!workspace || !organizationId) return null;
  if (workspace.session.role === "super_admin") return workspace;
  if (canManageCompany(workspace.session.role) && workspace.organization?.id === organizationId) {
    return workspace;
  }
  return null;
}

async function removeStoredLogo(logoUrl: string | null | undefined) {
  if (!logoUrl || !logoUrl.includes(`/${LOGO_BUCKET}/`)) return;
  try {
    const supabase = getStorageClient();
    const marker = `/${LOGO_BUCKET}/`;
    const idx = logoUrl.indexOf(marker);
    if (idx === -1) return;
    const path = logoUrl.slice(idx + marker.length).split("?")[0];
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
  } catch {
    // Best-effort cleanup only.
  }
}

export async function saveCompanyLogo(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const organizationId = String(formData.get("organization_id") || "");
  const workspace = await allowedOrganization(organizationId);
  if (!workspace) return { error: "You cannot change this company's logo." };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a logo file first." };
  }

  const ext = TYPES[file.type];
  if (!ext) {
    return {
      error: "Tiedostomuotoa ei tueta.",
    };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Logo must be 2 MB or smaller." };
  }

  let supabase;
  try {
    supabase = getStorageClient();
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Storage is not configured on this server.",
    };
  }

  const existing = await getPool().query(
    `SELECT logo_url FROM organizations WHERE id = $1`,
    [organizationId]
  );
  const previousUrl = existing.rows[0]?.logo_url as string | null | undefined;

  const storagePath = `${organizationId}/logo-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    const missingBucket =
      /bucket|not found|does not exist/i.test(uploadError.message || "");
    return {
      error: missingBucket
        ? `Create a public Storage bucket named "${LOGO_BUCKET}" in Supabase, then try again. (${uploadError.message})`
        : uploadError.message,
    };
  }

  const { data: publicUrlData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(storagePath);
  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  await getPool().query(`UPDATE organizations SET logo_url = $1 WHERE id = $2`, [
    logoUrl,
    organizationId,
  ]);
  await removeStoredLogo(previousUrl);

  revalidatePath("/home");
  revalidatePath("/companies");
  revalidatePath("/coaches");
  return { ok: true };
}

export async function removeCompanyLogo(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const organizationId = String(formData.get("organization_id") || "");
  const workspace = await allowedOrganization(organizationId);
  if (!workspace) return { error: "You cannot change this company's logo." };

  const existing = await getPool().query(
    `SELECT logo_url FROM organizations WHERE id = $1`,
    [organizationId]
  );
  await removeStoredLogo(existing.rows[0]?.logo_url);
  await getPool().query(`UPDATE organizations SET logo_url = NULL WHERE id = $1`, [organizationId]);

  revalidatePath("/home");
  revalidatePath("/companies");
  revalidatePath("/coaches");
  return { ok: true };
}

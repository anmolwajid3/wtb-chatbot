"use server";

import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const IMAGE_BUCKET = "coach-images";

function getStorageClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local to upload images"
    );
  }
  return createClient(url, serviceKey);
}

function arrField(formData: FormData, name: string): string[] {
  const raw = (formData.get(name) as string) || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function textOrNull(formData: FormData, name: string): string | null {
  const val = formData.get(name) as string;
  return val && val.trim() !== "" ? val : null;
}

function intOrNull(formData: FormData, name: string): number | null {
  const val = formData.get(name) as string;
  return val && val.trim() !== "" ? parseInt(val, 10) : null;
}

export async function toggleCoachActive(formData: FormData) {
  const id = formData.get("id") as string;
  const currentStatus = formData.get("currentStatus") === "true";
  const pool = getPool();
  await pool.query(`UPDATE coaches SET is_active = $1, updated_at = now() WHERE id = $2`, [
    !currentStatus,
    id,
  ]);
  revalidatePath("/coaches");
}

export async function saveCoach(formData: FormData) {
  const id = formData.get("id") as string | null;
  const pool = getPool();

  const fields = {
    coach_name: formData.get("coach_name") as string,
    company_name: textOrNull(formData, "company_name"),
    business_id: textOrNull(formData, "business_id"),
    email: textOrNull(formData, "email"),
    phone: textOrNull(formData, "phone"),
    website_or_linkedin: textOrNull(formData, "website_or_linkedin"),
    operating_area: textOrNull(formData, "operating_area"),
    program_name: textOrNull(formData, "program_name"),
    short_description: textOrNull(formData, "short_description"),
    long_description: textOrNull(formData, "long_description"),
    target_group: textOrNull(formData, "target_group"),
    suited_situations: arrField(formData, "suited_situations"),
    key_themes: arrField(formData, "key_themes"),
    participant_activities: textOrNull(formData, "participant_activities"),
    methods: arrField(formData, "methods"),
    delivery_format: textOrNull(formData, "delivery_format"),
    individual_or_group: textOrNull(formData, "individual_or_group"),
    group_size_min: intOrNull(formData, "group_size_min"),
    group_size_max: intOrNull(formData, "group_size_max"),
    duration: textOrNull(formData, "duration"),
    program_structure: textOrNull(formData, "program_structure"),
    goals: textOrNull(formData, "goals"),
    impact_measurement: textOrNull(formData, "impact_measurement"),
    change_achieved: textOrNull(formData, "change_achieved"),
    price_from: textOrNull(formData, "price_from"),
    pricing_model: textOrNull(formData, "pricing_model"),
    price_includes: textOrNull(formData, "price_includes"),
    additional_services: textOrNull(formData, "additional_services"),
    references_text: textOrNull(formData, "references_text"),
    results_feedback: textOrNull(formData, "results_feedback"),
    certifications: textOrNull(formData, "certifications"),
    keywords: arrField(formData, "keywords"),
    main_category: textOrNull(formData, "main_category"),
    subcategories: arrField(formData, "subcategories"),
    additional_info: textOrNull(formData, "additional_info"),
    availability: textOrNull(formData, "availability"),
    languages: arrField(formData, "languages"),
    video_url: textOrNull(formData, "video_url"),
    material_urls: arrField(formData, "material_urls"),
  };

  const columns = Object.keys(fields);
  const values = Object.values(fields);

  if (id) {
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");
    await pool.query(
      `UPDATE coaches SET ${setClause}, updated_at = now() WHERE id = $${columns.length + 1}`,
      [...values, id]
    );
  } else {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    await pool.query(
      `INSERT INTO coaches (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );
  }

  revalidatePath("/coaches");
  redirect("/coaches");
}

export async function uploadCoachImage(
  coachId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };
  if (!file.type.startsWith("image/")) return { error: "File must be an image" };

  const supabase = getStorageClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${coachId}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: publicUrlData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  const publicUrl = publicUrlData.publicUrl;

  const pool = getPool();
  const existing = await pool.query(`SELECT image_urls FROM coaches WHERE id = $1`, [coachId]);
  const currentUrls: string[] = existing.rows[0]?.image_urls || [];
  const updatedUrls = [...currentUrls, publicUrl];

  await pool.query(`UPDATE coaches SET image_urls = $1, updated_at = now() WHERE id = $2`, [
    updatedUrls,
    coachId,
  ]);

  revalidatePath(`/coaches/${coachId}`);
  revalidatePath("/coaches");
  return {};
}

export async function removeCoachImage(coachId: string, imageUrl: string): Promise<void> {
  const pool = getPool();
  const existing = await pool.query(`SELECT image_urls FROM coaches WHERE id = $1`, [coachId]);
  const currentUrls: string[] = existing.rows[0]?.image_urls || [];
  const updatedUrls = currentUrls.filter((u) => u !== imageUrl);

  await pool.query(`UPDATE coaches SET image_urls = $1, updated_at = now() WHERE id = $2`, [
    updatedUrls,
    coachId,
  ]);

  // Best-effort removal from storage too — not fatal if it fails (e.g. for older,
  // manually-pasted URLs that were never actually uploaded to this bucket).
  try {
    const supabase = getStorageClient();
    const marker = `/${IMAGE_BUCKET}/`;
    const idx = imageUrl.indexOf(marker);
    if (idx !== -1) {
      const path = imageUrl.slice(idx + marker.length);
      await supabase.storage.from(IMAGE_BUCKET).remove([path]);
    }
  } catch {
    // Ignore — the database is already updated, which is what matters most.
  }

  revalidatePath(`/coaches/${coachId}`);
  revalidatePath("/coaches");
}

export async function setCoachAccountCredentials(
  coachId: string,
  username: string,
  password: string
): Promise<{ error?: string }> {
  if (!username?.trim()) return { error: "Username is required" };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters" };

  const pool = getPool();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
      await pool.query(
      `INSERT INTO coach_accounts (coach_id, username, password_hash, must_change_password)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (coach_id) DO UPDATE SET username = $2, password_hash = $3, must_change_password = true`,
      [coachId, username.trim(), passwordHash]
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("coach_accounts_username_key")) {
      return { error: "That username is already taken by another coach" };
    }
    return { error: "Failed to save login" };
  }

  revalidatePath(`/coaches/${coachId}`);
  return {};
}

export async function getCoachAccountUsername(coachId: string): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query(`SELECT username FROM coach_accounts WHERE coach_id = $1`, [
    coachId,
  ]);
  return result.rows[0]?.username || null;
}

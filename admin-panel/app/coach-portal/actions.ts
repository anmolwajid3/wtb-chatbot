"use server";

import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getVerifiedCoachSession } from "@/lib/coachSessionServer";
import { listProfileFields } from "@/lib/workspace";
import { uploadCoachImage, removeCoachImage } from "../(dashboard)/coaches/actions";

function textOrNull(formData: FormData, name: string): string | null {
  const val = formData.get(name) as string;
  return val && val.trim() !== "" ? val : null;
}
function arrField(formData: FormData, name: string): string[] {
  const raw = (formData.get(name) as string) || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function intOrNull(formData: FormData, name: string): number | null {
  const val = formData.get(name) as string;
  return val && val.trim() !== "" ? parseInt(val, 10) : null;
}

export async function saveOwnProfile(formData: FormData) {
  const session = await getVerifiedCoachSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  const pool = getPool();
  const coachRow = await pool.query(`SELECT organization_id FROM coaches WHERE id = $1`, [session.coachId]);
  const organizationId = coachRow.rows[0]?.organization_id as string | undefined;

  const fields: Record<string, unknown> = {
    coach_name: textOrNull(formData, "coach_name") || undefined,
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

  // Don't blank coach_name if the field was omitted
  if (fields.coach_name === undefined) {
    delete fields.coach_name;
  }

  if (organizationId) {
    const defs = await listProfileFields(organizationId, { includeInactive: true });
    const custom: Record<string, unknown> = {};
    for (const def of defs.filter((d) => !d.is_builtin)) {
      const raw = formData.get(`cf_${def.field_key}`);
      if (raw == null) continue;
      const value = String(raw).trim();
      custom[def.field_key] = value;
    }
    fields.custom_fields = custom;
  }

  const columns = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");

  await pool.query(
    `UPDATE coaches SET ${setClause}, updated_at = now() WHERE id = $${columns.length + 1}`,
    [...values, session.coachId]
  );

  revalidatePath("/coach-portal");
  redirect("/coach-portal?saved=1");
}

export async function uploadOwnImage(coachId: string, formData: FormData) {
  const session = await getVerifiedCoachSession();
  if (!session || session.coachId !== coachId) {
    return { error: "Not authorized" };
  }
  return uploadCoachImage(coachId, formData);
}

export async function removeOwnImage(coachId: string, imageUrl: string) {
  const session = await getVerifiedCoachSession();
  if (!session || session.coachId !== coachId) {
    return;
  }
  return removeCoachImage(coachId, imageUrl);
}

export async function changeOwnPassword(formData: FormData) {
  const session = await getVerifiedCoachSession();
  if (!session) redirect("/login");

  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 8) {
    redirect("/coach-portal/change-password?error=short");
  }
  if (newPassword !== confirmPassword) {
    redirect("/coach-portal/change-password?error=mismatch");
  }

  const bcrypt = (await import("bcryptjs")).default;
  const passwordHash = await bcrypt.hash(newPassword, 10);

  const pool = getPool();
  await pool.query(
    `UPDATE coach_accounts SET password_hash = $1, must_change_password = false WHERE id = $2`,
    [passwordHash, session.coachAccountId]
  );

  redirect("/coach-portal");
}

/** Optional password change from the profile page (blank = no change). */
export async function changeOwnPasswordOptional(formData: FormData) {
  const session = await getVerifiedCoachSession();
  if (!session) redirect("/login");

  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  if (!newPassword && !confirmPassword) {
    redirect("/coach-portal");
  }
  if (newPassword.length < 8) {
    redirect("/coach-portal?error=short");
  }
  if (newPassword !== confirmPassword) {
    redirect("/coach-portal?error=mismatch");
  }

  const bcrypt = (await import("bcryptjs")).default;
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await getPool().query(
    `UPDATE coach_accounts SET password_hash = $1, must_change_password = false WHERE id = $2`,
    [passwordHash, session.coachAccountId]
  );
  redirect("/coach-portal?saved=1");
}

export async function submitQuery(formData: FormData) {
  const session = await getVerifiedCoachSession();
  if (!session) redirect("/login");

  const subject = (formData.get("subject") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();
  if (!subject || !message) return;

  const pool = getPool();
  await pool.query(
    `INSERT INTO coach_queries (coach_id, subject, message) VALUES ($1, $2, $3)`,
    [session.coachId, subject, message]
  );

  revalidatePath("/coach-portal/support");
}

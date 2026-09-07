"use server";

import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getVerifiedCoachSession } from "@/lib/coachSessionServer";
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
  const fields = {
    email: textOrNull(formData, "email"),
    phone: textOrNull(formData, "phone"),
    website_or_linkedin: textOrNull(formData, "website_or_linkedin"),
    program_name: textOrNull(formData, "program_name"),
    short_description: textOrNull(formData, "short_description"),
    long_description: textOrNull(formData, "long_description"),
    target_group: textOrNull(formData, "target_group"),
    suited_situations: arrField(formData, "suited_situations"),
    key_themes: arrField(formData, "key_themes"),
    methods: arrField(formData, "methods"),
    delivery_format: textOrNull(formData, "delivery_format"),
    individual_or_group: textOrNull(formData, "individual_or_group"),
    group_size_min: intOrNull(formData, "group_size_min"),
    group_size_max: intOrNull(formData, "group_size_max"),
    duration: textOrNull(formData, "duration"),
    goals: textOrNull(formData, "goals"),
    price_from: textOrNull(formData, "price_from"),
    pricing_model: textOrNull(formData, "pricing_model"),
    price_includes: textOrNull(formData, "price_includes"),
    references_text: textOrNull(formData, "references_text"),
    results_feedback: textOrNull(formData, "results_feedback"),
    certifications: textOrNull(formData, "certifications"),
    availability: textOrNull(formData, "availability"),
    languages: arrField(formData, "languages"),
  };

  const columns = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");

  await pool.query(
    `UPDATE coaches SET ${setClause}, updated_at = now() WHERE id = $${columns.length + 1}`,
    [...values, session.coachId]
  );

  revalidatePath("/coach-portal");
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
  if (!session) redirect("/coach-login");

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

export async function submitQuery(formData: FormData) {
  const session = await getVerifiedCoachSession();
  if (!session) redirect("/coach-login");

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
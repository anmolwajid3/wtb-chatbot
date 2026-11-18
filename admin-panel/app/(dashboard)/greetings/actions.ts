"use server";

import { getPool } from "@/lib/db";
import { assertStaff, canEditCompany } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";

async function requireEditor() {
  await assertStaff(canEditCompany);
}

function detectLocale(text: string): "en" | "fi" | "sv" {
  if (/[äöÄÖ]/.test(text) || /\b(hei|kerro|valmentaja|tiimi|motivaatio)\b/i.test(text)) return "fi";
  if (/[åÅ]/.test(text) || /\b(hej|berätta|hjälp)\b/i.test(text)) return "sv";
  return "en";
}

export async function addGreeting(text: string) {
  await requireEditor();
  if (!text?.trim()) return { error: "Greeting cannot be empty" };
  const workspace = await getWorkspace();
  const pool = getPool();
  const trimmed = text.trim();
  await pool.query(
    `INSERT INTO opening_greetings (greeting_text, organization_id, locale) VALUES ($1, $2, $3)`,
    [trimmed, workspace?.organization?.id ?? null, detectLocale(trimmed)]
  );
  revalidatePath("/greetings");
  return {};
}

export async function updateGreeting(id: string, text: string) {
  await requireEditor();
  if (!text?.trim()) return;
  const pool = getPool();
  await pool.query(`UPDATE opening_greetings SET greeting_text = $1 WHERE id = $2`, [text.trim(), id]);
  revalidatePath("/greetings");
}

export async function toggleGreeting(id: string, currentStatus: boolean) {
  await requireEditor();
  const pool = getPool();
  await pool.query(`UPDATE opening_greetings SET is_active = $1 WHERE id = $2`, [!currentStatus, id]);
  revalidatePath("/greetings");
}

export async function deleteGreeting(id: string) {
  await requireEditor();
  const pool = getPool();
  await pool.query(`DELETE FROM opening_greetings WHERE id = $1`, [id]);
  revalidatePath("/greetings");
}
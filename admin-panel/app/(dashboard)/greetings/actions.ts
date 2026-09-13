"use server";

import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function addGreeting(text: string) {
  if (!text?.trim()) return { error: "Greeting cannot be empty" };
  const pool = getPool();
  await pool.query(`INSERT INTO opening_greetings (greeting_text) VALUES ($1)`, [text.trim()]);
  revalidatePath("/greetings");
  return {};
}

export async function updateGreeting(id: string, text: string) {
  if (!text?.trim()) return;
  const pool = getPool();
  await pool.query(`UPDATE opening_greetings SET greeting_text = $1 WHERE id = $2`, [text.trim(), id]);
  revalidatePath("/greetings");
}

export async function toggleGreeting(id: string, currentStatus: boolean) {
  const pool = getPool();
  await pool.query(`UPDATE opening_greetings SET is_active = $1 WHERE id = $2`, [!currentStatus, id]);
  revalidatePath("/greetings");
}

export async function deleteGreeting(id: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM opening_greetings WHERE id = $1`, [id]);
  revalidatePath("/greetings");
}
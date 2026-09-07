"use server";

import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateQuery(id: string, status: string, adminResponse: string) {
  const pool = getPool();
  await pool.query(
    `UPDATE coach_queries SET status = $1, admin_response = $2, updated_at = now() WHERE id = $3`,
    [status, adminResponse || null, id]
  );
  revalidatePath("/queries");
}

export async function deleteQuery(id: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM coach_queries WHERE id = $1`, [id]);
  revalidatePath("/queries");
}
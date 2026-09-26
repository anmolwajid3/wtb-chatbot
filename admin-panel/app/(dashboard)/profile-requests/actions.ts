"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

async function guard() {
  const workspace = await requireOrganization();
  if (!canManageCompany(workspace.session.role)) redirect("/home");
  return workspace;
}

export async function approveProfileRequest(formData: FormData) {
  const { organization } = await guard();
  const id = String(formData.get("id") || "");
  const pool = getPool();
  const found = await pool.query(
    `SELECT * FROM profile_requests WHERE id = $1 AND organization_id = $2 AND status = 'pending'`,
    [id, organization.id]
  );
  const request = found.rows[0];
  if (!request) redirect("/profile-requests");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const coach = await client.query(
      `INSERT INTO coaches (coach_name, email, short_description, organization_id, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`,
      [request.name, request.email, request.note, organization.id]
    );
    await client.query(
      `INSERT INTO coach_accounts (coach_id, username, password_hash, must_change_password)
       VALUES ($1, $2, $3, false)`,
      [coach.rows[0].id, request.username, request.password_hash]
    );
    await client.query(
      `UPDATE profile_requests SET status = 'approved', reviewed_at = now() WHERE id = $1`,
      [id]
    );
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    redirect("/profile-requests?error=taken");
  } finally {
    client.release();
  }
  revalidatePath("/coaches");
  revalidatePath("/profile-requests");
  redirect("/profile-requests");
}

export async function declineProfileRequest(formData: FormData) {
  const { organization } = await guard();
  const id = String(formData.get("id") || "");
  await getPool().query(
    `UPDATE profile_requests SET status = 'declined', reviewed_at = now()
     WHERE id = $1 AND organization_id = $2 AND status = 'pending'`,
    [id, organization.id]
  );
  revalidatePath("/profile-requests");
  redirect("/profile-requests");
}

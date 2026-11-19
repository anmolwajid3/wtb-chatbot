"use server";

import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { canManageCompany, clampCreditLimit, clampProfileLimit } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

/** Super admin or company admin: set monthly message allowance and coach cap. */
export async function updateCompanyLimits(formData: FormData) {
  const workspace = await getWorkspace();
  if (!workspace || !canManageCompany(workspace.session.role)) redirect("/home");

  const returnTo = String(formData.get("return_to") || "/home");
  const creditLimit = clampCreditLimit(formData.get("credit_limit"));
  const profileLimit = clampProfileLimit(formData.get("profile_limit"));
  const resetUsed = String(formData.get("reset_used") || "") === "1";

  let organizationId = String(formData.get("id") || "");
  if (workspace.session.role === "super_admin") {
    if (!organizationId) organizationId = workspace.organization?.id || "";
  } else {
    organizationId = workspace.organization?.id || "";
  }
  if (!organizationId) redirect("/companies?need=1");

  const pool = getPool();
  if (resetUsed) {
    await pool.query(
      `UPDATE organizations
       SET credit_limit = $1,
           profile_limit = $2,
           credits_used = 0,
           credits_period_start = date_trunc('month', now())
       WHERE id = $3`,
      [creditLimit, profileLimit, organizationId]
    );
  } else {
    await pool.query(
      `UPDATE organizations
       SET credit_limit = $1, profile_limit = $2
       WHERE id = $3`,
      [creditLimit, profileLimit, organizationId]
    );
  }

  redirect(returnTo.startsWith("/") ? returnTo : "/home");
}

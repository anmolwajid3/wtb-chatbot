"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { canManageCompany } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

export async function saveMatching(formData: FormData) {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (!canManageCompany(workspace.session.role)) redirect("/home");
  if (!workspace.organization) redirect("/companies?need=1");

  const maxMatches = Math.min(10, Math.max(1, Number(formData.get("max_matches")) || 3));
  const minScore = Math.min(100, Math.max(0, Number(formData.get("min_match_score")) || 50));
  const turns = Math.min(8, Math.max(1, Number(formData.get("followup_turns")) || 2));
  const showScore = formData.get("show_match_score") === "on";

  await getPool().query(
    `UPDATE organizations
     SET max_matches = $1, min_match_score = $2, followup_turns = $3, show_match_score = $4
     WHERE id = $5`,
    [maxMatches, minScore, turns, showScore, workspace.organization.id]
  );
  revalidatePath("/matching");
  revalidatePath("/home");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";

const ALLOWED = ["", "contacted", "message_sent", "follow_up", "quoted", "closed", "no_action"];

export async function setConversationTag(formData: FormData) {
  const workspace = await getWorkspace();
  if (!workspace?.organization) redirect("/login");
  const id = String(formData.get("id") || "");
  const tag = String(formData.get("review_tag") || "");
  if (!id || !ALLOWED.includes(tag)) return;
  await getPool().query(
    `UPDATE conversations SET review_tag = NULLIF($1, '') WHERE id = $2 AND organization_id = $3`,
    [tag, id, workspace.organization.id]
  );
  revalidatePath("/logs");
  revalidatePath(`/logs/${id}`);
}

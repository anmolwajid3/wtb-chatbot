"use server";

import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { REQUIRED_PLACEHOLDERS } from "./requiredPlaceholders";
import { assertStaff, canEditCompany } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

export async function savePrompt(agentName: string, promptText: string) {
  await assertStaff(canEditCompany);
  if (!promptText?.trim()) return { error: "Prompt cannot be empty" };

  const required = REQUIRED_PLACEHOLDERS[agentName] || [];
  const missing = required.filter((p) => !promptText.includes(p));
  if (missing.length > 0) {
    return { error: `Missing required placeholder(s): ${missing.join(", ")} — the bot needs these to function` };
  }

  const workspace = await getWorkspace();
  const organizationId = workspace?.organization?.id;
  if (!organizationId) return { error: "Open a company first" };

  const pool = getPool();
  await pool.query(
    `INSERT INTO company_agent_prompts (organization_id, agent_name, system_prompt, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (organization_id, agent_name) DO UPDATE SET system_prompt = EXCLUDED.system_prompt, updated_at = now()`,
    [organizationId, agentName, promptText]
  );
  revalidatePath("/master-prompts");
  return {};
}

export async function resetPrompt(agentName: string) {
  await assertStaff(canEditCompany);
  const workspace = await getWorkspace();
  const organizationId = workspace?.organization?.id;
  if (!organizationId) return;
  const pool = getPool();
  await pool.query(`DELETE FROM company_agent_prompts WHERE agent_name = $1 AND organization_id = $2`, [
    agentName,
    organizationId,
  ]);
  revalidatePath("/master-prompts");
}
"use server";

import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { REQUIRED_PLACEHOLDERS } from "./requiredPlaceholders";

export async function savePrompt(agentName: string, promptText: string) {
  if (!promptText?.trim()) return { error: "Prompt cannot be empty" };

  const required = REQUIRED_PLACEHOLDERS[agentName] || [];
  const missing = required.filter((p) => !promptText.includes(p));
  if (missing.length > 0) {
    return { error: `Missing required placeholder(s): ${missing.join(", ")} — the bot needs these to function` };
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO agent_prompts (agent_name, system_prompt, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (agent_name) DO UPDATE SET system_prompt = $2, updated_at = now()`,
    [agentName, promptText]
  );
  revalidatePath("/master-prompts");
  return {};
}

export async function resetPrompt(agentName: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM agent_prompts WHERE agent_name = $1`, [agentName]);
  revalidatePath("/master-prompts");
}
"use server";

import { getPool } from "@/lib/db";
import { assertStaff, canAnalyze } from "@/lib/plans";
import { revalidatePath } from "next/cache";

async function requireOrgId() {
  const workspace = await assertStaff(canAnalyze);
  return workspace.organization?.id ?? null;
}

export async function setActiveModel(model: string) {
  if (!model?.trim()) return { error: "Model is required" };
  const organizationId = await requireOrgId();
  if (!organizationId) return { error: "Open a company first" };
  const pool = getPool();
  await pool.query(
    `INSERT INTO company_llm_settings (organization_id, active_model, spend_period, updated_at)
     VALUES ($1, $2, 'month', now())
     ON CONFLICT (organization_id) DO UPDATE SET active_model = EXCLUDED.active_model, updated_at = now()`,
    [organizationId, model.trim()]
  );
  revalidatePath("/llm-settings");
  return {};
}

export async function setMaxCap(capUsd: string) {
  const organizationId = await requireOrgId();
  if (!organizationId) return { error: "Open a company first" };
  const pool = getPool();
  const value = capUsd?.trim() ? parseFloat(capUsd) : null;
  await pool.query(
    `INSERT INTO company_llm_settings (organization_id, active_model, max_cost_cap_usd, spend_period, updated_at)
     VALUES ($1, 'not set', $2, 'month', now())
     ON CONFLICT (organization_id) DO UPDATE SET max_cost_cap_usd = EXCLUDED.max_cost_cap_usd, updated_at = now()`,
    [organizationId, value]
  );
  revalidatePath("/llm-settings");
  return {};
}

export async function setSpendPeriod(formData: FormData) {
  const organizationId = await requireOrgId();
  if (!organizationId) return;
  const period = String(formData.get("spend_period") || "month");
  if (!["day", "week", "month"].includes(period)) return;
  const pool = getPool();
  await pool.query(
    `INSERT INTO company_llm_settings (organization_id, active_model, spend_period, updated_at)
     VALUES ($1, 'not set', $2, now())
     ON CONFLICT (organization_id) DO UPDATE SET spend_period = EXCLUDED.spend_period, updated_at = now()`,
    [organizationId, period]
  );
  revalidatePath("/llm-settings");
}

export async function upsertPricing(model: string, inputPrice: string, outputPrice: string) {
  if (!model?.trim()) return { error: "Model is required" };
  const inputVal = parseFloat(inputPrice);
  const outputVal = parseFloat(outputPrice);
  if (isNaN(inputVal) || isNaN(outputVal)) return { error: "Prices must be numbers" };

  const pool = getPool();
  await pool.query(
    `INSERT INTO llm_pricing (model, input_price_per_1m, output_price_per_1m, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (model) DO UPDATE SET
       input_price_per_1m = $2, output_price_per_1m = $3, updated_at = now()`,
    [model.trim(), inputVal, outputVal]
  );
  revalidatePath("/llm-settings");
  return {};
}

export async function deletePricing(model: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM llm_pricing WHERE model = $1`, [model]);
  revalidatePath("/llm-settings");
}

export async function resetUsageLog() {
  const organizationId = await requireOrgId();
  if (!organizationId) return;
  const pool = getPool();
  await pool.query(`DELETE FROM llm_usage_log WHERE organization_id = $1`, [organizationId]);
  revalidatePath("/llm-settings");
}
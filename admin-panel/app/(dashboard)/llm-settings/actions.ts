"use server";

import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function setActiveModel(model: string) {
  if (!model?.trim()) return { error: "Model is required" };
  const pool = getPool();
  await pool.query(
    `UPDATE llm_settings SET active_model = $1, updated_at = now() WHERE id = 1`,
    [model.trim()]
  );
  revalidatePath("/llm-settings");
  return {};
}

export async function setMaxCap(capUsd: string) {
  const pool = getPool();
  const value = capUsd?.trim() ? parseFloat(capUsd) : null;
  await pool.query(
    `UPDATE llm_settings SET max_cost_cap_usd = $1, updated_at = now() WHERE id = 1`,
    [value]
  );
  revalidatePath("/llm-settings");
  return {};
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
  const pool = getPool();
  await pool.query(`DELETE FROM llm_usage_log`);
  revalidatePath("/llm-settings");
}
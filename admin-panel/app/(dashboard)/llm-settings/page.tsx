import { getPool } from "@/lib/db";
import {
  setActiveModel,
  setMaxCap,
  upsertPricing,
  deletePricing,
  resetUsageLog,
} from "./actions";
import ModelSwitcher from "./ModelSwitcher";
import MaxCapForm from "./MaxCapForm";
import PricingRow from "./PricingRow";
import AddPricingForm from "./AddPricingForm";

export const dynamic = "force-dynamic";

type UsageByModel = {
  model: string;
  calls: number;
  total_input: number;
  total_output: number;
  total_cost: number;
  all_actual: boolean;
  any_actual: boolean;
};

type UsageByAgent = {
  agent_name: string;
  calls: number;
  total_cost: number;
};

export default async function LlmSettingsPage() {
  const pool = getPool();

  const settingsResult = await pool.query(`SELECT active_model, max_cost_cap_usd FROM llm_settings WHERE id = 1`);
  const settings = settingsResult.rows[0] || { active_model: "not set", max_cost_cap_usd: null };

  const byModelResult = await pool.query(`
    SELECT model, count(*)::int AS calls,
           coalesce(sum(input_tokens), 0)::int AS total_input,
           coalesce(sum(output_tokens), 0)::int AS total_output,
           coalesce(sum(estimated_cost_usd), 0)::float AS total_cost,
           bool_and(is_actual_cost) AS all_actual,
           bool_or(is_actual_cost) AS any_actual
    FROM llm_usage_log GROUP BY model ORDER BY total_cost DESC
  `);
  const usageByModel: UsageByModel[] = byModelResult.rows;

  const hasAnyRealCost = usageByModel.some((row) => row.any_actual);
  const allRealCost = usageByModel.length > 0 && usageByModel.every((row) => row.all_actual);

  const byAgentResult = await pool.query(`
    SELECT agent_name, count(*)::int AS calls,
           coalesce(sum(estimated_cost_usd), 0)::float AS total_cost
    FROM llm_usage_log GROUP BY agent_name ORDER BY total_cost DESC
  `);
  const usageByAgent: UsageByAgent[] = byAgentResult.rows;

  const totalSpend = usageByModel.reduce((sum, row) => sum + row.total_cost, 0);
  const cap = settings.max_cost_cap_usd !== null ? Number(settings.max_cost_cap_usd) : null;
  const overCap = cap !== null && totalSpend >= cap;
  const nearCap = cap !== null && !overCap && totalSpend >= cap * 0.8;

  const pricingResult = await pool.query(
    `SELECT model, input_price_per_1m::float, output_price_per_1m::float FROM llm_pricing ORDER BY model`
  );

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-2">
        LLM Settings
      </h1>
      <p className="text-sm text-neutral-400 mb-6">
        Switch models, track spend, and manage pricing — all changes apply immediately, no
        redeploy needed.
      </p>

      <div
        className={`rounded-lg border p-4 mb-6 ${
          overCap
            ? "bg-red-900/20 border-red-800"
            : nearCap
            ? "bg-amber-900/20 border-amber-800"
            : "bg-neutral-900 border-neutral-800"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Total spend logged</p>
            <p className={`text-3xl font-semibold ${overCap ? "text-red-400" : nearCap ? "text-amber-400" : "text-neutral-100"}`}>
              ${totalSpend.toFixed(4)}
              {cap !== null && <span className="text-base text-neutral-500"> / ${cap.toFixed(2)} cap</span>}
            </p>
          </div>
          {overCap && (
            <span className="text-xs bg-red-900/40 text-red-400 px-3 py-1 rounded-full">
              Over cap — visibility only, bot is still running
            </span>
          )}
        </div>
        {usageByModel.length > 0 && (
          <p className="text-xs mt-2">
            {allRealCost ? (
              <span className="text-green-400">✓ Showing OpenRouter&apos;s real reported cost</span>
            ) : hasAnyRealCost ? (
              <span className="text-amber-400">⚠ Mix of real OpenRouter cost and estimated cost (some calls didn&apos;t return real cost data)</span>
            ) : (
              <span className="text-neutral-500">⚠ Estimated only — real cost data from OpenRouter not available yet, using the pricing table below instead</span>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
          <h3 className="font-medium text-neutral-100 mb-1">Active Model</h3>
          <p className="text-xs text-neutral-500 mb-3">Currently: {settings.active_model}</p>
          <ModelSwitcher currentModel={settings.active_model} setActiveModel={setActiveModel} />
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
          <h3 className="font-medium text-neutral-100 mb-1">Max Spend Cap</h3>
          <p className="text-xs text-neutral-500 mb-3">A visibility threshold, not an automatic cutoff</p>
          <MaxCapForm currentCap={cap} setMaxCap={setMaxCap} />
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden mb-6">
        <h3 className="font-medium text-neutral-100 px-5 pt-4 pb-2">Usage by Model</h3>
        <table className="w-full text-sm">
          <thead className="bg-black border-b border-neutral-800">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Model</th>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Calls</th>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Input tokens</th>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Output tokens</th>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Cost</th>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Source</th>
            </tr>
          </thead>
          <tbody>
            {usageByModel.map((row) => (
              <tr key={row.model} className="border-b border-neutral-800 last:border-0">
                <td className="px-4 py-2 text-neutral-100 text-xs">{row.model}</td>
                <td className="px-4 py-2 text-neutral-300 text-xs">{row.calls}</td>
                <td className="px-4 py-2 text-neutral-300 text-xs">{row.total_input.toLocaleString("en-GB")}</td>
                <td className="px-4 py-2 text-neutral-300 text-xs">{row.total_output.toLocaleString("en-GB")}</td>
                <td className="px-4 py-2 text-neutral-300 text-xs">${row.total_cost.toFixed(4)}</td>
                <td className="px-4 py-2 text-xs">
                  {row.all_actual ? (
                    <span className="text-green-400">Real</span>
                  ) : row.any_actual ? (
                    <span className="text-amber-400">Mixed</span>
                  ) : (
                    <span className="text-neutral-500">Estimated</span>
                  )}
                </td>
              </tr>
            ))}
            {usageByModel.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-600 text-xs">
                  No usage logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden mb-6">
        <h3 className="font-medium text-neutral-100 px-5 pt-4 pb-2">Usage by Agent</h3>
        <table className="w-full text-sm">
          <thead className="bg-black border-b border-neutral-800">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Agent</th>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Calls</th>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {usageByAgent.map((row) => (
              <tr key={row.agent_name} className="border-b border-neutral-800 last:border-0">
                <td className="px-4 py-2 text-neutral-100 text-xs">{row.agent_name}</td>
                <td className="px-4 py-2 text-neutral-300 text-xs">{row.calls}</td>
                <td className="px-4 py-2 text-neutral-300 text-xs">${row.total_cost.toFixed(4)}</td>
              </tr>
            ))}
            {usageByAgent.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-neutral-600 text-xs">
                  No usage logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <h3 className="font-medium text-neutral-100">Pricing (fallback only)</h3>
            <p className="text-xs text-neutral-500">
              Only used to estimate cost on the rare call where OpenRouter doesn&apos;t return a real
              cost figure. Not needed for normal operation.
            </p>
          </div>
          <AddPricingForm upsertPricing={upsertPricing} />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-black border-b border-neutral-800">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Model</th>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Input $</th>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Output $</th>
              <th className="text-left px-4 py-2 font-medium text-neutral-400 text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pricingResult.rows.map((p) => (
              <PricingRow key={p.model} pricing={p} upsertPricing={upsertPricing} deletePricing={deletePricing} />
            ))}
            {pricingResult.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-600 text-xs">
                  No pricing configured yet — usage will use a conservative default estimate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={resetUsageLog}>
        <button
          type="submit"
          className="text-xs text-neutral-500 hover:text-red-400"
        >
          Clear all usage history (manual reset — no automatic monthly reset yet)
        </button>
      </form>
    </div>
  );
}
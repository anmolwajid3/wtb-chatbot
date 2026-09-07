import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import GuardrailRow from "./GuardrailRow";
import AddGuardrailForm from "./AddGuardrailForm";

export const dynamic = "force-dynamic";

type Guardrail = { id: string; rule_text: string; category: string; is_active: boolean };

async function getGuardrails(): Promise<Guardrail[]> {
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM guardrails ORDER BY category, rule_text`);
  return result.rows;
}

async function addGuardrail(rule_text: string, category: string) {
  "use server";
  if (!rule_text?.trim()) return;
  const pool = getPool();
  await pool.query(`INSERT INTO guardrails (rule_text, category) VALUES ($1, $2)`, [
    rule_text.trim(),
    category?.trim() || "",
  ]);
  revalidatePath("/guardrails");
}

async function updateGuardrail(id: string, rule_text: string, category: string) {
  "use server";
  if (!rule_text?.trim()) return;
  const pool = getPool();
  await pool.query(
    `UPDATE guardrails SET rule_text = $1, category = $2 WHERE id = $3`,
    [rule_text.trim(), category?.trim() || "", id]
  );
  revalidatePath("/guardrails");
}

async function toggleGuardrail(id: string, currentStatus: boolean) {
  "use server";
  const pool = getPool();
  await pool.query(`UPDATE guardrails SET is_active = $1 WHERE id = $2`, [!currentStatus, id]);
  revalidatePath("/guardrails");
}

async function deleteGuardrail(id: string) {
  "use server";
  const pool = getPool();
  await pool.query(`DELETE FROM guardrails WHERE id = $1`, [id]);
  revalidatePath("/guardrails");
}

export default async function GuardrailsPage() {
  const guardrails = await getGuardrails();

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide">
          Guardrails
        </h1>
        <AddGuardrailForm addGuardrail={addGuardrail} />
      </div>
      <p className="text-sm text-neutral-400 mb-6">
        Things the bot must never promise or do. Every draft reply is checked against this
        active list before being sent — see backend/app/agents/guardrail_check.py. Click the
        pencil to edit a row.
      </p>

      <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-black border-b border-neutral-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-40">Topic</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Rule</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-24">Status</th>
              <th className="text-right px-4 py-3 font-medium text-neutral-400 w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {guardrails.map((g) => (
              <GuardrailRow
                key={g.id}
                guardrail={g}
                updateGuardrail={updateGuardrail}
                toggleGuardrail={toggleGuardrail}
                deleteGuardrail={deleteGuardrail}
              />
            ))}
            {guardrails.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-600">
                  No guardrails yet — click &quot;+ Add new guardrail&quot; above to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
import { getPool } from "@/lib/db";
import { assertStaff, canEditCompany } from "@/lib/plans";
import { getWorkspace, requireOrganization } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import GuardrailRow from "./GuardrailRow";
import AddGuardrailForm from "./AddGuardrailForm";

export const dynamic = "force-dynamic";

type Guardrail = { id: string; rule_text: string; category: string; is_active: boolean };

async function getGuardrails(organizationId: string | null): Promise<Guardrail[]> {
  const pool = getPool();
  const result = organizationId
    ? await pool.query(
        `SELECT * FROM guardrails WHERE organization_id = $1 ORDER BY category, rule_text`,
        [organizationId]
      )
    : await pool.query(
        `SELECT * FROM guardrails WHERE organization_id IS NULL ORDER BY category, rule_text`
      );
  return result.rows;
}

async function addGuardrail(rule_text: string, category: string) {
  "use server";
  await assertStaff(canEditCompany);
  if (!rule_text?.trim()) return;
  const workspace = await getWorkspace();
  const pool = getPool();
  await pool.query(
    `INSERT INTO guardrails (rule_text, category, organization_id) VALUES ($1, $2, $3)`,
    [rule_text.trim(), category?.trim() || "", workspace?.organization?.id ?? null]
  );
  revalidatePath("/guardrails");
}

async function updateGuardrail(id: string, rule_text: string, category: string) {
  "use server";
  await assertStaff(canEditCompany);
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
  await assertStaff(canEditCompany);
  const pool = getPool();
  await pool.query(`UPDATE guardrails SET is_active = $1 WHERE id = $2`, [!currentStatus, id]);
  revalidatePath("/guardrails");
}

async function deleteGuardrail(id: string) {
  "use server";
  await assertStaff(canEditCompany);
  const pool = getPool();
  await pool.query(`DELETE FROM guardrails WHERE id = $1`, [id]);
  revalidatePath("/guardrails");
}

export default async function GuardrailsPage() {
  const { session, organization } = await requireOrganization();
  if (!canEditCompany(session.role)) redirect("/home");
  const guardrails = await getGuardrails(organization.id);

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
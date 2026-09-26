import { getPool } from "@/lib/db";
import CoachForm from "../CoachForm";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

async function getCoach(id: string, organizationId: string | null) {
  const pool = getPool();
  const result = organizationId
    ? await pool.query(
        `SELECT * FROM coaches WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL)`,
        [id, organizationId]
      )
    : await pool.query(`SELECT * FROM coaches WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export default async function EditCoachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organization } = await requireOrganization();
  const coach = await getCoach(id, organization.id);
  const label = organization.profile_label;

  if (!coach) return notFound();

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="font-display text-2xl text-neutral-100 mb-6">
        {label}: {coach.coach_name}
      </h1>
      <CoachForm coach={coach} />
    </div>
  );
}
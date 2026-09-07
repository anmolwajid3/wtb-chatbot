import { getPool } from "@/lib/db";
import CoachForm from "../CoachForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getCoach(id: string) {
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM coaches WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export default async function EditCoachPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const coach = await getCoach(id);

  if (!coach) return notFound();

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-6">
        Edit Coach: {coach.coach_name}
      </h1>
      <CoachForm coach={coach} />
    </div>
  );
}
import { getPool } from "@/lib/db";
import { requireCoachSession } from "@/lib/coachSessionServer";

export const dynamic = "force-dynamic";

export default async function CoachMessagesPage() {
  const session = await requireCoachSession();
  const pool = getPool();
  const coach = await pool.query(`SELECT organization_id FROM coaches WHERE id = $1`, [session.coachId]);
  const organizationId = coach.rows[0]?.organization_id;
  const notices = await pool.query(
    `SELECT id, title, body, created_at FROM notices
     WHERE audience IN ('profiles', 'both')
       AND (organization_id IS NULL OR organization_id = $1)
     ORDER BY created_at DESC`,
    [organizationId]
  );

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="font-display text-3xl text-neutral-100 mb-2">Messages</h1>
      <p className="text-neutral-400 mb-6">Notes from your company and from Opas. They are for you to read.</p>
      {notices.rows.length === 0 && <p className="text-sm text-neutral-500">No messages yet.</p>}
      <ul className="grid gap-3">
        {notices.rows.map((notice) => (
          <li key={notice.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <p className="font-medium text-neutral-100">{notice.title}</p>
            <p className="text-sm text-neutral-400 mt-1 whitespace-pre-wrap">{notice.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

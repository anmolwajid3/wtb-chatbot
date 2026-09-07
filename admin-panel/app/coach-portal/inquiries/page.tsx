
import { getPool } from "@/lib/db";
import { requireCoachSession } from "@/lib/coachSessionServer";

export const dynamic = "force-dynamic";

type InquiryRow = {
  id: string;
  started_at: string;
  outcome: string;
  summary_text: string | null;
  contact_info: string | null;
};

type StructuredSummary = {
  need_summary?: string;
  key_details?: string[];
  next_step?: string;
};

const outcomeStyles: Record<string, string> = {
  matched: "bg-green-900/40 text-green-400",
  purchase_order: "bg-amber-900/40 text-amber-400",
  in_progress: "bg-blue-900/40 text-blue-400",
};

export default async function CoachInquiriesPage() {
  const session = await requireCoachSession();

  const pool = getPool();
  const result = await pool.query(
    `SELECT c.id, c.started_at, c.outcome, qr.summary_text, qr.contact_info
     FROM conversations c
     LEFT JOIN quote_requests qr ON qr.conversation_id = c.id
     WHERE $1 = ANY(c.matched_coach_ids)
     ORDER BY c.started_at DESC`,
    [session.coachId]
  );
  const rows: InquiryRow[] = result.rows;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-2">
        My Inquiries
      </h1>
      <p className="text-sm text-neutral-400 mb-6">
        Customers the assistant matched you with. Pricing is never discussed by the assistant —
        that stays a direct conversation between you and WTB&apos;s team.
      </p>

      <div className="space-y-3">
        {rows.map((r) => {
          let details: StructuredSummary = {};
          if (r.summary_text) {
            try {
              details = JSON.parse(r.summary_text);
            } catch {
              details = { need_summary: r.summary_text };
            }
          }

          return (
            <div key={r.id} className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-500">
                {new Date(r.started_at).toLocaleString("en-GB")}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    outcomeStyles[r.outcome] || "bg-neutral-800 text-neutral-500"
                  }`}
                >
                  {r.outcome.replace(/_/g, " ")}
                </span>
              </div>
              {details.need_summary && (
                <p className="text-sm text-neutral-200 mb-2">{details.need_summary}</p>
              )}
              {details.key_details && details.key_details.length > 0 && (
                <ul className="text-sm text-neutral-400 list-disc list-inside mb-2">
                  {details.key_details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
              {r.contact_info ? (
                <p className="text-xs text-amber-400">Contact: {r.contact_info}</p>
              ) : (
                <p className="text-xs text-neutral-600 italic">
                  No contact details shared yet — WTB&apos;s team will follow up once available.
                </p>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-sm text-neutral-600 italic">No inquiries yet.</p>
        )}
      </div>
    </div>
  );
}

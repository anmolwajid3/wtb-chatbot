import Link from "next/link";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type ConversationRow = {
  id: string;
  started_at: string;
  outcome: string;
  matched_coach_ids: string[] | null;
  has_quote_request: boolean;
};

async function getConversations(): Promise<ConversationRow[]> {
  const pool = getPool();
  const result = await pool.query(`
    SELECT c.id, c.started_at, c.outcome, c.matched_coach_ids,
           (qr.id IS NOT NULL) AS has_quote_request
    FROM conversations c
    LEFT JOIN quote_requests qr ON qr.conversation_id = c.id
    ORDER BY c.started_at DESC
    LIMIT 200
  `);
  return result.rows;
}

const outcomeStyles: Record<string, string> = {
  matched: "bg-green-900/40 text-green-400",
  purchase_order: "bg-amber-900/40 text-amber-400",
  spam: "bg-neutral-800 text-neutral-500",
  abandoned: "bg-neutral-800 text-neutral-500",
  in_progress: "bg-blue-900/40 text-blue-400",
};

function formatOutcome(outcome: string) {
  return outcome.replace(/_/g, " ");
}

export default async function LogsPage() {
  const conversations = await getConversations();

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-2">
        Conversation Logs
      </h1>
      <p className="text-sm text-neutral-400 mb-6">
        Every conversation the bot has had, kept for review — including which coaches were
        matched and whether a quote request was compiled.
      </p>

      <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black border-b border-neutral-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Started</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Outcome</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Coaches matched</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Quote request</th>
              <th className="text-right px-4 py-3 font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((c) => (
              <tr key={c.id} className="border-b border-neutral-800 last:border-0">
                <td className="px-4 py-3 text-neutral-300">
                {new Date(c.started_at).toLocaleString("en-GB")}
                  
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      outcomeStyles[c.outcome] || "bg-neutral-800 text-neutral-500"
                    }`}
                  >
                    {formatOutcome(c.outcome)}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {c.matched_coach_ids?.length ? `${c.matched_coach_ids.length} coach(es)` : "—"}
                </td>
                <td className="px-4 py-3 text-neutral-400">{c.has_quote_request ? "Yes" : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/logs/${c.id}`} className="text-amber-400 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {conversations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-600">
                  No conversations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
import { requireCoachSession } from "@/lib/coachSessionServer";
import { getPool } from "@/lib/db";
import { submitQuery } from "../actions";

export const dynamic = "force-dynamic";

type QueryRow = {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_response: string | null;
  created_at: string;
};

const statusStyles: Record<string, string> = {
  open: "bg-blue-900/40 text-blue-400",
  pending: "bg-amber-900/40 text-amber-400",
  closed: "bg-neutral-800 text-neutral-500",
};

export default async function CoachSupportPage() {
  const session = await requireCoachSession();

  const pool = getPool();
  const result = await pool.query(
    `SELECT id, subject, message, status, admin_response, created_at
     FROM coach_queries WHERE coach_id = $1 ORDER BY created_at DESC`,
    [session.coachId]
  );
  const queries: QueryRow[] = result.rows;

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-2">
        Support
      </h1>
      <p className="text-sm text-neutral-400 mb-6">
        Send a message to WTB&apos;s team and track its status here.
      </p>

      <form
        action={submitQuery}
        className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-3 mb-8"
      >
        <h3 className="font-medium text-neutral-100">Send a new message</h3>
        <input
          type="text"
          name="subject"
          placeholder="Subject"
          className="w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        />
        <textarea
          name="message"
          placeholder="Describe your question or issue..."
          rows={4}
          className="w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md text-sm hover:bg-amber-400"
        >
          Send
        </button>
      </form>

      <h3 className="font-medium text-neutral-100 mb-3">Your messages</h3>
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black border-b border-neutral-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Message</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-32">Status</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-64">Response</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-32">Date</th>
            </tr>
          </thead>
          <tbody>
            {queries.map((q) => (
              <tr key={q.id} className="border-b border-neutral-800 last:border-0 align-top">
                <td className="px-4 py-3">
                  <p className="text-neutral-100 font-medium">{q.subject}</p>
                  <p className="text-neutral-400 text-xs mt-1">{q.message}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusStyles[q.status] || ""}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {q.admin_response ? (
                    <p className="text-xs text-neutral-300">{q.admin_response}</p>
                  ) : (
                    <p className="text-xs text-neutral-600 italic">No response yet</p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                 {new Date(q.created_at).toLocaleDateString("en-GB")}
                </td>
              </tr>
            ))}
            {queries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-600">
                  No messages sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
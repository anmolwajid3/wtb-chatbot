import { getPool } from "@/lib/db";
import QueryRow from "./QueryRow";
import { updateQuery, deleteQuery } from "./actions";

export const dynamic = "force-dynamic";

export default async function QueriesPage({
  searchParams,
}: {
  searchParams: Promise<{ coach?: string }>;
}) {
  const params = await searchParams;
  const coachFilter = params.coach || "";

  const pool = getPool();

  const statsResult = await pool.query(
    `SELECT status, count(*)::int AS count FROM coach_queries GROUP BY status`
  );
  const stats = { open: 0, pending: 0, closed: 0 };
  for (const row of statsResult.rows) {
    if (row.status in stats) {
      stats[row.status as keyof typeof stats] = row.count;
    }
  }

  const coachListResult = await pool.query(
    `SELECT DISTINCT c.id, c.coach_name
     FROM coaches c JOIN coach_queries q ON q.coach_id = c.id
     ORDER BY c.coach_name`
  );

  const queryParams: string[] = [];
  let whereClause = "";
  if (coachFilter) {
    whereClause = "WHERE q.coach_id = $1";
    queryParams.push(coachFilter);
  }

  const result = await pool.query(
    `SELECT q.id, c.coach_name, q.subject, q.message, q.status, q.admin_response, q.created_at
     FROM coach_queries q
     JOIN coaches c ON c.id = q.coach_id
     ${whereClause}
     ORDER BY
       CASE q.status WHEN 'open' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
       q.created_at DESC`,
    queryParams
  );
  const queries = result.rows;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-2">
        Coach Support Queries
      </h1>
      <p className="text-sm text-neutral-400 mb-6">
        Messages coaches have sent through their portal.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-neutral-900 border border-blue-900/40 rounded-lg p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Open</p>
          <p className="text-3xl font-semibold text-blue-400">{stats.open}</p>
        </div>
        <div className="bg-neutral-900 border border-amber-900/40 rounded-lg p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Pending</p>
          <p className="text-3xl font-semibold text-amber-400">{stats.pending}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Closed</p>
          <p className="text-3xl font-semibold text-neutral-400">{stats.closed}</p>
        </div>
      </div>

      <form method="GET" className="flex items-center gap-2 mb-4">
        <select
          name="coach"
          defaultValue={coachFilter}
          className="bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        >
          <option value="">All coaches</option>
          {coachListResult.rows.map((c) => (
            <option key={c.id} value={c.id}>
              {c.coach_name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-neutral-800 text-neutral-200 px-4 py-2 rounded-md text-sm hover:bg-neutral-700"
        >
          Filter
        </button>
        {coachFilter && (
          <a href="/queries" className="text-xs text-neutral-500 hover:text-amber-400">
            Clear filter
          </a>
        )}
      </form>

      <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black border-b border-neutral-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Coach</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Message</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-40">Status</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-64">Response</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-32">Date</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {queries.map((q) => (
              <QueryRow key={q.id} query={q} updateQuery={updateQuery} deleteQuery={deleteQuery} />
            ))}
            {queries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-600">
                  No support queries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
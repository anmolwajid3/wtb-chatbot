import Link from "next/link";
import { getPool } from "@/lib/db";
import { toggleCoachActive } from "./actions";
import SafeImage from "./SafeImage";

export const dynamic = "force-dynamic";

type Coach = {
  id: string;
  coach_name: string;
  program_name: string | null;
  main_category: string | null;
  is_active: boolean;
  is_synthetic: boolean;
  image_urls: string[] | null;
};

async function getCoaches(): Promise<Coach[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, coach_name, program_name, main_category, is_active, is_synthetic, image_urls
     FROM coaches ORDER BY coach_name ASC`
  );
  return result.rows;
}

export default async function CoachesPage() {
  const coaches = await getCoaches();

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide">
          Coach Profiles
        </h1>
        <Link
          href="/coaches/new"
          className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md hover:bg-amber-400 transition"
        >
          + Add new coach
        </Link>
      </div>

      <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black border-b border-neutral-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-16"></th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Name</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Program</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Category</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Status</th>
              <th className="text-right px-4 py-3 font-medium text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coaches.map((coach) => {
              const firstImage = coach.image_urls?.[0];
              return (
                <tr key={coach.id} className="border-b border-neutral-800 last:border-0">
                  <td className="px-4 py-3">
                    {firstImage ? (
                      <SafeImage
                        src={firstImage}
                        alt={coach.coach_name}
                        className="w-10 h-10 rounded-full object-cover border border-neutral-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-600 text-xs">
                        —
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-100">
                    {coach.coach_name}
                    {coach.is_synthetic && (
                      <span className="ml-2 text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
                        synthetic
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{coach.program_name}</td>
                  <td className="px-4 py-3 text-neutral-400">{coach.main_category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        coach.is_active
                          ? "bg-green-900/40 text-green-400"
                          : "bg-neutral-800 text-neutral-500"
                      }`}
                    >
                      {coach.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <Link href={`/coaches/${coach.id}`} className="text-amber-400 hover:underline">
                      Edit
                    </Link>
                    <form action={toggleCoachActive} className="inline">
                      <input type="hidden" name="id" value={coach.id} />
                      <input type="hidden" name="currentStatus" value={String(coach.is_active)} />
                      <button type="submit" className="text-neutral-500 hover:underline">
                        {coach.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {coaches.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-600">
                  No coaches yet — add your first one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

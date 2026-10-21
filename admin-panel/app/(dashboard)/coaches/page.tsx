import Link from "next/link";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { getPool } from "@/lib/db";
import { getLocale, t } from "@/lib/i18n";
import { listProfileFields, requireOrganization } from "@/lib/workspace";
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

async function getCoaches(
  organizationId: string | null,
  q: string,
  status: string
): Promise<Coach[]> {
  const pool = getPool();
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (organizationId) {
    values.push(organizationId);
    clauses.push(`organization_id = $${values.length}`);
  }
  if (q) {
    values.push(`%${q}%`);
    clauses.push(
      `(coach_name ILIKE $${values.length} OR COALESCE(program_name, '') ILIKE $${values.length} OR COALESCE(main_category, '') ILIKE $${values.length})`
    );
  }
  if (status === "active") {
    clauses.push(`is_active = true`);
  } else if (status === "inactive") {
    clauses.push(`is_active = false`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query(
    `SELECT id, coach_name, program_name, main_category, is_active, is_synthetic, image_urls
     FROM coaches
     ${where}
     ORDER BY is_active DESC, coach_name ASC`,
    values
  );
  return result.rows;
}

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; max?: string }>;
}) {
  const { organization } = await requireOrganization();
  const locale = await getLocale();
  const params = await searchParams;
  const q = (params.q || "").trim();
  const status = params.status === "active" || params.status === "inactive" ? params.status : "";
  const label = organization.profile_label;
  const labelPlural = organization.profile_label_plural;
  const coaches = await getCoaches(organization.id, q, status);
  const fields = await listProfileFields(organization.id);
  const ready = fields.length > 0;
  const profileLimit = Number(organization.profile_limit || 50);
  const atCoachLimit = coaches.length >= profileLimit;
  const inputClass =
    "bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

  return (
    <div className="max-w-5xl mx-auto p-8">
      <Breadcrumbs
        items={[
          { href: "/home", label: locale === "fi" ? "Koti" : "Home" },
          { label: labelPlural },
        ]}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-neutral-100">
            {labelPlural}
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            {coaches.length}/{profileLimit}
          </p>
        </div>
        {!atCoachLimit ? (
          <Link
            href={ready ? "/coaches/new" : "/profile-structure"}
            className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md hover:bg-amber-400 transition"
          >
            + {ready ? label : t(locale, "nav.fields")}
          </Link>
        ) : (
          <span className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-500">
            {locale === "fi" ? `Raja ${profileLimit} täynnä` : `Limit ${profileLimit} reached`}
          </span>
        )}
      </div>
      {params.error === "limit" && (
        <p className="mb-4 text-sm text-amber-400">
          {locale === "fi"
            ? `Valmentajien raja (${params.max || profileLimit}) on täynnä. Nosta rajaa Asetuksissa.`
            : `Coach limit (${params.max || profileLimit}) reached. Raise it in Settings.`}
        </p>
      )}

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-neutral-500">
          {locale === "fi" ? "Haku" : "Search"}
          <input
            name="q"
            defaultValue={q}
            placeholder={locale === "fi" ? "Nimi, ohjelma…" : "Name, program…"}
            className={`mt-1 block min-w-[14rem] ${inputClass}`}
          />
        </label>
        <label className="text-xs text-neutral-500">
          {locale === "fi" ? "Tila" : "Status"}
          <select name="status" defaultValue={status} className={`mt-1 block ${inputClass}`}>
            <option value="">{locale === "fi" ? "Kaikki" : "All"}</option>
            <option value="active">{locale === "fi" ? "Aktiiviset" : "Active"}</option>
            <option value="inactive">{locale === "fi" ? "Ei aktiiviset" : "Inactive"}</option>
          </select>
        </label>
        <button type="submit" className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-black">
          {locale === "fi" ? "Suodata" : "Filter"}
        </button>
      </form>

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
                <tr
                  key={coach.id}
                  className={`border-b border-neutral-800 last:border-0 ${coach.is_active ? "" : "opacity-70"}`}
                >
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
                    <span className={`tag ${coach.is_active ? "tag-active" : "tag-muted"}`}>
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
                  {ready
                    ? t(locale, "fields.emptyList", { people: labelPlural })
                    : t(locale, "fields.setup", { person: label })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

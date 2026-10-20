import Link from "next/link";
import { redirect } from "next/navigation";
import { addMember, removeMember } from "../members/actions";
import { approveProfileRequest, declineProfileRequest } from "../profile-requests/actions";
import { getPool } from "@/lib/db";
import { getLocale, t } from "@/lib/i18n";
import { canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; need?: string; tab?: string }>;
}) {
  const { session, organization } = await requireOrganization();
  if (!canManageCompany(session.role)) redirect("/home");
  const params = await searchParams;
  const locale = await getLocale();
  const tab = params.tab === "coaches" ? "coaches" : "admins";
  const pool = getPool();

  const people = (
    await pool.query(
      `SELECT id, name, email, role FROM users WHERE organization_id = $1 ORDER BY name ASC`,
      [organization.id]
    )
  ).rows;

  const requests = (
    await pool.query(
      `SELECT id, name, email, username, note, status, created_at
       FROM profile_requests
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organization.id]
    )
  ).rows;

  const title = locale === "fi" ? "Käyttäjähallinta" : locale === "sv" ? "Användarhantering" : "User management";
  const adminsTab = locale === "fi" ? "Ylläpitäjät" : locale === "sv" ? "Administratörer" : "Admins";
  const coachesTab =
    locale === "fi"
      ? `${organization.profile_label_plural} & pyynnöt`
      : locale === "sv"
        ? `${organization.profile_label_plural} & förfrågningar`
        : `${organization.profile_label_plural} & requests`;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="font-display mb-2 text-3xl text-neutral-100">{title}</h1>
      <p className="mb-6 text-neutral-400">
        {locale === "fi"
          ? "Hallitse kirjautuvia ylläpitäjiä ja profiilipyyntöjä yhdessä paikassa."
          : locale === "sv"
            ? "Hantera inloggade administratörer och profilförfrågningar på ett ställe."
            : "Manage signing-in admins and profile join requests in one place."}
      </p>

      <div className="mb-6 flex gap-2 border-b border-neutral-800">
        <Link
          href="/users?tab=admins"
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${
            tab === "admins" ? "border-amber-500 text-amber-400" : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {adminsTab}
        </Link>
        <Link
          href="/users?tab=coaches"
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${
            tab === "coaches" ? "border-amber-500 text-amber-400" : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {coachesTab}
        </Link>
      </div>

      {tab === "admins" && (
        <>
          {params.error === "taken" && <p className="mb-4 text-sm text-red-400">{t(locale, "members.taken")}</p>}
          <form action={addMember} className="mb-8 grid grid-cols-1 gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-5 md:grid-cols-2">
            <label className="block">
              <span className="text-sm text-neutral-400">{t(locale, "members.name")}</span>
              <input name="name" required className={inputClass} />
            </label>
            <label className="block">
              <span className="text-sm text-neutral-400">{t(locale, "members.email")}</span>
              <input type="email" name="email" required className={inputClass} />
            </label>
            <label className="block">
              <span className="text-sm text-neutral-400">{t(locale, "members.password")}</span>
              <input type="text" name="password" required minLength={6} className={inputClass} />
            </label>
            <label className="block">
              <span className="text-sm text-neutral-400">{t(locale, "members.role")}</span>
              <select name="role" className={inputClass} defaultValue="viewer">
                <option value="viewer">{t(locale, "members.viewer")}</option>
                <option value="analyst">{t(locale, "members.analyst")}</option>
                <option value="editor">{t(locale, "members.editor")}</option>
                <option value="org_admin">{t(locale, "members.admin")}</option>
              </select>
            </label>
            <div>
              <button type="submit" className="rounded-md bg-amber-500 px-4 py-2 font-medium text-black">
                {t(locale, "members.add")}
              </button>
            </div>
          </form>

          {people.length === 0 ? (
            <p className="text-sm text-neutral-500">{t(locale, "members.empty")}</p>
          ) : (
            <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800 bg-neutral-900">
              {people.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-neutral-100">
                      {person.name}{" "}
                      <span className="text-xs text-neutral-500">· {person.role}</span>
                    </p>
                    <p className="text-sm text-neutral-500">{person.email}</p>
                  </div>
                  {person.id !== session.userId && person.role !== "super_admin" && (
                    <form action={removeMember}>
                      <input type="hidden" name="id" value={person.id} />
                      <button type="submit" className="text-sm text-neutral-500 hover:text-red-400">
                        {t(locale, "members.remove")}
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "coaches" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-400">
              {locale === "fi"
                ? "Hyväksy liittymispyynnöt tai hallitse profiileja."
                : locale === "sv"
                  ? "Godkänn förfrågningar eller hantera profiler."
                  : "Approve join requests or manage profiles."}
            </p>
            <Link href="/coaches" className="text-sm text-amber-400 hover:underline">
              {locale === "fi" ? `Avaa ${organization.profile_label_plural}` : locale === "sv" ? `Öppna ${organization.profile_label_plural}` : `Open ${organization.profile_label_plural}`}
            </Link>
          </div>
          {params.error === "taken" && <p className="mb-4 text-sm text-red-400">{t(locale, "join.taken")}</p>}
          {requests.length === 0 ? (
            <p className="text-sm text-neutral-500">{t(locale, "requests.empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-800 bg-black">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-neutral-400">{t(locale, "members.name")}</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-400">{t(locale, "members.email")}</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-400">{t(locale, "login.username")}</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-400">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-neutral-400" />
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-b border-neutral-800 last:border-0">
                      <td className="px-4 py-3 text-neutral-100">{request.name}</td>
                      <td className="px-4 py-3 text-neutral-400">{request.email}</td>
                      <td className="px-4 py-3 text-neutral-400">{request.username}</td>
                      <td className="px-4 py-3 capitalize text-neutral-400">{request.status}</td>
                      <td className="px-4 py-3 text-right">
                        {request.status === "pending" && (
                          <div className="flex justify-end gap-2">
                            <form action={approveProfileRequest}>
                              <input type="hidden" name="id" value={request.id} />
                              <button type="submit" className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-black">
                                {t(locale, "requests.approve")}
                              </button>
                            </form>
                            <form action={declineProfileRequest}>
                              <input type="hidden" name="id" value={request.id} />
                              <button type="submit" className="px-2 text-sm text-neutral-400 hover:text-red-400">
                                {t(locale, "requests.decline")}
                              </button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

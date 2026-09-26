import { redirect } from "next/navigation";
import { addMember, removeMember } from "./actions";
import { getPool } from "@/lib/db";
import { getLocale, t } from "@/lib/i18n";
import { canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; need?: string }>;
}) {
  const { session, organization } = await requireOrganization();
  if (!canManageCompany(session.role)) redirect("/home");

  const params = await searchParams;
  const locale = await getLocale();

  const people = organization
    ? (
        await getPool().query(
          `SELECT id, name, email, role FROM users WHERE organization_id = $1 ORDER BY name ASC`,
          [organization.id]
        )
      ).rows
    : [];

  const inputClass =
    "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="font-display text-3xl text-neutral-100 mb-1">{t(locale, "members.title")}</h1>
      <p className="text-neutral-400 mb-6">
        {t(locale, "members.lede", { name: organization.name, people: organization.profile_label_plural })}
      </p>
      {params.error === "taken" && <p className="text-sm text-red-400 mb-4">{t(locale, "members.taken")}</p>}

      {organization && (
        <form action={addMember} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <button type="submit" className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md hover:bg-amber-400 transition">
              {t(locale, "members.add")}
            </button>
          </div>
        </form>
      )}

      {organization && people.length === 0 && (
        <p className="text-sm text-neutral-500">{t(locale, "members.empty")}</p>
      )}
      {people.length > 0 && (
        <ul className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg bg-neutral-900">
          {people.map((person) => (
            <li key={person.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-neutral-100">
                  {person.name}{" "}
                  {person.id === session.userId && (
                    <span className="text-xs text-neutral-500">({t(locale, "members.you")})</span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">
                  {person.email} · {t(locale, `members.${person.role === "org_admin" ? "admin" : person.role}`)}
                </p>
              </div>
              {person.id !== session.userId && (
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
    </div>
  );
}

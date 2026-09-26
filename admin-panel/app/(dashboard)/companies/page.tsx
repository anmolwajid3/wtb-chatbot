import { redirect } from "next/navigation";
import { CompanyLogoForm } from "../../components/CompanyLogoForm";
import { createCompany, openCompany, setCompanyStatus, updateCompany } from "./actions";
import { getPool } from "@/lib/db";
import { getLocale, t } from "@/lib/i18n";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; need?: string }>;
}) {
  const workspace = await getWorkspace();
  if (!workspace || workspace.session.role !== "super_admin") redirect("/home");

  const params = await searchParams;
  const locale = await getLocale();
  const pool = getPool();
  const result = await pool.query(
    `SELECT o.id, o.name, o.slug, o.profile_label, o.profile_label_plural, o.status, o.plan, o.credit_limit, o.credits_used, o.logo_url,
            (SELECT count(*)::int FROM users u WHERE u.organization_id = o.id) AS people,
            (SELECT count(*)::int FROM coaches c WHERE c.organization_id = o.id) AS profiles
     FROM organizations o
     ORDER BY o.name ASC`
  );

  const inputClass =
    "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

  return (
    <div className="max-w-5xl mx-auto p-8">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">GPT Lab</p>
      <h1 className="font-display text-4xl text-neutral-100 mb-2">{t(locale, "companies.title")}</h1>
      <p className="text-neutral-400 mb-6 max-w-3xl">{t(locale, "companies.lede")}</p>
      {params.need && <p className="text-sm text-amber-400 mb-4">{t(locale, "companies.need")}</p>}
      {params.error === "taken" && <p className="text-sm text-red-400 mb-4">{t(locale, "companies.taken")}</p>}
      {params.error === "1" && <p className="text-sm text-red-400 mb-4">{t(locale, "companies.invalid")}</p>}

      <p className="text-sm text-neutral-500 mb-4">{t(locale, "companies.statusNote")}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: t(locale, "nav.companies"), value: result.rows.length },
          { label: "Active", value: result.rows.filter((row) => row.status === "active").length },
          { label: t(locale, "nav.profiles"), value: result.rows.reduce((sum, row) => sum + Number(row.profiles), 0) },
          {
            label: locale === "fi" ? "Viestit tässä kuussa" : locale === "sv" ? "Meddelanden denna månad" : "Messages this month",
            value: result.rows.reduce((sum, row) => sum + Number(row.credits_used), 0),
          },
        ].map((card) => (
          <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <p className="text-2xl font-display text-neutral-100">{card.value}</p>
            <p className="text-sm text-neutral-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>
      {result.rows.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 mb-8">
          <h2 className="text-sm font-medium text-neutral-500 mb-4">
            {locale === "fi" ? "Profiilit yrityksittäin" : locale === "sv" ? "Profiler per företag" : "Profiles by company"}
          </h2>
          <div className="grid gap-3">
            {result.rows.map((company) => {
              const peak = Math.max(1, ...result.rows.map((row) => Number(row.profiles)));
              return (
                <div key={company.id}>
                  <div className="flex justify-between text-sm text-neutral-400 mb-1">
                    <span>{company.name}</span>
                    <span>{company.profiles}</span>
                  </div>
                  <div className="stat-bar">
                    <span style={{ width: `${Math.round((Number(company.profiles) / peak) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result.rows.length === 0 ? (
        <p className="text-sm text-neutral-500 mb-8">{t(locale, "companies.empty")}</p>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead className="bg-black border-b border-neutral-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-400">Company</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-400">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-400">{t(locale, "companies.called")}</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-400">{t(locale, "companies.admins")}</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-400">Status</th>
                <th className="text-right px-4 py-3 font-medium text-neutral-400"></th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((company) => (
                <tr key={company.id} className="border-b border-neutral-800 last:border-0 align-top">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {company.logo_url ? (
                        <img src={company.logo_url} alt="" className="h-8 w-8 rounded-md object-cover bg-white" />
                      ) : null}
                      <div>
                        <div className="text-neutral-100 font-medium">{company.name}</div>
                        <div className="text-neutral-500 text-xs mt-0.5">{company.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-neutral-300">
                    <div className="capitalize">{company.plan}</div>
                    <div className="text-xs text-neutral-500">{company.credits_used}/{company.credit_limit} this month</div>
                  </td>
                  <td className="px-4 py-4 text-neutral-300">
                    {company.profiles} {company.profile_label_plural}
                  </td>
                  <td className="px-4 py-4 text-neutral-300">{company.people}</td>
                  <td className="px-4 py-4">
                    <span className={`tag tag-${company.status}`}>{company.status}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap justify-end gap-2 items-center">
                      <form action={openCompany}>
                        <input type="hidden" name="id" value={company.id} />
                        <button type="submit" className="bg-amber-500 text-black text-sm font-medium px-3 py-1.5 rounded-md">
                          {t(locale, "companies.enter")} {company.name}
                        </button>
                      </form>
                      {company.status !== "archived" && (
                        <form action={setCompanyStatus}>
                          <input type="hidden" name="id" value={company.id} />
                          <input type="hidden" name="status" value="archived" />
                          <button type="submit" className="text-sm text-neutral-400 hover:text-amber-400">Archive</button>
                        </form>
                      )}
                      {company.status !== "held" && (
                        <form action={setCompanyStatus}>
                          <input type="hidden" name="id" value={company.id} />
                          <input type="hidden" name="status" value="held" />
                          <button type="submit" className="text-sm text-neutral-400 hover:text-amber-400">Hold package</button>
                        </form>
                      )}
                      {company.status !== "removed" && (
                        <form action={setCompanyStatus}>
                          <input type="hidden" name="id" value={company.id} />
                          <input type="hidden" name="status" value="removed" />
                          <button type="submit" className="text-sm text-neutral-400 hover:text-amber-400">Remove</button>
                        </form>
                      )}
                      {company.status !== "active" && (
                        <form action={setCompanyStatus}>
                          <input type="hidden" name="id" value={company.id} />
                          <input type="hidden" name="status" value="active" />
                          <button type="submit" className="text-sm text-neutral-400 hover:text-amber-400">Restore</button>
                        </form>
                      )}
                    </div>
                    <details className="mt-2 text-right">
                      <summary className="cursor-pointer text-sm text-neutral-400">Edit</summary>
                      <form action={updateCompany} className="mt-2 grid gap-2 text-left">
                        <input type="hidden" name="id" value={company.id} />
                        <label className="text-xs text-neutral-500">
                          {t(locale, "companies.name")}
                          <input name="name" defaultValue={company.name} className={inputClass} />
                        </label>
                        <label className="text-xs text-neutral-500">
                          {t(locale, "companies.slug")}
                          <input name="slug" defaultValue={company.slug} className={inputClass} />
                        </label>
                        <label className="text-xs text-neutral-500">
                          {t(locale, "companies.label")}
                          <input name="profile_label" defaultValue={company.profile_label} className={inputClass} />
                        </label>
                        <label className="text-xs text-neutral-500">
                          {t(locale, "companies.labelPlural")}
                          <input name="profile_label_plural" defaultValue={company.profile_label_plural} className={inputClass} />
                        </label>
                        <label className="text-xs text-neutral-500">
                          Plan
                          <select name="plan" defaultValue={company.plan} className={inputClass}>
                            <option value="free">Free · 50 messages</option>
                            <option value="pro">Pro · 1,000 messages</option>
                            <option value="enterprise">Enterprise · 10,000 messages</option>
                          </select>
                        </label>
                        <button type="submit" className="bg-amber-500 text-black text-sm font-medium px-3 py-1.5 rounded-md">
                          Save company
                        </button>
                      </form>
                      <div className="mt-3">
                        <CompanyLogoForm organizationId={company.id} logoUrl={company.logo_url} label="Company logo" />
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
        <summary className="cursor-pointer text-neutral-100">{t(locale, "companies.add")}</summary>
        <form action={createCompany} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-neutral-400">{t(locale, "companies.name")}</span>
            <input name="name" required className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-400">{t(locale, "companies.slug")}</span>
            <input name="slug" placeholder="north-coaching" className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-400">{t(locale, "companies.label")}</span>
            <input name="profile_label" defaultValue="Coach" className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-400">{t(locale, "companies.labelPlural")}</span>
            <input name="profile_label_plural" defaultValue="Coaches" className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-400">{t(locale, "companies.adminName")}</span>
            <input name="admin_name" required className={inputClass} />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-400">{t(locale, "companies.adminEmail")}</span>
            <input type="email" name="admin_email" required className={inputClass} />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm text-neutral-400">Plan and monthly messages</span>
            <select name="plan" defaultValue="free" className={inputClass}>
              <option value="free">Free · 50 messages. Stops when they are used.</option>
              <option value="pro">Pro · 1,000 messages. Stops when they are used.</option>
              <option value="enterprise">Enterprise · 10,000 messages. Stops when they are used.</option>
            </select>
          </label>
          <p className="md:col-span-2 text-sm text-neutral-500">
            The first person is the company admin. People added later can be a viewer, an analyst, or an editor.
          </p>
          <label className="block md:col-span-2">
            <span className="text-sm text-neutral-400">{t(locale, "companies.adminPassword")}</span>
            <input type="text" name="admin_password" required minLength={6} className={inputClass} />
          </label>
          <div>
            <button type="submit" className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md hover:bg-amber-400 transition">
              {t(locale, "companies.create")}
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}

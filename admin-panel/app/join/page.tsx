import { HarborMark } from "../components/HarborMark";
import { getPool } from "@/lib/db";
import { getLocale, t } from "@/lib/i18n";
import { ensureSchema } from "@/lib/schema";
import { requestProfile } from "./actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  let companies: { id: string; name: string; profile_label: string }[] = [];
  try {
    await ensureSchema();
    const result = await getPool().query(
      `SELECT id, name, profile_label FROM organizations WHERE status = 'active' ORDER BY name ASC`
    );
    companies = result.rows;
  } catch {
    companies = [];
  }

  return (
    <div className="min-h-screen">
      <header className="max-w-xl mx-auto px-6 py-5">
        <HarborMark />
      </header>
      <main className="max-w-xl mx-auto px-6 pb-16">
        <h1 className="font-display text-3xl text-neutral-100 mb-2">{t(locale, "join.title")}</h1>
        <p className="text-neutral-400 mb-6">{t(locale, "join.lede")}</p>
        {params.sent && (
          <p className="text-sm text-neutral-300 bg-neutral-900 border border-neutral-800 rounded-lg p-4 mb-6">
            {t(locale, "join.sent", { company: params.sent })}
          </p>
        )}
        {params.error === "taken" && <p className="text-sm text-red-400 mb-4">{t(locale, "join.taken")}</p>}
        {params.error === "invalid" && <p className="text-sm text-red-400 mb-4">{t(locale, "join.invalid")}</p>}
        {params.error === "closed" && <p className="text-sm text-red-400 mb-4">{t(locale, "join.closed")}</p>}

        <form action={requestProfile} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 grid gap-4">
          <label className="text-sm text-neutral-400">
            {t(locale, "join.company")}
            <select name="organization_id" required className={inputClass} defaultValue="">
              <option value="" disabled>
                {t(locale, "join.company")}
              </option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} · {company.profile_label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-400">
            {t(locale, "join.name")}
            <input name="name" required className={inputClass} />
          </label>
          <label className="text-sm text-neutral-400">
            {t(locale, "join.email")}
            <input type="email" name="email" required className={inputClass} />
          </label>
          <label className="text-sm text-neutral-400">
            {t(locale, "join.username")}
            <input name="username" required className={inputClass} />
          </label>
          <label className="text-sm text-neutral-400">
            {t(locale, "join.password")}
            <input type="password" name="password" required minLength={8} className={inputClass} />
          </label>
          <label className="text-sm text-neutral-400">
            {t(locale, "join.note")}
            <textarea name="note" rows={4} className={inputClass} />
          </label>
          <button type="submit" className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md">
            {t(locale, "join.submit")}
          </button>
        </form>
      </main>
    </div>
  );
}

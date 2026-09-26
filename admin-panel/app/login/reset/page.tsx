import { HarborMark } from "../../components/HarborMark";
import { getLocale, t } from "@/lib/i18n";
import { completePasswordReset } from "../actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; done?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();

  return (
    <div className="min-h-screen">
      <header className="max-w-xl mx-auto px-6 py-5">
        <HarborMark />
      </header>
      <main className="max-w-xl mx-auto px-6 pb-16">
        <h1 className="font-display text-3xl text-neutral-100 mb-4">{t(locale, "reset.title")}</h1>
        {params.done && <p className="text-sm text-neutral-300 mb-4">{t(locale, "reset.done")}</p>}
        {(params.error === "bad" || !params.token) && !params.done && (
          <p className="text-sm text-red-400 mb-4">{t(locale, "reset.bad")}</p>
        )}
        {params.error === "short" && <p className="text-sm text-red-400 mb-4">{t(locale, "reset.short")}</p>}
        {params.token && !params.done && (
          <form action={completePasswordReset} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 grid gap-4">
            <input type="hidden" name="token" value={params.token} />
            <label className="text-sm text-neutral-400">
              {t(locale, "reset.password")}
              <input type="password" name="password" required minLength={8} className={inputClass} />
            </label>
            <label className="text-sm text-neutral-400">
              {t(locale, "reset.confirm")}
              <input type="password" name="confirm" required minLength={8} className={inputClass} />
            </label>
            <button type="submit" className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md">
              {t(locale, "reset.submit")}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

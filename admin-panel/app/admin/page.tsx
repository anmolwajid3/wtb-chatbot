import Link from "next/link";
import { redirect } from "next/navigation";
import { HarborMark } from "../components/HarborMark";
import { Preferences } from "../components/Preferences";
import { getLocale, getTheme, t } from "@/lib/i18n";
import { getStaffSession } from "@/lib/workspace";
import { loginAsStaff } from "../login/actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const theme = await getTheme();

  if (params.error !== "db") {
    try {
      if (await getStaffSession()) redirect("/home");
    } catch {
      // Stay on the form if the session cannot be read.
    }
  }

  const error =
    params.error === "db"
      ? t(locale, "login.db")
      : params.error === "usecompany"
        ? t(locale, "login.useCompany")
        : params.error === "1"
          ? t(locale, "login.error")
          : "";

  return (
    <div className="min-h-screen">
      <header className="max-w-md mx-auto w-full px-6 py-5 flex items-center justify-between">
        <HarborMark />
        <Preferences
          locale={locale}
          theme={theme}
          languageLabel={t(locale, "common.language")}
          themeLightLabel={t(locale, "common.themeToLight")}
          themeDarkLabel={t(locale, "common.themeToDark")}
        />
      </header>
      <main className="max-w-md mx-auto px-6 pb-16">
        <p className="text-xs uppercase tracking-wide text-amber-400 mb-2">GPT Lab</p>
        <h1 className="font-display text-4xl text-neutral-100 mb-2">{t(locale, "login.adminTitle")}</h1>
        <p className="text-neutral-400 mb-6">{t(locale, "login.adminLede")}</p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <form action={loginAsStaff} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
          <input type="hidden" name="door" value="lab" />
          <input type="hidden" name="next" value="/admin" />
          <label className="block mb-3 text-sm text-neutral-400">
            {t(locale, "login.email")}
            <input type="email" name="email" required autoComplete="username" className={inputClass} />
          </label>
          <label className="block mb-4 text-sm text-neutral-400">
            {t(locale, "login.password")}
            <input type="password" name="password" required autoComplete="current-password" className={inputClass} />
          </label>
          <button type="submit" className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md">
            {t(locale, "login.submit")}
          </button>
        </form>

        <p className="mt-6 text-sm">
          <Link href="/login" className="text-neutral-500 hover:text-amber-400">
            {t(locale, "login.adminLink")}
          </Link>
        </p>
      </main>
    </div>
  );
}

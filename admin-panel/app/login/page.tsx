import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountLogin } from "../components/AccountLogin";
import { HarborMark } from "../components/HarborMark";
import { Preferences } from "../components/Preferences";
import { getLocale, getTheme, t } from "@/lib/i18n";
import { getStaffSession } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function LoginPage({
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
      : params.error === "uselab"
        ? t(locale, "login.useLab")
        : params.error === "usecompany"
          ? t(locale, "login.useCompany")
          : params.error === "1"
            ? t(locale, "login.error")
            : "";

  return (
    <div className="min-h-screen">
      <header className="max-w-3xl mx-auto w-full px-6 py-5 flex items-center justify-between">
        <HarborMark />
        <Preferences
          locale={locale}
          theme={theme}
          languageLabel={t(locale, "common.language")}
          themeLightLabel={t(locale, "common.themeToLight")}
          themeDarkLabel={t(locale, "common.themeToDark")}
        />
      </header>
      <main className="max-w-3xl mx-auto px-6 pb-16">
        <h1 className="font-display text-4xl text-neutral-100 mb-2">{t(locale, "login.title")}</h1>
        <p className="text-neutral-400 mb-6 max-w-xl">{t(locale, "login.lede")}</p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <AccountLogin
          accountLabel={t(locale, "login.account")}
          companyLabel={t(locale, "login.companyOption")}
          profileLabel={t(locale, "login.profileOption")}
          emailLabel={t(locale, "login.email")}
          usernameLabel={t(locale, "login.username")}
          passwordLabel={t(locale, "login.password")}
          submitLabel={t(locale, "login.submit")}
        />

        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <Link href="/login/forgot" className="text-amber-400 hover:underline">
            {t(locale, "login.forgot")}
          </Link>
          <Link href="/join" className="text-amber-400 hover:underline">
            {t(locale, "login.join")}
          </Link>
          <span className="text-neutral-500">{t(locale, "login.joinHint")}</span>
        </div>
      </main>
    </div>
  );
}

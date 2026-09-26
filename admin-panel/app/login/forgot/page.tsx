import Link from "next/link";
import { HarborMark } from "../../components/HarborMark";
import { getLocale, t } from "@/lib/i18n";
import { requestPasswordReset } from "../actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ready?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const link = params.ready ? `/login/reset?token=${encodeURIComponent(params.ready)}` : "";

  return (
    <div className="min-h-screen">
      <header className="max-w-xl mx-auto px-6 py-5">
        <HarborMark />
      </header>
      <main className="max-w-xl mx-auto px-6 pb-16">
        <h1 className="font-display text-3xl text-neutral-100 mb-2">{t(locale, "forgot.title")}</h1>
        <p className="text-neutral-400 mb-6">{t(locale, "forgot.lede")}</p>
        {params.error === "missing" && <p className="text-sm text-red-400 mb-4">{t(locale, "forgot.missing")}</p>}
        {link && (
          <p className="text-sm text-neutral-300 bg-neutral-900 border border-neutral-800 rounded-lg p-4 mb-6">
            {t(locale, "forgot.ready")}{" "}
            <Link href={link} className="text-amber-400 break-all">
              {link}
            </Link>
          </p>
        )}
        <form action={requestPasswordReset} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 grid gap-4">
          <label className="text-sm text-neutral-400">
            {t(locale, "forgot.staff")}
            <input type="radio" name="kind" value="staff" defaultChecked className="ml-2" />
          </label>
          <label className="text-sm text-neutral-400">
            {t(locale, "forgot.profile")}
            <input type="radio" name="kind" value="profile" className="ml-2" />
          </label>
          <label className="text-sm text-neutral-400">
            {t(locale, "forgot.identifier")}
            <input name="identifier" required className={inputClass} />
          </label>
          <button type="submit" className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md">
            {t(locale, "forgot.submit")}
          </button>
        </form>
      </main>
    </div>
  );
}

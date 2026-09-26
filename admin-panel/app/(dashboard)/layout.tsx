import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction } from "../actions";
import { closeCompany } from "./companies/actions";
import { Preferences } from "../components/Preferences";
import { HarborMark } from "../components/HarborMark";
import { getLocale, getTheme, t } from "@/lib/i18n";
import { canAnalyze, canEditCompany, canManageCompany } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let workspace;
  try {
    workspace = await getWorkspace();
  } catch {
    redirect("/login?error=db");
  }
  if (!workspace) redirect("/login");

  const { session, organization } = workspace;
  const locale = await getLocale();
  const theme = await getTheme();
  const path = (await headers()).get("x-harbor-path") || "";
  const platformPath = path.startsWith("/companies") || path.startsWith("/notices");
  const inCompany = Boolean(organization) && !platformPath;
  const person = organization?.profile_label || t(locale, "nav.profiles");
  const people = organization?.profile_label_plural || t(locale, "nav.profiles");

  const links = inCompany
    ? [
        { href: "/home", label: t(locale, "nav.home") },
        { href: "/announcements", label: t(locale, "nav.notices") },
        { href: "/coaches", label: people },
        { href: "/profile-requests", label: t(locale, "nav.requests"), show: canManageCompany(session.role) },
        { href: "/profile-structure", label: t(locale, "fields.title", { label: person, name: organization?.name || "" }), show: canEditCompany(session.role) },
        { href: "/tone", label: t(locale, "nav.voice"), show: canEditCompany(session.role) },
        { href: "/phrases", label: t(locale, "nav.phrases"), show: canEditCompany(session.role) },
        { href: "/guardrails", label: t(locale, "nav.rules"), show: canEditCompany(session.role) },
        { href: "/diagnostics", label: t(locale, "nav.diagnostics"), show: canEditCompany(session.role) },
        { href: "/greetings", label: t(locale, "nav.greetings"), show: canEditCompany(session.role) },
        { href: "/matching", label: t(locale, "nav.matching"), show: canManageCompany(session.role) },
        { href: "/messages", label: t(locale, "nav.messages"), show: canManageCompany(session.role) },
        { href: "/logs", label: t(locale, "nav.logs") },
        { href: "/queries", label: t(locale, "nav.inbox") },
        { href: "/members", label: t(locale, "nav.people"), show: canManageCompany(session.role) },
        { href: "/llm-settings", label: t(locale, "nav.model"), show: canAnalyze(session.role) },
        { href: "/master-prompts", label: t(locale, "nav.prompts"), show: canEditCompany(session.role) },
      ]
    : [
        { href: "/companies", label: t(locale, "nav.companies") },
        { href: "/notices", label: t(locale, "nav.notices") },
      ];

  return (
    <div className="flex min-h-screen">
      <aside className="aside-shell w-60 shrink-0 flex flex-col justify-between p-4">
        <div>
          <div className="mb-5">
            <HarborMark onDark />
          </div>
          {inCompany && organization ? (
            <>
              {session.role === "super_admin" && (
                <p className="text-xs text-neutral-500 mb-2">GPT Lab</p>
              )}
              {organization.logo_url && (
                <img src={organization.logo_url} alt="" className="h-10 w-10 rounded-md object-cover bg-white mb-2" />
              )}
              <Link href="/home" className="font-display text-2xl text-neutral-100 block leading-none">
                {organization.name}
              </Link>
              <p className="text-xs text-neutral-500 mt-1 mb-4">
                {people} · {t(locale, "nav.onHarbor")}
              </p>
              {session.role === "super_admin" && (
                <form action={closeCompany} className="mb-4">
                  <button type="submit" className="text-xs text-neutral-400 hover:text-amber-400">
                    {t(locale, "nav.backToLab")}
                  </button>
                </form>
              )}
              {organization.status !== "active" && (
                <p className="text-xs text-neutral-500 mb-4">
                  Status: {organization.status}. Records are unchanged.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-200 mt-1">GPT Lab</p>
              <p className="text-xs text-neutral-500 mb-6">Platform owner</p>
            </>
          )}
          <nav className="flex flex-col gap-0.5">
            {links
              .filter((link) => link.show !== false)
              .map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-neutral-400 hover:text-amber-400 hover:bg-neutral-900 rounded-md px-2 py-1.5 transition"
                >
                  {link.label}
                </Link>
              ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3 pt-6">
          <Preferences
            locale={locale}
            theme={theme}
            languageLabel={t(locale, "common.language")}
            themeLightLabel={t(locale, "common.themeToLight")}
            themeDarkLabel={t(locale, "common.themeToDark")}
          />
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-neutral-500 hover:text-red-400 rounded-md px-2 py-1.5 transition"
            >
              {t(locale, "nav.logout")}
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

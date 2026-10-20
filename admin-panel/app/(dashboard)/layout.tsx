import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { closeCompany } from "./companies/actions";
import { HeaderBar } from "../components/HeaderBar";
import { NavIcon } from "../components/NavIcon";
import { SideNav, type SideNavItem } from "../components/SideNav";
import { getLocale, getTheme, t } from "@/lib/i18n";
import { canAnalyze, canEditCompany, canManageCompany } from "@/lib/plans";
import { getPool } from "@/lib/db";
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
  const people = organization?.profile_label_plural || t(locale, "nav.profiles");

  const companyLinks: SideNavItem[] = [
    { href: "/home", label: t(locale, "nav.home"), icon: "home" },
    { href: "/coaches", label: people, icon: "coaches" },
    { href: "/logs", label: locale === "fi" ? "Keskustelut" : locale === "sv" ? "Samtal" : "Conversations", icon: "chat" },
    { href: "/queries", label: t(locale, "nav.inbox"), icon: "inbox" },
    {
      href: "/chatbot",
      label: locale === "fi" ? "Chatbot" : locale === "sv" ? "Chatbot" : "Chatbot",
      icon: "voice",
      show: canEditCompany(session.role) || canManageCompany(session.role),
    },
    {
      href: "/users",
      label: locale === "fi" ? "Käyttäjähallinta" : locale === "sv" ? "Användarhantering" : "User management",
      icon: "users",
      show: canManageCompany(session.role),
    },
    {
      href: "/broadcasts",
      label: locale === "fi" ? "Tiedotteet tiimille" : locale === "sv" ? "Teammeddelanden" : "Team broadcasts",
      icon: "broadcast",
      show: canManageCompany(session.role),
    },
    {
      href: "/settings",
      label: locale === "fi" ? "Asetukset" : locale === "sv" ? "Inställningar" : "Settings",
      icon: "settings",
      show: canManageCompany(session.role) || canAnalyze(session.role) || canEditCompany(session.role),
    },
  ];

  const platformLinks: SideNavItem[] = [
    { href: "/companies", label: t(locale, "nav.companies"), icon: "home" },
    { href: "/notices", label: locale === "fi" ? "Alustatiedotteet" : locale === "sv" ? "Plattformsnotiser" : "Platform notices", icon: "broadcast" },
  ];

  const links = inCompany ? companyLinks : platformLinks;

  let noticeCount = 0;
  if (inCompany && organization) {
    try {
      const result = await getPool().query(
        `SELECT count(*)::int AS n FROM notices
         WHERE audience IN ('companies', 'both')
           AND (organization_id IS NULL OR organization_id = $1)`,
        [organization.id]
      );
      noticeCount = result.rows[0]?.n || 0;
    } catch {
      noticeCount = 0;
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="aside-shell flex w-60 shrink-0 flex-col justify-between p-4">
        <div>
          {inCompany && organization ? (
            <>
              {session.role === "super_admin" && (
                <form action={closeCompany} className="mb-3">
                  <button type="submit" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-amber-400">
                    <NavIcon name="back" className="h-3.5 w-3.5" />
                    {t(locale, "nav.backToLab")}
                  </button>
                </form>
              )}
              <Link href="/home" className="mb-4 block">
                {organization.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={organization.logo_url}
                    alt={organization.name}
                    className="mb-3 h-12 w-auto max-w-[9rem] object-contain object-left"
                  />
                ) : (
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-neutral-800 text-sm font-medium text-amber-400">
                    {organization.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="font-display block text-xl leading-tight text-neutral-100">{organization.name}</span>
                <span className="mt-0.5 block text-xs text-neutral-500">{people}</span>
              </Link>
              {organization.status !== "active" && (
                <p className="mb-3 text-xs text-neutral-500">Status: {organization.status}</p>
              )}
            </>
          ) : (
            <div className="mb-6">
              <p className="text-sm text-neutral-200">GPT Lab</p>
              <p className="text-xs text-neutral-500">Platform</p>
            </div>
          )}
          <SideNav links={links} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderBar
          locale={locale}
          theme={theme}
          languageLabel={t(locale, "common.language")}
          themeLightLabel={t(locale, "common.themeToLight")}
          themeDarkLabel={t(locale, "common.themeToDark")}
          userName={session.name}
          userEmail={session.email}
          noticeCount={noticeCount}
          logoutLabel={t(locale, "nav.logout")}
          profileLabel={locale === "fi" ? "Profiili" : locale === "sv" ? "Profil" : "Profile"}
          noticesLabel={locale === "fi" ? "Ilmoitukset" : locale === "sv" ? "Aviseringar" : "Notifications"}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

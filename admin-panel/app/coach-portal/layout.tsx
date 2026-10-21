import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HeaderBar } from "../components/HeaderBar";
import { SideNav, type SideNavItem } from "../components/SideNav";
import { verifyCoachSessionToken, COACH_SESSION_COOKIE } from "@/lib/coachSession";
import { getPool } from "@/lib/db";
import { getLocale, getTheme, t } from "@/lib/i18n";

async function coachLogoutAction() {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete(COACH_SESSION_COOKIE);
  redirect("/login");
}

export default async function CoachPortalLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COACH_SESSION_COOKIE)?.value;
  const session = verifyCoachSessionToken(token);

  if (!session) {
    redirect("/login");
  }

  const locale = await getLocale();
  const theme = await getTheme();
  const pool = getPool();

  const coachRow = await pool.query(
    `SELECT c.email, c.organization_id, o.name, o.logo_url, o.profile_label_plural,
            COALESCE(o.widget_accent, '#F59E0B') AS widget_accent,
            COALESCE(o.widget_theme, 'dark') AS widget_theme
     FROM coaches c
     LEFT JOIN organizations o ON o.id = c.organization_id
     WHERE c.id = $1`,
    [session.coachId]
  );
  const org = coachRow.rows[0] || {};
  const companyName = (org.name as string) || "Portal";
  const logoUrl = (org.logo_url as string | null) || null;
  const accent = (org.widget_accent as string) || "#F59E0B";
  const people = (org.profile_label_plural as string) || "";
  const email = (org.email as string) || "";

  let noticeCount = 0;
  if (org.organization_id) {
    try {
      const notices = await pool.query(
        `SELECT count(*)::int AS n FROM notices
         WHERE audience IN ('profiles', 'both')
           AND (organization_id IS NULL OR organization_id = $1)`,
        [org.organization_id]
      );
      noticeCount = notices.rows[0]?.n || 0;
    } catch {
      noticeCount = 0;
    }
  }

  const links: SideNavItem[] = [
    {
      href: "/coach-portal",
      label: locale === "fi" ? "Oma profiili" : "My Profile",
      icon: "profile",
    },
    {
      href: "/coach-portal/messages",
      label: locale === "fi" ? "Viestit" : "Messages",
      icon: "bell",
    },
    {
      href: "/coach-portal/support",
      label: locale === "fi" ? "Tuki" : "Support",
      icon: "inbox",
    },
  ];

  return (
    <div
      className="coach-portal flex min-h-screen"
      style={{ ["--brand-accent" as string]: accent }}
    >
      <aside className="aside-shell flex w-60 shrink-0 flex-col justify-between p-4">
        <div>
          <Link href="/coach-portal" className="mb-4 block">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={companyName}
                className="mb-3 h-12 w-auto max-w-[9rem] object-contain object-left"
              />
            ) : (
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-neutral-800 text-sm font-medium text-amber-400">
                {companyName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-display block text-xl leading-tight text-neutral-100">{companyName}</span>
            {people ? <span className="mt-0.5 block text-xs text-neutral-500">{people}</span> : null}
          </Link>
          <p className="mb-4 text-xs text-neutral-500">{session.coachName}</p>
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
          userName={session.coachName}
          userEmail={email}
          noticeCount={noticeCount}
          logoutLabel={t(locale, "nav.logout")}
          profileLabel={locale === "fi" ? "Profiili" : "Profile"}
          noticesLabel={locale === "fi" ? "Ilmoitukset" : "Notifications"}
          profileHref="/coach-portal"
          noticesHref="/coach-portal/messages"
          logoutAction={coachLogoutAction}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

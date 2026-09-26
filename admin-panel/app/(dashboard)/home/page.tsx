import Link from "next/link";
import { CompanyLogoForm } from "../../components/CompanyLogoForm";
import { getPool } from "@/lib/db";
import { getLocale, t } from "@/lib/i18n";
import { canEditCompany, canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { session, organization } = await requireOrganization();
  const locale = await getLocale();
  const person = organization.profile_label;
  const people = organization.profile_label_plural;
  const vars = { name: organization.name, people, person };

  const pool = getPool();
  const counts = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM coaches WHERE organization_id = $1) AS profiles,
       (SELECT count(*)::int FROM coaches WHERE organization_id = $1 AND is_active = true) AS active_profiles,
       (SELECT count(*)::int FROM users WHERE organization_id = $1) AS people,
       (SELECT count(*)::int FROM profile_requests WHERE organization_id = $1 AND status = 'pending') AS requests`,
    [organization.id]
  );
  const outcomes = await pool.query(
    `SELECT COALESCE(outcome, 'in_progress') AS outcome, count(*)::int AS count
     FROM conversations WHERE organization_id = $1 GROUP BY 1 ORDER BY count DESC`,
    [organization.id]
  );
  const notices = await pool.query(
    `SELECT id, title, body FROM notices
     WHERE audience IN ('companies', 'both')
       AND (organization_id IS NULL OR organization_id = $1)
     ORDER BY created_at DESC
     LIMIT 3`,
    [organization.id]
  );
  const stats = counts.rows[0] || { profiles: 0, active_profiles: 0, people: 0, requests: 0 };
  const outcomeRows = outcomes.rows as { outcome: string; count: number }[];
  const open = outcomeRows.find((row) => row.outcome === "in_progress")?.count || 0;
  const matched = outcomeRows.find((row) => row.outcome === "matched")?.count || 0;
  const peak = Math.max(1, ...outcomeRows.map((row) => row.count));
  const statCards = [
    { label: people, value: `${stats.active_profiles}/${stats.profiles}` },
    { label: locale === "fi" ? "Avoimet keskustelut" : locale === "sv" ? "Öppna samtal" : "Open conversations", value: String(open) },
    { label: locale === "fi" ? "Yhdistetyt" : locale === "sv" ? "Matchade" : "Matched", value: String(matched) },
    { label: locale === "fi" ? "Viestit tässä kuussa" : locale === "sv" ? "Meddelanden denna månad" : "Messages this month", value: `${organization.credits_used}/${organization.credit_limit}` },
    { label: locale === "fi" ? "Odottavat pyynnöt" : locale === "sv" ? "Väntande förfrågningar" : "Pending requests", value: String(stats.requests) },
  ];

  const cards = [
    {
      href: "/coaches",
      title: people,
      desc: t(locale, "home.profilesDesc", vars),
    },
    canEditCompany(session.role) && {
      href: "/profile-structure",
      title: t(locale, "fields.title", { label: person, name: organization.name }),
      desc: t(locale, "home.fieldsDesc", vars),
    },
    canEditCompany(session.role) && {
      href: "/tone",
      title: t(locale, "home.voice"),
      desc: t(locale, "home.voiceDesc"),
    },
    canEditCompany(session.role) && {
      href: "/phrases",
      title: t(locale, "home.phrases"),
      desc: t(locale, "home.phrasesDesc"),
    },
    canEditCompany(session.role) && {
      href: "/guardrails",
      title: t(locale, "home.rules"),
      desc: t(locale, "home.rulesDesc"),
    },
    canEditCompany(session.role) && {
      href: "/greetings",
      title: t(locale, "nav.greetings"),
      desc: t(locale, "home.greetingsDesc", vars),
    },
    {
      href: "/logs",
      title: t(locale, "nav.logs"),
      desc: t(locale, "home.logsDesc", vars),
    },
    canManageCompany(session.role) && {
      href: "/profile-requests",
      title: t(locale, "requests.title"),
      desc: t(locale, "requests.lede", { name: organization.name, person }),
    },
    canManageCompany(session.role) && {
      href: "/members",
      title: t(locale, "home.people"),
      desc: t(locale, "home.peopleDesc", vars),
    },
  ].filter((card): card is { href: string; title: string; desc: string } => Boolean(card));

  return (
    <div className="max-w-4xl mx-auto p-8">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">{organization.name}</p>
      <h1 className="font-display text-4xl text-neutral-100 mb-2">{people}</h1>
      <p className="text-neutral-400 mb-3 max-w-2xl">{t(locale, "home.inside", vars)}</p>
      <p className="text-sm text-neutral-500 mb-8">
        {organization.plan} · {organization.credits_used}/{organization.credit_limit} messages this month
      </p>
      {notices.rows.length > 0 && (
        <div className="grid gap-3 mb-8">
          {notices.rows.map((notice) => (
            <Link key={notice.id} href="/announcements" className="block bg-neutral-900 border border-amber-500/40 rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">{t(locale, "nav.notices")}</p>
              <p className="font-medium text-neutral-100 mt-1">{notice.title}</p>
              <p className="text-sm text-neutral-400 mt-1 whitespace-pre-wrap">{notice.body}</p>
            </Link>
          ))}
        </div>
      )}
      {canManageCompany(session.role) && (
        <CompanyLogoForm
          organizationId={organization.id}
          logoUrl={organization.logo_url}
          label={locale === "fi" ? "Yrityksen logo" : locale === "sv" ? "Företagets logotyp" : "Company logo"}
        />
      )}

      {organization.status !== "active" && (
        <p className="text-sm text-amber-400 mb-6">Status: {organization.status}. Records are unchanged.</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <p className="text-2xl font-display text-neutral-100">{card.value}</p>
            <p className="text-sm text-neutral-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {outcomeRows.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 mb-8">
          <h2 className="text-sm font-medium text-neutral-500 mb-4">
            {locale === "fi" ? "Keskustelut" : locale === "sv" ? "Samtal" : "Conversations"}
          </h2>
          <div className="grid gap-3">
            {outcomeRows.map((row) => (
              <div key={row.outcome}>
                <div className="flex justify-between text-sm text-neutral-400 mb-1">
                  <span className="capitalize">{row.outcome.replaceAll("_", " ")}</span>
                  <span>{row.count}</span>
                </div>
                <div className="stat-bar">
                  <span style={{ width: `${Math.round((row.count / peak) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 hover:border-amber-500 transition"
          >
            <h2 className="font-medium text-neutral-100">{card.title}</h2>
            <p className="text-sm text-neutral-400 mt-1">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

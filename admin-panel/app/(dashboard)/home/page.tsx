import Link from "next/link";
import { getPool } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { session, organization } = await requireOrganization();
  const locale = await getLocale();
  const people = organization.profile_label_plural;

  const pool = getPool();
  const counts = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM coaches WHERE organization_id = $1) AS profiles,
       (SELECT count(*)::int FROM coaches WHERE organization_id = $1 AND is_active = true) AS active_profiles,
       (SELECT count(*)::int FROM profile_requests WHERE organization_id = $1 AND status = 'pending') AS requests,
       (SELECT count(*)::int FROM conversations WHERE organization_id = $1 AND COALESCE(outcome, 'in_progress') = 'in_progress') AS open_chats,
       (SELECT count(*)::int FROM conversations WHERE organization_id = $1 AND outcome = 'matched') AS matched`,
    [organization.id]
  );
  const stats = counts.rows[0] || {
    profiles: 0,
    active_profiles: 0,
    requests: 0,
    open_chats: 0,
    matched: 0,
  };

  const copy =
    locale === "fi"
      ? {
          welcome: `Tervetuloa, ${session.name.split(" ")[0] || session.name}`,
          lede: "Pikakatsaus tilanteeseen. Asetukset, käyttäjät ja chatbot löytyvät sivupalkista.",
          open: "Avoimet keskustelut",
          matched: "Yhdistetyt",
          credits: "Viestit tässä kuussa",
          requests: "Odottavat pyynnöt",
          profiles: people,
          goConversations: "Katso keskustelut",
          goUsers: "Käyttäjähallinta",
          goSettings: "Asetukset",
          goChatbot: "Chatbot",
        }
      : locale === "sv"
        ? {
            welcome: `Välkommen, ${session.name.split(" ")[0] || session.name}`,
            lede: "En snabb överblick. Inställningar, användare och chatbot finns i sidomenyn.",
            open: "Öppna samtal",
            matched: "Matchade",
            credits: "Meddelanden denna månad",
            requests: "Väntande förfrågningar",
            profiles: people,
            goConversations: "Visa samtal",
            goUsers: "Användarhantering",
            goSettings: "Inställningar",
            goChatbot: "Chatbot",
          }
        : {
            welcome: `Welcome, ${session.name.split(" ")[0] || session.name}`,
            lede: "A quick snapshot of how things are going. Settings, people, and the chatbot live in the sidebar.",
            open: "Open conversations",
            matched: "Matched",
            credits: "Messages this month",
            requests: "Pending requests",
            profiles: people,
            goConversations: "View conversations",
            goUsers: "User management",
            goSettings: "Settings",
            goChatbot: "Chatbot",
          };

  const statCards = [
    { label: copy.profiles, value: `${stats.active_profiles}/${stats.profiles}`, href: "/coaches" },
    { label: copy.open, value: String(stats.open_chats), href: "/logs" },
    { label: copy.matched, value: String(stats.matched), href: "/logs" },
    {
      label: copy.credits,
      value: `${organization.credits_used}/${organization.credit_limit}`,
      href: canManageCompany(session.role) ? "/settings" : "/logs",
    },
    ...(canManageCompany(session.role)
      ? [{ label: copy.requests, value: String(stats.requests), href: "/users" }]
      : []),
  ];

  const shortcuts = [
    { href: "/logs", label: copy.goConversations },
    canManageCompany(session.role) && { href: "/users", label: copy.goUsers },
    { href: "/chatbot", label: copy.goChatbot },
    canManageCompany(session.role) && { href: "/settings", label: copy.goSettings },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="mx-auto max-w-4xl p-8">
      <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">{organization.name}</p>
      <h1 className="font-display mb-2 text-3xl text-neutral-100 md:text-4xl">{copy.welcome}</h1>
      <p className="mb-8 max-w-2xl text-neutral-400">{copy.lede}</p>

      {organization.status !== "active" && (
        <p className="mb-6 text-sm text-amber-400">Status: {organization.status}. Records are unchanged.</p>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition hover:border-amber-500"
          >
            <p className="font-display text-2xl text-neutral-100">{card.value}</p>
            <p className="mt-1 text-sm text-neutral-500">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-amber-500 hover:text-amber-400"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

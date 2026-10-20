import { Breadcrumbs } from "../../components/Breadcrumbs";
import { HomeCharts } from "./HomeCharts";
import { getPool } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
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
       (SELECT count(*)::int FROM conversations WHERE organization_id = $1 AND outcome = 'matched') AS matched,
       (SELECT count(*)::int FROM conversations WHERE organization_id = $1 AND COALESCE(outcome, 'in_progress') NOT IN ('in_progress', 'matched')) AS other_outcomes`,
    [organization.id]
  );
  const stats = counts.rows[0] || {
    profiles: 0,
    active_profiles: 0,
    requests: 0,
    open_chats: 0,
    matched: 0,
    other_outcomes: 0,
  };
  const inactiveProfiles = Math.max((stats.profiles || 0) - (stats.active_profiles || 0), 0);

  const copy =
    locale === "fi"
      ? {
          home: "Koti",
          welcome: `Tervetuloa, ${session.name.split(" ")[0] || session.name}`,
          lede: "Pikakatsaus tilanteeseen.",
          open: "Avoimet",
          matched: "Yhdistetyt",
          other: "Muut",
          outcomes: "Keskustelut",
          profiles: people,
          active: "Aktiiviset",
          inactive: "Ei aktiiviset",
          credits: "Viestit tässä kuussa",
          used: "Käytetty",
          remaining: "Jäljellä",
          requests: "Odottavat pyynnöt",
        }
      : locale === "sv"
        ? {
            home: "Hem",
            welcome: `Välkommen, ${session.name.split(" ")[0] || session.name}`,
            lede: "En snabb överblick.",
            open: "Öppna",
            matched: "Matchade",
            other: "Övriga",
            outcomes: "Samtal",
            profiles: people,
            active: "Aktiva",
            inactive: "Inaktiva",
            credits: "Meddelanden denna månad",
            used: "Använt",
            remaining: "Kvar",
            requests: "Väntande förfrågningar",
          }
        : {
            home: "Home",
            welcome: `Welcome, ${session.name.split(" ")[0] || session.name}`,
            lede: "A quick snapshot of how things are going.",
            open: "Open",
            matched: "Matched",
            other: "Other",
            outcomes: "Conversations",
            profiles: people,
            active: "Active",
            inactive: "Inactive",
            credits: "Messages this month",
            used: "Used",
            remaining: "Remaining",
            requests: "Pending requests",
          };

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Breadcrumbs items={[{ label: copy.home }]} />
      <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">{organization.name}</p>
      <h1 className="font-display mb-2 text-3xl text-neutral-100 md:text-4xl">{copy.welcome}</h1>
      <p className="mb-8 max-w-2xl text-neutral-400">{copy.lede}</p>

      {organization.status !== "active" && (
        <p className="mb-6 text-sm text-amber-400">Status: {organization.status}. Records are unchanged.</p>
      )}

      <HomeCharts
        openChats={stats.open_chats}
        matched={stats.matched}
        otherOutcomes={stats.other_outcomes}
        activeProfiles={stats.active_profiles}
        inactiveProfiles={inactiveProfiles}
        creditsUsed={organization.credits_used}
        creditLimit={organization.credit_limit}
        copy={{
          outcomes: copy.outcomes,
          open: copy.open,
          matched: copy.matched,
          other: copy.other,
          profiles: copy.profiles,
          active: copy.active,
          inactive: copy.inactive,
          credits: copy.credits,
          used: copy.used,
          remaining: copy.remaining,
        }}
      />

      {stats.requests > 0 && (
        <p className="mt-6 text-sm text-neutral-400">
          {copy.requests}: <span className="text-amber-400">{stats.requests}</span>
        </p>
      )}
    </div>
  );
}

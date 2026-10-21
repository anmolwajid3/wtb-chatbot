import { Breadcrumbs } from "../../components/Breadcrumbs";
import { resetMessageCredits } from "../companies/actions";
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
          limitHit:
            "Tämän kuun viestikiintiö on täynnä — chatbot on tauolla. Nollaa kiintiö jatkaaksesi testausta.",
          reset: "Nollaa viestit",
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
            limitHit:
              "This month's message allowance is used up — the chatbot is paused. Reset the counter to keep testing.",
            reset: "Reset messages",
          };

  const atLimit =
    Number(organization.credit_limit) > 0 &&
    Number(organization.credits_used) >= Number(organization.credit_limit);
  const canResetCredits = session.role === "super_admin";

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Breadcrumbs items={[{ label: copy.home }]} />
      <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">{organization.name}</p>
      <h1 className="font-display mb-2 text-3xl text-neutral-100 md:text-4xl">{copy.welcome}</h1>
      <p className="mb-8 max-w-2xl text-neutral-400">{copy.lede}</p>

      {organization.status !== "active" && (
        <p className="mb-6 text-sm text-amber-400">Status: {organization.status}. Records are unchanged.</p>
      )}

      {atLimit && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-200">{copy.limitHit}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {organization.credits_used}/{organization.credit_limit}
          </p>
          {canResetCredits ? (
            <form action={resetMessageCredits} className="mt-3">
              <input type="hidden" name="id" value={organization.id} />
              <input type="hidden" name="return_to" value="/home" />
              <button
                type="submit"
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400"
              >
                {copy.reset}
              </button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-neutral-500">
              {locale === "fi"
                ? "Pyydä GPT Lab -superadminia nollaamaan kiintiö Yritykset-sivulta."
                : "Ask a GPT Lab super admin to reset it on the Companies page."}
            </p>
          )}
        </div>
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

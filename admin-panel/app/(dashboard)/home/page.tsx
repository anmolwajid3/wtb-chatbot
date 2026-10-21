import { Breadcrumbs } from "../../components/Breadcrumbs";
import { updateCompanyLimits } from "../companies/limitsActions";
import { HomeCharts } from "./HomeCharts";
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
            "Tämän kuun viestikiintiö on täynnä — chatbot on tauolla. Nosta kiintiötä jatkaaksesi.",
          messagesLabel: "Viestikiintiö / kk",
          coachesLabel: "Valmentajien maksimi",
          saveLimits: "Tallenna kiintiöt",
          resetUsed: "Nollaa myös käytetyt viestit",
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
              "This month's message allowance is used up — the chatbot is paused. Raise the limit to keep testing.",
            messagesLabel: "Monthly message limit",
            coachesLabel: "Coach / profile limit",
            saveLimits: "Save limits",
            resetUsed: "Also reset messages used this month",
          };

  const atLimit =
    Number(organization.credit_limit) > 0 &&
    Number(organization.credits_used) >= Number(organization.credit_limit);
  const canEditLimits = canManageCompany(session.role);
  const inputClass =
    "mt-1 w-full max-w-xs bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Breadcrumbs items={[{ label: copy.home }]} />
      <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">{organization.name}</p>
      <h1 className="font-display mb-2 text-3xl text-neutral-100 md:text-4xl">{copy.welcome}</h1>
      <p className="mb-8 max-w-2xl text-neutral-400">{copy.lede}</p>

      {organization.status !== "active" && (
        <p className="mb-6 text-sm text-amber-400">Status: {organization.status}. Records are unchanged.</p>
      )}

      {canEditLimits && (
        <div
          className={`mb-6 rounded-lg border p-4 ${
            atLimit ? "border-amber-500/40 bg-amber-500/10" : "border-neutral-800 bg-neutral-900"
          }`}
        >
          {atLimit && <p className="mb-3 text-sm text-amber-200">{copy.limitHit}</p>}
          <p className="mb-3 text-xs text-neutral-500">
            {organization.credits_used}/{organization.credit_limit}{" "}
            {locale === "fi" ? "viestiä käytetty tässä kuussa" : "messages used this month"}
          </p>
          <form action={updateCompanyLimits} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={organization.id} />
            <input type="hidden" name="return_to" value="/home" />
            <label className="block text-sm text-neutral-400">
              {copy.messagesLabel}
              <input
                type="number"
                name="credit_limit"
                min={1}
                max={1000000}
                defaultValue={Math.max(Number(organization.credit_limit) || 1000, atLimit ? 1000 : 1)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm text-neutral-400">
              {copy.coachesLabel}
              <input
                type="number"
                name="profile_limit"
                min={1}
                max={500}
                defaultValue={organization.profile_limit || 50}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-400 sm:col-span-2">
              <input type="checkbox" name="reset_used" value="1" defaultChecked={atLimit} />
              {copy.resetUsed}
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400"
              >
                {copy.saveLimits}
              </button>
            </div>
          </form>
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

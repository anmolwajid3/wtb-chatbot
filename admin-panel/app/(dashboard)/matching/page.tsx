import { redirect } from "next/navigation";
import { saveMatching } from "./actions";
import { getLocale } from "@/lib/i18n";
import { canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const copy = {
  en: {
    title: "Matching",
    lede: "These rules decide when a visitor is offered people, and how many. A score under the minimum is not a match.",
    max: "Profiles to suggest",
    maxHint: "WTB starts at 3. The assistant never offers more than this.",
    min: "Minimum match, percent",
    minHint: "Anything below this is left out. 50 means a weak fit is not shown.",
    turns: "Visitor messages before a match",
    turnsHint: "The first message never matches. 2 waits for one follow-up.",
    score: "Show the match percent in the visitor's reply",
    save: "Save matching",
  },
  sv: {
    title: "Matchning",
    lede: "De här reglerna avgör när en besökare får förslag, och hur många. Ett resultat under gränsen är ingen matchning.",
    max: "Profiler att föreslå",
    maxHint: "WTB börjar på 3. Assistenten erbjuder aldrig fler.",
    min: "Lägsta matchning, procent",
    minHint: "Allt under detta lämnas bort. 50 betyder att en svag träff inte visas.",
    turns: "Besökarens meddelanden före en matchning",
    turnsHint: "Första meddelandet matchar aldrig. 2 väntar på en följdfråga.",
    score: "Visa matchningsprocenten i svaret till besökaren",
    save: "Spara matchning",
  },
  fi: {
    title: "Yhdistäminen",
    lede: "Nämä säännöt päättävät, milloin kävijälle tarjotaan ihmisiä ja kuinka monta. Rajaa heikompi tulos ei ole osuma.",
    max: "Ehdotettavat profiilit",
    maxHint: "WTB alkaa kolmesta. Avustaja ei ehdota enempää.",
    min: "Pienin osuma, prosenttia",
    minHint: "Tätä heikompi jää pois. 50 tarkoittaa, ettei heikkoa osumaa näytetä.",
    turns: "Kävijän viestit ennen osumaa",
    turnsHint: "Ensimmäinen viesti ei yhdistä. 2 odottaa yhtä jatkokysymystä.",
    score: "Näytä osumaprosentti kävijän vastauksessa",
    save: "Tallenna yhdistäminen",
  },
};

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export default async function MatchingPage() {
  const { session, organization } = await requireOrganization();
  if (!canManageCompany(session.role)) redirect("/home");
  const locale = await getLocale();
  const text = copy[locale];

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="font-display text-3xl text-neutral-100 mb-2">{text.title}</h1>
      <p className="text-neutral-400 mb-6">{text.lede}</p>
      <form action={saveMatching} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 grid gap-4">
        <label className="block text-sm text-neutral-400">
          {text.max}
          <input type="number" name="max_matches" min={1} max={10} defaultValue={organization.max_matches} className={inputClass} />
          <span className="block text-xs text-neutral-500 mt-1">{text.maxHint}</span>
        </label>
        <label className="block text-sm text-neutral-400">
          {text.min}
          <input type="number" name="min_match_score" min={0} max={100} defaultValue={organization.min_match_score} className={inputClass} />
          <span className="block text-xs text-neutral-500 mt-1">{text.minHint}</span>
        </label>
        <label className="block text-sm text-neutral-400">
          {text.turns}
          <input type="number" name="followup_turns" min={1} max={8} defaultValue={organization.followup_turns} className={inputClass} />
          <span className="block text-xs text-neutral-500 mt-1">{text.turnsHint}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" name="show_match_score" defaultChecked={organization.show_match_score} />
          {text.score}
        </label>
        <div>
          <button type="submit" className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md">
            {text.save}
          </button>
        </div>
      </form>
    </div>
  );
}

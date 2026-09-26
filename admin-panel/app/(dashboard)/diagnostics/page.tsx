import { redirect } from "next/navigation";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { getLocale, t } from "@/lib/i18n";
import { canEditCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const copy = {
  en: {
    lede: "Runs the assistant against this company's rules, voice, and example phrases. It does not use a message credit, and it does not save a conversation. A fail names the agent that missed.",
    run: "Run diagnostic",
    running: "Running…",
    down: "The assistant is not reachable. Start the backend, then run this again.",
  },
  sv: {
    lede: "Kör assistenten mot företagets regler, röst och exempelfraser. Det drar ingen kredit och sparar inget samtal. Ett fel pekar ut agenten som missade.",
    run: "Kör diagnostik",
    running: "Kör…",
    down: "Assistenten går inte att nå. Starta servern och kör igen.",
  },
  fi: {
    lede: "Ajaa avustajan tämän yrityksen sääntöjä, ääntä ja esimerkkilauseita vasten. Se ei kuluta viestiä eikä tallenna keskustelua. Virhe nimeää agentin, joka ei toiminut.",
    run: "Aja diagnostiikka",
    running: "Ajetaan…",
    down: "Avustajaan ei saada yhteyttä. Käynnistä palvelin ja aja uudelleen.",
  },
};

export default async function DiagnosticsPage() {
  const { session } = await requireOrganization();
  if (!canEditCompany(session.role)) redirect("/home");
  const locale = await getLocale();
  const text = copy[locale];

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="font-display text-3xl text-neutral-100 mb-2">{t(locale, "nav.diagnostics")}</h1>
      <DiagnosticsPanel
        intro={text.lede}
        runLabel={text.run}
        runningLabel={text.running}
        unreachable={text.down}
      />
    </div>
  );
}

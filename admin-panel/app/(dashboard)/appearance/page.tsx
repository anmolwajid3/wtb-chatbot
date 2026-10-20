import { redirect } from "next/navigation";
import { saveAppearance } from "./actions";
import { getLocale } from "@/lib/i18n";
import { canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

const copy = {
  en: {
    title: "Chat appearance",
    lede: "Colors and reply language for {name}'s visitor chatbot.",
    open: "Open chatbot",
    language: "Bot reply language",
    auto: "Follow visitor language toggle (EN / FI / SV)",
    alwaysEn: "Always English",
    alwaysFi: "Always Finnish",
    alwaysSv: "Always Swedish",
    languageHint:
      "When set to Always Finnish or Always English, every bot reply uses that language — including refusals and match suggestions.",
    theme: "Widget color mode",
    dark: "Dark",
    light: "Light",
    accent: "Accent color",
    accentHint: "Used for buttons and highlights on the chat page.",
    save: "Save appearance",
  },
  fi: {
    title: "Chatin ulkoasu",
    lede: "Värit ja vastauskieli yrityksen {name} chatbotille.",
    open: "Avaa chatbot",
    language: "Botin vastauskieli",
    auto: "Seuraa kävijän kielivalintaa (EN / FI / SV)",
    alwaysEn: "Aina englanti",
    alwaysFi: "Aina suomi",
    alwaysSv: "Aina ruotsi",
    languageHint:
      "Kun kieliksi on valittu Aina suomi tai Aina englanti, botin jokainen vastaus on sillä kielellä — myös kieltäytymiset ja ehdotukset.",
    theme: "Widgetin väritila",
    dark: "Tumma",
    light: "Vaalea",
    accent: "Korostusväri",
    accentHint: "Käytetään chatin painikkeissa ja korostuksissa.",
    save: "Tallenna ulkoasu",
  },
  sv: {
    title: "Chattens utseende",
    lede: "Färger och svarsspråk för {name}s besökarchattbot.",
    open: "Öppna chatbot",
    language: "Botens svarsspråk",
    auto: "Följ besökarens språkval (EN / FI / SV)",
    alwaysEn: "Alltid engelska",
    alwaysFi: "Alltid finska",
    alwaysSv: "Alltid svenska",
    languageHint:
      "När Always Finnish eller Always English är valt svarar boten alltid på det språket — även avvisningar och förslag.",
    theme: "Widgetens färgläge",
    dark: "Mörk",
    light: "Ljus",
    accent: "Accentfärg",
    accentHint: "Används för knappar och markeringar på chatsidan.",
    save: "Spara utseende",
  },
} as const;

export default async function AppearancePage() {
  const { session, organization } = await requireOrganization();
  if (!canManageCompany(session.role)) redirect("/home");

  const locale = await getLocale();
  const text = copy[locale] || copy.en;
  const widgetUrl = `https://opas-widget.fly.dev/?company=${organization.slug}`;

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="font-display text-3xl text-neutral-100 mb-2">{text.title}</h1>
      <p className="text-neutral-400 mb-6">
        {text.lede.replace("{name}", organization.name)}{" "}
        <a href={widgetUrl} className="text-amber-400 hover:underline" target="_blank" rel="noreferrer">
          {text.open}
        </a>
      </p>

      <form action={saveAppearance} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 grid gap-4">
        <label className="block text-sm text-neutral-400">
          {text.language}
          <select name="reply_language" defaultValue={organization.reply_language || "auto"} className={inputClass}>
            <option value="auto">{text.auto}</option>
            <option value="en">{text.alwaysEn}</option>
            <option value="fi">{text.alwaysFi}</option>
            <option value="sv">{text.alwaysSv}</option>
          </select>
          <span className="block text-xs text-neutral-500 mt-1">{text.languageHint}</span>
        </label>

        <label className="block text-sm text-neutral-400">
          {text.theme}
          <select name="widget_theme" defaultValue={organization.widget_theme || "dark"} className={inputClass}>
            <option value="dark">{text.dark}</option>
            <option value="light">{text.light}</option>
          </select>
        </label>

        <label className="block text-sm text-neutral-400">
          {text.accent}
          <input
            type="color"
            name="widget_accent"
            defaultValue={organization.widget_accent || "#FFFFFF"}
            className="mt-1 h-10 w-24 bg-black border border-neutral-700 rounded-md p-1"
          />
          <span className="block text-xs text-neutral-500 mt-1">{text.accentHint}</span>
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

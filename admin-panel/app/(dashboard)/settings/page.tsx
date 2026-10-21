import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { CompanyLogoForm } from "../../components/CompanyLogoForm";
import { NavIcon } from "../../components/NavIcon";
import { saveAppearance } from "../appearance/actions";
import { getLocale } from "@/lib/i18n";
import { canAnalyze, canEditCompany, canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export default async function SettingsPage() {
  const { session, organization } = await requireOrganization();
  if (!canManageCompany(session.role) && !canAnalyze(session.role) && !canEditCompany(session.role)) {
    redirect("/home");
  }
  const locale = await getLocale();
  const widgetUrl = `https://opas-widget.fly.dev/?company=${organization.slug}`;

  const copy =
    locale === "fi"
      ? {
          title: "Asetukset",
          lede: "Brändi, chatbotin ulkoasu, kieli ja malli.",
          branding: "Yrityksen logo",
          appearance: "Chatbotin ulkoasu",
          language: "Botin vastauskieli",
          auto: "Seuraa kävijän kielivalintaa (FI / EN)",
          alwaysEn: "Aina englanti",
          alwaysFi: "Aina suomi",
          languageHint: "Tämä on yrityksen oletuskieli chatbotille.",
          theme: "Väritila",
          dark: "Tumma",
          light: "Vaalea",
          accent: "Korostusväri",
          accentHint: "Käytetään chatin painikkeissa. Valitse brändisi väri — ei tarvitse olla oletus.",
          save: "Tallenna ulkoasu",
          open: "Avaa chatbot",
          model: "Mallin valinta",
          modelDesc: "Valitse LLM-malli ja seuraa käyttöä.",
          diagnostics: "Diagnostiikka",
          diagnosticsDesc: "Tarkista chatbotin perustoiminnot.",
          advanced: "Lisäasetukset",
        }
       : {
            title: "Settings",
            lede: "Brand, chatbot look, language, and model.",
            branding: "Company logo",
            appearance: "Chatbot appearance",
            language: "Bot reply language",
            auto: "Follow visitor language toggle (FI / EN)",
            alwaysEn: "Always English",
            alwaysFi: "Always Finnish",
            languageHint: "Default language for this company’s visitor chatbot.",
            theme: "Color mode",
            dark: "Dark",
            light: "Light",
            accent: "Accent color",
            accentHint: "Used for chat buttons and highlights. Pick your brand color — it doesn’t have to stay the default.",
            save: "Save appearance",
            open: "Open chatbot",
            model: "Model selection",
            modelDesc: "Choose the LLM and review usage.",
            diagnostics: "Diagnostics",
            diagnosticsDesc: "Check that the chatbot’s basics still work.",
            advanced: "Advanced",
          };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <div>
        <Breadcrumbs
          items={[
            { href: "/home", label: locale === "fi" ? "Koti" : "Home" },
            { label: copy.title },
          ]}
        />
        <h1 className="font-display mb-2 text-3xl text-neutral-100">{copy.title}</h1>
        <p className="text-neutral-400">{copy.lede}</p>
      </div>

      {canManageCompany(session.role) && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">{copy.branding}</h2>
          <CompanyLogoForm
            organizationId={organization.id}
            logoUrl={organization.logo_url}
            label={copy.branding}
          />
        </section>
      )}

      {canManageCompany(session.role) && (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">{copy.appearance}</h2>
            <a href={widgetUrl} className="text-sm text-amber-400 hover:underline" target="_blank" rel="noreferrer">
              {copy.open}
            </a>
          </div>
          <form action={saveAppearance} className="grid gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <label className="block text-sm text-neutral-400">
              {copy.language}
              <select name="reply_language" defaultValue={organization.reply_language || "auto"} className={inputClass}>
                <option value="auto">{copy.auto}</option>
                <option value="fi">{copy.alwaysFi}</option>
                <option value="en">{copy.alwaysEn}</option>
              </select>
              <span className="mt-1 block text-xs text-neutral-500">{copy.languageHint}</span>
            </label>
            <label className="block text-sm text-neutral-400">
              {copy.theme}
              <select name="widget_theme" defaultValue={organization.widget_theme || "dark"} className={inputClass}>
                <option value="dark">{copy.dark}</option>
                <option value="light">{copy.light}</option>
              </select>
            </label>
            <label className="block text-sm text-neutral-400">
              {copy.accent}
              <input
                type="color"
                name="widget_accent"
                defaultValue={organization.widget_accent || "#F59E0B"}
                className="mt-1 h-10 w-24 rounded-md border border-neutral-700 bg-black p-1"
              />
              <span className="mt-1 block text-xs text-neutral-500">{copy.accentHint}</span>
            </label>
            <div>
              <button type="submit" className="rounded-md bg-amber-500 px-4 py-2 font-medium text-black">
                {copy.save}
              </button>
            </div>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">{copy.advanced}</h2>
        <div className="grid gap-3">
          {canAnalyze(session.role) && (
            <Link
              href="/llm-settings"
              className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition hover:border-amber-500"
            >
              <span className="text-amber-400">
                <NavIcon name="model" className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-medium text-neutral-100">{copy.model}</span>
                <span className="mt-0.5 block text-sm text-neutral-400">{copy.modelDesc}</span>
              </span>
            </Link>
          )}
          {canEditCompany(session.role) && (
            <Link
              href="/diagnostics"
              className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition hover:border-amber-500"
            >
              <span className="text-amber-400">
                <NavIcon name="diagnostics" className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-medium text-neutral-100">{copy.diagnostics}</span>
                <span className="mt-0.5 block text-sm text-neutral-400">{copy.diagnosticsDesc}</span>
              </span>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

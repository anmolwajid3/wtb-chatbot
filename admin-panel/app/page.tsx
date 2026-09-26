import Link from "next/link";
import { HarborMark } from "./components/HarborMark";
import { LandingStage } from "./components/LandingStage";
import { landingFeatures } from "./components/landingCopy";
import { Preferences } from "./components/Preferences";
import { getLocale, getTheme, t } from "@/lib/i18n";
import { getStaffSession } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const planCopy = {
  en: {
    label: "Monthly visitor messages",
    note: "When the month's messages are used, the public assistant stops.",
    free: "For a first company and a small trial.",
    pro: "For a working team with steady visitor traffic.",
    enterprise: "For a public assistant that many people can reach.",
  },
  sv: {
    label: "Besökarmeddelanden per månad",
    note: "När månadens meddelanden är slut stannar den offentliga assistenten.",
    free: "För ett första företag och ett litet prov.",
    pro: "För ett arbetande team med stadig trafik.",
    enterprise: "För en offentlig assistent som många kan nå.",
  },
  fi: {
    label: "Kävijäviestit kuukaudessa",
    note: "Kun kuukauden viestit on käytetty, julkinen avustaja pysähtyy.",
    free: "Ensimmäiselle yritykselle ja pienelle kokeilulle.",
    pro: "Työskentelevälle tiimille, jolla on tasaista liikennettä.",
    enterprise: "Julkiselle avustajalle, jonka monet voivat tavoittaa.",
  },
};

const stepImages = [
  {
    image: "/landing/talk.jpg",
    alt: "Two people talking across a table.",
    href: "https://unsplash.com/photos/two-women-sitting-beside-table-and-talking-LQ1t-8Ms5PY",
  },
  {
    image: "/landing/coach.jpg",
    alt: "Two people looking at a tablet outdoors.",
    href: "https://unsplash.com/photos/two-people-sitting-during-day-aWf7mjwwJJo",
  },
  {
    image: "/landing/cups.jpg",
    alt: "Two cups of coffee on a table between two people.",
    href: "https://unsplash.com/photos/a-couple-of-people-sitting-at-a-table-with-cups-of-coffee-3gAiajAfjXI",
  },
];

const featureHrefs = ["/admin", "/join", "/login", "/login", "/login", "#plans"];

export default async function LandingPage() {
  const locale = await getLocale();
  const theme = await getTheme();
  let signedIn = false;
  try {
    signedIn = Boolean(await getStaffSession());
  } catch {
    signedIn = false;
  }

  const steps = [1, 2, 3].map((n, index) => ({
    title: t(locale, `landing.step${n}t`),
    body: t(locale, `landing.step${n}b`),
    image: stepImages[index].image,
    alt: stepImages[index].alt,
    href: stepImages[index].href,
  }));
  const copy = planCopy[locale];
  const plans = [
    { id: "free", name: "Free", limit: "50", note: `${copy.free} ${copy.note}` },
    { id: "pro", name: "Pro", limit: "1,000", note: `${copy.pro} ${copy.note}` },
    { id: "enterprise", name: "Enterprise", limit: "10,000", note: `${copy.enterprise} ${copy.note}` },
  ];

  return (
    <div className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
        <HarborMark />
        <div className="flex items-center gap-3">
          <Preferences
            locale={locale}
            theme={theme}
            languageLabel={t(locale, "common.language")}
            themeLightLabel={t(locale, "common.themeToLight")}
            themeDarkLabel={t(locale, "common.themeToDark")}
          />
          {!signedIn && (
            <Link href="/admin" className="text-sm text-neutral-500 hover:text-amber-400">
              {t(locale, "landing.admin")}
            </Link>
          )}
          <Link
            href={signedIn ? "/home" : "/login"}
            className="text-sm bg-amber-500 text-black font-medium px-3 py-1.5 rounded-full hover:bg-amber-400 transition"
          >
            {signedIn ? t(locale, "landing.workspace") : t(locale, "landing.signIn")}
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-6 pb-24">
        <section className="landing-hero">
          <a
            href="https://unsplash.com/photos/business-people-in-a-meeting-around-a-table-fQf9XTYNmQU"
            target="_blank"
            rel="noreferrer"
          >
            <img src="/landing/hero.jpg" alt="People in a meeting around a table." />
          </a>
          <div className="landing-hero-copy">
            <p className="text-sm mb-3" style={{ color: "#FFFFFF" }}>
              {t(locale, "landing.kicker")}
            </p>
            <h1 className="font-display text-4xl md:text-6xl leading-tight max-w-3xl">{t(locale, "landing.title")}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: "#E7EDE4" }}>
              {t(locale, "landing.lede")}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/login" className="text-sm bg-white text-[#2C3329] font-medium px-4 py-2 rounded-full">
                {t(locale, "landing.signIn")}
              </Link>
              <Link href="/join" className="text-sm border border-white/70 text-white font-medium px-4 py-2 rounded-full">
                {t(locale, "login.join")}
              </Link>
            </div>
          </div>
        </section>

        <p className="mt-8 max-w-2xl text-neutral-500">{t(locale, "landing.adopt")}</p>

        <LandingStage
          steps={steps}
          plans={plans}
          stepLabel={t(locale, "home.flow")}
          planLabel={copy.label}
        />

        <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-4">
          {landingFeatures(locale).map((feature, index) => (
            <Link
              key={feature.title}
              href={featureHrefs[index]}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 block hover:border-[#677862]"
            >
              <h2 className="text-lg text-neutral-100 mb-2">{feature.title}</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">{feature.body}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}

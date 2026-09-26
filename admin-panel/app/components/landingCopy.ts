import type { Locale } from "@/lib/i18n";

export type Feature = { title: string; body: string };

const features: Record<Locale, Feature[]> = {
  en: [
    {
      title: "A company of its own",
      body: "GPT Lab adds the company. Archive, hold, and remove only change its status.",
    },
    {
      title: "Profiles with your fields",
      body: "Each company decides the questions on a profile, and groups the ones that belong together.",
    },
    {
      title: "A conversation, not a form",
      body: "Visitors describe a need. The assistant suggests only real profiles from that company.",
    },
    {
      title: "Voice, phrases, and rules",
      body: "Each company sets how the assistant speaks, and what it must not say.",
    },
    {
      title: "Greetings, logs, and the handoff",
      body: "Every conversation is stored, and a match leaves the team a short brief.",
    },
    {
      title: "Plans, credits, and a hard stop",
      body: "Free, Pro, and Enterprise include a monthly message limit. The assistant stops when it is used.",
    },
  ],
  sv: [
    {
      title: "Ett eget företag",
      body: "GPT Lab lägger till företaget. Arkivera, pausa och ta bort ändrar bara status.",
    },
    {
      title: "Profiler med era fält",
      body: "Företaget väljer frågorna på en profil och grupperar dem som hör ihop.",
    },
    {
      title: "Ett samtal, inte ett formulär",
      body: "Besökaren beskriver ett behov. Assistenten föreslår bara riktiga profiler från det företaget.",
    },
    {
      title: "Röst, fraser och regler",
      body: "Varje företag bestämmer hur assistenten talar och vad den inte får säga.",
    },
    {
      title: "Hälsningar, loggar och överlämning",
      body: "Varje samtal sparas, och en matchning lämnar teamet en kort sammanfattning.",
    },
    {
      title: "Planer, krediter och ett stopp",
      body: "Free, Pro och Enterprise har en månadsgräns. Assistenten stannar när den är använd.",
    },
  ],
  fi: [
    {
      title: "Oma yritys",
      body: "GPT Lab lisää yrityksen. Arkistointi, pito ja poisto muuttavat vain tilan.",
    },
    {
      title: "Profiilit omilla kentillä",
      body: "Yritys päättää profiilin kysymykset ja ryhmittää yhteen kuuluvat.",
    },
    {
      title: "Keskustelu, ei lomake",
      body: "Kävijä kuvaa tarpeen. Avustaja ehdottaa vain sen yrityksen oikeita profiileja.",
    },
    {
      title: "Ääni, fraasit ja säännöt",
      body: "Jokainen yritys päättää, miten avustaja puhuu ja mitä se ei saa sanoa.",
    },
    {
      title: "Tervehdykset, lokit ja luovutus",
      body: "Jokainen keskustelu tallennetaan, ja osuma jättää tiimille lyhyen yhteenvedon.",
    },
    {
      title: "Paketit, krediitit ja pysäytys",
      body: "Free, Pro ja Enterprise sisältävät kuukausirajan. Avustaja pysähtyy, kun se on käytetty.",
    },
  ],
};

export function landingFeatures(locale: Locale): Feature[] {
  return features[locale] ?? features.en;
}

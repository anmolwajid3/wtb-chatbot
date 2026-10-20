import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { NavIcon } from "../../components/NavIcon";
import { getLocale } from "@/lib/i18n";
import { canEditCompany, canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ChatbotHubPage() {
  const { session, organization } = await requireOrganization();
  if (!canEditCompany(session.role) && !canManageCompany(session.role)) redirect("/home");
  const locale = await getLocale();
  const person = organization.profile_label;

  const items = [
    canEditCompany(session.role) && {
      href: "/tone",
      icon: "voice",
      title: locale === "fi" ? "Ääni" : "Voice",
      desc:
        locale === "fi"
          ? "Botin perussävy."
           : "The assistant’s steady way of speaking.",
    },
    canEditCompany(session.role) && {
      href: "/phrases",
      icon: "chat",
      title: locale === "fi" ? "Fraasit" : "Phrases",
      desc:
        locale === "fi"
          ? "Esimerkkilauseet eri tunnelmille."
           : "Example lines for different moods.",
    },
    canEditCompany(session.role) && {
      href: "/guardrails",
      icon: "rules",
      title: locale === "fi" ? "Säännöt" : "Rules",
      desc:
        locale === "fi"
          ? "Mitä botti ei saa sanoa."
           : "What the assistant must never say.",
    },
    canEditCompany(session.role) && {
      href: "/greetings",
      icon: "broadcast",
      title: locale === "fi" ? "Tervehdykset" : "Greetings",
      desc:
        locale === "fi"
          ? "Chatin avausviesti."
           : "The opening line visitors hear.",
    },
    canEditCompany(session.role) && {
      href: "/profile-structure",
      icon: "coaches",
      title: locale === "fi" ? `${person}-kentät` : `${person} fields`,
      desc:
        locale === "fi"
          ? "Profiililomakkeen kysymykset."
           : "Questions on each profile.",
    },
    canManageCompany(session.role) && {
      href: "/matching",
      icon: "matching",
      title: locale === "fi" ? "Sovitus" : "Matching",
      desc:
        locale === "fi"
          ? "Kuinka monta ehdotusta ja milloin."
           : "How many suggestions and when to show them.",
    },
    canEditCompany(session.role) && {
      href: "/master-prompts",
      icon: "settings",
      title: locale === "fi" ? "Kehotteet" : "Prompts",
      desc:
        locale === "fi"
          ? "Edistyneet järjestelmäkehotteet."
           : "Advanced system prompts.",
    },
  ].filter(Boolean) as { href: string; icon: string; title: string; desc: string }[];

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Breadcrumbs
        items={[
          { href: "/home", label: locale === "fi" ? "Koti" : "Home" },
          { label: "Chatbot" },
        ]}
      />
      <h1 className="font-display mb-2 text-3xl text-neutral-100">
        {locale === "fi" ? "Chatbot" : "Chatbot"}
      </h1>
      <p className="mb-8 text-neutral-400">
        {locale === "fi"
          ? `Miten ${organization.name}-avustaja puhuu ja ehdottaa profiileja.`
           : `How ${organization.name}’s assistant speaks and suggests profiles.`}
      </p>
      <div className="grid gap-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition hover:border-amber-500"
          >
            <span className="mt-0.5 text-amber-400">
              <NavIcon name={item.icon} className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-medium text-neutral-100">{item.title}</span>
              <span className="mt-0.5 block text-sm text-neutral-400">{item.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";

const cards = [
  { href: "/coaches", title: "Coach Profiles", desc: "Add, edit, and deactivate coaches" },
  { href: "/tone", title: "Tone of Voice", desc: "The bot's underlying, always-on voice" },
  { href: "/phrases", title: "Example Phrases", desc: "Mood-specific phrasing (positive/negative/neutral)" },
  { href: "/guardrails", title: "Guardrails", desc: "Things the bot must never promise or do" },
];

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="font-display text-3xl font-semibold text-amber-400 uppercase tracking-wide mb-1">
        WTB Chatbot Admin
      </h1>
      <p className="text-neutral-400 mb-8">Manage the bot&apos;s behavior without touching any code.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/5 transition"
          >
            <h2 className="font-medium text-neutral-100">{c.title}</h2>
            <p className="text-sm text-neutral-400 mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
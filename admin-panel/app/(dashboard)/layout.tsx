import Link from "next/link";
import { logoutAction } from "../actions";

const navLinks = [
  { href: "/coaches", label: "Coaches" },
  { href: "/tone", label: "Tone of Voice" },
  { href: "/phrases", label: "Example Phrases" },
  { href: "/guardrails", label: "Guardrails" },
  { href: "/logs", label: "Conversation Logs" },
  { href: "/queries", label: "Coach Support Queries" },
  { href: "/llm-settings", label: "LLM Settings" },
  { href: "/master-prompts", label: "Master Prompts" },
  { href: "/greetings", label: "Opening Greetings" },
];


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-black border-r border-neutral-800 flex flex-col justify-between p-5">
        <div>
          <Link
            href="/"
            className="font-display font-semibold text-amber-400 uppercase tracking-wide text-sm block mb-8"
          >
            WTB Admin
          </Link>
          <nav className="flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-neutral-400 hover:text-amber-400 hover:bg-neutral-900 rounded-md px-3 py-2 transition"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full text-left text-sm text-neutral-500 hover:text-red-400 hover:bg-neutral-900 rounded-md px-3 py-2 transition"
          >
            Log out
          </button>
        </form>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
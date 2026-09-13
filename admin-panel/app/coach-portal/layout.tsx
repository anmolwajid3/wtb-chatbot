import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyCoachSessionToken } from "@/lib/coachSession";

async function coachLogoutAction() {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete("wtb_coach_session");
  redirect("/coach-login");
}

const navLinks = [
  { href: "/coach-portal", label: "My Profile" },
  { href: "/coach-portal/support", label: "Support" },
];

export default async function CoachPortalLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("wtb_coach_session")?.value;
  const session = verifyCoachSessionToken(token);

  if (!session) {
    redirect("/coach-login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-black border-r border-neutral-800 flex flex-col justify-between p-5">
        <div>
          <div className="font-display font-semibold text-amber-400 uppercase tracking-wide text-sm mb-1">
            WTB Coach Portal
          </div>
          <p className="text-xs text-neutral-500 mb-8">{session.coachName}</p>
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
        <form action={coachLogoutAction}>
          <button
            type="submit"
            className="w-full text-left text-sm text-neutral-500 hover:text-red-400 hover:bg-neutral-900 rounded-md px-3 py-2 transition"
          >
            Log out
          </button>
        </form>
      </aside>
      <main className="flex-1 min-w-0 bg-black">{children}</main>
    </div>
  );
}
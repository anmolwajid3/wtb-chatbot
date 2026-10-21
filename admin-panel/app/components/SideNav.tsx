"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./NavIcon";

export type SideNavItem = {
  href: string;
  label: string;
  icon: string;
  show?: boolean;
};

function matchesPath(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Exact hubs: don't treat /coach-portal as a prefix match over its children.
  if (href === "/coach-portal") return false;
  if (href !== "/home" && pathname.startsWith(`${href}/`)) return true;
  if (
    href === "/chatbot" &&
    ["/tone", "/phrases", "/guardrails", "/greetings", "/matching", "/profile-structure", "/master-prompts"].some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    )
  ) {
    return true;
  }
  if (
    href === "/settings" &&
    ["/llm-settings", "/diagnostics", "/appearance"].some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    )
  ) {
    return true;
  }
  if (
    href === "/users" &&
    ["/members", "/profile-requests"].some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return true;
  }
  if (href === "/broadcasts" && pathname.startsWith("/messages")) return true;
  if (href === "/notifications" && pathname.startsWith("/announcements")) return true;
  return false;
}

export function SideNav({ links }: { links: SideNavItem[] }) {
  const pathname = usePathname() || "";
  const visible = links.filter((link) => link.show !== false);

  let activeHref: string | null = null;
  let bestScore = -1;
  for (const link of visible) {
    if (!matchesPath(pathname, link.href)) continue;
    // Prefer exact / longer / more specific matches so Inbox does not stick over Chatbot children.
    const score =
      (pathname === link.href ? 1000 : 0) +
      link.href.length +
      (link.href === "/chatbot" && pathname !== "/chatbot" ? 50 : 0) +
      (link.href === "/settings" && pathname !== "/settings" ? 50 : 0);
    if (score > bestScore) {
      bestScore = score;
      activeHref = link.href;
    }
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {visible.map((link) => {
        const active = link.href === activeHref;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition ${
              active
                ? "bg-neutral-900 text-amber-400"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-amber-400"
            }`}
          >
            <NavIcon name={link.icon} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

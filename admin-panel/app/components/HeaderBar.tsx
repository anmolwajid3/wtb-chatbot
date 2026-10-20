"use client";

import Link from "next/link";
import { useState } from "react";
import { Preferences } from "./Preferences";
import { NavIcon } from "./NavIcon";
import { LogoutForm } from "./LogoutForm";
import type { Locale } from "@/lib/i18n";

export function HeaderBar({
  locale,
  theme,
  languageLabel,
  themeLightLabel,
  themeDarkLabel,
  userName,
  userEmail,
  noticeCount,
  logoutLabel,
  profileLabel,
  noticesLabel,
}: {
  locale: Locale;
  theme: "light" | "dark";
  languageLabel: string;
  themeLightLabel: string;
  themeDarkLabel: string;
  userName: string;
  userEmail: string;
  noticeCount: number;
  logoutLabel: string;
  profileLabel: string;
  noticesLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="header-bar sticky top-0 z-20 flex items-center justify-end gap-3 border-b px-4 py-2.5 backdrop-blur">
      <Preferences
        locale={locale}
        theme={theme}
        languageLabel={languageLabel}
        themeLightLabel={themeLightLabel}
        themeDarkLabel={themeDarkLabel}
      />
      <Link
        href="/notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-amber-400"
        aria-label={noticesLabel}
        title={noticesLabel}
      >
        <NavIcon name="bell" />
        {noticeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-amber-500 px-1 text-center text-[10px] font-medium text-black">
            {noticeCount > 9 ? "9+" : noticeCount}
          </span>
        )}
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-200 hover:border-amber-500"
          aria-expanded={open}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 text-xs font-medium text-amber-400">
            {(userName || "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden max-w-[10rem] truncate sm:inline">{userName}</span>
        </button>
        {open && (
          <>
            <button type="button" className="fixed inset-0 z-10 cursor-default bg-transparent" aria-label="Close menu" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-neutral-800 bg-neutral-900 py-2 shadow-lg">
              <div className="border-b border-neutral-800 px-3 pb-2">
                <p className="truncate text-sm text-neutral-100">{userName}</p>
                <p className="truncate text-xs text-neutral-500">{userEmail}</p>
              </div>
              <Link
                href="/profile"
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-amber-400"
                onClick={() => setOpen(false)}
              >
                <NavIcon name="profile" />
                {profileLabel}
              </Link>
              <Link
                href="/notifications"
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-amber-400"
                onClick={() => setOpen(false)}
              >
                <NavIcon name="bell" />
                {noticesLabel}
              </Link>
              <div className="border-t border-neutral-800 px-1 pt-1">
                <LogoutForm
                  label={logoutLabel}
                  className="w-full rounded-md px-2 py-2 text-left text-sm text-neutral-400 hover:bg-neutral-800 hover:text-red-400"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

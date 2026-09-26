"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, THEME_COOKIE } from "@/lib/brand";
import type { Locale } from "@/lib/i18n";

const LOCALES: { id: Locale; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "sv", label: "SV" },
  { id: "fi", label: "FI" },
];

export function Preferences({
  locale,
  theme,
  languageLabel,
  themeLightLabel,
  themeDarkLabel,
}: {
  locale: Locale;
  theme: "light" | "dark";
  languageLabel: string;
  themeLightLabel: string;
  themeDarkLabel: string;
}) {
  const router = useRouter();

  function setLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
    document.cookie = `${THEME_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-full border border-neutral-700 p-0.5" role="group" aria-label={languageLabel}>
        {LOCALES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLocale(item.id)}
            aria-pressed={locale === item.id}
            className={`px-2 py-1 text-xs rounded-full transition ${
              locale === item.id ? "bg-amber-500 text-black" : "text-neutral-400 hover:text-amber-400"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        className="text-xs rounded-full border border-neutral-700 px-2.5 py-1 text-neutral-300 hover:text-amber-400 hover:border-amber-500 transition"
      >
        {theme === "light" ? themeDarkLabel : themeLightLabel}
      </button>
    </div>
  );
}

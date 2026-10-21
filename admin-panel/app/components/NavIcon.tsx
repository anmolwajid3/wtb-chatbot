/** Simple inline icons for sidebar / header — no extra dependency. */

const paths: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z",
  users: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 20a8 8 0 0 1 16 0",
  coaches: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0",
  chat: "M4 5h16v10H8l-4 4V5z",
  inbox: "M3 7h18v12H3V7zm0 0 9 7 9-7",
  broadcast: "M4 10v4h3l5 4V6L7 10H4zm14-2a6 6 0 0 1 0 12M16 9a3.5 3.5 0 0 1 0 6",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.5 4a8.5 8.5 0 0 0-.2-1.7l2-1.5-2-3.5-2.4 1a8.7 8.7 0 0 0-2.9-1.7L14.5 2h-5l-.5 2.6a8.7 8.7 0 0 0-2.9 1.7l-2.4-1-2 3.5 2 1.5A8.5 8.5 0 0 0 3.5 12c0 .6.1 1.1.2 1.7l-2 1.5 2 3.5 2.4-1a8.7 8.7 0 0 0 2.9 1.7l.5 2.6h5l.5-2.6a8.7 8.7 0 0 0 2.9-1.7l2.4 1 2-3.5-2-1.5c.1-.6.2-1.1.2-1.7z",
  voice: "M12 3v10a3 3 0 0 1-6 0V8m9 4v2a6 6 0 0 1-12 0v-1",
  rules: "M12 3 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3z",
  matching: "M8 12h8M12 8v8M5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2",
  diagnostics: "M9 3h6v4H9V3zm1 6h4v12h-4V9zM4 9h4v4H4V9zm12 0h4v8h-4V9z",
  model: "M4 7h16v10H4V7zm2 2v6h4V9H6zm6 0v6h6V9h-6z",
  bell: "M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5l-2 2h16l-2-2z",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0",
  back: "M15 18l-6-6 6-6",
};

export function NavIcon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const d = paths[name] || paths.home;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={`shrink-0 ${className}`} aria-hidden>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

import { redirect } from "next/navigation";
import { deletePlatformNotice, sendPlatformNotice } from "./actions";
import { getPool } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const copy = {
  en: {
    title: "Notices",
    lede: "Tell companies, their profiles, or both. A maintenance break belongs here. It is shown, not emailed.",
    subject: "Subject",
    body: "Message",
    who: "Show this to",
    companies: "Companies",
    profiles: "Profiles",
    both: "Companies and profiles",
    send: "Send notice",
    empty: "No platform notices yet.",
    remove: "Remove",
  },
  sv: {
    title: "Aviseringar",
    lede: "Berätta för företag, deras profiler eller båda. Ett underhållsavbrott hör hemma här. Det visas, det mejlas inte.",
    subject: "Ämne",
    body: "Meddelande",
    who: "Visa för",
    companies: "Företag",
    profiles: "Profiler",
    both: "Företag och profiler",
    send: "Skicka avisering",
    empty: "Inga aviseringar ännu.",
    remove: "Ta bort",
  },
  fi: {
    title: "Ilmoitukset",
    lede: "Kerro yrityksille, niiden profiileille tai molemmille. Huoltokatko kuuluu tänne. Viesti näytetään, sitä ei lähetetä sähköpostina.",
    subject: "Aihe",
    body: "Viesti",
    who: "Näytä",
    companies: "Yrityksille",
    profiles: "Profiileille",
    both: "Yrityksille ja profiileille",
    send: "Lähetä ilmoitus",
    empty: "Ei vielä ilmoituksia.",
    remove: "Poista",
  },
};

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export default async function NoticesPage() {
  const workspace = await getWorkspace();
  if (!workspace || workspace.session.role !== "super_admin") redirect("/home");
  const locale = await getLocale();
  const text = copy[locale];
  const notices = await getPool().query(
    `SELECT id, audience, title, body, created_at FROM notices
     WHERE organization_id IS NULL
     ORDER BY created_at DESC`
  );

  return (
    <div className="max-w-2xl mx-auto p-8">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">GPT Lab</p>
      <h1 className="font-display text-3xl text-neutral-100 mb-2">{text.title}</h1>
      <p className="text-neutral-400 mb-6">{text.lede}</p>
      <form action={sendPlatformNotice} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 grid gap-4 mb-8">
        <label className="text-sm text-neutral-400">
          {text.subject}
          <input name="title" required className={inputClass} />
        </label>
        <label className="text-sm text-neutral-400">
          {text.body}
          <textarea name="body" required rows={4} className={inputClass} />
        </label>
        <label className="text-sm text-neutral-400">
          {text.who}
          <select name="audience" defaultValue="both" className={inputClass}>
            <option value="companies">{text.companies}</option>
            <option value="profiles">{text.profiles}</option>
            <option value="both">{text.both}</option>
          </select>
        </label>
        <div>
          <button type="submit" className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md">
            {text.send}
          </button>
        </div>
      </form>
      {notices.rows.length === 0 && <p className="text-sm text-neutral-500">{text.empty}</p>}
      <ul className="grid gap-3">
        {notices.rows.map((notice) => (
          <li key={notice.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">{notice.audience}</p>
                <p className="font-medium text-neutral-100 mt-1">{notice.title}</p>
                <p className="text-sm text-neutral-400 mt-1 whitespace-pre-wrap">{notice.body}</p>
              </div>
              <form action={deletePlatformNotice}>
                <input type="hidden" name="id" value={notice.id} />
                <button type="submit" className="text-sm text-neutral-500 hover:text-red-400">
                  {text.remove}
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { redirect } from "next/navigation";
import { deleteProfileNotice, sendProfileNotice } from "../messages/actions";
import { getPool } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const copy = {
  en: {
    title: "Team broadcasts",
    lede: "Send a notice to every profile in {name}. This is not a private chat — everyone in the company roster can see it.",
    subject: "Subject",
    body: "Message",
    send: "Send to all profiles",
    empty: "No broadcasts yet.",
    remove: "Remove",
  },
  sv: {
    title: "Teammeddelanden",
    lede: "Skicka en notis till varje profil i {name}. Det här är ingen privat chatt.",
    subject: "Ämne",
    body: "Meddelande",
    send: "Skicka till alla profiler",
    empty: "Inga meddelanden ännu.",
    remove: "Ta bort",
  },
  fi: {
    title: "Tiedotteet tiimille",
    lede: "Lähetä ilmoitus jokaiselle yrityksen {name} profiilille. Tämä ei ole yksityinen keskustelu.",
    subject: "Aihe",
    body: "Viesti",
    send: "Lähetä kaikille profiileille",
    empty: "Ei vielä tiedotteita.",
    remove: "Poista",
  },
};

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export default async function BroadcastsPage() {
  const { session, organization } = await requireOrganization();
  if (!canManageCompany(session.role)) redirect("/home");
  const locale = await getLocale();
  const text = copy[locale];
  const notices = await getPool().query(
    `SELECT id, title, body, created_at FROM notices
     WHERE organization_id = $1 AND audience = 'profiles'
     ORDER BY created_at DESC`,
    [organization.id]
  );

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="font-display mb-2 text-3xl text-neutral-100">{text.title}</h1>
      <p className="mb-6 text-neutral-400">{text.lede.replace("{name}", organization.name)}</p>
      <form action={sendProfileNotice} className="mb-8 grid gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <label className="text-sm text-neutral-400">
          {text.subject}
          <input name="title" required className={inputClass} />
        </label>
        <label className="text-sm text-neutral-400">
          {text.body}
          <textarea name="body" required rows={4} className={inputClass} />
        </label>
        <div>
          <button type="submit" className="rounded-md bg-amber-500 px-4 py-2 font-medium text-black">
            {text.send}
          </button>
        </div>
      </form>
      {notices.rows.length === 0 && <p className="text-sm text-neutral-500">{text.empty}</p>}
      <ul className="grid gap-3">
        {notices.rows.map((notice) => (
          <li key={notice.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-neutral-100">{notice.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-400">{notice.body}</p>
              </div>
              <form action={deleteProfileNotice}>
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

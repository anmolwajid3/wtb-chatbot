import { redirect } from "next/navigation";
import { deleteProfileNotice, sendProfileNotice } from "./actions";
import { getPool } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const copy = {
  en: {
    title: "Messages",
    lede: "A note here is shown to every profile in this company. It does not start a chat.",
    subject: "Subject",
    body: "Message",
    send: "Send to all profiles",
    empty: "No messages yet.",
    remove: "Remove",
  },
  sv: {
    title: "Meddelanden",
    lede: "En anteckning här visas för varje profil i företaget. Den startar ingen chatt.",
    subject: "Ämne",
    body: "Meddelande",
    send: "Skicka till alla profiler",
    empty: "Inga meddelanden ännu.",
    remove: "Ta bort",
  },
  fi: {
    title: "Viestit",
    lede: "Tämä viesti näkyy jokaiselle tämän yrityksen profiilille. Se ei avaa keskustelua.",
    subject: "Aihe",
    body: "Viesti",
    send: "Lähetä kaikille profiileille",
    empty: "Ei vielä viestejä.",
    remove: "Poista",
  },
};

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export default async function MessagesPage() {
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
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="font-display text-3xl text-neutral-100 mb-2">{text.title}</h1>
      <p className="text-neutral-400 mb-6">{text.lede.replace("this company", organization.name)}</p>
      <form action={sendProfileNotice} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 grid gap-4 mb-8">
        <label className="text-sm text-neutral-400">
          {text.subject}
          <input name="title" required className={inputClass} />
        </label>
        <label className="text-sm text-neutral-400">
          {text.body}
          <textarea name="body" required rows={4} className={inputClass} />
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
                <p className="font-medium text-neutral-100">{notice.title}</p>
                <p className="text-sm text-neutral-400 mt-1 whitespace-pre-wrap">{notice.body}</p>
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

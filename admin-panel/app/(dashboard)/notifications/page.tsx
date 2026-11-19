import { getPool } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { organization } = await requireOrganization();
  const locale = await getLocale();
  const notices = await getPool().query(
    `SELECT id, title, body, created_at, audience FROM notices
     WHERE audience IN ('companies', 'both')
       AND (organization_id IS NULL OR organization_id = $1)
     ORDER BY created_at DESC`,
    [organization.id]
  );

  const copy =
    locale === "fi"
      ? {
          title: "Ilmoitukset",
          lede: "GPT Labin ja alustan tiedotteet tälle yritykselle.",
          empty: "Ei ilmoituksia.",
          from: "GPT Lab",
        }
       : {
            title: "Notifications",
            lede: "Notes from GPT Lab for this company.",
            empty: "No notifications yet.",
            from: "GPT Lab",
          };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="font-display mb-2 text-3xl text-neutral-100">{copy.title}</h1>
      <p className="mb-6 text-neutral-400">{copy.lede}</p>
      {notices.rows.length === 0 && <p className="text-sm text-neutral-500">{copy.empty}</p>}
      <ul className="grid gap-3">
        {notices.rows.map((notice) => (
          <li key={notice.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">{copy.from}</p>
            <p className="mt-1 font-medium text-neutral-100">{notice.title}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-400">{notice.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

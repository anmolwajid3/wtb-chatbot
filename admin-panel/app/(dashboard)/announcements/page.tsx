import { getPool } from "@/lib/db";
import { getLocale, t } from "@/lib/i18n";
import { requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const copy = {
  en: {
    lede: "Notes from GPT Lab for this company. They are shown here, not emailed.",
    empty: "No notices for this company.",
  },
  sv: {
    lede: "Meddelanden från GPT Lab till det här företaget. De visas här och mejlas inte.",
    empty: "Inga aviseringar för det här företaget.",
  },
  fi: {
    lede: "GPT Labin ilmoitukset tälle yritykselle. Ne näytetään tässä, niitä ei lähetetä sähköpostina.",
    empty: "Ei ilmoituksia tälle yritykselle.",
  },
};

export default async function AnnouncementsPage() {
  const { organization } = await requireOrganization();
  const locale = await getLocale();
  const text = copy[locale];
  const notices = await getPool().query(
    `SELECT id, title, body, created_at FROM notices
     WHERE audience IN ('companies', 'both')
       AND (organization_id IS NULL OR organization_id = $1)
     ORDER BY created_at DESC`,
    [organization.id]
  );

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="font-display text-3xl text-neutral-100 mb-2">{t(locale, "nav.notices")}</h1>
      <p className="text-neutral-400 mb-6">{text.lede}</p>
      {notices.rows.length === 0 && <p className="text-sm text-neutral-500">{text.empty}</p>}
      <ul className="grid gap-3">
        {notices.rows.map((notice) => (
          <li key={notice.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <p className="font-medium text-neutral-100">{notice.title}</p>
            <p className="text-sm text-neutral-400 mt-1 whitespace-pre-wrap">{notice.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

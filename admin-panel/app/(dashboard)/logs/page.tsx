import Link from "next/link";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { setConversationTag } from "./actions";
import { TagSelect } from "./TagSelect";
import { getPool } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type ConversationRow = {
  id: string;
  started_at: string;
  outcome: string;
  matched_coach_ids: string[] | null;
  has_quote_request: boolean;
  review_tag: string | null;
};

const TAGS = [
  { value: "", labelEn: "No tag", labelFi: "Ei tagia" },
  { value: "contacted", labelEn: "Contacted", labelFi: "Otettu yhteyttä" },
  { value: "message_sent", labelEn: "Message sent", labelFi: "Viesti lähetetty" },
  { value: "follow_up", labelEn: "Follow-up", labelFi: "Seuranta" },
  { value: "quoted", labelEn: "Quoted", labelFi: "Tarjous lähetetty" },
  { value: "closed", labelEn: "Closed", labelFi: "Suljettu" },
  { value: "no_action", labelEn: "No action", labelFi: "Ei toimenpiteitä" },
];

function tagLabel(value: string | null, locale: string) {
  const row = TAGS.find((t) => t.value === (value || ""));
  if (!row) return value || "—";
  if (locale === "fi") return row.labelFi;
  return row.labelEn;
}

function outcomeTag(outcome: string) {
  if (outcome === "matched") return "tag tag-matched";
  if (outcome === "purchase_order") return "tag tag-order";
  if (outcome === "in_progress") return "tag tag-progress";
  return "tag tag-muted";
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string; tag?: string; q?: string }>;
}) {
  const workspace = await getWorkspace();
  const organizationId = workspace?.organization?.id;
  const locale = await getLocale();
  const params = await searchParams;

  if (!organizationId) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="font-display mb-2 text-2xl text-neutral-100">Conversations</h1>
        <p className="text-sm text-neutral-400">Open a company to see its conversations.</p>
      </div>
    );
  }

  const outcome = params.outcome || "";
  const tag = params.tag || "";
  const q = (params.q || "").trim();

  const clauses = ["c.organization_id = $1"];
  const values: unknown[] = [organizationId];
  if (outcome) {
    values.push(outcome);
    clauses.push(`c.outcome = $${values.length}`);
  }
  if (tag === "none") {
    clauses.push(`(c.review_tag IS NULL OR c.review_tag = '')`);
  } else if (tag) {
    values.push(tag);
    clauses.push(`c.review_tag = $${values.length}`);
  }
  if (q) {
    values.push(`%${q}%`);
    clauses.push(`(c.id::text ILIKE $${values.length} OR COALESCE(c.review_tag, '') ILIKE $${values.length} OR COALESCE(c.outcome, '') ILIKE $${values.length})`);
  }

  const pool = getPool();
  const result = await pool.query(
    `SELECT c.id, c.started_at, c.outcome, c.matched_coach_ids, c.review_tag,
            (qr.id IS NOT NULL) AS has_quote_request
     FROM conversations c
     LEFT JOIN quote_requests qr ON qr.conversation_id = c.id
     WHERE ${clauses.join(" AND ")}
     ORDER BY c.started_at DESC
     LIMIT 200`,
    values
  );
  const conversations: ConversationRow[] = result.rows;

  const title = locale === "fi" ? "Keskustelut" : "Conversations";
  const fi = locale === "fi";
  const inputClass =
    "bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";
  const outcomeLabel = (value: string) => {
    if (!fi) return value.replace(/_/g, " ");
    const map: Record<string, string> = {
      in_progress: "kesken",
      matched: "yhdistetty",
      purchase_order: "ostotilaus",
      spam: "roskaposti",
      abandoned: "keskeytetty",
    };
    return map[value] || value.replace(/_/g, " ");
  };

  return (
    <div className="mx-auto max-w-5xl p-8">
      <Breadcrumbs
        items={[
          { href: "/home", label: fi ? "Koti" : "Home" },
          { label: title },
        ]}
      />
      <h1 className="font-display mb-2 text-2xl text-neutral-100">{title}</h1>
      <p className="mb-6 text-sm text-neutral-400">
        {fi
          ? "Merkitse keskustelut tagilla sen jälkeen kun olette olleet yhteydessä."
          : "Tag conversations after your team has followed up with the visitor."}
      </p>

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <label className="text-xs text-neutral-500">
          {fi ? "Haku" : "Search"}
          <input name="q" defaultValue={q} placeholder="ID / tag…" className={`mt-1 block ${inputClass}`} />
        </label>
        <label className="text-xs text-neutral-500">
          {fi ? "Tulos" : "Outcome"}
          <select name="outcome" defaultValue={outcome} className={`mt-1 block ${inputClass}`}>
            <option value="">{fi ? "Kaikki" : "All"}</option>
            <option value="in_progress">{outcomeLabel("in_progress")}</option>
            <option value="matched">{outcomeLabel("matched")}</option>
            <option value="purchase_order">{outcomeLabel("purchase_order")}</option>
            <option value="spam">{outcomeLabel("spam")}</option>
            <option value="abandoned">{outcomeLabel("abandoned")}</option>
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          {fi ? "Tagi" : "Tag"}
          <select name="tag" defaultValue={tag} className={`mt-1 block ${inputClass}`}>
            <option value="">{fi ? "Kaikki tagit" : "All tags"}</option>
            <option value="none">{tagLabel("", locale)}</option>
            {TAGS.filter((t) => t.value).map((t) => (
              <option key={t.value} value={t.value}>
                {tagLabel(t.value, locale)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-black">
          {fi ? "Suodata" : "Filter"}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-800 bg-black">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">{fi ? "Aloitettu" : "Started"}</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">{fi ? "Tulos" : "Outcome"}</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">{fi ? "Tagi" : "Tag"}</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-400">{fi ? "Valmentajat" : "Coaches"}</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-400">{fi ? "Toiminnot" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((c) => (
              <tr key={c.id} className="border-b border-neutral-800 last:border-0">
                <td className="px-4 py-3 text-neutral-300">{new Date(c.started_at).toLocaleString(locale === "fi" ? "fi-FI" : "en-GB")}</td>
                <td className="px-4 py-3">
                  <span className={outcomeTag(c.outcome)}>{outcomeLabel(c.outcome)}</span>
                </td>
                <td className="px-4 py-3">
                  <form action={setConversationTag} className="inline-flex items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <TagSelect
                      name="review_tag"
                      defaultValue={c.review_tag || ""}
                      className="bg-black border border-neutral-700 rounded-md px-2 py-1 text-xs text-neutral-200"
                    >
                      {TAGS.map((t) => (
                        <option key={t.value || "none"} value={t.value}>
                          {tagLabel(t.value, locale)}
                        </option>
                      ))}
                    </TagSelect>
                    <noscript>
                      <button type="submit" className="text-xs text-amber-400">
                        Save
                      </button>
                    </noscript>
                  </form>
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {c.matched_coach_ids?.length ? `${c.matched_coach_ids.length}` : "—"}
                  {c.has_quote_request ? (fi ? " · tarjous" : " · quote") : ""}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/logs/${c.id}`} className="text-amber-400 hover:underline">
                    {fi ? "Avaa" : "View"}
                  </Link>
                </td>
              </tr>
            ))}
            {conversations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-600">
                  {fi ? "Ei vastaavia keskusteluja." : "No conversations match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

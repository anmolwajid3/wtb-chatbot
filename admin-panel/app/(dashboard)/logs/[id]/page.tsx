import { Breadcrumbs } from "../../../components/Breadcrumbs";
import { getPool } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type TranscriptMessage = { role: string; content: string };
type MoodEntry = { turn: number; mood: string };

async function getConversation(id: string, organizationId: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, started_at, transcript_json, outcome, matched_coach_ids, mood_history, review_tag
     FROM conversations WHERE id = $1 AND organization_id = $2`,
    [id, organizationId]
  );
  return result.rows[0] || null;
}

async function getCoachNames(ids: string[]): Promise<{ id: string; coach_name: string }[]> {
  if (!ids || ids.length === 0) return [];
  const pool = getPool();
  const result = await pool.query(`SELECT id, coach_name FROM coaches WHERE id = ANY($1::uuid[])`, [ids]);
  return result.rows;
}

async function getQuoteRequest(conversationId: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT summary_text, contact_info, is_purchase_order, created_at
     FROM quote_requests WHERE conversation_id = $1`,
    [conversationId]
  );
  return result.rows[0] || null;
}

function outcomeTag(outcome: string) {
  if (outcome === "matched") return "tag tag-matched";
  if (outcome === "purchase_order") return "tag tag-order";
  if (outcome === "in_progress") return "tag tag-progress";
  return "tag tag-muted";
}

type StructuredSummary = {
  need_summary: string;
  key_details?: string[];
  open_questions?: string[];
  next_step?: string;
};

function copyFor(locale: string) {
  if (locale === "en") {
    return {
      home: "Home",
      conversations: "Conversations",
      detail: "Detail",
      title: "Conversation",
      started: "Started",
      matched: "Matched coaches",
      quote: "Quote request",
      purchase: "Purchase order brief",
      keyDetails: "Key details",
      stillConfirm: "Still to confirm",
      nextStep: "Next step",
      contact: "Contact",
      notProvided: "not provided",
      transcript: "Transcript",
      emptyTranscript: "No transcript recorded.",
      mood: "mood",
      moodHistory: "Mood history",
      turn: "Turn",
      tag: "Tag",
    };
  }
  return {
    home: "Koti",
    conversations: "Keskustelut",
    detail: "Tiedot",
    title: "Keskustelu",
    started: "Aloitettu",
    matched: "Ehdotetut valmentajat",
    quote: "Tarjouspyyntö",
    purchase: "Ostotilauksen yhteenveto",
    keyDetails: "Keskeiset tiedot",
    stillConfirm: "Vielä varmistettava",
    nextStep: "Seuraava askel",
    contact: "Yhteystieto",
    notProvided: "ei annettu",
    transcript: "Keskustelu",
    emptyTranscript: "Ei tallennettua keskustelua.",
    mood: "tunnelma",
    moodHistory: "Tunnelmahistoria",
    turn: "Vuoro",
    tag: "Tagi",
  };
}

function outcomeLabel(outcome: string, locale: string) {
  const mapFi: Record<string, string> = {
    matched: "yhdistetty",
    purchase_order: "ostotilaus",
    in_progress: "kesken",
    spam: "roskaposti",
    abandoned: "keskeytetty",
  };
  if (locale === "en") return outcome.replace(/_/g, " ");
  return mapFi[outcome] || outcome.replace(/_/g, " ");
}

function renderQuoteSummary(summaryText: string, labels: ReturnType<typeof copyFor>) {
  try {
    const parsed: StructuredSummary = JSON.parse(summaryText);
    if (parsed && typeof parsed === "object" && parsed.need_summary) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-neutral-200">{parsed.need_summary}</p>

          {parsed.key_details && parsed.key_details.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">{labels.keyDetails}</p>
              <ul className="text-sm text-neutral-300 list-disc list-inside space-y-0.5">
                {parsed.key_details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {parsed.open_questions && parsed.open_questions.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-500 mb-1">{labels.stillConfirm}</p>
              <ul className="text-sm text-neutral-300 list-disc list-inside space-y-0.5">
                {parsed.open_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {parsed.next_step && (
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">{labels.nextStep}</p>
              <p className="text-sm text-neutral-100 font-medium">{parsed.next_step}</p>
            </div>
          )}
        </div>
      );
    }
  } catch {
    // not JSON — fall through
  }
  return <p className="text-sm text-neutral-300 whitespace-pre-wrap">{summaryText}</p>;
}

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getWorkspace();
  if (!workspace?.organization) return notFound();
  const locale = await getLocale();
  const labels = copyFor(locale);
  const conversation = await getConversation(id, workspace.organization.id);
  if (!conversation) return notFound();

  const coaches = await getCoachNames(conversation.matched_coach_ids || []);
  const quoteRequest = await getQuoteRequest(id);
  const transcript: TranscriptMessage[] = conversation.transcript_json || [];
  const moodHistory: MoodEntry[] = conversation.mood_history || [];
  const dateLocale = locale === "fi" ? "fi-FI" : "en-GB";

  return (
    <div className="max-w-4xl mx-auto p-8">
      <Breadcrumbs
        items={[
          { href: "/home", label: labels.home },
          { href: "/logs", label: labels.conversations },
          { label: labels.detail },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide">
          {labels.title}
        </h1>
        <span className={outcomeTag(conversation.outcome)}>
          {outcomeLabel(conversation.outcome, locale)}
        </span>
        {conversation.review_tag && (
          <span className="tag tag-muted">
            {labels.tag}: {String(conversation.review_tag).replace(/_/g, " ")}
          </span>
        )}
      </div>
      <p className="text-sm text-neutral-500 mb-6">
        {labels.started} {new Date(conversation.started_at).toLocaleString(dateLocale)} · ID: {conversation.id}
      </p>

      {coaches.length > 0 && (
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4 mb-4">
          <h3 className="text-sm font-medium text-neutral-300 mb-2">{labels.matched}</h3>
          <ul className="text-sm text-neutral-400 list-disc list-inside">
            {coaches.map((c) => (
              <li key={c.id}>{c.coach_name}</li>
            ))}
          </ul>
        </div>
      )}

      {quoteRequest && (
        <div className="bg-neutral-900 rounded-lg border border-amber-900/40 p-4 mb-4">
          <h3 className="text-sm font-medium text-amber-400 mb-3">
            {quoteRequest.is_purchase_order ? labels.purchase : labels.quote}
          </h3>
          {renderQuoteSummary(quoteRequest.summary_text, labels)}
          <p className="text-xs text-neutral-500 mt-3">
            {labels.contact}: {quoteRequest.contact_info || labels.notProvided}
          </p>
        </div>
      )}

      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4 mb-4">
        <h3 className="text-sm font-medium text-neutral-300 mb-3">{labels.transcript}</h3>
        <div className="flex flex-col gap-3">
          {transcript.map((m, i) => {
            const isUser = m.role === "user";
            const turnNumber = Math.floor(i / 2) + 1;
            const moodForTurn = moodHistory.find((mh) => mh.turn === turnNumber);
            return (
              <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    isUser ? "bg-amber-500 text-black" : "bg-black border border-neutral-800 text-neutral-200"
                  }`}
                >
                  {m.content}
                  {isUser && moodForTurn && (
                    <div className="text-[10px] opacity-60 mt-1">
                      {labels.mood}: {moodForTurn.mood}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {transcript.length === 0 && (
            <p className="text-sm text-neutral-600 italic">{labels.emptyTranscript}</p>
          )}
        </div>
      </div>

      {moodHistory.length > 0 && (
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-300 mb-2">{labels.moodHistory}</h3>
          <div className="flex flex-wrap gap-2">
            {moodHistory.map((mh, i) => (
              <span
                key={i}
                className="text-xs bg-black border border-neutral-800 rounded px-2 py-1 text-neutral-400"
              >
                {labels.turn} {mh.turn}: {mh.mood}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

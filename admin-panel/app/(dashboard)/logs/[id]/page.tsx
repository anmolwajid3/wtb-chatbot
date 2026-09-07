import { getPool } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

type TranscriptMessage = { role: string; content: string };
type MoodEntry = { turn: number; mood: string };

async function getConversation(id: string) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, started_at, transcript_json, outcome, matched_coach_ids, mood_history
     FROM conversations WHERE id = $1`,
    [id]
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

const outcomeStyles: Record<string, string> = {
  matched: "bg-green-900/40 text-green-400",
  purchase_order: "bg-amber-900/40 text-amber-400",
  spam: "bg-neutral-800 text-neutral-500",
  abandoned: "bg-neutral-800 text-neutral-500",
  in_progress: "bg-blue-900/40 text-blue-400",
};

type StructuredSummary = {
  need_summary: string;
  key_details?: string[];
  open_questions?: string[];
  next_step?: string;
};

function renderQuoteSummary(summaryText: string) {
  try {
    const parsed: StructuredSummary = JSON.parse(summaryText);
    if (parsed && typeof parsed === "object" && parsed.need_summary) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-neutral-200">{parsed.need_summary}</p>

          {parsed.key_details && parsed.key_details.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Key details</p>
              <ul className="text-sm text-neutral-300 list-disc list-inside space-y-0.5">
                {parsed.key_details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {parsed.open_questions && parsed.open_questions.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-500 mb-1">Still to confirm</p>
              <ul className="text-sm text-neutral-300 list-disc list-inside space-y-0.5">
                {parsed.open_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {parsed.next_step && (
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Next step</p>
              <p className="text-sm text-neutral-100 font-medium">{parsed.next_step}</p>
            </div>
          )}
        </div>
      );
    }
  } catch {
    // not JSON — fall through to plain-text rendering below
  }
  return <p className="text-sm text-neutral-300 whitespace-pre-wrap">{summaryText}</p>;
}

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) return notFound();

  const coaches = await getCoachNames(conversation.matched_coach_ids || []);
  const quoteRequest = await getQuoteRequest(id);
  const transcript: TranscriptMessage[] = conversation.transcript_json || [];
  const moodHistory: MoodEntry[] = conversation.mood_history || [];

  return (
    <div className="max-w-4xl mx-auto p-8">
      <Link href="/logs" className="text-sm text-neutral-500 hover:text-amber-400 mb-4 inline-block">
        ← Back to logs
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide">
          Conversation
        </h1>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            outcomeStyles[conversation.outcome] || "bg-neutral-800 text-neutral-500"
          }`}
        >
          {conversation.outcome.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-sm text-neutral-500 mb-6">
        Started {new Date(conversation.started_at).toLocaleString("en-GB")} · ID: {conversation.id}
      </p>

      {coaches.length > 0 && (
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4 mb-4">
          <h3 className="text-sm font-medium text-neutral-300 mb-2">Matched coaches</h3>
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
            {quoteRequest.is_purchase_order ? "Purchase Order brief" : "Quote request"}
          </h3>
          {renderQuoteSummary(quoteRequest.summary_text)}
          <p className="text-xs text-neutral-500 mt-3">Contact: {quoteRequest.contact_info || "not provided"}</p>
        </div>
      )}

      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4 mb-4">
        <h3 className="text-sm font-medium text-neutral-300 mb-3">Transcript</h3>
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
                    <div className="text-[10px] opacity-60 mt-1">mood: {moodForTurn.mood}</div>
                  )}
                </div>
              </div>
            );
          })}
          {transcript.length === 0 && (
            <p className="text-sm text-neutral-600 italic">No transcript recorded.</p>
          )}
        </div>
      </div>

      {moodHistory.length > 0 && (
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <h3 className="text-sm font-medium text-neutral-300 mb-2">Mood history (debug view)</h3>
          <div className="flex flex-wrap gap-2">
            {moodHistory.map((mh, i) => (
              <span
                key={i}
                className="text-xs bg-black border border-neutral-800 rounded px-2 py-1 text-neutral-400"
              >
                Turn {mh.turn}: {mh.mood}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
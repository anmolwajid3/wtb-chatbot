import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import PhraseItem from "./PhraseItem";

export const dynamic = "force-dynamic";

type Phrase = { id: string; situation_type: string; phrase_text: string; is_active: boolean };

async function getPhrases(): Promise<Phrase[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM example_phrases ORDER BY situation_type, phrase_text`
  );
  return result.rows;
}

async function addPhrase(formData: FormData) {
  "use server";
  const situation_type = formData.get("situation_type") as string;
  const phrase_text = formData.get("phrase_text") as string;
  if (!phrase_text?.trim()) return;
  const pool = getPool();
  await pool.query(
    `INSERT INTO example_phrases (situation_type, phrase_text) VALUES ($1, $2)`,
    [situation_type, phrase_text]
  );
  revalidatePath("/phrases");
}

async function updatePhrase(id: string, phrase_text: string) {
  "use server";
  if (!phrase_text?.trim()) return;
  const pool = getPool();
  await pool.query(`UPDATE example_phrases SET phrase_text = $1 WHERE id = $2`, [
    phrase_text.trim(),
    id,
  ]);
  revalidatePath("/phrases");
}

async function deletePhrase(id: string) {
  "use server";
  const pool = getPool();
  await pool.query(`DELETE FROM example_phrases WHERE id = $1`, [id]);
  revalidatePath("/phrases");
}

function MoodColumn({
  title,
  situationType,
  phrases,
}: {
  title: string;
  situationType: string;
  phrases: Phrase[];
}) {
  const filtered = phrases.filter((p) => p.situation_type === situationType);

  return (
    <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
      <h3 className="font-medium mb-3 text-amber-400">{title}</h3>
      <ul className="space-y-2 mb-4">
        {filtered.map((p) => (
          <PhraseItem key={p.id} phrase={p} updatePhrase={updatePhrase} deletePhrase={deletePhrase} />
        ))}
        {filtered.length === 0 && (
          <li className="text-sm text-neutral-600 italic">No phrases yet.</li>
        )}
      </ul>
      <form action={addPhrase} className="flex gap-2">
        <input type="hidden" name="situation_type" value={situationType} />
        <input
          type="text"
          name="phrase_text"
          placeholder="Add a phrase..."
          className="flex-1 bg-black border border-neutral-700 rounded-md px-2 py-1.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          className="bg-amber-500 text-black px-3 py-1.5 rounded-md text-sm font-medium hover:bg-amber-400"
        >
          Add
        </button>
      </form>
    </div>
  );
}

export default async function PhrasesPage() {
  const phrases = await getPhrases();

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-2">
        Example Phrases
      </h1>
      <p className="text-sm text-neutral-400 mb-6">
        These seed the bot&apos;s phrasing for each detected customer mood. The bot re-assesses
        mood on every turn — these phrases guide tone, they aren&apos;t copied verbatim every time.
        Click the pencil on any phrase to edit it in place.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MoodColumn title="Positive" situationType="positive" phrases={phrases} />
        <MoodColumn title="Negative" situationType="negative" phrases={phrases} />
        <MoodColumn title="Neutral" situationType="neutral" phrases={phrases} />
      </div>
    </div>
  );
}
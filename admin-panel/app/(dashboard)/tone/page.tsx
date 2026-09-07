import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function getToneSetting() {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM tone_settings WHERE name = 'default_voice' LIMIT 1`
  );
  return result.rows[0] || null;
}

async function saveTone(formData: FormData) {
  "use server";
  const description_text = formData.get("description_text") as string;
  const pool = getPool();
  await pool.query(
    `INSERT INTO tone_settings (name, description_text) VALUES ('default_voice', $1)
     ON CONFLICT (name) DO UPDATE SET description_text = $1, updated_at = now()`,
    [description_text]
  );
  revalidatePath("/tone");
}

export default async function TonePage() {
  const tone = await getToneSetting();

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-2">
        Tone of Voice
      </h1>
      <p className="text-sm text-neutral-400 mb-6">
        This is the bot&apos;s underlying voice — it stays constant across every conversation.
        What changes per-conversation is phrasing, based on the customer&apos;s mood (see the
        Example Phrases page for that).
      </p>

      <form action={saveTone} className="bg-neutral-900 rounded-lg border border-neutral-800 p-5">
        <label className="block">
          <span className="text-sm text-neutral-400">Base tone description</span>
          <textarea
            name="description_text"
            defaultValue={tone?.description_text || ""}
            rows={6}
            className="mt-2 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
            placeholder="e.g. Warm, professional, empathetic coaching-industry tone. Reflects a consultative, human style — never robotic, never pushy."
          />
        </label>
        <button
          type="submit"
          className="mt-4 bg-amber-500 text-black font-medium px-5 py-2.5 rounded-md hover:bg-amber-400 transition"
        >
          Save
        </button>
      </form>
    </div>
  );
}
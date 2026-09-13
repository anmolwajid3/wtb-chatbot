import { getPool } from "@/lib/db";
import { addGreeting, updateGreeting, toggleGreeting, deleteGreeting } from "./actions";
import GreetingRow from "./GreetingRow";
import AddGreetingForm from "./AddGreetingForm";

export const dynamic = "force-dynamic";

type Greeting = { id: string; greeting_text: string; is_active: boolean };

export default async function GreetingsPage() {
  const pool = getPool();
  const result = await pool.query(`SELECT id, greeting_text, is_active FROM opening_greetings ORDER BY created_at`);
  const greetings: Greeting[] = result.rows;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide">
          Opening Greetings
        </h1>
        <AddGreetingForm addGreeting={addGreeting} />
      </div>
      <p className="text-sm text-neutral-400 mb-6">
        Add as many variations as you like — a random active one is shown each time a visitor
        opens the chat, instead of always the same line.
      </p>

      <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black border-b border-neutral-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-neutral-400">Greeting</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-24">Status</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-400 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {greetings.map((g) => (
              <GreetingRow
                key={g.id}
                greeting={g}
                updateGreeting={updateGreeting}
                deleteGreeting={deleteGreeting}
                toggleGreeting={toggleGreeting}
              />
            ))}
            {greetings.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-neutral-600">
                  No greetings yet — click &quot;+ Add new greeting&quot; above to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
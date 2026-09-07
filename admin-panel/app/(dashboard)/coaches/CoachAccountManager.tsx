"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CoachAccountManager({
  coachId,
  existingUsername,
  setCredentials,
}: {
  coachId: string;
  existingUsername: string | null;
  setCredentials: (coachId: string, username: string, password: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(existingUsername || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await setCredentials(coachId, username, password);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setMessage(existingUsername ? "Login updated." : "Login created.");
      setPassword("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {existingUsername && (
        <p className="text-xs text-green-400">
          This coach has an active login (username: {existingUsername})
        </p>
      )}
      <label className="block">
        <span className="text-sm text-neutral-400">Username</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-400">Password (min 8 characters)</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        />
      </label>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md text-sm hover:bg-amber-400 disabled:opacity-50"
      >
        {saving ? "Saving..." : existingUsername ? "Update login" : "Create login"}
      </button>
      {message && <p className="text-xs text-green-400">{message}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-neutral-600">
        Re-enter the password each time you save, even if you are only changing the username.
      </p>
    </div>
  );
}

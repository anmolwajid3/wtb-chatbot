"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MaxCapForm({
  currentCap,
  setMaxCap,
}: {
  currentCap: number | null;
  setMaxCap: (capUsd: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [cap, setCap] = useState(currentCap !== null ? String(currentCap) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await setMaxCap(cap);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-neutral-500">$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          placeholder="No cap set"
          className="w-32 bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md text-sm hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved" : "Save"}
        </button>
      </div>
      <p className="text-xs text-neutral-600">
        This is a visibility threshold, not an automatic cutoff — the assistant keeps running past
        this cap, but the banner above turns red so you notice. Leave blank for no cap.
      </p>
    </div>
  );
}
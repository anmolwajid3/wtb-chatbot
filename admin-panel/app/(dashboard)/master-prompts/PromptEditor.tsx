"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PromptEditor({
  agentName,
  agentLabel,
  currentPrompt,
  isOverridden,
  requiredPlaceholders,
  savePrompt,
  resetPrompt,
}: {
  agentName: string;
  agentLabel: string;
  currentPrompt: string;
  isOverridden: boolean;
  requiredPlaceholders: string[];
  savePrompt: (agentName: string, promptText: string) => Promise<{ error?: string }>;
  resetPrompt: (agentName: string) => Promise<void>;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(currentPrompt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await savePrompt(agentName, text);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  async function handleReset() {
    if (window.confirm(`Reset ${agentLabel} to its original default prompt? Your edits will be lost.`)) {
      await resetPrompt(agentName);
      router.refresh();
    }
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-neutral-850"
      >
        <div>
          <span className="font-medium text-neutral-100">{agentLabel}</span>
          {isOverridden ? (
            <span className="ml-2 text-xs bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded-full">
              Customized
            </span>
          ) : (
            <span className="ml-2 text-xs bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full">
              Default
            </span>
          )}
        </div>
        <span className="text-neutral-500 text-sm">{isOpen ? "Hide" : "Edit"}</span>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-neutral-800 pt-4">
          {requiredPlaceholders.length > 0 && (
            <p className="text-xs text-neutral-500 mb-2">
              Required placeholders — the bot needs these left in the text exactly as shown:{" "}
              <span className="text-amber-400">{requiredPlaceholders.join(", ")}</span>
            </p>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            className="w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 font-mono focus:outline-none focus:border-amber-500 resize-y"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md text-sm hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? "Saving..." : saved ? "Saved" : "Save"}
            </button>
            {isOverridden && (
              <button
                onClick={handleReset}
                className="text-sm text-neutral-500 hover:text-red-400"
              >
                Reset to default
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          <p className="text-xs text-neutral-600 mt-2">
            Takes effect on the very next chatbot request — no restart needed.
          </p>
        </div>
      )}
    </div>
  );
}
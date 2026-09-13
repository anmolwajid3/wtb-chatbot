"use client";

import { useState } from "react";

export default function AddGreetingForm({
  addGreeting,
}: {
  addGreeting: (text: string) => Promise<{ error?: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    await addGreeting(text);
    setSaving(false);
    setText("");
    setIsOpen(false);
  }

  function handleCancel() {
    setText("");
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md text-sm hover:bg-amber-400"
      >
        {isOpen ? "Close" : "+ Add new greeting"}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-0" onClick={handleCancel} />
          <div className="absolute right-0 mt-2 w-96 bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3 shadow-xl z-10">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Hey there! What's on your mind today — a team challenge, a specific goal?"
              rows={3}
              className="w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={saving || !text.trim()}
                className="flex-1 bg-amber-500 text-black font-medium px-4 py-2 rounded-md text-sm hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? "Adding..." : "Add"}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-md text-sm text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
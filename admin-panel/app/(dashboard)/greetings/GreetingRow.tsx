"use client";

import { useState } from "react";

type Greeting = { id: string; greeting_text: string; is_active: boolean };

export default function GreetingRow({
  greeting,
  updateGreeting,
  deleteGreeting,
  toggleGreeting,
}: {
  greeting: Greeting;
  updateGreeting: (id: string, text: string) => Promise<void>;
  deleteGreeting: (id: string) => Promise<void>;
  toggleGreeting: (id: string, currentStatus: boolean) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(greeting.greeting_text);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    await updateGreeting(greeting.id, text);
    setSaving(false);
    setIsEditing(false);
  }

  function handleCancel() {
    setText(greeting.greeting_text);
    setIsEditing(false);
  }

  async function handleDelete() {
    if (window.confirm("Remove this greeting?")) {
      await deleteGreeting(greeting.id);
    }
  }

  return (
    <tr className="border-b border-neutral-800 last:border-0 align-top">
      <td className="px-4 py-3">
        {isEditing ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            autoFocus
            className="w-full bg-transparent border-0 border-b border-amber-500 px-1 py-1 text-sm text-neutral-100 focus:outline-none resize-none"
          />
        ) : (
          <span className="text-sm text-neutral-200">{greeting.greeting_text}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => toggleGreeting(greeting.id, greeting.is_active)}
          className={`text-xs px-3 py-1 rounded-full whitespace-nowrap ${
            greeting.is_active ? "bg-green-900/40 text-green-400" : "bg-neutral-800 text-neutral-500"
          }`}
        >
          {greeting.is_active ? "Active" : "Inactive"}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={saving} title="Save" className="text-amber-400 hover:text-amber-300 disabled:opacity-50">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <button onClick={handleCancel} title="Cancel" className="text-neutral-500 hover:text-neutral-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} title="Edit" className="text-neutral-400 hover:text-amber-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          )}
          <button onClick={handleDelete} title="Delete" className="text-neutral-500 hover:text-red-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
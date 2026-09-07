"use client";

import { useState } from "react";

type Phrase = { id: string; situation_type: string; phrase_text: string; is_active: boolean };

export default function PhraseItem({
  phrase,
  updatePhrase,
  deletePhrase,
}: {
  phrase: Phrase;
  updatePhrase: (id: string, phrase_text: string) => Promise<void>;
  deletePhrase: (id: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(phrase.phrase_text);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    await updatePhrase(phrase.id, text);
    setSaving(false);
    setIsEditing(false);
  }

  function handleCancel() {
    setText(phrase.phrase_text);
    setIsEditing(false);
  }

  async function handleDelete() {
    if (window.confirm("Remove this phrase?")) {
      await deletePhrase(phrase.id);
    }
  }

  return (
    <li className="flex items-start justify-between gap-2 text-sm bg-black rounded p-2 text-neutral-200">
      {isEditing ? (
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          className="flex-1 bg-transparent border-0 border-b border-amber-500 px-1 py-0.5 text-sm text-neutral-100 focus:outline-none"
        />
      ) : (
        <span className="flex-1">{phrase.phrase_text}</span>
      )}

      <div className="flex items-center gap-2 shrink-0">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              title="Save"
              className="text-amber-400 hover:text-amber-300 disabled:opacity-50"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            <button onClick={handleCancel} title="Cancel" className="text-neutral-500 hover:text-neutral-300">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        ) : (
          <button onClick={() => setIsEditing(true)} title="Edit" className="text-neutral-500 hover:text-amber-400">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        )}
        <button onClick={handleDelete} title="Remove" className="text-neutral-600 hover:text-red-400">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
    </li>
  );
}
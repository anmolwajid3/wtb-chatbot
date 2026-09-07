"use client";

import { useState } from "react";

type Guardrail = { id: string; rule_text: string; category: string; is_active: boolean };

export default function GuardrailRow({
  guardrail,
  updateGuardrail,
  toggleGuardrail,
  deleteGuardrail,
}: {
  guardrail: Guardrail;
  updateGuardrail: (id: string, rule_text: string, category: string) => Promise<void>;
  toggleGuardrail: (id: string, currentStatus: boolean) => Promise<void>;
  deleteGuardrail: (id: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [category, setCategory] = useState(guardrail.category);
  const [ruleText, setRuleText] = useState(guardrail.rule_text);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateGuardrail(guardrail.id, ruleText, category);
    setSaving(false);
    setIsEditing(false);
  }

  async function handleCancel() {
    setCategory(guardrail.category);
    setRuleText(guardrail.rule_text);
    setIsEditing(false);
  }

  async function handleToggle() {
    setTogglingStatus(true);
    await toggleGuardrail(guardrail.id, guardrail.is_active);
    setTogglingStatus(false);
  }

  async function handleDelete() {
    if (window.confirm("Delete this guardrail? This can't be undone.")) {
      await deleteGuardrail(guardrail.id);
    }
  }

  return (
    <tr className="border-b border-neutral-800 last:border-0 align-middle">
      <td className="px-4 py-3 align-middle">
        {isEditing ? (
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-transparent border-0 border-b border-amber-500 px-1 py-1 text-xs text-neutral-300 focus:outline-none"
          />
        ) : (
          <span className="text-xs text-neutral-300">{guardrail.category}</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle">
        {isEditing ? (
          <textarea
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
            rows={3}
            className="w-full bg-transparent border-0 border-b border-amber-500 px-1 py-1 text-sm text-neutral-100 focus:outline-none resize-none [scrollbar-width:thin] [scrollbar-color:#404040_#000000] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-700 [&::-webkit-scrollbar-thumb]:rounded-full"
          />
        ) : (
          <span className="text-sm text-neutral-100 whitespace-pre-wrap">{guardrail.rule_text}</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle">
        <button
          onClick={handleToggle}
          disabled={togglingStatus}
          className={`text-xs px-3 py-1 rounded-full whitespace-nowrap disabled:opacity-50 ${
            guardrail.is_active ? "bg-green-900/40 text-green-400" : "bg-neutral-800 text-neutral-500"
          }`}
        >
          {guardrail.is_active ? "Active" : "Inactive"}
        </button>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center justify-end gap-3">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                title="Save"
                className="text-amber-400 hover:text-amber-300 disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <button
                onClick={handleCancel}
                title="Cancel"
                className="text-neutral-500 hover:text-neutral-300"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              title="Edit"
              className="text-neutral-400 hover:text-amber-400"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          )}
          <button onClick={handleDelete} title="Delete" className="text-neutral-500 hover:text-red-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
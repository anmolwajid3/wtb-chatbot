"use client";

import { useState } from "react";

export default function AddGuardrailForm({
  addGuardrail,
}: {
  addGuardrail: (rule_text: string, category: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [ruleText, setRuleText] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!ruleText.trim()) return;
    setSaving(true);
    await addGuardrail(ruleText, category);
    setSaving(false);
    setRuleText("");
    setCategory("");
    setIsOpen(false);
  }

  function handleCancel() {
    setRuleText("");
    setCategory("");
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md text-sm hover:bg-amber-400"
      >
        {isOpen ? "Close" : "+ Add new guardrail"}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-0" onClick={handleCancel} />

          <div className="absolute right-0 mt-2 w-96 bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3 shadow-xl z-10">
            <textarea
              value={ruleText}
              onChange={(e) => setRuleText(e.target.value)}
              placeholder="e.g. Never suggest the customer cancel with their current coach"
              rows={3}
              className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-amber-500 px-1 py-1 text-sm text-neutral-100 focus:outline-none resize-none"
            />
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Topic — type anything you like"
              className="w-full bg-transparent border-0 border-b border-neutral-700 focus:border-amber-500 px-1 py-1 text-sm text-neutral-100 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={saving || !ruleText.trim()}
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
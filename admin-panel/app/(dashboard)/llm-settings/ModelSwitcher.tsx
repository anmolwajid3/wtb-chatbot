"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MODEL_GROUPS: { label: string; models: string[] }[] = [
  {
    label: "Anthropic (Claude)",
    models: ["anthropic/claude-opus-5", "anthropic/claude-sonnet-5", "anthropic/claude-haiku-4-5"],
  },
  {
    label: "OpenAI (GPT)",
    models: ["openai/gpt-4o", "openai/gpt-4o-mini", "openai/o1"],
  },
  {
    label: "Google (Gemini)",
    models: ["google/gemini-2.0-flash-001", "google/gemini-pro-1.5"],
  },
  {
    label: "Meta (Llama)",
    models: ["meta-llama/llama-3.3-70b-instruct"],
  },
  {
    label: "Mistral",
    models: ["mistralai/mistral-large-2411"],
  },
  {
    label: "DeepSeek",
    models: ["deepseek/deepseek-chat"],
  },
];

const ALL_KNOWN_MODELS = MODEL_GROUPS.flatMap((g) => g.models);

export default function ModelSwitcher({
  currentModel,
  setActiveModel,
}: {
  currentModel: string;
  setActiveModel: (model: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const isKnown = ALL_KNOWN_MODELS.includes(currentModel);
  const [selected, setSelected] = useState(isKnown ? currentModel : "custom");
  const [customModel, setCustomModel] = useState(isKnown ? "" : currentModel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    const modelToSave = selected === "custom" ? customModel : selected;
    setSaving(true);
    setError(null);
    const result = await setActiveModel(modelToSave);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
      >
        {MODEL_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </optgroup>
        ))}
        <option value="custom">Custom (type exact OpenRouter model string)</option>
      </select>
      {selected === "custom" && (
        <input
          type="text"
          value={customModel}
          onChange={(e) => setCustomModel(e.target.value)}
          placeholder="e.g. qwen/qwen-2.5-72b-instruct"
          className="w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        />
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md text-sm hover:bg-amber-400 disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved" : "Switch model"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-neutral-600">
        Takes effect on the very next chatbot request — no restart needed. Only the Claude options
        are confirmed correct against this system; verify any other model string against{" "}
        <span className="text-neutral-400">openrouter.ai/models</span> before switching — providers
        rename and version their models often, and a wrong string breaks every agent until corrected.
      </p>
    </div>
  );
}
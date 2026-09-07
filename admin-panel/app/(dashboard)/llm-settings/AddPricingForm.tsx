"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddPricingForm({
  upsertPricing,
}: {
  upsertPricing: (model: string, inputPrice: string, outputPrice: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [model, setModel] = useState("");
  const [inputPrice, setInputPrice] = useState("");
  const [outputPrice, setOutputPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    setSaving(true);
    setError(null);
    const result = await upsertPricing(model, inputPrice, outputPrice);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setModel("");
      setInputPrice("");
      setOutputPrice("");
      setIsOpen(false);
      router.refresh();
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="bg-amber-500 text-black font-medium px-3 py-1.5 rounded-md text-xs hover:bg-amber-400"
      >
        {isOpen ? "Close" : "+ Add model pricing"}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-0" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-80 bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2 shadow-xl z-10">
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Model string, e.g. openai/gpt-4o"
              className="w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={inputPrice}
                onChange={(e) => setInputPrice(e.target.value)}
                placeholder="Input $/1M"
                className="w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
              />
              <input
                type="number"
                step="0.01"
                value={outputPrice}
                onChange={(e) => setOutputPrice(e.target.value)}
                placeholder="Output $/1M"
                className="w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full bg-amber-500 text-black font-medium px-3 py-2 rounded-md text-xs hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
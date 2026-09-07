"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Pricing = { model: string; input_price_per_1m: number; output_price_per_1m: number };

export default function PricingRow({
  pricing,
  upsertPricing,
  deletePricing,
}: {
  pricing: Pricing;
  upsertPricing: (model: string, inputPrice: string, outputPrice: string) => Promise<{ error?: string }>;
  deletePricing: (model: string) => Promise<void>;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [inputPrice, setInputPrice] = useState(String(pricing.input_price_per_1m));
  const [outputPrice, setOutputPrice] = useState(String(pricing.output_price_per_1m));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await upsertPricing(pricing.model, inputPrice, outputPrice);
    setSaving(false);
    setIsEditing(false);
    router.refresh();
  }

  function handleCancel() {
    setInputPrice(String(pricing.input_price_per_1m));
    setOutputPrice(String(pricing.output_price_per_1m));
    setIsEditing(false);
  }

  async function handleDelete() {
    if (window.confirm(`Remove pricing for ${pricing.model}?`)) {
      await deletePricing(pricing.model);
      router.refresh();
    }
  }

  return (
    <tr className="border-b border-neutral-800 last:border-0">
      <td className="px-4 py-2 text-neutral-100 text-xs">{pricing.model}</td>
      <td className="px-4 py-2">
        {isEditing ? (
          <input
            type="number"
            step="0.01"
            value={inputPrice}
            onChange={(e) => setInputPrice(e.target.value)}
            className="w-24 bg-black border border-neutral-700 rounded-md px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
          />
        ) : (
          <span className="text-xs text-neutral-300">${pricing.input_price_per_1m.toFixed(2)}</span>
        )}
      </td>
      <td className="px-4 py-2">
        {isEditing ? (
          <input
            type="number"
            step="0.01"
            value={outputPrice}
            onChange={(e) => setOutputPrice(e.target.value)}
            className="w-24 bg-black border border-neutral-700 rounded-md px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
          />
        ) : (
          <span className="text-xs text-neutral-300">${pricing.output_price_per_1m.toFixed(2)}</span>
        )}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={saving} title="Save" className="text-amber-400 hover:text-amber-300 disabled:opacity-50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
              <button onClick={handleCancel} title="Cancel" className="text-neutral-500 hover:text-neutral-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} title="Edit" className="text-neutral-400 hover:text-amber-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          )}
          <button onClick={handleDelete} title="Delete" className="text-neutral-500 hover:text-red-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
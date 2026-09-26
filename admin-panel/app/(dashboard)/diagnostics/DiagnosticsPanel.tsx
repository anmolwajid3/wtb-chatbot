"use client";

import { useState } from "react";
import { runCompanyDiagnostics, type DiagnosticCheck } from "./actions";

export function DiagnosticsPanel({
  runLabel,
  runningLabel,
  intro,
  unreachable,
}: {
  runLabel: string;
  runningLabel: string;
  intro: string;
  unreachable: string;
}) {
  const [checks, setChecks] = useState<DiagnosticCheck[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onRun() {
    setPending(true);
    setError("");
    try {
      setChecks(await runCompanyDiagnostics());
    } catch {
      setChecks(null);
      setError(unreachable);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="text-neutral-400 mb-6">{intro}</p>
      <button
        type="button"
        onClick={onRun}
        disabled={pending}
        className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md disabled:opacity-60"
      >
        {pending ? runningLabel : runLabel}
      </button>
      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
      {checks && (
        <ul className="grid gap-3 mt-6">
          {checks.map((check) => (
            <li key={check.name} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-neutral-100">{check.name}</p>
                <span className={check.level === "pass" ? "tag tag-active" : check.level === "fail" ? "text-sm text-red-400" : "text-sm text-amber-400"}>
                  {check.level}
                </span>
              </div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mt-2">{check.agent}</p>
              <p className="text-sm text-neutral-400 mt-1">{check.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

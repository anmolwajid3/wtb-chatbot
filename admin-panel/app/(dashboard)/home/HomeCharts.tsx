type ChartCopy = {
  outcomes: string;
  open: string;
  matched: string;
  other: string;
  profiles: string;
  active: string;
  inactive: string;
  credits: string;
  used: string;
  remaining: string;
};

export function HomeCharts({
  openChats,
  matched,
  otherOutcomes,
  activeProfiles,
  inactiveProfiles,
  creditsUsed,
  creditLimit,
  copy,
}: {
  openChats: number;
  matched: number;
  otherOutcomes: number;
  activeProfiles: number;
  inactiveProfiles: number;
  creditsUsed: number;
  creditLimit: number;
  copy: ChartCopy;
}) {
  const outcomeTotal = Math.max(openChats + matched + otherOutcomes, 1);
  const profileTotal = Math.max(activeProfiles + inactiveProfiles, 1);
  const creditPct = creditLimit > 0 ? Math.min(100, Math.round((creditsUsed / creditLimit) * 100)) : 0;
  const remaining = Math.max(creditLimit - creditsUsed, 0);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-4 text-sm font-medium text-neutral-400">{copy.outcomes}</h2>
        <div className="flex items-center gap-4">
          <Donut
            segments={[
              { value: openChats, color: "#F59E0B" },
              { value: matched, color: "#0E1C12" },
              { value: otherOutcomes, color: "#6B7280" },
            ]}
          />
          <ul className="space-y-1.5 text-sm">
            <LegendDot color="#F59E0B" label={copy.open} value={openChats} />
            <LegendDot color="#0E1C12" label={copy.matched} value={matched} />
            <LegendDot color="#6B7280" label={copy.other} value={otherOutcomes} />
            <li className="pt-1 text-xs text-neutral-500">n = {outcomeTotal === 1 && openChats + matched + otherOutcomes === 0 ? 0 : openChats + matched + otherOutcomes}</li>
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-4 text-sm font-medium text-neutral-400">{copy.profiles}</h2>
        <div className="space-y-3">
          <BarRow label={copy.active} value={activeProfiles} max={profileTotal} color="#0E1C12" />
          <BarRow label={copy.inactive} value={inactiveProfiles} max={profileTotal} color="#9CA3AF" />
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="mb-4 text-sm font-medium text-neutral-400">{copy.credits}</h2>
        <div className="mb-2 flex items-end justify-between">
          <p className="font-display text-3xl text-neutral-100">{creditPct}%</p>
          <p className="text-xs text-neutral-500">
            {creditsUsed}/{creditLimit}
          </p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${creditPct}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-neutral-400">
          {copy.remaining}: <span className="text-neutral-100">{remaining}</span>
        </p>
      </section>
    </div>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2 text-neutral-300">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="flex-1">{label}</span>
      <span className="tabular-nums text-neutral-100">{value}</span>
    </li>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-neutral-400">{label}</span>
        <span className="tabular-nums text-neutral-100">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Donut({ segments }: { segments: { value: number; color: string }[] }) {
  const total = Math.max(
    segments.reduce((sum, s) => sum + s.value, 0),
    1
  );
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const empty = segments.every((s) => s.value === 0);

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden>
      <circle cx="44" cy="44" r={r} fill="none" stroke="#314033" strokeWidth="12" />
      {!empty &&
        segments.map((seg, i) => {
          if (seg.value <= 0) return null;
          const len = (seg.value / total) * c;
          const el = (
            <circle
              key={i}
              cx="44"
              cy="44"
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="12"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 44 44)"
            />
          );
          offset += len;
          return el;
        })}
    </svg>
  );
}

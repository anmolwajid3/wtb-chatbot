export function Flow({
  label,
  steps,
}: {
  label: string;
  steps: { title: string; body: string }[];
}) {
  return (
    <section aria-label={label}>
      <p className="text-sm text-neutral-400 mb-3">{label}</p>
      <div className="flow-track mb-5" aria-hidden="true">
        <span className="flow-dot" />
      </div>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flow-step rounded-lg border border-neutral-800 bg-neutral-900 p-4" style={{ animationDelay: `${index * 120}ms` }}>
            <span className="text-xs text-amber-400">{index + 1}</span>
            <h3 className="mt-1 font-medium text-neutral-100">{step.title}</h3>
            <p className="mt-1 text-sm text-neutral-400 leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

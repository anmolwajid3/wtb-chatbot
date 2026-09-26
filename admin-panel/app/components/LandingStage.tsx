"use client";

import { useState } from "react";

type Step = { title: string; body: string; image: string; alt: string; href: string };
type Plan = { id: string; name: string; limit: string; note: string };

export function LandingStage({
  steps,
  plans,
  stepLabel,
  planLabel,
}: {
  steps: Step[];
  plans: Plan[];
  stepLabel: string;
  planLabel: string;
}) {
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState(plans[1]?.id ?? plans[0]?.id ?? "pro");
  const current = steps[step] ?? steps[0];

  return (
    <div className="mt-14 grid gap-12">
      <section>
        <p className="landing-kicker text-xs uppercase tracking-[0.18em] mb-4">
          {stepLabel}
        </p>
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4 items-stretch">
          <div className="grid gap-3">
            {steps.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className="landing-pick rounded-2xl px-5 py-4 bg-neutral-900"
                aria-pressed={step === index}
                onClick={() => setStep(index)}
              >
                <span className="block text-xs text-neutral-500 mb-1">0{index + 1}</span>
                <span className="block text-lg text-neutral-100">{item.title}</span>
                {step === index && (
                  <span className="block mt-2 text-sm text-neutral-400 leading-relaxed">{item.body}</span>
                )}
              </button>
            ))}
          </div>
          {current && (
            <figure className="overflow-hidden rounded-3xl bg-neutral-900 min-h-72">
              <a href={current.href} target="_blank" rel="noreferrer" className="block h-full">
                <img src={current.image} alt={current.alt} className="h-full w-full object-cover min-h-72" />
              </a>
            </figure>
          )}
        </div>
      </section>

      <section>
        <p id="plans" className="landing-kicker text-xs uppercase tracking-[0.18em] mb-4">
          {planLabel}
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          {plans.map((item) => (
            <button
              key={item.id}
              type="button"
              className="landing-pick rounded-2xl p-5 bg-neutral-900"
              aria-pressed={plan === item.id}
              onClick={() => setPlan(item.id)}
            >
              <span className="block text-sm text-neutral-500">{item.name}</span>
              <span className="block mt-3 font-display text-4xl text-neutral-100">{item.limit}</span>
              <span className="block mt-3 text-sm text-neutral-400 leading-relaxed">{item.note}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

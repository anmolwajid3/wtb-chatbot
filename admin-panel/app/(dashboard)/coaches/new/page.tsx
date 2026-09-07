import CoachForm from "../CoachForm";

export default function NewCoachPage() {
  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-6">
        Add New Coach
      </h1>
      <CoachForm coach={null} />
    </div>
  );
}
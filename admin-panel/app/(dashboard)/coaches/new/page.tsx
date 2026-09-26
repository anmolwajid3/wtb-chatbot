import CoachForm from "../CoachForm";
import { requireOrganization } from "@/lib/workspace";

export default async function NewCoachPage() {
  const { organization } = await requireOrganization();
  const label = organization.profile_label;
  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="font-display text-2xl text-neutral-100 mb-6">
        {label}
      </h1>
      <CoachForm coach={null} />
    </div>
  );
}

import { getPool } from "@/lib/db";
import { requireCoachSession } from "@/lib/coachSessionServer";
import { saveOwnProfile, uploadOwnImage, removeOwnImage } from "./actions";
import CoachImageUploader from "../(dashboard)/coaches/CoachImageUploader";

export const dynamic = "force-dynamic";

function val(coach: Record<string, unknown> | null, field: string): string {
  if (!coach) return "";
  const v = coach[field];
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function Field({
  label,
  name,
  defaultValue,
  textarea = false,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-400">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={3}
          className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        />
      ) : (
        <input
          type={type}
          name={name}
          defaultValue={defaultValue}
          className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        />
      )}
    </label>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-5 mb-4">
      <h3 className="font-medium text-neutral-100 mb-1">{title}</h3>
      {note && <p className="text-xs text-neutral-500 mb-3">{note}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">{children}</div>
    </div>
  );
}

export default async function CoachPortalPage() {
  const session = await requireCoachSession();
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM coaches WHERE id = $1`, [session.coachId]);
  const coach = result.rows[0] || null;

  if (!coach) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-neutral-400">
        Your profile could not be found. Please contact WTB.
      </div>
    );
  }

  const currentImages: string[] = Array.isArray(coach.image_urls) ? coach.image_urls : [];

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-1">
        My Profile
      </h1>
      <p className="text-sm text-neutral-400 mb-6">
        This is what WTB&apos;s assistant and team see about your services. Keep it accurate and
        up to date.
      </p>

      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-5 mb-4">
        <h3 className="font-medium text-neutral-100 mb-3">Photos</h3>
        <CoachImageUploader
          coachId={coach.id}
          currentImages={currentImages}
          uploadImage={uploadOwnImage}
          removeImage={removeOwnImage}
        />
      </div>

      <form action={saveOwnProfile}>
        <Section title="Contact">
          <Field label="Email" name="email" defaultValue={val(coach, "email")} type="email" />
          <Field label="Phone" name="phone" defaultValue={val(coach, "phone")} />
          <Field
            label="Website / LinkedIn"
            name="website_or_linkedin"
            defaultValue={val(coach, "website_or_linkedin")}
          />
        </Section>

        <Section title="Your Service">
          <Field label="Program name" name="program_name" defaultValue={val(coach, "program_name")} />
          <Field
            label="Short description"
            name="short_description"
            defaultValue={val(coach, "short_description")}
            textarea
          />
          <Field
            label="Long description"
            name="long_description"
            defaultValue={val(coach, "long_description")}
            textarea
          />
          <Field label="Target group" name="target_group" defaultValue={val(coach, "target_group")} />
          <Field
            label="Suited situations (comma-separated)"
            name="suited_situations"
            defaultValue={val(coach, "suited_situations")}
          />
          <Field
            label="Key themes (comma-separated)"
            name="key_themes"
            defaultValue={val(coach, "key_themes")}
          />
          <Field label="Methods (comma-separated)" name="methods" defaultValue={val(coach, "methods")} />
        </Section>

        <Section title="Delivery">
          <Field
            label="Delivery format"
            name="delivery_format"
            defaultValue={val(coach, "delivery_format")}
          />
          <Field
            label="Individual or group"
            name="individual_or_group"
            defaultValue={val(coach, "individual_or_group")}
          />
          <Field
            label="Group size min"
            name="group_size_min"
            defaultValue={val(coach, "group_size_min")}
            type="number"
          />
          <Field
            label="Group size max"
            name="group_size_max"
            defaultValue={val(coach, "group_size_max")}
            type="number"
          />
          <Field label="Duration" name="duration" defaultValue={val(coach, "duration")} />
        </Section>

        <Section title="Goals & Track Record">
          <Field label="Goals" name="goals" defaultValue={val(coach, "goals")} textarea />
          <Field
            label="References"
            name="references_text"
            defaultValue={val(coach, "references_text")}
            textarea
          />
          <Field
            label="Results / feedback"
            name="results_feedback"
            defaultValue={val(coach, "results_feedback")}
            textarea
          />
          <Field
            label="Certifications"
            name="certifications"
            defaultValue={val(coach, "certifications")}
            textarea
          />
        </Section>

        <Section
          title="Pricing"
          note="Used internally by WTB's team only — the chatbot is never allowed to share this with customers."
        >
          <Field label="Price from" name="price_from" defaultValue={val(coach, "price_from")} />
          <Field label="Pricing model" name="pricing_model" defaultValue={val(coach, "pricing_model")} />
          <Field
            label="What's included"
            name="price_includes"
            defaultValue={val(coach, "price_includes")}
            textarea
          />
        </Section>

        <Section title="Availability">
          <Field label="Availability" name="availability" defaultValue={val(coach, "availability")} />
          <Field
            label="Languages (comma-separated)"
            name="languages"
            defaultValue={val(coach, "languages")}
          />
        </Section>

        <button
          type="submit"
          className="bg-amber-500 text-black font-medium px-5 py-2.5 rounded-md hover:bg-amber-400 transition"
        >
          Save changes
        </button>
      </form>
    </div>
  );
}

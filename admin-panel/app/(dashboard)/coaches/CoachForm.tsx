import { saveCoach, uploadCoachImage, removeCoachImage, setCoachAccountCredentials, getCoachAccountUsername } from "./actions";
import CoachImageUploader from "./CoachImageUploader";
import CoachAccountManager from "./CoachAccountManager";

type CoachRecord = Record<string, unknown> | null;

function val(coach: CoachRecord, field: string): string {
  if (!coach) return "";
  const v = coach[field];
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-5 mb-4">
      <h3 className="font-medium text-neutral-100 mb-1">{title}</h3>
      {note && <p className="text-xs text-amber-500/80 mb-3">{note}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">{children}</div>
    </div>
  );
}

function Field({ label, name, defaultValue, textarea = false, type = "text" }: {
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

export default async function CoachForm({ coach }: { coach: CoachRecord }) {
  const currentImages: string[] = Array.isArray(coach?.image_urls)
    ? (coach.image_urls as string[])
    : [];
  const videoUrl = val(coach, "video_url");
  const existingUsername = coach ? await getCoachAccountUsername(String(coach.id)) : null;

  return (
    <form action={saveCoach} className="max-w-4xl">
      {coach && <input type="hidden" name="id" value={String(coach.id)} />}

      <Section title="1. Basic Info">
        <Field label="Coach name *" name="coach_name" defaultValue={val(coach, "coach_name")} />
        <Field label="Company / billing name" name="company_name" defaultValue={val(coach, "company_name")} />
        <Field label="Business ID" name="business_id" defaultValue={val(coach, "business_id")} />
        <Field label="Email" name="email" defaultValue={val(coach, "email")} type="email" />
        <Field label="Phone" name="phone" defaultValue={val(coach, "phone")} />
        <Field label="Website / LinkedIn" name="website_or_linkedin" defaultValue={val(coach, "website_or_linkedin")} />
        <Field label="Operating area" name="operating_area" defaultValue={val(coach, "operating_area")} />
      </Section>

      <Section title="2. Service Basic Info">
        <Field label="Program name" name="program_name" defaultValue={val(coach, "program_name")} />
        <Field label="Short description" name="short_description" defaultValue={val(coach, "short_description")} textarea />
        <Field label="Long description" name="long_description" defaultValue={val(coach, "long_description")} textarea />
      </Section>

      <Section title="3. Target Group & Situation">
        <Field label="Target group" name="target_group" defaultValue={val(coach, "target_group")} />
        <Field
          label="Suited situations (comma-separated)"
          name="suited_situations"
          defaultValue={val(coach, "suited_situations")}
        />
      </Section>

      <Section title="4. Content & Themes">
        <Field label="Key themes (comma-separated)" name="key_themes" defaultValue={val(coach, "key_themes")} />
        <Field label="Participant activities" name="participant_activities" defaultValue={val(coach, "participant_activities")} textarea />
        <Field label="Methods (comma-separated)" name="methods" defaultValue={val(coach, "methods")} />
      </Section>

      <Section title="5. Delivery Model">
        <Field label="Delivery format" name="delivery_format" defaultValue={val(coach, "delivery_format")} />
        <Field label="Individual or group" name="individual_or_group" defaultValue={val(coach, "individual_or_group")} />
        <Field label="Group size min" name="group_size_min" defaultValue={val(coach, "group_size_min")} type="number" />
        <Field label="Group size max" name="group_size_max" defaultValue={val(coach, "group_size_max")} type="number" />
        <Field label="Duration" name="duration" defaultValue={val(coach, "duration")} />
        <Field label="Program structure" name="program_structure" defaultValue={val(coach, "program_structure")} textarea />
      </Section>

      <Section title="6. Goals & Outcomes">
        <Field label="Goals" name="goals" defaultValue={val(coach, "goals")} textarea />
        <Field label="Impact measurement" name="impact_measurement" defaultValue={val(coach, "impact_measurement")} textarea />
        <Field label="Change achieved" name="change_achieved" defaultValue={val(coach, "change_achieved")} textarea />
      </Section>

      <Section
        title="7. Pricing & Sales"
        note="Internal only, this data is never shown to customers. The bot is structurally prevented from seeing these fields (see backend/app/db/connection.py)."
      >
        <Field label="Price from" name="price_from" defaultValue={val(coach, "price_from")} />
        <Field label="Pricing model" name="pricing_model" defaultValue={val(coach, "pricing_model")} />
        <Field label="What's included" name="price_includes" defaultValue={val(coach, "price_includes")} textarea />
        <Field label="Additional services" name="additional_services" defaultValue={val(coach, "additional_services")} textarea />
      </Section>

      <Section title="8. References & Track Record">
        <Field label="References" name="references_text" defaultValue={val(coach, "references_text")} textarea />
        <Field label="Results / feedback" name="results_feedback" defaultValue={val(coach, "results_feedback")} textarea />
        <Field label="Certifications" name="certifications" defaultValue={val(coach, "certifications")} textarea />
      </Section>

      <Section title="9. Keywords & Classification">
        <Field label="Keywords (comma-separated)" name="keywords" defaultValue={val(coach, "keywords")} />
        <Field label="Main category" name="main_category" defaultValue={val(coach, "main_category")} />
        <Field label="Subcategories (comma-separated)" name="subcategories" defaultValue={val(coach, "subcategories")} />
      </Section>

      <Section title="10. Additional Info">
        <Field label="Additional info" name="additional_info" defaultValue={val(coach, "additional_info")} textarea />
        <Field label="Availability" name="availability" defaultValue={val(coach, "availability")} />
        <Field label="Languages (comma-separated)" name="languages" defaultValue={val(coach, "languages")} />
      </Section>

      <Section
        title="11. Media & Materials"
        note="Add photo, video, and material links here. These are not yet shown to customers in the chat widget, only visible here in the admin panel for now."
      >
        <div>
          {coach ? (
            <CoachImageUploader
              coachId={String(coach.id)}
              currentImages={currentImages}
              uploadImage={uploadCoachImage}
              removeImage={removeCoachImage}
            />
          ) : (
            <p className="text-xs text-neutral-500 italic">
              Save this coach first, then come back here to upload photos.
            </p>
          )}
        </div>
        <div>
          <Field label="Video URL" name="video_url" defaultValue={val(coach, "video_url")} />
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 text-xs underline mt-2 inline-block"
            >
              Open video in new tab
            </a>
          )}
        </div>
        <Field
          label="Material URLs (comma-separated)"
          name="material_urls"
          defaultValue={val(coach, "material_urls")}
          textarea
        />
      </Section>

      {coach && (
        <Section
          title="12. Coach Portal Login"
          note="Set a username and password so this coach can log into their own portal (separate from this staff panel) to view their profile and their matched inquiries."
        >
          <CoachAccountManager
            coachId={String(coach.id)}
            existingUsername={existingUsername}
            setCredentials={setCoachAccountCredentials}
          />
        </Section>
      )}

      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          className="bg-amber-500 text-black font-medium px-5 py-2.5 rounded-md hover:bg-amber-400 transition"
        >
          Save coach
        </button>
      </div>
    </form>
  );
}

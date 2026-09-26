import Link from "next/link";
import { sectionForField } from "@/lib/profileSections";
import { getWorkspace, listProfileFields, listProfileSections, type ProfileField } from "@/lib/workspace";
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

function Field({ label, name, defaultValue, textarea = false, type = "text", required = false }: {
  label: string;
  name: string;
  defaultValue: string;
  textarea?: boolean;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-400">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          required={required}
          rows={3}
          className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        />
      ) : (
        <input
          type={type}
          name={name}
          defaultValue={defaultValue}
          required={required}
          className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
        />
      )}
    </label>
  );
}

function ExtraFields({
  title,
  fields,
  saved,
}: {
  title: string;
  fields: ProfileField[];
  saved: Record<string, unknown>;
}) {
  const rows = fields.filter(
    (field) => field.group_name === title || sectionForField(field.group_name) === title
  );
  return rows.map((field) => {
    const current = saved[field.field_key] == null ? "" : String(saved[field.field_key]);
    const name = `cf_${field.field_key}`;
    const label = `${field.label}${field.required ? " *" : ""}`;
    if (field.field_type === "radio") {
      return (
        <fieldset key={field.id} className="block">
          <legend className="text-sm text-neutral-400">{label}</legend>
          <div className="mt-2 flex flex-col gap-1">
            {(field.options || []).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-neutral-200">
                <input type="radio" name={name} value={option} defaultChecked={current === option} required={field.required} />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    if (field.field_type === "dropdown") {
      return (
        <label key={field.id} className="block">
          <span className="text-sm text-neutral-400">{label}</span>
          <select
            name={name}
            defaultValue={current}
            required={field.required}
            className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
          >
            <option value=""></option>
            {(field.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );
    }
    return (
      <Field
        key={field.id}
        label={label}
        name={name}
        defaultValue={current}
        textarea={field.field_type === "textarea"}
        type={field.field_type === "number" ? "number" : "text"}
        required={field.required}
      />
    );
  });
}

function CustomProfileForm({
  coach,
  fields,
  sections,
  label,
  plural,
}: {
  coach: CoachRecord;
  fields: ProfileField[];
  sections: string[];
  label: string;
  plural: string;
}) {
  const saved =
    coach?.custom_fields && typeof coach.custom_fields === "object"
      ? (coach.custom_fields as Record<string, unknown>)
      : {};
  if (fields.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <p className="text-neutral-300 mb-4">Create sections and fields before adding a {label.toLowerCase()}.</p>
        <Link href="/profile-structure" className="text-amber-400 hover:underline">
          Set up fields
        </Link>
      </div>
    );
  }
  const ordered = [...sections];
  for (const field of fields) {
    if (field.group_name && !ordered.includes(field.group_name)) ordered.push(field.group_name);
  }
  const firstId = fields[0]?.id;
  return (
    <form action={saveCoach} className="max-w-4xl">
      {coach && <input type="hidden" name="id" value={String(coach.id)} />}
      {ordered.map((title) => {
        const rows = fields.filter((field) => field.group_name === title);
        if (rows.length === 0) return null;
        return (
          <Section key={title} title={title}>
            {rows.map((field) => {
              const shown = field.id === firstId ? { ...field, required: true } : field;
              return (
                <div key={field.id}>
                  {field.id === firstId && (
                    <p className="text-xs text-neutral-500 mb-1">This is the name shown in the list.</p>
                  )}
                  <ExtraFields title={title} fields={[shown]} saved={saved} />
                </div>
              );
            })}
          </Section>
        );
      })}
      <div className="flex gap-3 mt-6 items-center">
        <button type="submit" className="bg-amber-500 text-black font-medium px-5 py-2.5 rounded-md hover:bg-amber-400 transition">
          Save {label.toLowerCase()}
        </button>
        <Link href="/coaches" className="text-sm text-neutral-400 hover:text-amber-400 px-3 py-2">
          Back to {plural}
        </Link>
      </div>
    </form>
  );
}

export default async function CoachForm({ coach }: { coach: CoachRecord }) {
  const workspace = await getWorkspace();
  const allFields = workspace?.organization ? await listProfileFields(workspace.organization.id) : [];
  const hasBuiltin = allFields.some((field) => field.is_builtin);
  if (!hasBuiltin) {
    const sections = workspace?.organization ? await listProfileSections(workspace.organization.id) : [];
    return (
      <CustomProfileForm
        coach={coach}
        fields={allFields}
        sections={sections.map((section) => section.title)}
        label={workspace?.organization?.profile_label || "profile"}
        plural={workspace?.organization?.profile_label_plural || "list"}
      />
    );
  }
  const customFields = allFields.filter((field) => !field.is_builtin);
  const savedCustom =
    coach?.custom_fields && typeof coach.custom_fields === "object"
      ? (coach.custom_fields as Record<string, unknown>)
      : {};
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
        <ExtraFields title="1. Basic Info" fields={customFields} saved={savedCustom} />
      </Section>

      <Section title="2. Service Basic Info">
        <Field label="Program name" name="program_name" defaultValue={val(coach, "program_name")} />
        <Field label="Short description" name="short_description" defaultValue={val(coach, "short_description")} textarea />
        <Field label="Long description" name="long_description" defaultValue={val(coach, "long_description")} textarea />
        <ExtraFields title="2. Service Basic Info" fields={customFields} saved={savedCustom} />
      </Section>

      <Section title="3. Target Group & Situation">
        <Field label="Target group" name="target_group" defaultValue={val(coach, "target_group")} />
        <Field
          label="Suited situations (comma-separated)"
          name="suited_situations"
          defaultValue={val(coach, "suited_situations")}
        />
        <ExtraFields title="3. Target Group & Situation" fields={customFields} saved={savedCustom} />
      </Section>

      <Section title="4. Content & Themes">
        <Field label="Key themes (comma-separated)" name="key_themes" defaultValue={val(coach, "key_themes")} />
        <Field label="Participant activities" name="participant_activities" defaultValue={val(coach, "participant_activities")} textarea />
        <Field label="Methods (comma-separated)" name="methods" defaultValue={val(coach, "methods")} />
        <ExtraFields title="4. Content & Themes" fields={customFields} saved={savedCustom} />
      </Section>

      <Section title="5. Delivery Model">
        <Field label="Delivery format" name="delivery_format" defaultValue={val(coach, "delivery_format")} />
        <Field label="Individual or group" name="individual_or_group" defaultValue={val(coach, "individual_or_group")} />
        <Field label="Group size min" name="group_size_min" defaultValue={val(coach, "group_size_min")} type="number" />
        <Field label="Group size max" name="group_size_max" defaultValue={val(coach, "group_size_max")} type="number" />
        <Field label="Duration" name="duration" defaultValue={val(coach, "duration")} />
        <Field label="Program structure" name="program_structure" defaultValue={val(coach, "program_structure")} textarea />
        <ExtraFields title="5. Delivery Model" fields={customFields} saved={savedCustom} />
      </Section>

      <Section title="6. Goals & Outcomes">
        <Field label="Goals" name="goals" defaultValue={val(coach, "goals")} textarea />
        <Field label="Impact measurement" name="impact_measurement" defaultValue={val(coach, "impact_measurement")} textarea />
        <Field label="Change achieved" name="change_achieved" defaultValue={val(coach, "change_achieved")} textarea />
        <ExtraFields title="6. Goals & Outcomes" fields={customFields} saved={savedCustom} />
      </Section>

      <Section
        title="7. Pricing & Sales"
        note="Internal only, this data is never shown to customers. The bot is structurally prevented from seeing these fields (see backend/app/db/connection.py)."
      >
        <Field label="Price from" name="price_from" defaultValue={val(coach, "price_from")} />
        <Field label="Pricing model" name="pricing_model" defaultValue={val(coach, "pricing_model")} />
        <Field label="What's included" name="price_includes" defaultValue={val(coach, "price_includes")} textarea />
        <Field label="Additional services" name="additional_services" defaultValue={val(coach, "additional_services")} textarea />
        <ExtraFields title="7. Pricing & Sales" fields={customFields} saved={savedCustom} />
      </Section>

      <Section title="8. References & Track Record">
        <Field label="References" name="references_text" defaultValue={val(coach, "references_text")} textarea />
        <Field label="Results / feedback" name="results_feedback" defaultValue={val(coach, "results_feedback")} textarea />
        <Field label="Certifications" name="certifications" defaultValue={val(coach, "certifications")} textarea />
        <ExtraFields title="8. References & Track Record" fields={customFields} saved={savedCustom} />
      </Section>

      <Section title="9. Keywords & Classification">
        <Field label="Keywords (comma-separated)" name="keywords" defaultValue={val(coach, "keywords")} />
        <Field label="Main category" name="main_category" defaultValue={val(coach, "main_category")} />
        <Field label="Subcategories (comma-separated)" name="subcategories" defaultValue={val(coach, "subcategories")} />
        <ExtraFields title="9. Keywords & Classification" fields={customFields} saved={savedCustom} />
      </Section>

      <Section title="10. Additional Info">
        <Field label="Additional info" name="additional_info" defaultValue={val(coach, "additional_info")} textarea />
        <Field label="Availability" name="availability" defaultValue={val(coach, "availability")} />
        <Field label="Languages (comma-separated)" name="languages" defaultValue={val(coach, "languages")} />
        <ExtraFields title="10. Additional Info" fields={customFields} saved={savedCustom} />
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
        <ExtraFields title="11. Media & Materials" fields={customFields} saved={savedCustom} />
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

      <div className="flex gap-3 mt-6 items-center">
        <button
          type="submit"
          className="bg-amber-500 text-black font-medium px-5 py-2.5 rounded-md hover:bg-amber-400 transition"
        >
          Save coach
        </button>
        <Link href="/coaches" className="text-sm text-neutral-400 hover:text-amber-400 px-3 py-2">
          Back to {workspace?.organization?.profile_label_plural || "list"}
        </Link>
      </div>
    </form>
  );
}

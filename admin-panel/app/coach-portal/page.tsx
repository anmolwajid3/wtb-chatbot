import { getPool } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { requireCoachSession } from "@/lib/coachSessionServer";
import { listProfileFields, listProfileSections } from "@/lib/workspace";
import { saveOwnProfile, uploadOwnImage, removeOwnImage, changeOwnPasswordOptional } from "./actions";
import CoachImageUploader from "../(dashboard)/coaches/CoachImageUploader";
import { sectionForField } from "@/lib/profileSections";

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
  required = false,
}: {
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

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-5 mb-4">
      <h3 className="font-medium text-neutral-100 mb-1">{title}</h3>
      {note && <p className="text-xs text-neutral-500 mb-3">{note}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">{children}</div>
    </div>
  );
}

export default async function CoachPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireCoachSession();
  const locale = await getLocale();
  const fi = locale === "fi";
  const params = await searchParams;
  const pool = getPool();
  const result = await pool.query(`SELECT * FROM coaches WHERE id = $1`, [session.coachId]);
  const coach = result.rows[0] || null;

  if (!coach) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-neutral-400">
        {fi
          ? "Profiilia ei löytynyt. Ota yhteyttä yrityksen ylläpitäjään."
          : "Your profile could not be found. Please contact your company admin."}
      </div>
    );
  }

  const organizationId = coach.organization_id as string | null;
  const fields = organizationId
    ? await listProfileFields(organizationId, { includeInactive: true })
    : [];
  const customFields = fields.filter((field) => !field.is_builtin && field.is_active !== false);
  const savedCustom =
    coach.custom_fields && typeof coach.custom_fields === "object"
      ? (coach.custom_fields as Record<string, unknown>)
      : {};
  const ownSections = fields.length > 0 && !fields.some((f) => f.is_builtin);
  const sections = ownSections && organizationId
    ? (await listProfileSections(organizationId)).map((s) => s.title)
    : [];

  const currentImages: string[] = Array.isArray(coach.image_urls) ? coach.image_urls : [];
  const videoUrl = val(coach, "video_url");

  const extra = (title: string) =>
    customFields
      .filter((field) => field.group_name === title || sectionForField(field.group_name) === title)
      .map((field) => {
        const current = savedCustom[field.field_key] == null ? "" : String(savedCustom[field.field_key]);
        const name = `cf_${field.field_key}`;
        const label = `${field.label}${field.required ? " *" : ""}`;
        if (field.field_type === "textarea") {
          return <Field key={field.id} label={label} name={name} defaultValue={current} textarea required={field.required} />;
        }
        if (field.field_type === "number") {
          return <Field key={field.id} label={label} name={name} defaultValue={current} type="number" required={field.required} />;
        }
        if (field.field_type === "dropdown" || field.field_type === "radio") {
          return (
            <label key={field.id} className="block">
              <span className="text-sm text-neutral-400">{label}</span>
              <select
                name={name}
                defaultValue={current}
                required={field.required}
                className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
              >
                <option value="">—</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        return <Field key={field.id} label={label} name={name} defaultValue={current} required={field.required} />;
      });

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-1">
        {fi ? "Oma profiili" : "My Profile"}
      </h1>
      <p className="text-sm text-neutral-400 mb-6">
        {fi
          ? "Tämä on se, mitä avustaja ja tiimisi näkevät palveluistasi. Pidä tiedot ajan tasalla."
          : "This is what the assistant and your team see about your services. Keep it accurate and up to date."}
      </p>

      {params.saved && (
        <p className="mb-4 text-sm text-amber-400">{fi ? "Profiili tallennettu." : "Profile saved."}</p>
      )}
      {params.error === "short" && (
        <p className="mb-4 text-sm text-red-400">
          {fi ? "Salasanan oltava vähintään 8 merkkiä." : "Password must be at least 8 characters."}
        </p>
      )}
      {params.error === "mismatch" && (
        <p className="mb-4 text-sm text-red-400">{fi ? "Salasanat eivät täsmää." : "Passwords do not match."}</p>
      )}

      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-5 mb-4">
        <h3 className="font-medium text-neutral-100 mb-3">{fi ? "Kuvat" : "Photos"}</h3>
        <CoachImageUploader
          coachId={coach.id}
          currentImages={currentImages}
          uploadImage={uploadOwnImage}
          removeImage={removeOwnImage}
        />
      </div>

      <form action={saveOwnProfile}>
        {ownSections ? (
          <>
            {sections.map((title) => (
              <Section key={title} title={title}>
                {extra(title)}
              </Section>
            ))}
            <Section title={fi ? "1. Perustiedot" : "1. Basic Info"}>
              <Field label={fi ? "Valmentajan nimi *" : "Coach name *"} name="coach_name" defaultValue={val(coach, "coach_name")} required />
              <Field label={fi ? "Yritys / laskutusnimi" : "Company / billing name"} name="company_name" defaultValue={val(coach, "company_name")} />
              <Field label={fi ? "Y-tunnus" : "Business ID"} name="business_id" defaultValue={val(coach, "business_id")} />
              <Field label={fi ? "Sähköposti" : "Email"} name="email" defaultValue={val(coach, "email")} type="email" />
              <Field label={fi ? "Puhelin" : "Phone"} name="phone" defaultValue={val(coach, "phone")} />
              <Field label="Website / LinkedIn" name="website_or_linkedin" defaultValue={val(coach, "website_or_linkedin")} />
              <Field label={fi ? "Toiminta-alue" : "Operating area"} name="operating_area" defaultValue={val(coach, "operating_area")} />
            </Section>
          </>
        ) : (
          <>
            <Section title={fi ? "1. Perustiedot" : "1. Basic Info"}>
              <Field label={fi ? "Valmentajan nimi *" : "Coach name *"} name="coach_name" defaultValue={val(coach, "coach_name")} required />
              <Field label={fi ? "Yritys / laskutusnimi" : "Company / billing name"} name="company_name" defaultValue={val(coach, "company_name")} />
              <Field label={fi ? "Y-tunnus" : "Business ID"} name="business_id" defaultValue={val(coach, "business_id")} />
              <Field label={fi ? "Sähköposti" : "Email"} name="email" defaultValue={val(coach, "email")} type="email" />
              <Field label={fi ? "Puhelin" : "Phone"} name="phone" defaultValue={val(coach, "phone")} />
              <Field label="Website / LinkedIn" name="website_or_linkedin" defaultValue={val(coach, "website_or_linkedin")} />
              <Field label={fi ? "Toiminta-alue" : "Operating area"} name="operating_area" defaultValue={val(coach, "operating_area")} />
              {extra("1. Basic Info")}
            </Section>

            <Section title={fi ? "2. Palvelun perustiedot" : "2. Service Basic Info"}>
              <Field label={fi ? "Ohjelman nimi" : "Program name"} name="program_name" defaultValue={val(coach, "program_name")} />
              <Field label={fi ? "Lyhyt kuvaus" : "Short description"} name="short_description" defaultValue={val(coach, "short_description")} textarea />
              <Field label={fi ? "Pitkä kuvaus" : "Long description"} name="long_description" defaultValue={val(coach, "long_description")} textarea />
              {extra("2. Service Basic Info")}
            </Section>

            <Section title={fi ? "3. Kohderyhmä & tilanne" : "3. Target Group & Situation"}>
              <Field label={fi ? "Kohderyhmä" : "Target group"} name="target_group" defaultValue={val(coach, "target_group")} />
              <Field
                label={fi ? "Sopivat tilanteet (pilkulla erotettuna)" : "Suited situations (comma-separated)"}
                name="suited_situations"
                defaultValue={val(coach, "suited_situations")}
              />
              {extra("3. Target Group & Situation")}
            </Section>

            <Section title={fi ? "4. Sisältö & teemat" : "4. Content & Themes"}>
              <Field label={fi ? "Avainteemat (pilkulla)" : "Key themes (comma-separated)"} name="key_themes" defaultValue={val(coach, "key_themes")} />
              <Field label={fi ? "Osallistujien tekemiset" : "Participant activities"} name="participant_activities" defaultValue={val(coach, "participant_activities")} textarea />
              <Field label={fi ? "Menetelmät (pilkulla)" : "Methods (comma-separated)"} name="methods" defaultValue={val(coach, "methods")} />
              {extra("4. Content & Themes")}
            </Section>

            <Section title={fi ? "5. Toteutusmalli" : "5. Delivery Model"}>
              <Field label={fi ? "Toteutusmuoto" : "Delivery format"} name="delivery_format" defaultValue={val(coach, "delivery_format")} />
              <Field label={fi ? "Yksilö tai ryhmä" : "Individual or group"} name="individual_or_group" defaultValue={val(coach, "individual_or_group")} />
              <Field label={fi ? "Ryhmäkoko min" : "Group size min"} name="group_size_min" defaultValue={val(coach, "group_size_min")} type="number" />
              <Field label={fi ? "Ryhmäkoko max" : "Group size max"} name="group_size_max" defaultValue={val(coach, "group_size_max")} type="number" />
              <Field label={fi ? "Kesto" : "Duration"} name="duration" defaultValue={val(coach, "duration")} />
              <Field label={fi ? "Ohjelman rakenne" : "Program structure"} name="program_structure" defaultValue={val(coach, "program_structure")} textarea />
              {extra("5. Delivery Model")}
            </Section>

            <Section title={fi ? "6. Tavoitteet & tulokset" : "6. Goals & Outcomes"}>
              <Field label={fi ? "Tavoitteet" : "Goals"} name="goals" defaultValue={val(coach, "goals")} textarea />
              <Field label={fi ? "Vaikuttavuuden mittaus" : "Impact measurement"} name="impact_measurement" defaultValue={val(coach, "impact_measurement")} textarea />
              <Field label={fi ? "Saavutettu muutos" : "Change achieved"} name="change_achieved" defaultValue={val(coach, "change_achieved")} textarea />
              {extra("6. Goals & Outcomes")}
            </Section>

            <Section
              title={fi ? "7. Hinnoittelu" : "7. Pricing & Sales"}
              note={fi ? "Vain sisäiseen käyttöön — avustaja ei jaa tätä kävijöille." : "Internal only — the assistant never shares this with visitors."}
            >
              <Field label={fi ? "Hinta alkaen" : "Price from"} name="price_from" defaultValue={val(coach, "price_from")} />
              <Field label={fi ? "Hinnoittelumalli" : "Pricing model"} name="pricing_model" defaultValue={val(coach, "pricing_model")} />
              <Field label={fi ? "Hintaan sisältyy" : "What's included"} name="price_includes" defaultValue={val(coach, "price_includes")} textarea />
              <Field label={fi ? "Lisäpalvelut" : "Additional services"} name="additional_services" defaultValue={val(coach, "additional_services")} textarea />
              {extra("7. Pricing & Sales")}
            </Section>

            <Section title={fi ? "8. Referenssit" : "8. References & Track Record"}>
              <Field label={fi ? "Referenssit" : "References"} name="references_text" defaultValue={val(coach, "references_text")} textarea />
              <Field label={fi ? "Tulokset / palaute" : "Results / feedback"} name="results_feedback" defaultValue={val(coach, "results_feedback")} textarea />
              <Field label={fi ? "Sertifikaatit" : "Certifications"} name="certifications" defaultValue={val(coach, "certifications")} textarea />
              {extra("8. References & Track Record")}
            </Section>

            <Section title={fi ? "9. Avainsanat & luokittelu" : "9. Keywords & Classification"}>
              <Field label={fi ? "Avainsanat (pilkulla)" : "Keywords (comma-separated)"} name="keywords" defaultValue={val(coach, "keywords")} />
              <Field label={fi ? "Pääkategoria" : "Main category"} name="main_category" defaultValue={val(coach, "main_category")} />
              <Field label={fi ? "Alakategoriat (pilkulla)" : "Subcategories (comma-separated)"} name="subcategories" defaultValue={val(coach, "subcategories")} />
              {extra("9. Keywords & Classification")}
            </Section>

            <Section title={fi ? "10. Lisätiedot" : "10. Additional Info"}>
              <Field label={fi ? "Lisätiedot" : "Additional info"} name="additional_info" defaultValue={val(coach, "additional_info")} textarea />
              <Field label={fi ? "Saatavuus" : "Availability"} name="availability" defaultValue={val(coach, "availability")} />
              <Field label={fi ? "Kielet (pilkulla)" : "Languages (comma-separated)"} name="languages" defaultValue={val(coach, "languages")} />
              {extra("10. Additional Info")}
            </Section>

            <Section title={fi ? "11. Media & materiaalit" : "11. Media & Materials"}>
              <Field label="Video URL" name="video_url" defaultValue={videoUrl} />
              <Field
                label={fi ? "Materiaalien URL:t (pilkulla)" : "Material URLs (comma-separated)"}
                name="material_urls"
                defaultValue={val(coach, "material_urls")}
                textarea
              />
              {extra("11. Media & Materials")}
            </Section>
          </>
        )}

        <button
          type="submit"
          className="bg-amber-500 text-black font-medium px-5 py-2.5 rounded-md hover:bg-amber-400 transition"
        >
          {fi ? "Tallenna muutokset" : "Save changes"}
        </button>
      </form>

      <form action={changeOwnPasswordOptional} className="mt-8 bg-neutral-900 rounded-lg border border-neutral-800 p-5 max-w-lg">
        <h3 className="font-medium text-neutral-100 mb-1">{fi ? "Vaihda salasana" : "Change password"}</h3>
        <p className="text-xs text-neutral-500 mb-4">
          {fi ? "Jätä tyhjäksi, jos et vaihda salasanaa." : "Leave blank if you don’t want to change your password."}
        </p>
        <div className="grid gap-3">
          <label className="block">
            <span className="text-sm text-neutral-400">{fi ? "Uusi salasana" : "New password"}</span>
            <input
              type="password"
              name="newPassword"
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
            />
          </label>
          <label className="block">
            <span className="text-sm text-neutral-400">{fi ? "Vahvista salasana" : "Confirm password"}</span>
            <input
              type="password"
              name="confirmPassword"
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
            />
          </label>
          <div>
            <button type="submit" className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black">
              {fi ? "Päivitä salasana" : "Update password"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

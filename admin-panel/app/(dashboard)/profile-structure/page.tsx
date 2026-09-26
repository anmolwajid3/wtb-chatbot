import { redirect } from "next/navigation";
import { addProfileField, addProfileSection, deleteProfileField, deleteProfileSection, moveProfileField, updateProfileField } from "./actions";
import { FieldForm } from "./FieldForm";
import { getLocale, t } from "@/lib/i18n";
import { PROFILE_SECTION_TITLES, sectionForField } from "@/lib/profileSections";
import { canEditCompany } from "@/lib/plans";
import { listProfileFields, listProfileSections, requireOrganization } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProfileStructurePage({
  searchParams,
}: {
  searchParams: Promise<{ need?: string }>;
}) {
  const { session, organization } = await requireOrganization();
  if (!canEditCompany(session.role)) redirect("/home");

  const params = await searchParams;
  const locale = await getLocale();
  const fields = await listProfileFields(organization.id);
  const ownSections = !(fields.some((field) => field.is_builtin));
  const savedSections = ownSections ? await listProfileSections(organization.id) : [];
  const sections = ownSections ? savedSections.map((section) => section.title) : PROFILE_SECTION_TITLES;
  const copy = {
    label: t(locale, "fields.label"),
    type: t(locale, "fields.type"),
    group: t(locale, "fields.group"),
    groupHint: t(locale, "fields.groupHint"),
    choices: t(locale, "fields.choices"),
    choicesHint: t(locale, "fields.choicesHint"),
    required: t(locale, "fields.required"),
    text: t(locale, "fields.text"),
    textarea: t(locale, "fields.textarea"),
    dropdown: t(locale, "fields.dropdown"),
    radio: t(locale, "fields.radio"),
    number: t(locale, "fields.number"),
    submit: t(locale, "fields.add"),
    builtin: t(locale, "fields.builtin"),
  };

  const grouped = new Map<string, typeof fields>();
  if (ownSections) {
    for (const section of savedSections) grouped.set(section.title, []);
  }
  for (const field of fields) {
    const name = ownSections ? field.group_name : sectionForField(field.group_name);
    if (!name) continue;
    grouped.set(name, [...(grouped.get(name) || []), field]);
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="font-display text-3xl text-neutral-100 mb-1">
        {t(locale, "fields.title", { label: organization.profile_label, name: organization.name })}
      </h1>
      <p className="text-neutral-400 mb-2">
        {ownSections
          ? t(locale, "fields.setup", { person: organization.profile_label })
          : t(locale, "fields.lede", { label: organization.profile_label, name: organization.name })}
      </p>
      {!ownSections && <p className="text-sm text-neutral-500 mb-6">{t(locale, "fields.later")}</p>}
      {ownSections && sections.length === 0 && (
        <p className="text-sm text-neutral-500 mb-6">{t(locale, "fields.noSections")}</p>
      )}
      {params.need && <p className="text-sm text-amber-400 mb-4">{t(locale, "fields.need")}</p>}

      {ownSections && (
        <form action={addProfileSection} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 mb-4 flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-48">
            <span className="text-sm text-neutral-400">{t(locale, "fields.sectionName")}</span>
            <input name="title" required className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100" />
          </label>
          <button type="submit" className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md">
            {t(locale, "fields.addSection")}
          </button>
        </form>
      )}

      {sections.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 mb-8">
          <FieldForm action={addProfileField} sections={sections} copy={copy} />
        </div>
      )}

      {fields.length === 0 && !ownSections && <p className="text-sm text-neutral-500">{t(locale, "fields.empty")}</p>}
      {[...grouped.entries()]
        .sort((a, b) => sections.indexOf(a[0]) - sections.indexOf(b[0]))
        .map(([name, rows]) => (
        <section key={name} className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-neutral-500">{name}</h2>
            {ownSections && rows.length === 0 && (
              <form action={deleteProfileSection}>
                <input type="hidden" name="id" value={savedSections.find((section) => section.title === name)?.id || ""} />
                <button type="submit" className="text-xs text-neutral-500 hover:text-red-400">
                  {t(locale, "fields.removeSection")}
                </button>
              </form>
            )}
          </div>
          {rows.length > 0 && (
          <ul className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg bg-neutral-900">
            {rows.map((field) => {
              const index = fields.findIndex((item) => item.id === field.id);
              return (
                <li key={field.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-neutral-100">
                        {field.label}
                        {field.required ? " *" : ""}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {t(locale, `fields.${field.field_type}`)}
                        {field.is_builtin ? ` · ${t(locale, "fields.builtinShort")}` : ""}
                        {(field.field_type === "dropdown" || field.field_type === "radio") && field.options?.length
                          ? ` · ${field.options.join(", ")}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <form action={moveProfileField}>
                        <input type="hidden" name="id" value={field.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button type="submit" disabled={index === 0} className="text-xs text-neutral-500 hover:text-amber-400 disabled:opacity-30">
                          {t(locale, "fields.up")}
                        </button>
                      </form>
                      <form action={moveProfileField}>
                        <input type="hidden" name="id" value={field.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          disabled={index === fields.length - 1}
                          className="text-xs text-neutral-500 hover:text-amber-400 disabled:opacity-30"
                        >
                          {t(locale, "fields.down")}
                        </button>
                      </form>
                      {!field.is_builtin && (
                        <form action={deleteProfileField}>
                          <input type="hidden" name="id" value={field.id} />
                          <button type="submit" className="text-sm text-neutral-500 hover:text-red-400">
                            {t(locale, "fields.delete")}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-neutral-400">{t(locale, "fields.edit")}</summary>
                    <div className="mt-3">
                      <FieldForm
                        action={updateProfileField}
                        sections={sections}
                        field={field}
                        copy={{ ...copy, submit: t(locale, "fields.save") }}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          )}
        </section>
      ))}
    </div>
  );
}

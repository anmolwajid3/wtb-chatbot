"use client";

import { useState } from "react";

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export type FieldDraft = {
  id: string;
  label: string;
  field_type: string;
  options: string[] | null;
  required: boolean;
  group_name: string;
  is_builtin: boolean;
};

export function FieldForm({
  action,
  sections,
  field,
  copy,
}: {
  action: (formData: FormData) => void;
  sections: string[];
  field?: FieldDraft;
  copy: {
    label: string;
    type: string;
    group: string;
    groupHint: string;
    choices: string;
    choicesHint: string;
    required: string;
    text: string;
    textarea: string;
    dropdown: string;
    radio: string;
    number: string;
    submit: string;
    builtin: string;
  };
}) {
  const [type, setType] = useState(field?.field_type || "text");
  const choices = type === "dropdown" || type === "radio";
  const locked = Boolean(field?.is_builtin);
  const section = sections.includes(field?.group_name || "") ? field?.group_name : sections[0];

  return (
    <form action={action} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {field && <input type="hidden" name="id" value={field.id} />}
      <label className="block">
        <span className="text-sm text-neutral-400">{copy.label}</span>
        <input name="label" required defaultValue={field?.label || ""} className={inputClass} />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-400">{copy.type}</span>
        <select
          name="field_type"
          className={inputClass}
          value={locked ? field?.field_type : type}
          onChange={(event) => setType(event.target.value)}
          disabled={locked}
        >
          <option value="text">{copy.text}</option>
          <option value="textarea">{copy.textarea}</option>
          <option value="dropdown">{copy.dropdown}</option>
          <option value="radio">{copy.radio}</option>
          <option value="number">{copy.number}</option>
        </select>
        {locked && <input type="hidden" name="field_type" value={field?.field_type} />}
      </label>
      <label className="block md:col-span-2">
        <span className="text-sm text-neutral-400">{copy.group}</span>
        <select name="group_name" defaultValue={section} className={inputClass}>
          {sections.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="block text-xs text-neutral-500 mt-1">{copy.groupHint}</span>
      </label>
      {choices && (
        <label className="block md:col-span-2">
          <span className="text-sm text-neutral-400">{copy.choices}</span>
          <input
            name="options"
            required={!locked}
            defaultValue={(field?.options || []).join(", ")}
            placeholder={copy.choicesHint}
            className={inputClass}
            disabled={locked}
          />
        </label>
      )}
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" name="required" defaultChecked={field?.required} />
        {copy.required}
      </label>
      <div>
        <button type="submit" className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md hover:bg-amber-400 transition">
          {copy.submit}
        </button>
      </div>
      {locked && <p className="md:col-span-2 text-xs text-neutral-500">{copy.builtin}</p>}
    </form>
  );
}

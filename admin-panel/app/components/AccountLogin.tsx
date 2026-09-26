"use client";

import { useState } from "react";
import { loginAsProfile, loginAsStaff } from "../login/actions";

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export function AccountLogin({
  accountLabel,
  companyLabel,
  profileLabel,
  emailLabel,
  usernameLabel,
  passwordLabel,
  submitLabel,
}: {
  accountLabel: string;
  companyLabel: string;
  profileLabel: string;
  emailLabel: string;
  usernameLabel: string;
  passwordLabel: string;
  submitLabel: string;
}) {
  const [kind, setKind] = useState("company");
  const profile = kind === "profile";

  return (
    <form action={profile ? loginAsProfile : loginAsStaff} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 max-w-md">
      <input type="hidden" name="door" value="company" />
      <label className="block mb-3 text-sm text-neutral-400">
        {accountLabel}
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className={inputClass}
        >
          <option value="company">{companyLabel}</option>
          <option value="profile">{profileLabel}</option>
        </select>
      </label>
      {profile ? (
        <label className="block mb-3 text-sm text-neutral-400">
          {usernameLabel}
          <input type="text" name="username" required autoComplete="username" className={inputClass} />
        </label>
      ) : (
        <label className="block mb-3 text-sm text-neutral-400">
          {emailLabel}
          <input type="email" name="email" required autoComplete="username" className={inputClass} />
        </label>
      )}
      <label className="block mb-4 text-sm text-neutral-400">
        {passwordLabel}
        <input type="password" name="password" required autoComplete="current-password" className={inputClass} />
      </label>
      <button type="submit" className="bg-amber-500 text-black font-medium px-4 py-2 rounded-md">
        {submitLabel}
      </button>
    </form>
  );
}

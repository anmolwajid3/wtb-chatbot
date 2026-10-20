"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { removeCompanyLogo, saveCompanyLogo } from "../(dashboard)/companies/logoActions";

export function CompanyLogoForm({
  organizationId,
  logoUrl,
  label,
}: {
  organizationId: string;
  logoUrl: string | null;
  label: string;
}) {
  const router = useRouter();
  const [saveState, saveAction, saving] = useActionState(saveCompanyLogo, null);
  const [removeState, removeAction, removing] = useActionState(removeCompanyLogo, null);

  useEffect(() => {
    if (saveState?.ok || removeState?.ok) router.refresh();
  }, [saveState, removeState, router]);

  const error = saveState?.error || removeState?.error;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-16 w-auto max-w-[10rem] rounded-md object-contain bg-white p-1" />
        ) : (
          <div className="h-16 w-16 rounded-md bg-neutral-800 border border-neutral-700" />
        )}
        <form action={saveAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="organization_id" value={organizationId} />
          <label className="text-sm text-neutral-400">
            {label}
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              required
              className="mt-1 block text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="bg-amber-500 text-black text-sm font-medium px-3 py-1.5 rounded-md disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save logo"}
          </button>
        </form>
        {logoUrl && (
          <form action={removeAction}>
            <input type="hidden" name="organization_id" value={organizationId} />
            <button
              type="submit"
              disabled={removing}
              className="text-sm text-neutral-500 hover:text-red-400 disabled:opacity-60"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </form>
        )}
      </div>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}

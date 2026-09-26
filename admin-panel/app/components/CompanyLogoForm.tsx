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
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 mb-6 flex flex-wrap items-center gap-4">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-14 w-14 rounded-md object-cover bg-white" />
      ) : (
        <div className="h-14 w-14 rounded-md bg-neutral-800 border border-neutral-700" />
      )}
      <form action={saveCompanyLogo} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="organization_id" value={organizationId} />
        <label className="text-sm text-neutral-400">
          {label}
          <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/gif" required className="mt-1 block text-sm" />
        </label>
        <button type="submit" className="bg-amber-500 text-black text-sm font-medium px-3 py-1.5 rounded-md">
          Save logo
        </button>
      </form>
      {logoUrl && (
        <form action={removeCompanyLogo}>
          <input type="hidden" name="organization_id" value={organizationId} />
          <button type="submit" className="text-sm text-neutral-500 hover:text-red-400">
            Remove
          </button>
        </form>
      )}
    </div>
  );
}

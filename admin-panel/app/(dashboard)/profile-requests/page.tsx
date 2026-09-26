import { approveProfileRequest, declineProfileRequest } from "./actions";
import { getPool } from "@/lib/db";
import { getLocale, t } from "@/lib/i18n";
import { canManageCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProfileRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { session, organization } = await requireOrganization();
  if (!canManageCompany(session.role)) redirect("/home");
  const params = await searchParams;
  const locale = await getLocale();
  const result = await getPool().query(
    `SELECT id, name, email, username, note, status, created_at
     FROM profile_requests
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organization.id]
  );

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="font-display text-3xl text-neutral-100 mb-2">{t(locale, "requests.title")}</h1>
      <p className="text-neutral-400 mb-6">
        {t(locale, "requests.lede", {
          name: organization.name,
          person: organization.profile_label,
        })}
      </p>
      {params.error === "taken" && <p className="text-sm text-red-400 mb-4">{t(locale, "join.taken")}</p>}
      {result.rows.length === 0 ? (
        <p className="text-sm text-neutral-500">{t(locale, "requests.empty")}</p>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black border-b border-neutral-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-400">{t(locale, "members.name")}</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-400">{t(locale, "members.email")}</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-400">{t(locale, "login.username")}</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-400">{t(locale, "requests.note")}</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-400">Status</th>
                <th className="text-right px-4 py-3 font-medium text-neutral-400"></th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((request) => (
                <tr key={request.id} className="border-b border-neutral-800 last:border-0 align-top">
                  <td className="px-4 py-3 text-neutral-100">{request.name}</td>
                  <td className="px-4 py-3 text-neutral-400">{request.email}</td>
                  <td className="px-4 py-3 text-neutral-400">{request.username}</td>
                  <td className="px-4 py-3 text-neutral-400 max-w-xs">{request.note || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`tag tag-${request.status === "pending" ? "progress" : request.status === "approved" ? "matched" : "muted"}`}>
                      {t(locale, `requests.${request.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {request.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <form action={approveProfileRequest}>
                          <input type="hidden" name="id" value={request.id} />
                          <button type="submit" className="bg-amber-500 text-black text-sm font-medium px-3 py-1.5 rounded-md">
                            {t(locale, "requests.approve")}
                          </button>
                        </form>
                        <form action={declineProfileRequest}>
                          <input type="hidden" name="id" value={request.id} />
                          <button type="submit" className="text-sm text-neutral-400 hover:text-red-400 px-2">
                            {t(locale, "requests.decline")}
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { requireCoachSession } from "@/lib/coachSessionServer";
import { changeOwnPassword } from "../actions";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireCoachSession(true);
  const params = await searchParams;

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-2">
        Set Your Password
      </h1>
      <p className="text-sm text-neutral-400 mb-6">
        For security, please set your own password before continuing.
      </p>

      {params.error === "mismatch" && (
        <p className="text-red-400 text-sm mb-4">Passwords do not match.</p>
      )}
      {params.error === "short" && (
        <p className="text-red-400 text-sm mb-4">Password must be at least 8 characters.</p>
      )}

      <form action={changeOwnPassword} className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4">
        <label className="block">
          <span className="text-sm text-neutral-400">New password</span>
          <input
            type="password"
            name="newPassword"
            autoFocus
            className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
          />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Confirm new password</span>
          <input
            type="password"
            name="confirmPassword"
            className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
          />
        </label>
        <button
          type="submit"
          className="w-full bg-amber-500 text-black font-medium px-4 py-2 rounded-md hover:bg-amber-400 transition"
        >
          Set password
        </button>
      </form>
    </div>
  );
}
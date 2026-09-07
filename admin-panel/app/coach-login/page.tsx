import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { createCoachSessionToken } from "@/lib/coachSession";

async function coachLoginAction(formData: FormData) {
  "use server";
  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;

  if (!username || !password) {
    redirect("/coach-login?error=1");
  }

  const pool = getPool();
  const result = await pool.query(
    `SELECT ca.id AS account_id, ca.password_hash, ca.must_change_password, ca.coach_id, c.coach_name
     FROM coach_accounts ca
     JOIN coaches c ON c.id = ca.coach_id
     WHERE ca.username = $1`,
    [username]
  );

  const account = result.rows[0];
  if (!account) {
    redirect("/coach-login?error=1");
  }

  const passwordMatches = await bcrypt.compare(password, account.password_hash);
  if (!passwordMatches) {
    redirect("/coach-login?error=1");
  }

  const token = createCoachSessionToken({
    coachAccountId: account.account_id,
    coachId: account.coach_id,
    coachName: account.coach_name,
  });

  const cookieStore = await cookies();
  cookieStore.set("wtb_coach_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  if (account.must_change_password) {
    redirect("/coach-portal/change-password");
  }
  redirect("/coach-portal");
}

export default async function CoachLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <form
        action={coachLoginAction}
        className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 w-full max-w-sm"
      >
        <h1 className="font-display text-xl text-amber-400 uppercase tracking-wide mb-1 text-center">
          Coach Login
        </h1>
        <p className="text-xs text-neutral-500 text-center mb-6">
          WTB coach portal — view your profile and your matched inquiries
        </p>
        {params.error && (
          <p className="text-red-400 text-sm mb-4 text-center">
            Incorrect username or password — try again.
          </p>
        )}
        <label className="block mb-4">
          <span className="text-sm text-neutral-400">Username</span>
          <input
            type="text"
            name="username"
            autoFocus
            className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
          />
        </label>
        <label className="block mb-5">
          <span className="text-sm text-neutral-400">Password</span>
          <input
            type="password"
            name="password"
            className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
          />
        </label>
        <button
          type="submit"
          className="w-full bg-amber-500 text-black font-medium px-4 py-2 rounded-md hover:bg-amber-400 transition"
        >
          Log in
        </button>
        <p className="text-xs text-neutral-600 text-center mt-4">
          Forgotten your password? Contact WTB directly to have it reset.
        </p>
      </form>
    </div>
  );
}
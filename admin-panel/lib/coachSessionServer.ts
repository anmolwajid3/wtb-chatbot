import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { verifyCoachSessionToken } from "./coachSession";

export async function getVerifiedCoachSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("wtb_coach_session")?.value;
  return verifyCoachSessionToken(token);
}

// Use this in coach-portal pages instead of getVerifiedCoachSession directly.
// It also enforces the forced-password-change flow: if the coach hasn't set
// their own password yet (still using one an admin assigned them), they get
// redirected to the change-password page before they can reach anything else.
// Pass allowPasswordChangeRequired=true only on the change-password page
// itself, so it doesn't redirect into a loop.
export async function requireCoachSession(allowPasswordChangeRequired = false) {
  const session = await getVerifiedCoachSession();
  if (!session) {
    redirect("/coach-login");
  }

  if (!allowPasswordChangeRequired) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT must_change_password FROM coach_accounts WHERE id = $1`,
      [session.coachAccountId]
    );
    if (result.rows[0]?.must_change_password) {
      redirect("/coach-portal/change-password");
    }
  }

  return session;
}
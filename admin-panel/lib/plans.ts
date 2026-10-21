export const PLANS = {
  free: { credits: 1000 },
  pro: { credits: 5000 },
  enterprise: { credits: 20000 },
} as const;

/** Soft cap on profiles/coaches per company (editable per org). */
export const DEFAULT_PROFILE_LIMIT = 50;

export type PlanId = keyof typeof PLANS;

export function planCredits(plan: string): number {
  if (plan === "pro" || plan === "enterprise" || plan === "free") return PLANS[plan].credits;
  return PLANS.free.credits;
}

export function clampCreditLimit(raw: unknown, fallback: number = 1000): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1_000_000, Math.max(1, Math.floor(n)));
}

export function clampProfileLimit(raw: unknown, fallback: number = DEFAULT_PROFILE_LIMIT): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(500, Math.max(1, Math.floor(n)));
}

export function canManageCompany(role: string) {
  return role === "super_admin" || role === "org_admin";
}

export function canEditCompany(role: string) {
  return canManageCompany(role) || role === "editor" || role === "member";
}

export function canAnalyze(role: string) {
  return canEditCompany(role) || role === "analyst";
}

export async function assertStaff(check: (role: string) => boolean) {
  const { redirect } = await import("next/navigation");
  const { getWorkspace } = await import("./workspace");
  const workspace = await getWorkspace();
  if (!workspace || !check(workspace.session.role)) redirect("/home");
  return workspace;
}

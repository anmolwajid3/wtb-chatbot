export const PLANS = {
  free: { credits: 50 },
  pro: { credits: 1000 },
  enterprise: { credits: 10000 },
} as const;

export type PlanId = keyof typeof PLANS;

export function planCredits(plan: string): number {
  if (plan === "pro" || plan === "enterprise" || plan === "free") return PLANS[plan].credits;
  return PLANS.free.credits;
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

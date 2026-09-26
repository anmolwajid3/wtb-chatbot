"use server";

import { canEditCompany } from "@/lib/plans";
import { requireOrganization } from "@/lib/workspace";

export type DiagnosticCheck = {
  name: string;
  level: "pass" | "fail" | "watch";
  agent: string;
  detail: string;
};

export async function runCompanyDiagnostics(): Promise<DiagnosticCheck[]> {
  const { session, organization } = await requireOrganization();
  if (!canEditCompany(session.role)) {
    return [{ name: "Access", level: "fail", agent: "—", detail: "This account cannot run diagnostics." }];
  }
  const response = await fetch("http://127.0.0.1:8000/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organization_slug: organization.slug }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("diagnose failed");
  }
  const body = (await response.json()) as { checks: DiagnosticCheck[] };
  return body.checks;
}

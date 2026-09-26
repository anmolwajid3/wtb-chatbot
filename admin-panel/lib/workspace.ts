import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ORG_COOKIE, STAFF_COOKIE } from "./brand";
import { getPool } from "./db";
import { ensureSchema } from "./schema";
import { verifyStaffSessionToken, type StaffSession } from "./session";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  profile_label: string;
  profile_label_plural: string;
  status: string;
  plan: string;
  credit_limit: number;
  credits_used: number;
  max_matches: number;
  min_match_score: number;
  followup_turns: number;
  show_match_score: boolean;
  logo_url: string | null;
};

export type Workspace = {
  session: StaffSession;
  organization: Organization | null;
};

export async function getStaffSession(): Promise<StaffSession | null> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  return verifyStaffSessionToken(token);
}

export async function getWorkspace(): Promise<Workspace | null> {
  await ensureSchema();
  const session = await getStaffSession();
  if (!session) return null;

  const pool = getPool();
  let organizationId = session.organizationId;
  if (session.role === "super_admin") {
    organizationId = (await cookies()).get(ORG_COOKIE)?.value ?? null;
  }

  if (!organizationId) return { session, organization: null };

  const result = await pool.query(
    `SELECT id, name, slug, profile_label, profile_label_plural, status, plan, credit_limit, credits_used,
            max_matches, min_match_score, followup_turns, show_match_score, logo_url
     FROM organizations WHERE id = $1`,
    [organizationId]
  );
  return { session, organization: result.rows[0] ?? null };
}

export async function requireOrganization() {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (!workspace.organization) {
    redirect(workspace.session.role === "super_admin" ? "/companies" : "/login");
  }
  return { session: workspace.session, organization: workspace.organization };
}

export type ProfileField = {
  id: string;
  field_key: string;
  label: string;
  field_type: "text" | "textarea" | "dropdown" | "number" | "radio";
  options: string[] | null;
  required: boolean;
  sort_order: number;
  is_builtin: boolean;
  group_name: string;
};

export type ProfileSection = {
  id: string;
  title: string;
  sort_order: number;
};

export async function listProfileSections(organizationId: string): Promise<ProfileSection[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, title, sort_order FROM profile_sections
     WHERE organization_id = $1
     ORDER BY sort_order ASC, title ASC`,
    [organizationId]
  );
  return result.rows;
}

export async function listProfileFields(organizationId: string): Promise<ProfileField[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, field_key, label, field_type, options, required, sort_order, is_builtin, group_name
     FROM profile_fields
     WHERE organization_id = $1
     ORDER BY sort_order ASC, label ASC`,
    [organizationId]
  );
  return result.rows;
}

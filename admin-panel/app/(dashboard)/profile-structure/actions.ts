"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { canEditCompany } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

function toKey(label: string) {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return base || "field";
}

async function requireOrg() {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (!canEditCompany(workspace.session.role)) redirect("/home");
  if (!workspace.organization) redirect("/profile-structure?need=1");
  return workspace.organization;
}

function readField(formData: FormData) {
  const label = String(formData.get("label") || "").trim();
  const fieldType = String(formData.get("field_type") || "text");
  const allowed = ["text", "textarea", "dropdown", "number", "radio"];
  const groupName = String(formData.get("group_name") || "").trim();
  const choices = fieldType === "dropdown" || fieldType === "radio";
  const options = choices
    ? String(formData.get("options") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const required = formData.get("required") === "on";
  if (!label || !allowed.includes(fieldType)) return null;
  if (choices && options.length === 0) return null;
  return { label, fieldType, groupName, options, required };
}

async function usesOwnSections(organizationId: string) {
  const pool = getPool();
  const builtins = await pool.query(
    `SELECT 1 FROM profile_fields WHERE organization_id = $1 AND is_builtin = true LIMIT 1`,
    [organizationId]
  );
  return builtins.rows.length === 0;
}

export async function addProfileSection(formData: FormData) {
  const organization = await requireOrg();
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const pool = getPool();
  const order = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM profile_sections WHERE organization_id = $1`,
    [organization.id]
  );
  await pool.query(
    `INSERT INTO profile_sections (organization_id, title, sort_order)
     VALUES ($1, $2, $3)
     ON CONFLICT (organization_id, title) DO NOTHING`,
    [organization.id, title, order.rows[0].next]
  );
  revalidatePath("/profile-structure");
}

export async function deleteProfileSection(formData: FormData) {
  const organization = await requireOrg();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const pool = getPool();
  const section = await pool.query(
    `SELECT title FROM profile_sections WHERE id = $1 AND organization_id = $2`,
    [id, organization.id]
  );
  if (!section.rows[0]) return;
  const used = await pool.query(
    `SELECT 1 FROM profile_fields WHERE organization_id = $1 AND group_name = $2 LIMIT 1`,
    [organization.id, section.rows[0].title]
  );
  if (used.rows.length > 0) return;
  await pool.query(`DELETE FROM profile_sections WHERE id = $1 AND organization_id = $2`, [id, organization.id]);
  revalidatePath("/profile-structure");
}

export async function addProfileField(formData: FormData) {
  const organization = await requireOrg();
  const field = readField(formData);
  if (!field) return;
  const { label, fieldType, groupName, options, required } = field;

  const pool = getPool();
  if (await usesOwnSections(organization.id)) {
    const section = await pool.query(
      `SELECT 1 FROM profile_sections WHERE organization_id = $1 AND title = $2`,
      [organization.id, groupName]
    );
    if (!section.rows[0]) return;
  }
  const order = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM profile_fields WHERE organization_id = $1`,
    [organization.id]
  );
  let key = toKey(label);
  const existing = await pool.query(
    `SELECT field_key FROM profile_fields WHERE organization_id = $1 AND field_key LIKE $2`,
    [organization.id, `${key}%`]
  );
  const taken = new Set(existing.rows.map((row) => row.field_key as string));
  if (taken.has(key)) {
    let n = 2;
    while (taken.has(`${key}_${n}`)) n += 1;
    key = `${key}_${n}`;
  }

  await pool.query(
    `INSERT INTO profile_fields (organization_id, field_key, label, field_type, options, required, sort_order, group_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [organization.id, key, label, fieldType, options, required, order.rows[0].next, groupName]
  );
  revalidatePath("/profile-structure");
  revalidatePath("/coaches");
}

export async function updateProfileField(formData: FormData) {
  const organization = await requireOrg();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const pool = getPool();
  const current = await pool.query(
    `SELECT is_builtin FROM profile_fields WHERE id = $1 AND organization_id = $2`,
    [id, organization.id]
  );
  if (!current.rows[0]) return;
  if (current.rows[0].is_builtin) {
    const label = String(formData.get("label") || "").trim();
    if (!label) return;
    await pool.query(
      `UPDATE profile_fields SET label = $1, group_name = $2, required = $3 WHERE id = $4 AND organization_id = $5`,
      [label, String(formData.get("group_name") || "").trim(), formData.get("required") === "on", id, organization.id]
    );
  } else {
    const field = readField(formData);
    if (!field) return;
    await pool.query(
      `UPDATE profile_fields
       SET label = $1, field_type = $2, options = $3, required = $4, group_name = $5
       WHERE id = $6 AND organization_id = $7`,
      [field.label, field.fieldType, field.options, field.required, field.groupName, id, organization.id]
    );
  }
  revalidatePath("/profile-structure");
  revalidatePath("/coaches");
}

export async function deleteProfileField(formData: FormData) {
  const organization = await requireOrg();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const pool = getPool();
  await pool.query(
    `DELETE FROM profile_fields WHERE id = $1 AND organization_id = $2 AND is_builtin = false`,
    [id, organization.id]
  );
  revalidatePath("/profile-structure");
}

export async function moveProfileField(formData: FormData) {
  const organization = await requireOrg();
  const id = String(formData.get("id") || "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const pool = getPool();
  const fields = await pool.query(
    `SELECT id, sort_order FROM profile_fields WHERE organization_id = $1 ORDER BY sort_order ASC, label ASC`,
    [organization.id]
  );
  const rows = fields.rows as { id: string; sort_order: number }[];
  const index = rows.findIndex((row) => row.id === id);
  const swapWith = index + direction;
  if (index < 0 || swapWith < 0 || swapWith >= rows.length) return;
  const current = rows[index];
  const other = rows[swapWith];
  await pool.query(`UPDATE profile_fields SET sort_order = $1 WHERE id = $2`, [other.sort_order, current.id]);
  await pool.query(`UPDATE profile_fields SET sort_order = $1 WHERE id = $2`, [current.sort_order, other.id]);
  revalidatePath("/profile-structure");
}

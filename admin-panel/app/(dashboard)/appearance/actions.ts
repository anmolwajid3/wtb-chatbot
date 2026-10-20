"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { canManageCompany } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

export async function saveAppearance(formData: FormData) {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (!canManageCompany(workspace.session.role)) redirect("/home");
  if (!workspace.organization) redirect("/companies?need=1");

  const replyLanguage = String(formData.get("reply_language") || "auto");
  const widgetTheme = String(formData.get("widget_theme") || "dark");
  let accent = String(formData.get("widget_accent") || "#FFFFFF").trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(accent)) accent = "#FFFFFF";

  const safeLang = ["auto", "en", "fi", "sv"].includes(replyLanguage) ? replyLanguage : "auto";
  const safeTheme = widgetTheme === "light" ? "light" : "dark";

  await getPool().query(
    `UPDATE organizations
     SET reply_language = $1, widget_theme = $2, widget_accent = $3
     WHERE id = $4`,
    [safeLang, safeTheme, accent, workspace.organization.id]
  );
  revalidatePath("/appearance");
  revalidatePath("/home");
}

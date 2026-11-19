"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { STAFF_COOKIE } from "@/lib/brand";
import { getPool } from "@/lib/db";
import { createStaffSessionToken } from "@/lib/session";
import { getWorkspace } from "@/lib/workspace";

export async function updateProfile(formData: FormData) {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!name || !email) redirect("/profile?error=1");
  if (password && password.length < 8) redirect("/profile?error=short");
  if (password && password !== confirm) redirect("/profile?error=match");

  const pool = getPool();
  try {
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4`,
        [name, email, passwordHash, workspace.session.userId]
      );
    } else {
      await pool.query(`UPDATE users SET name = $1, email = $2 WHERE id = $3`, [
        name,
        email,
        workspace.session.userId,
      ]);
    }
  } catch {
    redirect("/profile?error=taken");
  }

  const token = createStaffSessionToken({
    ...workspace.session,
    name,
    email,
  });
  const cookieStore = await cookies();
  cookieStore.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/profile");
  revalidatePath("/home");
  redirect("/profile?saved=1");
}

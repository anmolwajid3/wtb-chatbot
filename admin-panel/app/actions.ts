"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ORG_COOKIE, STAFF_COOKIE } from "@/lib/brand";
import { getStaffSession } from "@/lib/workspace";

export async function logoutAction() {
  const session = await getStaffSession();
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_COOKIE);
  cookieStore.delete(ORG_COOKIE);
  redirect(session?.role === "super_admin" ? "/admin" : "/login");
}

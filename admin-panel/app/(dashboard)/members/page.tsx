import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** @deprecated use /users */
export default function MembersRedirect() {
  redirect("/users?tab=admins");
}

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** @deprecated use /users?tab=coaches */
export default function ProfileRequestsRedirect() {
  redirect("/users?tab=coaches");
}

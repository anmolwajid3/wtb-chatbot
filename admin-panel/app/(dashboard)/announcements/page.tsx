import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** @deprecated use /notifications */
export default function AnnouncementsRedirect() {
  redirect("/notifications");
}

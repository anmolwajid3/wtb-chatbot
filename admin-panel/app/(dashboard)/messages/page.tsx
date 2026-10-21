import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** @deprecated use /broadcasts */
export default function MessagesRedirect() {
  redirect("/broadcasts");
}

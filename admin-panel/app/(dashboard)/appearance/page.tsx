import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Appearance lives under Settings now. */
export default function AppearanceRedirect() {
  redirect("/settings");
}

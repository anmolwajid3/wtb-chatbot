import { redirect } from "next/navigation";
import { updateProfile } from "./actions";
import { getLocale } from "@/lib/i18n";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  const locale = await getLocale();
  const params = await searchParams;
  const { session } = workspace;

  const copy =
    locale === "fi"
      ? {
          title: "Profiili",
          lede: "Päivitä nimesi, sähköpostisi tai salasanasi.",
          name: "Nimi",
          email: "Sähköposti",
          password: "Uusi salasana",
          confirm: "Vahvista salasana",
          passwordHint: "Jätä tyhjäksi, jos et vaihda salasanaa.",
          save: "Tallenna",
          saved: "Profiili tallennettu.",
          err1: "Nimi ja sähköposti tarvitaan.",
          short: "Salasanan oltava vähintään 8 merkkiä.",
          match: "Salasanat eivät täsmää.",
          taken: "Sähköposti on jo käytössä.",
        }
      : locale === "sv"
        ? {
            title: "Profil",
            lede: "Uppdatera namn, e-post eller lösenord.",
            name: "Namn",
            email: "E-post",
            password: "Nytt lösenord",
            confirm: "Bekräfta lösenord",
            passwordHint: "Lämna tomt om du inte byter lösenord.",
            save: "Spara",
            saved: "Profilen sparades.",
            err1: "Namn och e-post krävs.",
            short: "Lösenordet måste vara minst 8 tecken.",
            match: "Lösenorden matchar inte.",
            taken: "E-postadressen används redan.",
          }
        : {
            title: "Profile",
            lede: "Update your name, email, or password.",
            name: "Name",
            email: "Email",
            password: "New password",
            confirm: "Confirm password",
            passwordHint: "Leave blank if you don’t want to change your password.",
            save: "Save changes",
            saved: "Profile saved.",
            err1: "Name and email are required.",
            short: "Password must be at least 8 characters.",
            match: "Passwords do not match.",
            taken: "That email is already in use.",
          };

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="font-display mb-2 text-3xl text-neutral-100">{copy.title}</h1>
      <p className="mb-6 text-neutral-400">{copy.lede}</p>
      {params.saved && <p className="mb-4 text-sm text-amber-400">{copy.saved}</p>}
      {params.error === "1" && <p className="mb-4 text-sm text-red-400">{copy.err1}</p>}
      {params.error === "short" && <p className="mb-4 text-sm text-red-400">{copy.short}</p>}
      {params.error === "match" && <p className="mb-4 text-sm text-red-400">{copy.match}</p>}
      {params.error === "taken" && <p className="mb-4 text-sm text-red-400">{copy.taken}</p>}

      <form action={updateProfile} className="grid gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <label className="block text-sm text-neutral-400">
          {copy.name}
          <input name="name" required defaultValue={session.name} className={inputClass} />
        </label>
        <label className="block text-sm text-neutral-400">
          {copy.email}
          <input type="email" name="email" required defaultValue={session.email} className={inputClass} />
        </label>
        <label className="block text-sm text-neutral-400">
          {copy.password}
          <input type="password" name="password" minLength={8} className={inputClass} autoComplete="new-password" />
          <span className="mt-1 block text-xs text-neutral-500">{copy.passwordHint}</span>
        </label>
        <label className="block text-sm text-neutral-400">
          {copy.confirm}
          <input type="password" name="confirm" minLength={8} className={inputClass} autoComplete="new-password" />
        </label>
        <div>
          <button type="submit" className="rounded-md bg-amber-500 px-4 py-2 font-medium text-black">
            {copy.save}
          </button>
        </div>
      </form>
    </div>
  );
}

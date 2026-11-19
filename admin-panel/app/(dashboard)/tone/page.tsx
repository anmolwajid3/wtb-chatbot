import { Breadcrumbs } from "../../components/Breadcrumbs";
import { getPool } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { assertStaff, canEditCompany } from "@/lib/plans";
import { getWorkspace, requireOrganization } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function getToneSetting(organizationId: string | null) {
  const pool = getPool();
  const result = organizationId
    ? await pool.query(
        `SELECT * FROM tone_settings WHERE name = 'default_voice' AND organization_id = $1 LIMIT 1`,
        [organizationId]
      )
    : await pool.query(
        `SELECT * FROM tone_settings WHERE name = 'default_voice' AND organization_id IS NULL LIMIT 1`
      );
  return result.rows[0] || null;
}

async function saveTone(formData: FormData) {
  "use server";
  await assertStaff(canEditCompany);
  const description_text = formData.get("description_text") as string;
  const workspace = await getWorkspace();
  const orgId = workspace?.organization?.id ?? null;
  const pool = getPool();
  const existing = await pool.query(
    `SELECT id FROM tone_settings WHERE name = 'default_voice' AND organization_id IS NOT DISTINCT FROM $1 LIMIT 1`,
    [orgId]
  );
  if (existing.rows[0]) {
    await pool.query(`UPDATE tone_settings SET description_text = $1, updated_at = now() WHERE id = $2`, [
      description_text,
      existing.rows[0].id,
    ]);
  } else {
    await pool.query(
      `INSERT INTO tone_settings (name, description_text, organization_id) VALUES ('default_voice', $1, $2)`,
      [description_text, orgId]
    );
  }
  revalidatePath("/tone");
}

export default async function TonePage() {
  const { session, organization } = await requireOrganization();
  if (!canEditCompany(session.role)) redirect("/home");
  const locale = await getLocale();
  const fi = locale === "fi";
  const tone = await getToneSetting(organization.id);

  return (
    <div className="max-w-3xl mx-auto p-8">
      <Breadcrumbs
        items={[
          { href: "/home", label: fi ? "Koti" : "Home" },
          { href: "/chatbot", label: "Chatbot" },
          { label: fi ? "Äänen sävy" : "Tone of Voice" },
        ]}
      />
      <h1 className="font-display text-2xl font-semibold text-amber-400 uppercase tracking-wide mb-2">
        {fi ? "Äänen sävy" : "Tone of Voice"}
      </h1>
      <p className="text-sm text-neutral-400 mb-6">
        {fi
          ? `Tämä on yrityksen ${organization.name} ääni. Se pysyy samana jokaisessa keskustelussa. Vuorokohtainen sävy muuttuu tunnelman mukaan (ks. Esimerkkifraasit).`
          : `This is ${organization.name}'s voice. It stays constant across every conversation. Per-turn phrasing follows mood (see Example Phrases).`}
      </p>

      <form action={saveTone} className="bg-neutral-900 rounded-lg border border-neutral-800 p-5">
        <label className="block">
          <span className="text-sm text-neutral-400">{fi ? "Perussävyn kuvaus" : "Base tone description"}</span>
          <textarea
            name="description_text"
            defaultValue={tone?.description_text || ""}
            rows={6}
            className="mt-2 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
            placeholder={
              fi
                ? "Esim. Lämmin, ammattimainen ja empaattinen valmennustyyli. Konsultatiivinen, inhimillinen — ei robottimainen, ei tyrkyttävä."
                : "e.g. Warm, professional, empathetic coaching tone — never robotic, never pushy."
            }
          />
        </label>
        <button
          type="submit"
          className="mt-4 bg-amber-500 text-black font-medium px-5 py-2.5 rounded-md hover:bg-amber-400 transition"
        >
          {fi ? "Tallenna" : "Save"}
        </button>
      </form>
    </div>
  );
}
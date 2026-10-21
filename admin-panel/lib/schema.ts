import bcrypt from "bcryptjs";
import { STARTER_GREETINGS_FI, STARTER_GUARDRAILS, STARTER_PHRASES_FI, STARTER_TONE } from "./brand";
import { getPool } from "./db";
import { PROFILE_SECTIONS, PROFILE_SECTION_TITLES } from "./profileSections";

let ready: Promise<void> | null = null;

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    profile_label TEXT NOT NULL DEFAULT 'Guide',
    profile_label_plural TEXT NOT NULL DEFAULT 'Guides',
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'org_admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS profile_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'dropdown', 'number')),
    options TEXT[] DEFAULT '{}',
    required BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    UNIQUE (organization_id, field_key)
  )`,
  `CREATE TABLE IF NOT EXISTS opening_greetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    greeting_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `ALTER TABLE coaches ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id)`,
  `ALTER TABLE coaches ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb`,
  `ALTER TABLE tone_settings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id)`,
  `ALTER TABLE example_phrases ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id)`,
  `ALTER TABLE guardrails ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id)`,
  `ALTER TABLE opening_greetings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id)`,
  `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id)`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS credit_limit INTEGER NOT NULL DEFAULT 50`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS credits_used INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS credits_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now())`,
  `DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'users' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'org_admin', 'member', 'viewer', 'analyst', 'editor'));
END $$`,
  `ALTER TABLE profile_fields ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS coach_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL UNIQUE REFERENCES coaches(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_kind TEXT NOT NULL CHECK (account_kind IN ('staff', 'profile')),
    account_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS profile_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ
  )`,
  `ALTER TABLE profile_fields ADD COLUMN IF NOT EXISTS group_name TEXT NOT NULL DEFAULT ''`,
  `DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'profile_fields' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%field_type%'
  LOOP
    EXECUTE format('ALTER TABLE profile_fields DROP CONSTRAINT %I', r.conname);
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_fields_field_type_check'
  ) THEN
    ALTER TABLE profile_fields ADD CONSTRAINT profile_fields_field_type_check
      CHECK (field_type IN ('text', 'textarea', 'dropdown', 'number', 'radio'));
  END IF;
END $$`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_matches INTEGER NOT NULL DEFAULT 3`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS min_match_score INTEGER NOT NULL DEFAULT 50`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS followup_turns INTEGER NOT NULL DEFAULT 2`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS show_match_score BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reply_language TEXT NOT NULL DEFAULT 'auto'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS widget_theme TEXT NOT NULL DEFAULT 'dark'`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS widget_accent TEXT NOT NULL DEFAULT '#FFFFFF'`,
  `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS review_tag TEXT`,
  `ALTER TABLE profile_fields ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`,
  `CREATE UNIQUE INDEX IF NOT EXISTS quote_requests_conversation_id_uidx ON quote_requests (conversation_id)`,
  `CREATE TABLE IF NOT EXISTS profile_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE (organization_id, title)
  )`,
  `CREATE TABLE IF NOT EXISTS notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    audience TEXT NOT NULL CHECK (audience IN ('profiles', 'companies', 'both')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `ALTER TABLE tone_settings DROP CONSTRAINT IF EXISTS tone_settings_name_key`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tone_settings_org_name_uidx
    ON tone_settings (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), name)`,
];

async function seedSuperAdmin() {
  const pool = getPool();
  const existing = await pool.query(`SELECT id FROM users WHERE role = 'super_admin' LIMIT 1`);
  if (existing.rows.length > 0) return;

  const email = (process.env.SUPER_ADMIN_EMAIL || "admin@gptlab.dev").trim().toLowerCase();
  const password =
    process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PANEL_PASSWORD || "harbor-admin";
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (email, name, password_hash, role, organization_id)
     VALUES ($1, 'GPT Lab', $2, 'super_admin', NULL)
     ON CONFLICT (email) DO NOTHING`,
    [email, passwordHash]
  );
}

async function seedSharedDefaults() {
  const pool = getPool();
  const tone = await pool.query(
    `SELECT id FROM tone_settings WHERE name = 'default_voice' AND organization_id IS NULL LIMIT 1`
  );
  if (tone.rows.length === 0) {
    await pool.query(
      `INSERT INTO tone_settings (name, description_text, organization_id) VALUES ('default_voice', $1, NULL)`,
      [STARTER_TONE]
    );
  }

  const rules = await pool.query(`SELECT id FROM guardrails WHERE organization_id IS NULL LIMIT 1`);
  if (rules.rows.length === 0) {
    for (const rule of STARTER_GUARDRAILS) {
      await pool.query(
        `INSERT INTO guardrails (rule_text, category, organization_id) VALUES ($1, $2, NULL)`,
        [rule.rule_text, rule.category]
      );
    }
  }
}

const WTB_FIELDS: { key: string; label: string; type: "text" | "textarea" | "number" }[] = [
  { key: "coach_name", label: "Valmentajan nimi", type: "text" },
  { key: "company_name", label: "Yritys / laskutusnimi", type: "text" },
  { key: "business_id", label: "Y-tunnus", type: "text" },
  { key: "email", label: "Sähköposti", type: "text" },
  { key: "phone", label: "Puhelin", type: "text" },
  { key: "website_or_linkedin", label: "Verkkosivu / LinkedIn", type: "text" },
  { key: "operating_area", label: "Toiminta-alue", type: "text" },
  { key: "program_name", label: "Ohjelman nimi", type: "text" },
  { key: "short_description", label: "Lyhyt kuvaus", type: "textarea" },
  { key: "long_description", label: "Pitkä kuvaus", type: "textarea" },
  { key: "target_group", label: "Kohderyhmä", type: "text" },
  { key: "suited_situations", label: "Sopivat tilanteet", type: "text" },
  { key: "key_themes", label: "Avainteemat", type: "text" },
  { key: "participant_activities", label: "Osallistujien tekemiset", type: "textarea" },
  { key: "methods", label: "Menetelmät", type: "text" },
  { key: "delivery_format", label: "Toteutusmuoto", type: "text" },
  { key: "individual_or_group", label: "Yksilö tai ryhmä", type: "text" },
  { key: "group_size_min", label: "Ryhmäkoko min", type: "number" },
  { key: "group_size_max", label: "Ryhmäkoko max", type: "number" },
  { key: "duration", label: "Kesto", type: "text" },
  { key: "program_structure", label: "Ohjelman rakenne", type: "textarea" },
  { key: "goals", label: "Tavoitteet", type: "textarea" },
  { key: "impact_measurement", label: "Vaikuttavuuden mittaus", type: "textarea" },
  { key: "change_achieved", label: "Saavutettu muutos", type: "textarea" },
  { key: "price_from", label: "Hinta alkaen", type: "text" },
  { key: "pricing_model", label: "Hinnoittelumalli", type: "text" },
  { key: "price_includes", label: "Hintaan sisältyy", type: "textarea" },
  { key: "additional_services", label: "Lisäpalvelut", type: "textarea" },
  { key: "references_text", label: "Referenssit", type: "textarea" },
  { key: "results_feedback", label: "Tulokset / palaute", type: "textarea" },
  { key: "certifications", label: "Sertifikaatit", type: "textarea" },
  { key: "keywords", label: "Avainsanat", type: "text" },
  { key: "main_category", label: "Pääkategoria", type: "text" },
  { key: "subcategories", label: "Alakategoriat", type: "text" },
  { key: "additional_info", label: "Lisätiedot", type: "textarea" },
  { key: "availability", label: "Saatavuus", type: "text" },
  { key: "languages", label: "Kielet", type: "text" },
  { key: "video_url", label: "Videon URL", type: "text" },
  { key: "material_urls", label: "Materiaalien URL:t", type: "textarea" },
];

async function attachUnassigned(table: string, organizationId: string) {
  const pool = getPool();
  try {
    await pool.query(`UPDATE ${table} SET organization_id = $1 WHERE organization_id IS NULL`, [organizationId]);
  } catch {
    // Table or column may not exist yet. Leave the rows where they are.
  }
}

async function seedWtbCompany() {
  const pool = getPool();
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS company_llm_settings (
      organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      active_model TEXT,
      max_cost_cap_usd NUMERIC,
      spend_period TEXT NOT NULL DEFAULT 'month',
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS company_agent_prompts (
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      agent_name TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (organization_id, agent_name)
    )`,
    `ALTER TABLE llm_usage_log ADD COLUMN IF NOT EXISTS organization_id UUID`,
  ]) {
    try {
      await pool.query(sql);
    } catch {
      // These tables are optional until the model pages have been used.
    }
  }

  const existing = await pool.query(
    `SELECT id FROM organizations
     WHERE lower(name) = 'wtb' OR slug IN ('wtb', 'what-the-business')
     ORDER BY (SELECT count(*) FROM users u WHERE u.organization_id = organizations.id) DESC,
              created_at ASC
     LIMIT 1`
  );
  let organizationId = existing.rows[0]?.id as string | undefined;
  if (!organizationId) {
    const created = await pool.query(
      `INSERT INTO organizations (name, slug, profile_label, profile_label_plural, status)
       VALUES ('WTB', 'wtb', 'Coach', 'Coaches', 'active')
       RETURNING id`
    );
    organizationId = created.rows[0].id as string;
  }

  await pool.query(
    `UPDATE tone_settings AS row
     SET organization_id = $1
     WHERE row.organization_id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM tone_settings existing
         WHERE existing.organization_id = $1 AND existing.name = row.name
       )`,
    [organizationId]
  );

  for (const table of ["coaches", "example_phrases", "guardrails", "opening_greetings", "conversations"]) {
    await attachUnassigned(table, organizationId);
  }

  try {
    await pool.query(
      `INSERT INTO company_llm_settings (organization_id, active_model, max_cost_cap_usd, spend_period)
       SELECT $1, active_model, max_cost_cap_usd, 'month' FROM llm_settings WHERE id = 1
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId]
    );
    await pool.query(`UPDATE llm_usage_log SET organization_id = $1 WHERE organization_id IS NULL`, [organizationId]);
    await pool.query(
      `INSERT INTO company_agent_prompts (organization_id, agent_name, system_prompt, updated_at)
       SELECT $1, agent_name, system_prompt, COALESCE(updated_at, now()) FROM agent_prompts
       ON CONFLICT (organization_id, agent_name) DO NOTHING`,
      [organizationId]
    );
  } catch {
    // Model tables are created outside this schema. Skip when they are absent.
  }

  const builtin = await pool.query(
    `SELECT count(*)::int AS count FROM profile_fields WHERE organization_id = $1 AND is_builtin = true`,
    [organizationId]
  );
  if (builtin.rows[0].count === 0) {
    for (let index = 0; index < WTB_FIELDS.length; index += 1) {
      const field = WTB_FIELDS[index];
      await pool.query(
        `INSERT INTO profile_fields (organization_id, field_key, label, field_type, required, sort_order, is_builtin)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (organization_id, field_key) DO UPDATE SET is_builtin = true, label = EXCLUDED.label`,
        [organizationId, field.key, field.label, field.type, field.key === "coach_name", index]
      );
    }
  }

  await foldExtraWtbCompanies(organizationId);
  await assignBuiltinSections();
}

async function assignBuiltinSections() {
  const pool = getPool();
  for (const section of PROFILE_SECTIONS) {
    await pool.query(
      `UPDATE profile_fields
       SET group_name = $1
       WHERE is_builtin = true
         AND field_key = ANY($2::text[])
         AND (group_name = '' OR group_name IS NULL OR NOT (group_name = ANY($3::text[])))`,
      [section.title, section.keys, PROFILE_SECTION_TITLES]
    );
  }
}

async function foldExtraWtbCompanies(organizationId: string) {
  const pool = getPool();
  const extras = await pool.query(
    `SELECT id FROM organizations
     WHERE id <> $1 AND (lower(name) = 'wtb' OR slug IN ('wtb', 'what-the-business'))`,
    [organizationId]
  );
  for (const extra of extras.rows) {
    const extraId = extra.id as string;
    for (const table of ["coaches", "example_phrases", "guardrails", "opening_greetings", "conversations"]) {
      await attachFromOrganization(table, extraId, organizationId);
    }
    try {
      await pool.query(
        `UPDATE tone_settings AS row
         SET organization_id = $1
         WHERE row.organization_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM tone_settings existing
             WHERE existing.organization_id = $1 AND existing.name = row.name
           )`,
        [organizationId, extraId]
      );
      await pool.query(
        `UPDATE profile_fields AS row
         SET organization_id = $1
         WHERE row.organization_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM profile_fields existing
             WHERE existing.organization_id = $1 AND existing.field_key = row.field_key
           )`,
        [organizationId, extraId]
      );
      await pool.query(`UPDATE llm_usage_log SET organization_id = $1 WHERE organization_id = $2`, [
        organizationId,
        extraId,
      ]);
      await pool.query(
        `INSERT INTO company_llm_settings (organization_id, active_model, max_cost_cap_usd, spend_period, updated_at)
         SELECT $1, active_model, max_cost_cap_usd, spend_period, updated_at
         FROM company_llm_settings WHERE organization_id = $2
         ON CONFLICT (organization_id) DO NOTHING`,
        [organizationId, extraId]
      );
      await pool.query(
        `INSERT INTO company_agent_prompts (organization_id, agent_name, system_prompt, updated_at)
         SELECT $1, agent_name, system_prompt, updated_at
         FROM company_agent_prompts WHERE organization_id = $2
         ON CONFLICT (organization_id, agent_name) DO NOTHING`,
        [organizationId, extraId]
      );
    } catch {
      // Company setting tables are optional until the model pages have been used.
    }
    const leftover = await pool.query(
      `SELECT
         (SELECT count(*) FROM users WHERE organization_id = $1) +
         (SELECT count(*) FROM coaches WHERE organization_id = $1) +
         (SELECT count(*) FROM conversations WHERE organization_id = $1) AS count`,
      [extraId]
    );
    if (Number(leftover.rows[0].count) === 0) {
      try {
        await pool.query(`DELETE FROM profile_fields WHERE organization_id = $1`, [extraId]);
        await pool.query(`DELETE FROM tone_settings WHERE organization_id = $1`, [extraId]);
        await pool.query(`DELETE FROM organizations WHERE id = $1`, [extraId]);
      } catch {
        // Leave the empty company row if a related record still points at it.
      }
    }
  }
}

async function attachFromOrganization(table: string, fromId: string, toId: string) {
  const pool = getPool();
  try {
    await pool.query(`UPDATE ${table} SET organization_id = $1 WHERE organization_id = $2`, [toId, fromId]);
  } catch {
    // Table or column may not exist yet. Leave the rows where they are.
  }
}

async function run() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    for (const sql of STATEMENTS) {
      await client.query(sql);
    }
  } finally {
    client.release();
  }
  await seedSuperAdmin();
  await seedSharedDefaults();
  await seedWtbCompany();
  await seedSignInAccounts();
  await seedFinnishContent();
}

async function seedFinnishContent() {
  const pool = getPool();
  // Tone: only replace the old English starter text
  await pool.query(
    `UPDATE tone_settings
     SET description_text = $1, updated_at = now()
     WHERE name = 'default_voice'
       AND (
         description_text ILIKE '%Warm, clear%'
         OR description_text ILIKE '%Never robotic%'
         OR description_text ILIKE '%thoughtful person%'
       )`,
    [STARTER_TONE]
  );

  for (const rule of STARTER_GUARDRAILS) {
    await pool.query(
      `UPDATE guardrails SET rule_text = $1
       WHERE organization_id IS NULL AND category = $2
         AND (
           rule_text ILIKE '%Never %'
           OR rule_text ILIKE '%price%'
           OR rule_text ILIKE '%medical%'
           OR rule_text ILIKE '%verified%'
         )`,
      [rule.rule_text, rule.category]
    );
  }

  const orgs = await pool.query(
    `SELECT id FROM organizations WHERE slug IN ('wtb', 'what-the-business')`
  );
  for (const org of orgs.rows) {
    const organizationId = org.id as string;

    const englishGreetings = await pool.query(
      `SELECT 1 FROM opening_greetings
       WHERE organization_id = $1
         AND (greeting_text ILIKE 'Hi!%' OR greeting_text ILIKE 'Hey%' OR greeting_text ILIKE 'Welcome!%')
       LIMIT 1`,
      [organizationId]
    );
    const greetingCount = await pool.query(
      `SELECT count(*)::int AS n FROM opening_greetings WHERE organization_id = $1`,
      [organizationId]
    );
    if (englishGreetings.rows.length > 0 || greetingCount.rows[0].n === 0) {
      await pool.query(`DELETE FROM opening_greetings WHERE organization_id = $1`, [organizationId]);
      for (const greeting of STARTER_GREETINGS_FI) {
        await pool.query(
          `INSERT INTO opening_greetings (greeting_text, is_active, organization_id) VALUES ($1, true, $2)`,
          [greeting, organizationId]
        );
      }
    }

    const englishPhrases = await pool.query(
      `SELECT 1 FROM example_phrases
       WHERE organization_id = $1
         AND (
           phrase_text ILIKE '%I hear you%'
           OR phrase_text ILIKE '%Love the energy%'
           OR phrase_text ILIKE '%Understood.%'
           OR phrase_text ILIKE '%Exciting direction%'
         )
       LIMIT 1`,
      [organizationId]
    );
    const phraseCount = await pool.query(
      `SELECT count(*)::int AS n FROM example_phrases WHERE organization_id = $1`,
      [organizationId]
    );
    if (englishPhrases.rows.length > 0 || phraseCount.rows[0].n === 0) {
      await pool.query(`DELETE FROM example_phrases WHERE organization_id = $1`, [organizationId]);
      for (const phrase of STARTER_PHRASES_FI) {
        await pool.query(
          `INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
           VALUES ($1, $2, true, $3)`,
          [phrase.situation_type, phrase.phrase_text, organizationId]
        );
      }
    }

    await pool.query(
      `UPDATE coaches SET
         coach_name = CASE
           WHEN coach_name ILIKE '%John Doe%' THEN 'Juhani Virtanen'
           WHEN coach_name ILIKE 'Synthetic Coach A%' THEN 'Synteettinen valmentaja A'
           WHEN coach_name ILIKE 'Synthetic Coach B%' THEN 'Synteettinen valmentaja B'
           WHEN coach_name ILIKE 'Synthetic Coach C%' THEN 'Synteettinen valmentaja C'
           ELSE coach_name
         END,
         program_name = CASE
           WHEN program_name ILIKE '%Team Motivation%' THEN 'Tiimin motivaatiosprintti'
           WHEN program_name ILIKE '%Sustainable Pace%' THEN 'Kestävä tahti -ohjelma'
           WHEN program_name ILIKE '%Crisis Communication%' THEN 'Kriisiviestinnän bootcamp'
           WHEN program_name ILIKE '%Executive Growth%' THEN 'Johtajan kasvuparring'
           ELSE program_name
         END,
         short_description = CASE
           WHEN program_name ILIKE '%Team Motivation%' OR coach_name ILIKE '%John Doe%'
             THEN 'Neljän viikon hybridiohjelma, joka palauttaa energian ja sitoutumisen matalan motivaation jälkeen.'
           WHEN program_name ILIKE '%Sustainable Pace%'
             THEN 'Ohjelma, joka pureutuu ylikuormituksen juurisyihin ja rakentaa kestävän työrytmin.'
           ELSE short_description
         END,
         long_description = CASE
           WHEN program_name ILIKE '%Team Motivation%' OR coach_name ILIKE '%John Doe%'
             THEN 'Neljän viikon hybridiohjelma, joka on rakennettu palauttamaan tiimin energia ja sitoutuminen matalan moraalin jakson jälkeen.'
           WHEN program_name ILIKE '%Sustainable Pace%'
             THEN 'Viiden viikon ohjelma, jossa selvitetään ylikuormituksen syyt ja rakennetaan käytännön korjaus — lähi- tai hybriditoteutuksena.'
           ELSE long_description
         END,
         main_category = CASE
           WHEN program_name ILIKE '%Team Motivation%' OR coach_name ILIKE '%John Doe%' THEN 'Tiimikehitys'
           WHEN program_name ILIKE '%Sustainable Pace%' THEN 'Hyvinvointi ja jaksaminen'
           ELSE main_category
         END,
         languages = CASE
           WHEN program_name ILIKE '%Team Motivation%'
             OR program_name ILIKE '%Sustainable Pace%'
             OR coach_name ILIKE '%John Doe%'
             OR coach_name ILIKE 'Synthetic Coach%'
             THEN ARRAY['suomi', 'englanti']
           ELSE languages
         END,
         updated_at = now()
       WHERE organization_id = $1
         AND (
           coach_name ILIKE '%John Doe%'
           OR coach_name ILIKE 'Synthetic Coach%'
           OR program_name ILIKE '%Team Motivation%'
           OR program_name ILIKE '%Sustainable Pace%'
           OR program_name ILIKE '%Crisis Communication%'
           OR program_name ILIKE '%Executive Growth%'
         )`,
      [organizationId]
    );

    await pool.query(
      `UPDATE organizations SET reply_language = 'fi' WHERE id = $1 AND reply_language = 'sv'`,
      [organizationId]
    );
  }
}

async function seedSignInAccounts() {
  const pool = getPool();
  const passwordHash = await bcrypt.hash("Harbor123", 10);
  const admins = [
    ["admin@test.harbor", "Admin"],
    ["ada.admin@gptlab.dev", "Ada Admin"],
    ["ben.admin@gptlab.dev", "Ben Admin"],
    ["chi.admin@gptlab.dev", "Chi Admin"],
  ];
  for (const [email, name] of admins) {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role, organization_id)
       VALUES ($1, $2, $3, 'super_admin', NULL)
       ON CONFLICT (email) DO NOTHING`,
      [email, name, passwordHash]
    );
  }

  const org = await pool.query(
    `SELECT id FROM organizations
     WHERE lower(name) = 'wtb' OR slug IN ('wtb', 'what-the-business')
     ORDER BY created_at ASC
     LIMIT 1`
  );
  const organizationId = org.rows[0]?.id as string | undefined;
  if (!organizationId) return;

  const companyUsers = [
    ["company@test.harbor", "Company"],
    ["wtb.one@example.com", "WTB One"],
    ["wtb.two@example.com", "WTB Two"],
    ["wtb.three@example.com", "WTB Three"],
  ];
  for (const [email, name] of companyUsers) {
    await pool.query(
      `INSERT INTO users (organization_id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, 'org_admin')
       ON CONFLICT (email) DO NOTHING`,
      [organizationId, email, name, passwordHash]
    );
  }

  const coaches = [
    ["User", "user"],
    ["WTB Coach One", "coach.one"],
    ["WTB Coach Two", "coach.two"],
    ["WTB Coach Three", "coach.three"],
  ];
  for (const [name, username] of coaches) {
    const existing = await pool.query(`SELECT id FROM coach_accounts WHERE username = $1`, [username]);
    if (existing.rows.length > 0) continue;
    const coach = await pool.query(
      `INSERT INTO coaches (coach_name, organization_id, is_active, is_synthetic, short_description)
       VALUES ($1, $2, true, true, $3)
       RETURNING id`,
      [name, organizationId, "Sign-in profile for WTB."]
    );
    await pool.query(
      `INSERT INTO coach_accounts (coach_id, username, password_hash, must_change_password)
       VALUES ($1, $2, $3, false)`,
      [coach.rows[0].id, username, passwordHash]
    );
  }
}

export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = run().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

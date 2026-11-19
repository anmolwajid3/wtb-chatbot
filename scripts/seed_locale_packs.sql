-- Separate EN / FI visitor language packs for greetings + example phrases.
-- Fixes ?lang=en returning Finnish rows that were auto-tagged locale='en'.
--
-- Repo path: scripts/seed_locale_packs.sql
-- Apply in Supabase → SQL Editor (or: psql "$DATABASE_URL" -f scripts/seed_locale_packs.sql)

BEGIN;

ALTER TABLE opening_greetings ADD COLUMN IF NOT EXISTS locale TEXT;
ALTER TABLE example_phrases ADD COLUMN IF NOT EXISTS locale TEXT;

UPDATE opening_greetings SET locale = 'en' WHERE locale IS NULL OR btrim(locale) = '';
UPDATE example_phrases SET locale = 'en' WHERE locale IS NULL OR btrim(locale) = '';

ALTER TABLE opening_greetings ALTER COLUMN locale SET DEFAULT 'en';
ALTER TABLE example_phrases ALTER COLUMN locale SET DEFAULT 'en';
ALTER TABLE opening_greetings ALTER COLUMN locale SET NOT NULL;
ALTER TABLE example_phrases ALTER COLUMN locale SET NOT NULL;

-- Retag Finnish content that was wrongly stamped as English when the column was added.
UPDATE opening_greetings
SET locale = 'fi'
WHERE locale = 'en'
  AND (
    greeting_text ~ '[äöÄÖ]'
    OR greeting_text ~* '(^|[^[:alnum:]])(hei|kerro|valmentaja|tiimi|motivaatio|kuukauden|löytämään)([^[:alnum:]]|$)'
  );

UPDATE example_phrases
SET locale = 'fi'
WHERE locale = 'en'
  AND (
    phrase_text ~ '[äöÄÖ]'
    OR phrase_text ~* '(^|[^[:alnum:]])(hei|kerro|valmentaja|tiimi|motivaatio|kuukauden)([^[:alnum:]]|$)'
  );

-- Global (organization_id IS NULL) EN greetings — insert if missing.
INSERT INTO opening_greetings (greeting_text, is_active, organization_id, locale)
SELECT v.greeting_text, true, NULL, 'en'
FROM (
  VALUES
    ('Hi! Tell me a bit about what you''re looking for — a theme, a situation, a team size, whatever comes to mind — and I''ll help point you to the right fit.'),
    ('Hello — what kind of coaching or team situation are you hoping to improve?'),
    ('Welcome. Share a short note about the challenge or goal, and I''ll help find a good match.')
) AS v(greeting_text)
WHERE NOT EXISTS (
  SELECT 1 FROM opening_greetings g
  WHERE g.organization_id IS NULL AND g.locale = 'en' AND g.greeting_text = v.greeting_text
);

-- Global FI greetings
INSERT INTO opening_greetings (greeting_text, is_active, organization_id, locale)
SELECT v.greeting_text, true, NULL, 'fi'
FROM (
  VALUES
    ('Hei! Kerro vähän, mitä etsit — teema, tilanne, ryhmäkoko, mikä vain tulee mieleen — niin autan löytämään sopivan.'),
    ('Tervetuloa. Kerro lyhyesti haasteesta tai tavoitteesta, niin autan löytämään sopivan valmentajan.'),
    ('Moikka! Millaisessa tiimin tai johtamisen tilanteessa kaipaisit apua?')
) AS v(greeting_text)
WHERE NOT EXISTS (
  SELECT 1 FROM opening_greetings g
  WHERE g.organization_id IS NULL AND g.locale = 'fi' AND g.greeting_text = v.greeting_text
);

-- Swedish is no longer a visitor language.
UPDATE opening_greetings SET is_active = false WHERE locale = 'sv';

-- EN example phrases
INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id, locale)
SELECT v.situation_type, v.phrase_text, true, NULL, 'en'
FROM (
  VALUES
    ('positive', 'That sounds exciting — happy to help you find a strong fit.'),
    ('positive', 'Great energy. Let''s turn that into a concrete match.'),
    ('negative', 'I hear that this has been tough. We''ll take it one step at a time.'),
    ('negative', 'Thanks for sharing that — we can find someone who handles pressure like this.'),
    ('neutral', 'Got it. A couple of details will help me point you well.'),
    ('neutral', 'Thanks — I''ll keep this practical and clear.')
) AS v(situation_type, phrase_text)
WHERE NOT EXISTS (
  SELECT 1 FROM example_phrases p
  WHERE p.organization_id IS NULL AND p.locale = 'en'
    AND p.situation_type = v.situation_type AND p.phrase_text = v.phrase_text
);

-- FI example phrases
INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id, locale)
SELECT v.situation_type, v.phrase_text, true, NULL, 'fi'
FROM (
  VALUES
    ('positive', 'Kuulostaa hyvältä — autan mielelläni löytämään sopivan valmentajan.'),
    ('positive', 'Hienoa energiaa. Tehdään siitä konkreettinen osuma.'),
    ('negative', 'Kuulostaa raskaalta. Edetään rauhassa yksi askel kerrallaan.'),
    ('negative', 'Kiitos että kerroit — löydetään joku, joka osaa tukea juuri tällaisessa tilanteessa.'),
    ('neutral', 'Selvä. Pari lisätietoa auttaa ohjaamaan oikeaan suuntaan.'),
    ('neutral', 'Kiitos — pidän tämän käytännöllisenä ja selkeänä.')
) AS v(situation_type, phrase_text)
WHERE NOT EXISTS (
  SELECT 1 FROM example_phrases p
  WHERE p.organization_id IS NULL AND p.locale = 'fi'
    AND p.situation_type = v.situation_type AND p.phrase_text = v.phrase_text
);

UPDATE example_phrases SET is_active = false WHERE locale = 'sv';

COMMIT;

-- Sanity counts
SELECT 'greetings_by_locale' AS check, locale, count(*) AS n
FROM opening_greetings WHERE is_active GROUP BY locale ORDER BY locale;

SELECT 'phrases_by_locale' AS check, locale, situation_type, count(*) AS n
FROM example_phrases WHERE is_active GROUP BY locale, situation_type ORDER BY locale, situation_type;

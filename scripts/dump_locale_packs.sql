-- Dump locale-scoped visitor copy (run in Supabase SQL editor).
-- Path in repo: /agent/repos/wtb-chatbot/scripts/dump_locale_packs.sql
-- Local Mac clone: <your-repo>/scripts/dump_locale_packs.sql

SELECT 'opening_greetings' AS table_name;
SELECT id, locale, is_active, organization_id,
       left(greeting_text, 120) AS greeting_preview,
       created_at
FROM opening_greetings
ORDER BY locale, organization_id NULLS FIRST, created_at;

SELECT locale, count(*) AS n, count(*) FILTER (WHERE is_active) AS active_n
FROM opening_greetings
GROUP BY locale
ORDER BY locale;

SELECT 'example_phrases' AS table_name;
SELECT id, locale, situation_type, is_active, organization_id,
       left(phrase_text, 100) AS phrase_preview
FROM example_phrases
ORDER BY locale, situation_type, phrase_text;

SELECT locale, situation_type, count(*) AS n
FROM example_phrases
GROUP BY locale, situation_type
ORDER BY locale, situation_type;

-- Rows that look Finnish but are tagged English (the usual ?lang=en bug)
SELECT 'mis_tagged_fi_as_en_greetings' AS issue;
SELECT id, locale, left(greeting_text, 160) AS text
FROM opening_greetings
WHERE locale = 'en'
  AND (
    greeting_text ~ '[äöÄÖ]'
    OR greeting_text ~* '\m(hei|kerro|valmentaja|tiimi|motivaatio|kuukauden)\M'
  );

SELECT 'mis_tagged_fi_as_en_phrases' AS issue;
SELECT id, locale, situation_type, left(phrase_text, 160) AS text
FROM example_phrases
WHERE locale = 'en'
  AND (
    phrase_text ~ '[äöÄÖ]'
    OR phrase_text ~* '\m(hei|kerro|valmentaja|tiimi|motivaatio)\M'
  );

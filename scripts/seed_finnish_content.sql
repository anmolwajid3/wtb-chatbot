-- Migrate WTB demo content to Finnish (tone, greetings, phrases, synthetic coaches).
-- Safe to re-run. Targets organizations with slug wtb / what-the-business.

-- Tone
UPDATE tone_settings
SET description_text = 'Lämmin, selkeä ja ammattimainen. Kuulosta ajattelevalta ihmiseltä, joka auttaa löytämään sopivan valmentajan. Ei robottimainen, ei tyrkyttävä.',
    updated_at = now()
WHERE name = 'default_voice'
  AND (
    organization_id IS NULL
    OR organization_id IN (SELECT id FROM organizations WHERE slug IN ('wtb', 'what-the-business'))
  );

-- Guardrails (shared defaults)
UPDATE guardrails SET rule_text = 'Älä koskaan ilmoita, arvioi tai vihjaa tiettyä hintaa tai hintahaarukkaa.'
WHERE category = 'pricing' AND organization_id IS NULL
  AND rule_text ILIKE '%price%';
UPDATE guardrails SET rule_text = 'Älä koskaan anna lääketieteellistä tai oikeudellista neuvontaa.'
WHERE category = 'medical-legal' AND organization_id IS NULL
  AND (rule_text ILIKE '%medical%' OR rule_text ILIKE '%legal%');
UPDATE guardrails SET rule_text = 'Älä koskaan mainitse henkilöä, palvelua tai pätevyyttä, jota ei ole tämän keskustelun vahvistetuissa profiileissa.'
WHERE category = 'fabrication' AND organization_id IS NULL
  AND rule_text ILIKE '%verified%';

-- Greetings: replace org greetings with Finnish set
DELETE FROM opening_greetings
WHERE organization_id IN (SELECT id FROM organizations WHERE slug IN ('wtb', 'what-the-business'));

INSERT INTO opening_greetings (greeting_text, is_active, organization_id)
SELECT v.greeting, true, o.id
FROM organizations o
CROSS JOIN (
  VALUES
    ('Hei! Kerro vähän, mitä etsit — teema, tilanne, tiimin koko, mikä vaan — niin autan löytämään sopivan valmentajan.'),
    ('Terve! Olipa kyse tiimin haasteesta, tietystä tavoitteesta tai vasta raakileesta ideasta, autan löytämään siihen oikean valmentajan.'),
    ('Tervetuloa! Kerro tilanteestasi, isosta tai pienestä, niin ohjaan sinut valmentajan luo, joka sopii teille aidosti.')
) AS v(greeting)
WHERE o.slug IN ('wtb', 'what-the-business');

-- Example phrases
DELETE FROM example_phrases
WHERE organization_id IN (SELECT id FROM organizations WHERE slug IN ('wtb', 'what-the-business'));

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT v.mood, v.phrase, true, o.id
FROM organizations o
CROSS JOIN (
  VALUES
    ('negative', 'Kuulen sinua — väsynyt tiimi painaa, ja voimme etsiä siihen rauhallista tukea.'),
    ('negative', 'Kuulostaa uuvuttavalta. Otetaan tämä yksi selkeä askel kerrallaan.'),
    ('negative', 'Et ole tässä yksin; moni tiimi osuu matalan energian jaksoon.'),
    ('positive', 'Mahtavaa energiaa — kanavoidaan se oikeaan valmennusosuumaan.'),
    ('positive', 'Hieno suunta! Voidaan yhdistää tuo vauhti vahvaan ohjelmaan.'),
    ('positive', 'Hienoa, että olette valmiita panostamaan tiimiin — se avoimuus auttaa.'),
    ('neutral', 'Selvä. Pari käytännön yksityiskohtaa auttaa ohjaamaan oikein.'),
    ('neutral', 'Kuva on tähän asti selkeä. Seuraavaksi rajaan sopivat vaihtoehdot.'),
    ('neutral', 'Merkattu. Voidaan pitää tämä suoraviivaisena ja keskittyä sopivuuteen.')
) AS v(mood, phrase)
WHERE o.slug IN ('wtb', 'what-the-business');

-- Known demo coaches → Finnish content (match by English program / name)
UPDATE coaches SET
  coach_name = 'Mikko Häkkinen',
  program_name = 'Kestävä tahti -ohjelma',
  short_description = 'Ohjelma, joka pureutuu ylikuormituksen juurisyihin ja rakentaa kestävän työrytmin.',
  long_description = 'Viiden viikon ohjelma, jossa selvitetään, mikä ajaa ylikuormitusta, ja rakennetaan käytännön korjaus — lähi- tai hybriditoteutuksena.',
  main_category = 'Hyvinvointi ja jaksaminen',
  delivery_format = 'Lähi tai hybrid',
  duration = '5 viikkoa',
  languages = ARRAY['suomi', 'englanti'],
  updated_at = now()
WHERE is_synthetic = true
  AND (
    program_name ILIKE '%Sustainable Pace%'
    OR coach_name ILIKE '%Mikko Häkkinen%'
  );

UPDATE coaches SET
  coach_name = 'Juhani Virtanen',
  program_name = 'Tiimin motivaatiosprintti',
  short_description = 'Neljän viikon hybridiohjelma, joka palauttaa energian ja sitoutumisen matalan motivaation jälkeen.',
  long_description = 'Neljän viikon hybridiohjelma, joka on rakennettu palauttamaan tiimin energia ja sitoutuminen matalan moraalin jakson jälkeen. Sopii hyvin keskisuurille tiimeille.',
  main_category = 'Tiimikehitys',
  delivery_format = 'Hybrid',
  duration = '4 viikkoa',
  languages = ARRAY['suomi', 'englanti'],
  updated_at = now()
WHERE is_synthetic = true
  AND (
    program_name ILIKE '%Team Motivation Sprint%'
    OR coach_name ILIKE '%John Doe%'
    OR coach_name ILIKE '%Synthetic Coach A%'
  );

UPDATE coaches SET
  program_name = 'Kriisiviestinnän bootcamp',
  short_description = 'Nopea, käytännönläheinen kriisiviestintäkoulutus johtoryhmille.',
  long_description = 'Kahden päivän intensiivikoulutus: kriisiviestit, media ja sisäinen viestintä paineen alla.',
  main_category = 'Viestintä',
  delivery_format = 'Lähi',
  duration = '2 päivää',
  languages = ARRAY['suomi', 'englanti'],
  updated_at = now()
WHERE is_synthetic = true
  AND (
    program_name ILIKE '%Crisis Communication%'
    OR coach_name ILIKE '%Synthetic Coach B%'
  );

UPDATE coaches SET
  program_name = 'Johtajan kasvuparring',
  short_description = 'Henkilökohtainen strateginen sparraus toimitusjohtajille ja perustajille kasvuvaiheessa.',
  long_description = 'Kuukausittaiset 1:1-tapaamiset kasvun, markkinamuutoksen tai johtajuussiirtymän tueksi.',
  main_category = 'Liiketoiminta ja johtaminen',
  delivery_format = 'Etä',
  duration = 'Jatkuva, kuukausittain',
  languages = ARRAY['suomi', 'englanti'],
  updated_at = now()
WHERE is_synthetic = true
  AND (
    program_name ILIKE '%Executive Growth%'
    OR coach_name ILIKE '%Synthetic Coach C%'
  );

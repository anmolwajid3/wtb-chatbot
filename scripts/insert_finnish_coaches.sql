-- Insert five coaches with every profile field filled, in Finnish.
-- Safe to run again: a name that already exists is left as it is.
-- Run: psql "$DATABASE_URL" -f scripts/insert_finnish_coaches.sql

WITH org AS (
  SELECT id
  FROM organizations
  WHERE slug IN ('wtb', 'what-the-business') OR lower(name) = 'wtb'
  ORDER BY created_at
  LIMIT 1
)
INSERT INTO coaches (
  is_active, is_synthetic, coach_name, company_name, business_id, email, phone,
  website_or_linkedin, operating_area, program_name, short_description, long_description,
  target_group, suited_situations, key_themes, participant_activities, methods,
  delivery_format, individual_or_group, group_size_min, group_size_max, duration,
  program_structure, goals, impact_measurement, change_achieved, price_from, pricing_model,
  price_includes, additional_services, references_text, results_feedback, certifications,
  keywords, main_category, subcategories, image_urls, video_url, material_urls,
  additional_info, availability, languages, organization_id, custom_fields
)
SELECT
  v.is_active, v.is_synthetic, v.coach_name, v.company_name, v.business_id, v.email, v.phone,
  v.website_or_linkedin, v.operating_area, v.program_name, v.short_description, v.long_description,
  v.target_group, v.suited_situations, v.key_themes, v.participant_activities, v.methods,
  v.delivery_format, v.individual_or_group, v.group_size_min, v.group_size_max, v.duration,
  v.program_structure, v.goals, v.impact_measurement, v.change_achieved, v.price_from, v.pricing_model,
  v.price_includes, v.additional_services, v.references_text, v.results_feedback, v.certifications,
  v.keywords, v.main_category, v.subcategories, v.image_urls, v.video_url, v.material_urls,
  v.additional_info, v.availability, v.languages, org.id, v.custom_fields
FROM org
CROSS JOIN (
  VALUES
  (
    true, false, 'Aino Korhonen', 'Pohjola Valmennus Oy', '1234567-1', 'aino.korhonen@example.com', '+358401112201',
    'https://opas-admin.fly.dev', 'Helsinki ja etä koko Suomi', 'Tiimin motivaation palautus',
    'Kuuden viikon ohjelma, joka palauttaa tiimin energian matalan motivaation jälkeen.',
    'Kuuden viikon hybridi, jossa työpajat ja esihenkilösparraus palauttavat suunnan, kun tiimi on menettänyt motivaationsa.',
    'Esihenkilöt ja 6–16 hengen tiimit', ARRAY['matala motivaatio', 'uupumus muutoksen jälkeen'],
    ARRAY['motivaatio', 'tiimi', 'sitoutuminen'], 'Tiimi nimeää esteet ja sopii viikoittaiset kokeilut.',
    ARRAY['työpajat', 'sparraus'], 'Hybridi', 'Ryhmä', 6, 16, '6 viikkoa',
    'Aloitus, neljä työpajaa ja päätös.', 'Motivaatio ja selkeä rytmi palautuvat.',
    'Alkukysely ja loppukysely.', 'Tiimi puhuu taas tavoitteista.',
    '4 800 euroa + alv', 'Kiinteä paketti', 'Työpajat ja materiaalit.', 'Lisäsparraus esihenkilölle.',
    'Kaksi suomalaista asiantuntijayritystä.', 'Osallistujat kuvaavat energian paluun.', 'ICF-sertifikaatti.',
    ARRAY['motivaatio', 'tiimi'], 'Tiimikehitys', ARRAY['motivaatio', 'esihenkilötyö'],
    ARRAY['https://opas-widget.fly.dev/opas.png'], 'https://opas-widget.fly.dev', ARRAY['https://opas-admin.fly.dev'],
    'Sopii suomeksi tai englanniksi.', 'Vapaa seuraavan kuukauden alussa.', ARRAY['suomi', 'englanti'],
    '{"kieli":"suomi"}'::jsonb
  ),
  (
    true, false, 'Eero Laine', 'Selkeä Suunta Oy', '2345678-2', 'eero.laine@example.com', '+358401112202',
    'https://opas-admin.fly.dev', 'Tampere ja etä', 'Esihenkilön ensiaskeleet',
    'Viiden viikon ohjelma uudelle esihenkilölle, joka tarvitsee rakenteen.',
    'Viisi viikkoa käytännön johtamista: odotukset, palautekeskustelut ja tiimin rytmi.',
    'Uudet esihenkilöt', ARRAY['ensimmäinen esihenkilörooli', 'epäselvät odotukset'],
    ARRAY['johtaminen', 'esihenkilö', 'palaute'], 'Osallistuja harjoittelee yhden palautekeskustelun viikossa.',
    ARRAY['1:1-sparraus', 'harjoitukset'], 'Etä', 'Yksilö', 1, 1, '5 viikkoa',
    'Aloitus ja viisi tapaamista.', 'Esihenkilö johtaa selkein odotuksin.',
    'Itsearviointi alussa ja lopussa.', 'Keskustelut tiimin kanssa muuttuvat säännöllisiksi.',
    '2 200 euroa + alv', 'Kiinteä paketti', 'Tapaamiset ja tehtävät.', 'Lisätapaaminen.',
    'Teollisuuden tiiminvetäjiä.', 'Osallistujat kertovat varmuuden kasvaneen.', 'Johtamisen erikoisammattitutkinto.',
    ARRAY['johtaminen', 'esihenkilö'], 'Johtaminen', ARRAY['uusi esihenkilö'],
    ARRAY['https://opas-widget.fly.dev/opas.png'], 'https://opas-widget.fly.dev', ARRAY['https://opas-admin.fly.dev'],
    'Yksilövalmennus etänä.', 'Vapaa kahden viikon päästä.', ARRAY['suomi'],
    '{"kieli":"suomi"}'::jsonb
  ),
  (
    true, false, 'Helmi Nieminen', 'Rauhallinen Tahti Oy', '3456789-3', 'helmi.nieminen@example.com', '+358401112203',
    'https://opas-admin.fly.dev', 'Turku, Helsinki ja etä', 'Kestävä työtahti',
    'Neljän viikon ohjelma tiimille, jonka kuorma on kasvanut liian suureksi.',
    'Neljä viikkoa, joiden aikana tiimi rajaa työn, sopii tauot ja palauttaa kestävän rytmin.',
    'Asiantuntijatiimit', ARRAY['ylikuormitus', 'katkonainen työ'],
    ARRAY['jaksaminen', 'työtahti', 'kuormitus'], 'Tiimi kokeilee yhtä rajauskeinoa joka viikko.',
    ARRAY['työpaja', 'pulssikysely'], 'Hybridi', 'Ryhmä', 5, 14, '4 viikkoa',
    'Kolme työpajaa ja päätös.', 'Kuorma laskee ja prioriteetit selkeytyvät.',
    'Kuormituskysely alussa ja lopussa.', 'Ylityöt vähenevät sovitusti.',
    '3 600 euroa + alv', 'Kiinteä paketti', 'Työpajat ja kysely.', 'Esihenkilön lisäsparraus.',
    'Julkisen sektorin tiimejä.', 'Tiimit raportoivat selkeämmän viikon.', 'Työhyvinvoinnin valmentaja.',
    ARRAY['jaksaminen', 'työtahti'], 'Hyvinvointi', ARRAY['kuormitus'],
    ARRAY['https://opas-widget.fly.dev/opas.png'], 'https://opas-widget.fly.dev', ARRAY['https://opas-admin.fly.dev'],
    'Sopii lähityöhön tai hybridiin.', 'Vapaa ensi kuussa.', ARRAY['suomi'],
    '{"kieli":"suomi"}'::jsonb
  ),
  (
    true, false, 'Onni Virtanen', 'Kasvuaskel Oy', '4567890-4', 'onni.virtanen@example.com', '+358401112204',
    'https://opas-admin.fly.dev', 'Oulu ja etä', 'Myynnin yhteinen suunta',
    'Kuuden viikon ohjelma myyntitiimille, jonka putki on hidastunut.',
    'Kuusi viikkoa yhteisiä harjoituksia: asiakaskohtaamiset, seuranta ja tiimin viikkorytmi.',
    'Myyntitiimit', ARRAY['hidastunut myynti', 'epäselvä seuranta'],
    ARRAY['myynti', 'asiakastyö', 'tiimi'], 'Jokainen harjoittelee yhden asiakaskeskustelun ja purkaa sen tiimissä.',
    ARRAY['harjoitukset', 'viikkopalaveri'], 'Lähi', 'Ryhmä', 4, 12, '6 viikkoa',
    'Aloitus, neljä harjoitusta ja päätös.', 'Putki ja seuranta ovat taas yhteisessä käytössä.',
    'Putken lähtöluku ja loppuluenta.', 'Tiimi pitää sovitun seurantarutiinin.',
    '5 400 euroa + alv', 'Kiinteä paketti', 'Työpajat paikan päällä.', 'Esihenkilön tunti.',
    'B2B-myyntitiimejä.', 'Osallistujat kuvaavat selkeämpää viikkoa.', 'Myynnin valmentaja.',
    ARRAY['myynti', 'tiimi'], 'Myynti', ARRAY['asiakastyö'],
    ARRAY['https://opas-widget.fly.dev/opas.png'], 'https://opas-widget.fly.dev', ARRAY['https://opas-admin.fly.dev'],
    'Toteutus suomeksi läsnä.', 'Vapaa kolmen viikon päästä.', ARRAY['suomi'],
    '{"kieli":"suomi"}'::jsonb
  ),
  (
    true, false, 'Salla Mäkinen', 'Viesti Haltuun Oy', '5678901-5', 'salla.makinen@example.com', '+358401112205',
    'https://opas-admin.fly.dev', 'Pääkaupunkiseutu', 'Kriisiviestin harjoitus',
    'Kahden päivän harjoitus johtoryhmälle, joka tarvitsee selkeän viestin paineessa.',
    'Kaksi lähipäivää: sisäinen viesti, ulkoinen viesti ja rooliharjoitus johdolle.',
    'Johtoryhmät', ARRAY['kriisiviestintä', 'epäselvä vastuunjako'],
    ARRAY['viestintä', 'kriisi', 'johtaminen'], 'Ryhmä kirjoittaa yhden sisäisen ja yhden ulkoisen viestin.',
    ARRAY['simulaatio', 'rooliharjoitus'], 'Lähi', 'Ryhmä', 3, 8, '2 päivää',
    'Kaksi peräkkäistä päivää.', 'Johto tietää kuka viestii ja mitä.',
    'Harjoituksen jälkeinen purku.', 'Viestipohja on valmis seuraavaan tilanteeseen.',
    '3 200 euroa + alv', 'Kiinteä paketti', 'Kaksi päivää ja materiaalit.', 'Seurantapuhelu.',
    'Järjestön johtoryhmiä.', 'Osallistujat pitävät pohjaa käytössään.', 'Viestinnän valmentaja.',
    ARRAY['viestintä', 'kriisi'], 'Viestintä', ARRAY['kriisi'],
    ARRAY['https://opas-widget.fly.dev/opas.png'], 'https://opas-widget.fly.dev', ARRAY['https://opas-admin.fly.dev'],
    'Vain läsnäolo, suomeksi.', 'Vapaa ensi viikolla.', ARRAY['suomi'],
    '{"kieli":"suomi"}'::jsonb
  )
) AS v(
  is_active, is_synthetic, coach_name, company_name, business_id, email, phone,
  website_or_linkedin, operating_area, program_name, short_description, long_description,
  target_group, suited_situations, key_themes, participant_activities, methods,
  delivery_format, individual_or_group, group_size_min, group_size_max, duration,
  program_structure, goals, impact_measurement, change_achieved, price_from, pricing_model,
  price_includes, additional_services, references_text, results_feedback, certifications,
  keywords, main_category, subcategories, image_urls, video_url, material_urls,
  additional_info, availability, languages, custom_fields
)
WHERE NOT EXISTS (
  SELECT 1 FROM coaches c WHERE c.coach_name = v.coach_name AND c.program_name = v.program_name
);

-- Synthetic coach profiles (Finnish content — primary language for WTB)

INSERT INTO coaches (
    is_active, is_synthetic, coach_name, company_name, program_name, short_description,
    long_description, target_group, suited_situations, key_themes, methods,
    delivery_format, individual_or_group, group_size_min, group_size_max, duration,
    price_from, pricing_model, main_category, keywords, languages
) VALUES
(
    true, true, 'Synteettinen valmentaja A', 'Testikumppani Oy', 'Tiimin motivaatiosprintti',
    'Lyhyt, energisoiva ohjelma tiimin motivaation palautattamiseen.',
    'Neljän viikon ohjelma, jossa yhdistyvät työpajat ja esihenkilövalmennus. Tavoitteena on palauttaa tiimin energia ja sitoutuminen matalan motivaation jakson jälkeen.',
    'Keskisuuret tiimit (5–20 hlö), tiiminvetäjät ja HR', ARRAY['matala motivaatio', 'tiimin motivointi', 'uudelleenrakentaminen muutoksen jälkeen'],
    ARRAY['motivaatio', 'tiimidynamiikka', 'sitoutuminen'], ARRAY['työpajat', 'tiimivalmennus', 'pulssikyselyt'],
    'Hybrid', 'Ryhmä', 5, 20, '4 viikkoa',
    '2 000 € + ALV', 'Kiinteä pakettihinta', 'Tiimikehitys',
    ARRAY['motivaatio', 'tiimin rakentaminen', 'sitoutuminen'], ARRAY['suomi', 'englanti']
),
(
    true, true, 'Synteettinen valmentaja B', 'Kriisiapu Consulting', 'Kriisiviestinnän bootcamp',
    'Nopea, käytännönläheinen kriisiviestintäkoulutus johtoryhmille.',
    'Kahden päivän intensiivikoulutus: kriisiviestit, media ja sisäinen viestintä paineen alla.',
    'Johtoryhmät, viestintähenkilöstö', ARRAY['kriisiviestintä', 'PR-hätätilanne', 'maineen riski'],
    ARRAY['kriisinhallinta', 'viestintä', 'mediavalmennus'], ARRAY['simulaatiot', 'rooliharjoitukset', 'case-analyysi'],
    'Lähi', 'Ryhmä', 2, 10, '2 päivää',
    '3 500 € + ALV', 'Kiinteä pakettihinta', 'Viestintä',
    ARRAY['kriisi', 'viestintä', 'PR'], ARRAY['suomi', 'englanti']
),
(
    true, true, 'Synteettinen valmentaja C', 'Kasvupolku Oy', 'Johtajan kasvuparring',
    'Henkilökohtainen strateginen sparraus toimitusjohtajille ja perustajille kasvuvaiheessa.',
    'Kuukausittaiset 1:1-tapaamiset kasvun, markkinamuutoksen tai johtajuussiirtymän tueksi — strategista sparrausta ja vastuullistamista.',
    'PK-yritysten toimitusjohtajat ja perustajat (liikevaihto 1–20 M€)', ARRAY['kasvun haasteet', 'johtajuussiirtymä', 'perustajan uupumus'],
    ARRAY['strategia', 'johtajavalmennus', 'kasvujohtaminen'], ARRAY['1:1-sparraus', 'tavoitteiden seuranta'],
    'Etä', 'Yksilö', 1, 1, 'Jatkuva, kuukausittain',
    '180 €/h + ALV', 'Tuntiveloitus', 'Liiketoiminta ja johtaminen',
    ARRAY['strategia', 'johtajavalmennus', 'kasvu'], ARRAY['suomi', 'englanti']
),
(
    false, true, 'Synteettinen valmentaja D (ei aktiivinen)', 'Testikumppani Oy', 'Vanha ohjelma (poistettu käytöstä)',
    'Tämä profiili on tarkoituksella pois käytöstä eikä saa näkyä suosituksissa.',
    'Käytetään varmistamaan, että epäaktiiviset valmentajat jäävät pois osumista.',
    'Ei käytössä', ARRAY['ei käytössä'], ARRAY['ei käytössä'], ARRAY['ei käytössä'],
    'Etä', 'Yksilö', 1, 1, 'Ei käytössä',
    '999 € + ALV', 'Ei käytössä', 'Testaus',
    ARRAY['pois käytöstä', 'testi'], ARRAY['suomi']
);

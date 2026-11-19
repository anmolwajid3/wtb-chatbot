-- Esimerkkifraasit (suomi). Suorita Supabase SQL -editorissa.

DELETE FROM example_phrases
WHERE organization_id IN (
  SELECT id FROM organizations WHERE slug IN ('what-the-business', 'wtb')
);

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'negative', $$Kuulen sinua — väsynyt tiimi painaa, ja voimme etsiä siihen rauhallista tukea.$$, true, id
FROM organizations WHERE slug IN ('what-the-business', 'wtb');

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'negative', $$Kuulostaa uuvuttavalta. Otetaan tämä yksi selkeä askel kerrallaan.$$, true, id
FROM organizations WHERE slug IN ('what-the-business', 'wtb');

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'negative', $$Et ole tässä yksin; moni tiimi osuu matalan energian jaksoon.$$, true, id
FROM organizations WHERE slug IN ('what-the-business', 'wtb');

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'positive', $$Mahtavaa energiaa — kanavoidaan se oikeaan valmennusosuumaan.$$, true, id
FROM organizations WHERE slug IN ('what-the-business', 'wtb');

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'positive', $$Hieno suunta! Voidaan yhdistää tuo vauhti vahvaan ohjelmaan.$$, true, id
FROM organizations WHERE slug IN ('what-the-business', 'wtb');

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'positive', $$Hienoa, että olette valmiita panostamaan tiimiin — se avoimuus auttaa.$$, true, id
FROM organizations WHERE slug IN ('what-the-business', 'wtb');

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'neutral', $$Selvä. Pari käytännön yksityiskohtaa auttaa ohjaamaan oikein.$$, true, id
FROM organizations WHERE slug IN ('what-the-business', 'wtb');

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'neutral', $$Kuva on tähän asti selkeä. Seuraavaksi rajaan sopivat vaihtoehdot.$$, true, id
FROM organizations WHERE slug IN ('what-the-business', 'wtb');

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'neutral', $$Merkattu. Voidaan pitää tämä suoraviivaisena ja keskittyä sopivuuteen.$$, true, id
FROM organizations WHERE slug IN ('what-the-business', 'wtb');

SELECT situation_type, phrase_text
FROM example_phrases
WHERE organization_id IN (SELECT id FROM organizations WHERE slug IN ('what-the-business', 'wtb'))
ORDER BY situation_type, phrase_text;

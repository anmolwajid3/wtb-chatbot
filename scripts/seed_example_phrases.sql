-- Example phrases for what-the-business (positive / negative / neutral).
-- Run in Supabase SQL editor. Clean natural lines only — no test markers.

DELETE FROM example_phrases
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'what-the-business');

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'negative', $$I hear you - carrying a tired team is heavy, and we can find steady support.$$, true, id
FROM organizations WHERE slug = 'what-the-business';

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'negative', $$That sounds draining. Let's take this one clear step at a time.$$, true, id
FROM organizations WHERE slug = 'what-the-business';

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'negative', $$You're not alone in this; many teams hit a low-energy stretch like this.$$, true, id
FROM organizations WHERE slug = 'what-the-business';

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'positive', $$Love the energy - let's channel that into the right coaching fit.$$, true, id
FROM organizations WHERE slug = 'what-the-business';

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'positive', $$Exciting direction! We can match that momentum to a strong program.$$, true, id
FROM organizations WHERE slug = 'what-the-business';

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'positive', $$Great to hear you're ready to invest in the team - that openness helps a lot.$$, true, id
FROM organizations WHERE slug = 'what-the-business';

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'neutral', $$Understood. A couple of practical details will help me point you well.$$, true, id
FROM organizations WHERE slug = 'what-the-business';

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'neutral', $$Clear picture so far. Next I'll narrow the options that fit.$$, true, id
FROM organizations WHERE slug = 'what-the-business';

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT 'neutral', $$Noted. We can keep this straightforward and focused on fit.$$, true, id
FROM organizations WHERE slug = 'what-the-business';

SELECT situation_type, phrase_text
FROM example_phrases
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'what-the-business')
ORDER BY situation_type, phrase_text;

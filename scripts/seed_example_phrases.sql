-- Example phrases for what-the-business (positive / negative / neutral).
-- Run in Supabase SQL editor.
-- The PHRASE_* markers let the E2E script verify the right phrases were loaded.
-- The bot uses them as tone guidance — it should not copy them verbatim every time.

-- Clear previous WTB test phrases (safe: only rows that carry our markers)
DELETE FROM example_phrases
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'what-the-business')
  AND phrase_text LIKE 'PHRASE_%';

INSERT INTO example_phrases (situation_type, phrase_text, is_active, organization_id)
SELECT v.situation_type, v.phrase_text, true, o.id
FROM organizations o
CROSS JOIN (
  VALUES
    -- NEGATIVE: empathy without dwelling
    ('negative', 'PHRASE_NEG_A: I hear you — carrying a tired team is heavy, and we can find steady support.'),
    ('negative', 'PHRASE_NEG_B: That sounds draining. Let''s take this one clear step at a time.'),
    ('negative', 'PHRASE_NEG_C: You''re not alone in this; many teams hit a low-energy stretch like this.'),

    -- POSITIVE: warm enthusiasm
    ('positive', 'PHRASE_POS_A: Love the energy — let''s channel that into the right coaching fit.'),
    ('positive', 'PHRASE_POS_B: Exciting direction! We can match that momentum to a strong program.'),
    ('positive', 'PHRASE_POS_C: Great to hear you''re ready to invest in the team — that openness helps a lot.'),

    -- NEUTRAL: clear and matter-of-fact
    ('neutral', 'PHRASE_NEU_A: Understood. A couple of practical details will help me point you well.'),
    ('neutral', 'PHRASE_NEU_B: Clear picture so far. Next I''ll narrow the options that fit.'),
    ('neutral', 'PHRASE_NEU_C: Noted. We can keep this straightforward and focused on fit.')
) AS v(situation_type, phrase_text)
WHERE o.slug = 'what-the-business';

-- Sanity check
SELECT situation_type, phrase_text
FROM example_phrases
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'what-the-business')
  AND phrase_text LIKE 'PHRASE_%'
ORDER BY situation_type, phrase_text;

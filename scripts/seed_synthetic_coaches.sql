-- Synthetic coach profiles for testing (per the brief's Section 6/9 requirement
-- to test grounding against a controlled, known-answer dataset)

INSERT INTO coaches (
    is_active, is_synthetic, coach_name, company_name, program_name, short_description,
    long_description, target_group, suited_situations, key_themes, methods,
    delivery_format, individual_or_group, group_size_min, group_size_max, duration,
    price_from, pricing_model, main_category, keywords, languages
) VALUES
(
    true, true, 'Synthetic Coach A', 'Testikumppani Oy', 'Team Motivation Sprint',
    'A short, energizing program to re-motivate a flagging team.',
    'A 4-week program combining group workshops and manager coaching to rebuild team energy and engagement after a period of low morale.',
    'Mid-size teams (5-20 people), team leads and HR', ARRAY['low morale', 'team motivation', 'post-restructuring team rebuilding'],
    ARRAY['motivation', 'team dynamics', 'engagement'], ARRAY['workshops', 'team coaching', 'pulse surveys'],
    'Hybrid', 'Group', 5, 20, '4 weeks',
    '€2,000 + VAT', 'Fixed package price', 'Team development',
    ARRAY['motivation', 'team building', 'engagement'], ARRAY['Finnish', 'English']
),
(
    true, true, 'Synthetic Coach B', 'Kriisiapu Consulting', 'Crisis Communication Bootcamp',
    'Fast, practical crisis-communication training for leadership teams facing an active or recent crisis.',
    'An intensive 2-day bootcamp covering crisis messaging, media handling, and internal communication during high-pressure situations.',
    'Leadership teams, communications staff', ARRAY['crisis communication', 'PR emergency', 'reputational risk'],
    ARRAY['crisis management', 'communication', 'media training'], ARRAY['simulations', 'role play', 'case study review'],
    'In-person', 'Group', 2, 10, '2 days',
    '€3,500 + VAT', 'Fixed package price', 'Communications',
    ARRAY['crisis', 'communication', 'PR'], ARRAY['Finnish', 'English']
),
(
    true, true, 'Synthetic Coach C', 'Kasvupolku Oy', 'Executive Growth Sparring',
    'One-on-one strategic sparring for CEOs and founders navigating a growth transition.',
    'Ongoing monthly one-on-one sessions for CEOs facing a scaling challenge, market shift, or leadership transition, combining strategic sparring with accountability check-ins.',
    'CEOs and founders of SMEs (€1-20M revenue)', ARRAY['scaling challenges', 'leadership transition', 'founder burnout'],
    ARRAY['strategy', 'executive coaching', 'growth leadership'], ARRAY['1:1 sparring', 'goal tracking'],
    'Remote', 'Individual', 1, 1, 'Ongoing, monthly',
    '€180/h + VAT', 'Hourly billing', 'Business and leadership',
    ARRAY['strategy', 'executive coaching', 'growth'], ARRAY['Finnish', 'English']
),
(
    false, true, 'Synthetic Coach D (inactive — for testing deactivation)', 'Testikumppani Oy', 'Legacy Program (Deactivated)',
    'This profile is intentionally deactivated and should never appear in bot recommendations.',
    'Used to verify that inactive coaches are correctly excluded from matching.',
    'N/A', ARRAY['N/A'], ARRAY['N/A'], ARRAY['N/A'],
    'Remote', 'Individual', 1, 1, 'N/A',
    '€999 + VAT', 'N/A', 'Testing',
    ARRAY['deactivated', 'test'], ARRAY['Finnish']
);

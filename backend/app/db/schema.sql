-- WTB Chatbot MVP — Database Schema
-- Run this in Supabase SQL Editor, or via: psql "$DATABASE_URL" -f schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- provides gen_random_uuid()

CREATE TABLE IF NOT EXISTS coaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_active BOOLEAN DEFAULT true,
    is_synthetic BOOLEAN DEFAULT false,

    -- Basic info
    coach_name TEXT NOT NULL,
    company_name TEXT,
    business_id TEXT,
    email TEXT,
    phone TEXT,
    website_or_linkedin TEXT,
    operating_area TEXT,

    -- Service basic info
    program_name TEXT,
    short_description TEXT,
    long_description TEXT,

    -- Target group & situation
    target_group TEXT,
    suited_situations TEXT[],

    -- Content & themes
    key_themes TEXT[],
    participant_activities TEXT,
    methods TEXT[],

    -- Delivery model
    delivery_format TEXT,
    individual_or_group TEXT,
    group_size_min INT,
    group_size_max INT,
    duration TEXT,
    program_structure TEXT,

    -- Goals & outcomes
    goals TEXT,
    impact_measurement TEXT,
    change_achieved TEXT,

    -- Pricing & sales (INTERNAL ONLY — never passed to the customer-facing formatter agent)
    price_from TEXT,
    pricing_model TEXT,
    price_includes TEXT,
    additional_services TEXT,

    -- References & track record
    references_text TEXT,
    results_feedback TEXT,
    certifications TEXT,

    -- Keywords & classification
    keywords TEXT[],
    main_category TEXT,
    subcategories TEXT[],

    -- Media & materials
    image_urls TEXT[],
    video_url TEXT,
    material_urls TEXT[],

    -- Additional info
    additional_info TEXT,
    availability TEXT,
    languages TEXT[],

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tone_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description_text TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS example_phrases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    situation_type TEXT NOT NULL CHECK (situation_type IN ('positive', 'negative', 'neutral')),
    phrase_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS guardrails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_text TEXT NOT NULL,
    category TEXT CHECK (category IN ('pricing', 'medical-legal', 'fabrication', 'other')),
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ DEFAULT now(),
    transcript_json JSONB DEFAULT '[]'::jsonb,
    outcome TEXT CHECK (outcome IN ('in_progress', 'matched', 'purchase_order', 'spam', 'abandoned')) DEFAULT 'in_progress',
    matched_coach_ids UUID[],
    mood_history JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS quote_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    summary_text TEXT,
    contact_info TEXT,
    is_purchase_order BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default tone setting and starter guardrails so the system is usable immediately
INSERT INTO tone_settings (name, description_text)
VALUES ('default_voice', 'Warm, professional, empathetic coaching-industry tone. Reflects a consultative, human style — never robotic, never pushy.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO guardrails (rule_text, category) VALUES
('Never state, estimate, or imply a specific price or price range to the customer.', 'pricing'),
('Never give medical or legal advice.', 'medical-legal'),
('Never mention, describe, or imply the existence of a coach, service, or credential that is not present in the verified coach data provided for this conversation.', 'fabrication')
ON CONFLICT DO NOTHING;

-- Comprehensive Schema Update Script
-- This script checks for EVERY column and adds it if missing.
-- Run this in the Supabase SQL Editor.

DO $$
BEGIN
    -- Vertical 1: Engajamento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'checkin') THEN
        ALTER TABLE health_inputs ADD COLUMN checkin TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'whatsapp') THEN
        ALTER TABLE health_inputs ADD COLUMN whatsapp TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'adimplencia') THEN
        ALTER TABLE health_inputs ADD COLUMN adimplencia TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'recarga') THEN
        ALTER TABLE health_inputs ADD COLUMN recarga TEXT;
    END IF;

    -- Vertical 2: Resultados
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'roi_bucket') THEN
        ALTER TABLE health_inputs ADD COLUMN roi_bucket TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'growth') THEN
        ALTER TABLE health_inputs ADD COLUMN growth TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'engagement_vs_avg') THEN
        ALTER TABLE health_inputs ADD COLUMN engagement_vs_avg TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'results_focus') THEN
        ALTER TABLE health_inputs ADD COLUMN results_focus TEXT DEFAULT 'both';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'social_profile') THEN
        ALTER TABLE health_inputs ADD COLUMN social_profile TEXT;
    END IF;

    -- Vertical 3: Relacionamento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'checkin_produtivo') THEN
        ALTER TABLE health_inputs ADD COLUMN checkin_produtivo TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'progresso') THEN
        ALTER TABLE health_inputs ADD COLUMN progresso TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'relacionamento_interno') THEN
        ALTER TABLE health_inputs ADD COLUMN relacionamento_interno TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'aviso_previo') THEN
        ALTER TABLE health_inputs ADD COLUMN aviso_previo TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'pesquisa_respondida') THEN
        ALTER TABLE health_inputs ADD COLUMN pesquisa_respondida TEXT;
    END IF;

    -- Vertical 4: Pesquisas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'csat_tecnico') THEN
        ALTER TABLE health_inputs ADD COLUMN csat_tecnico TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'nps') THEN
        ALTER TABLE health_inputs ADD COLUMN nps TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'mhs') THEN
        ALTER TABLE health_inputs ADD COLUMN mhs TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'pesquisa_geral_respondida') THEN
        ALTER TABLE health_inputs ADD COLUMN pesquisa_geral_respondida TEXT;
    END IF;

    -- Metadata & Timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'updated_at') THEN
        ALTER TABLE health_inputs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'last_updated') THEN
        ALTER TABLE health_inputs ADD COLUMN last_updated TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'last_updated_engagement') THEN
        ALTER TABLE health_inputs ADD COLUMN last_updated_engagement TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'last_updated_results') THEN
        ALTER TABLE health_inputs ADD COLUMN last_updated_results TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'last_updated_relationship') THEN
        ALTER TABLE health_inputs ADD COLUMN last_updated_relationship TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'last_updated_surveys') THEN
        ALTER TABLE health_inputs ADD COLUMN last_updated_surveys TIMESTAMP WITH TIME ZONE;
    END IF;

END $$;

-- Refresh Schema Cache (Supabase specific hint)
NOTIFY pgrst, 'reload schema';

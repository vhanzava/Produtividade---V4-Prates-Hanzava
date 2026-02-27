-- DEFINITIVE SCHEMA RESET SCRIPT
-- WARNING: This will delete existing data in 'health_inputs' to ensure a clean slate.
-- Since you mentioned you haven't filled in data yet, this is the safest way to fix the "missing column" errors.

-- 1. Drop the existing broken table
DROP TABLE IF EXISTS health_inputs CASCADE;

-- 2. Recreate the table with ALL required columns
CREATE TABLE health_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core Keys
    client_id TEXT NOT NULL,
    month_key TEXT NOT NULL,
    
    -- Vertical 1: Engajamento
    checkin TEXT,
    whatsapp TEXT,
    adimplencia TEXT,
    recarga TEXT,
    
    -- Vertical 2: Resultados
    roi_bucket TEXT,
    growth TEXT,
    engagement_vs_avg TEXT,
    
    -- Vertical 3: Relacionamento
    checkin_produtivo TEXT,
    progresso TEXT,
    relacionamento_interno TEXT,
    aviso_previo TEXT,
    pesquisa_respondida TEXT,
    
    -- Vertical 4: Pesquisas
    csat_tecnico TEXT,
    nps TEXT,
    mhs TEXT,
    pesquisa_geral_respondida TEXT,
    
    -- Metadata & New Features
    results_focus TEXT DEFAULT 'both',
    social_profile TEXT,
    
    -- Timestamps
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE,
    
    -- Granular Timestamps
    last_updated_engagement TIMESTAMP WITH TIME ZONE,
    last_updated_results TIMESTAMP WITH TIME ZONE,
    last_updated_relationship TIMESTAMP WITH TIME ZONE,
    last_updated_surveys TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    UNIQUE(client_id, month_key)
);

-- 3. Re-enable Security Policies
ALTER TABLE health_inputs ENABLE ROW LEVEL SECURITY;

-- Drop policy if it somehow exists (though table drop should handle it)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON health_inputs;

CREATE POLICY "Enable all access for authenticated users" ON health_inputs
    FOR ALL USING (auth.role() = 'authenticated');

-- 4. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';

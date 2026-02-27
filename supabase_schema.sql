-- Create health_inputs table if it doesn't exist
CREATE TABLE IF NOT EXISTS health_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    
    -- Metadata
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE, -- Legacy/Fallback
    
    -- Unique constraint to prevent duplicates per client/month
    UNIQUE(client_id, month_key)
);

-- Add new columns for Health Dashboard enhancements (Idempotent)
DO $$
BEGIN
    -- results_focus
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'results_focus') THEN
        ALTER TABLE health_inputs ADD COLUMN results_focus TEXT DEFAULT 'both';
    END IF;

    -- social_profile
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'health_inputs' AND column_name = 'social_profile') THEN
        ALTER TABLE health_inputs ADD COLUMN social_profile TEXT;
    END IF;

    -- Granular timestamps
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

-- Create app_state table for JSON storage (Productivity Module)
CREATE TABLE IF NOT EXISTS app_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_email)
);

-- Enable Row Level Security (RLS)
ALTER TABLE health_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- Policies (Adjust as needed for your auth setup)
-- Allow all access for authenticated users for simplicity in this context, 
-- or restrict based on user_id if you have auth.uid() mapping.
-- Here we assume a simple "allow all" for authenticated users to start.

CREATE POLICY "Enable all access for authenticated users" ON health_inputs
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON app_state
    FOR ALL USING (auth.role() = 'authenticated');

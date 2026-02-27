-- Add new columns for Results vertical logic
ALTER TABLE health_inputs ADD COLUMN IF NOT EXISTS espera_resultado_mensuravel TEXT DEFAULT 'sim';
ALTER TABLE health_inputs ADD COLUMN IF NOT EXISTS mensura_resultado_financeiro TEXT DEFAULT 'sim';

-- Refresh Schema Cache
NOTIFY pgrst, 'reload schema';

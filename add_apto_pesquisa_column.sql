
ALTER TABLE health_inputs ADD COLUMN IF NOT EXISTS cliente_apto_pesquisa TEXT DEFAULT 'sim';

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

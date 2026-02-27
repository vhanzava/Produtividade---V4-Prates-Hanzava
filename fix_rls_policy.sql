-- Fix RLS Policy to allow public/anonymous access
-- This solves the "new row violates row-level security policy" error

-- 1. Drop the restrictive policy
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON health_inputs;

-- 2. Create a permissive policy (Allows everyone to read/write)
CREATE POLICY "Enable public access" ON health_inputs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Do the same for app_state just in case
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON app_state;

CREATE POLICY "Enable public access" ON app_state
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';

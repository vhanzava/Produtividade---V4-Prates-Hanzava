-- ============================================================================
-- FECHA O ACESSO PÚBLICO AO BANCO
--
-- O fix_rls_policy.sql deixou as policies como USING (true) WITH CHECK (true),
-- o que libera leitura E escrita para o papel `anon`. Como a chave anon vai no
-- bundle público do site, na prática qualquer pessoa com a URL conseguia ler a
-- base inteira — clientes, fees, custo por colaborador, todos os apontamentos —
-- e também apagá-la.
--
-- Aqui o acesso volta a exigir sessão autenticada.
--
-- ============================================================================
-- ORDEM DE EXECUÇÃO — não inverta:
--
--   1. Faça o deploy do código com o login do Supabase (commit "seguranca").
--   2. Crie os usuários em Authentication > Users no painel do Supabase.
--   3. Confirme que você consegue entrar na ferramenta com e-mail e senha.
--   4. SÓ ENTÃO rode este script.
--
-- Rodar antes do passo 3 derruba a ferramenta para todo mundo: o app ainda
-- estaria falando com o banco sem sessão, e o banco pararia de responder.
-- ============================================================================

-- 1. Remove as policies permissivas
DROP POLICY IF EXISTS "Enable public access" ON health_inputs;
DROP POLICY IF EXISTS "Enable public access" ON app_state;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON health_inputs;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON app_state;

-- 2. Acesso apenas para quem tem sessão válida.
--    `TO authenticated` é o que efetivamente barra o papel anon — sem essa
--    cláusula a policy valeria para todos os papéis.
CREATE POLICY "Authenticated access" ON health_inputs
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated access" ON app_state
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- 3. Garante que a RLS está ligada (sem isso as policies não são aplicadas)
ALTER TABLE health_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- 4. Revoga os privilégios de tabela do papel anon.
--    RLS e GRANT são camadas independentes: sem este REVOKE o anon continuaria
--    com permissão de tabela, mesmo sem policy que o atenda.
REVOKE ALL ON health_inputs FROM anon;
REVOKE ALL ON app_state FROM anon;

-- 5. A tabela de histórico do health score também é lida pelo app
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'health_score_history') THEN
        EXECUTE 'ALTER TABLE health_score_history ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Enable public access" ON health_score_history';
        EXECUTE 'DROP POLICY IF EXISTS "Authenticated access" ON health_score_history';
        EXECUTE 'CREATE POLICY "Authenticated access" ON health_score_history FOR ALL TO authenticated USING (true) WITH CHECK (true)';
        EXECUTE 'REVOKE ALL ON health_score_history FROM anon';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- COMO CONFERIR QUE FUNCIONOU
--
-- No terminal, com a URL e a chave anon do projeto:
--
--   curl "https://SEU-PROJETO.supabase.co/rest/v1/app_state?select=id" \
--        -H "apikey: SUA_CHAVE_ANON"
--
-- Antes: devolvia os dados. Depois: deve devolver lista vazia ou erro de
-- permissão. Se ainda devolver dados, algo não foi aplicado.
-- ============================================================================

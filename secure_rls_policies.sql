-- ============================================================================
-- CONTROLE DE ACESSO — lista de e-mails autorizados
--
-- Problema original: o fix_rls_policy.sql deixou as policies como
-- USING (true) WITH CHECK (true), liberando leitura e escrita para o papel
-- `anon`. Como a chave anon vai no bundle público por design, qualquer pessoa
-- com a URL do site lia a base inteira — clientes, fees, custo por colaborador,
-- todos os apontamentos — e também podia apagá-la.
--
-- Aqui o acesso passa a exigir: (1) sessão autenticada E (2) e-mail presente na
-- tabela `allowed_users`. Estar logado não basta.
--
-- Isso permite que a conta se crie sozinha no primeiro login sem abrir a base:
-- `@v4company.com` é o domínio de toda a rede V4, não só desta unidade, então
-- quem não estiver na lista consegue no máximo um login vazio.
--
-- ============================================================================
-- ORDEM DE EXECUÇÃO — não inverta:
--
--   1. Faça o deploy do código com o login por link mágico.
--   2. Rode este script inteiro.
--   3. Ajuste a lista de e-mails no passo 5 abaixo antes de rodar.
--   4. Entre na ferramenta e confirme que funciona.
--
-- O código tolera este script ainda não ter rodado (cai numa lista embutida de
-- 3 e-mails), então deployar antes não quebra nada. O contrário — rodar isto
-- sem o deploy — derruba a ferramenta para todo mundo.
-- ============================================================================

-- 1. Tabela de autorizados. Guarda também as permissões, para adicionar gente
--    sem precisar de deploy de código.
CREATE TABLE IF NOT EXISTS allowed_users (
    email                  TEXT PRIMARY KEY,
    nome                   TEXT,
    is_master              BOOLEAN NOT NULL DEFAULT false,
    can_edit_health_score  BOOLEAN NOT NULL DEFAULT false,
    can_edit_productivity  BOOLEAN NOT NULL DEFAULT false,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Função usada pelas policies.
--    SECURITY DEFINER para conseguir ler allowed_users mesmo com RLS ligada na
--    própria tabela; STABLE para o Postgres avaliar uma vez por consulta em vez
--    de uma vez por linha; search_path fixo para não ser sequestrada por um
--    schema homônimo.
CREATE OR REPLACE FUNCTION public.is_allowed_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM allowed_users
        WHERE email = lower(auth.jwt() ->> 'email')
    );
$$;

-- 3. A própria lista: cada pessoa enxerga só a própria linha (é assim que o app
--    descobre as permissões dela). Escrita só pelo painel/SQL, nunca pela API.
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Le a propria linha" ON allowed_users;
CREATE POLICY "Le a propria linha" ON allowed_users
    FOR SELECT TO authenticated
    USING (email = lower(auth.jwt() ->> 'email'));

REVOKE ALL ON allowed_users FROM anon;
GRANT SELECT ON allowed_users TO authenticated;

-- 4. Policies das tabelas de dados
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['app_state', 'health_inputs', 'health_score_history'] LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

            -- Remove as permissivas antigas
            EXECUTE format('DROP POLICY IF EXISTS "Enable public access" ON %I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON %I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Authenticated access" ON %I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Usuario autorizado" ON %I', t);

            EXECUTE format(
                'CREATE POLICY "Usuario autorizado" ON %I FOR ALL TO authenticated
                 USING (public.is_allowed_user()) WITH CHECK (public.is_allowed_user())', t);

            -- RLS e GRANT são camadas independentes: sem o REVOKE o anon
            -- continuaria com privilégio de tabela mesmo sem policy que o atenda.
            EXECUTE format('REVOKE ALL ON %I FROM anon', t);
        END IF;
    END LOOP;
END $$;

-- 5. >>> AJUSTE ESTA LISTA ANTES DE RODAR <<<
--    Uma linha por pessoa da operação. Para adicionar alguém depois, basta um
--    INSERT novo — nenhum deploy é necessário.
INSERT INTO allowed_users (email, nome, is_master, can_edit_health_score, can_edit_productivity) VALUES
    ('vinicius.hanzava@v4company.com', 'Vinícius Hanzava', true,  true,  true),
    ('lara.davila@v4company.com',      'Lara D''Avila',    false, true,  false),
    ('caina.rossini@v4company.com',    'Cainã Rossini',    false, true,  false)
ON CONFLICT (email) DO UPDATE SET
    nome                  = EXCLUDED.nome,
    is_master             = EXCLUDED.is_master,
    can_edit_health_score = EXCLUDED.can_edit_health_score,
    can_edit_productivity = EXCLUDED.can_edit_productivity;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ADICIONAR ALGUÉM DEPOIS (somente leitura, sem permissão de edição):
--
--   INSERT INTO allowed_users (email, nome) VALUES
--       ('fulano@v4company.com', 'Fulano');
--
-- REMOVER O ACESSO DE ALGUÉM:
--
--   DELETE FROM allowed_users WHERE email = 'fulano@v4company.com';
--
-- CONFERIR QUE A BASE FECHOU (rode no terminal, com a chave anon):
--
--   curl "https://SEU-PROJETO.supabase.co/rest/v1/app_state?select=id" \
--        -H "apikey: SUA_CHAVE_ANON"
--
-- Antes devolvia os dados. Depois deve vir vazio ou erro de permissão.
-- ============================================================================

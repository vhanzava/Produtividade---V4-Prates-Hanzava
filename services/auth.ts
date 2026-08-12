import { UserSession } from '../types';
import { supabase } from '../lib/supabase';

// Autenticação da ferramenta.
//
// Até aqui o "login" era só uma checagem de domínio no browser: nada impedia
// alguém de falar direto com o Supabase, porque a RLS estava aberta e a chave
// anon vai no bundle público. Agora a sessão é do próprio Supabase, e a RLS só
// responde para quem está autenticado — a chave anon sozinha não abre nada.

export const ALLOWED_EMAIL_DOMAIN = '@v4company.com';

const MASTER_EMAIL = 'vinicius.hanzava@v4company.com';

/** Quem pode editar o Health Score além do master. */
const HEALTH_SCORE_EDITORS = [
  'lara.davila@v4company.com',
  'caina.rossini@v4company.com',
];

/**
 * Permissões a partir da lista embutida. Usada só como retaguarda — a fonte da
 * verdade é a tabela `allowed_users`, ver `fetchAccess`.
 */
export const buildSession = (email: string): UserSession => {
  const normalized = email.trim().toLowerCase();
  const isMaster = normalized === MASTER_EMAIL;

  return {
    email: normalized,
    isMaster,
    isAuthenticated: true,
    permissions: {
      canEditHealthScore: isMaster || HEALTH_SCORE_EDITORS.includes(normalized),
      canEditProductivity: isMaster,
    },
  };
};

export type AccessResult =
  | { status: 'ok'; session: UserSession }
  /** Autenticou, mas o e-mail não está na lista de autorizados. */
  | { status: 'denied' }
  /** Não deu para verificar (rede/servidor); não é o mesmo que negar. */
  | { status: 'error'; message: string };

/**
 * Decide se este e-mail tem acesso, consultando `allowed_users`.
 *
 * Estar autenticado não basta: `@v4company.com` é o domínio de toda a rede V4,
 * não só desta unidade, e o login permite que a conta se crie sozinha. Quem
 * autoriza de fato é a RLS no banco — esta consulta existe para a tela poder
 * dizer "você não tem acesso" em vez de mostrar uma ferramenta vazia.
 */
export const fetchAccess = async (email: string): Promise<AccessResult> => {
  const normalized = email.trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .from('allowed_users')
      .select('is_master, can_edit_health_score, can_edit_productivity')
      .eq('email', normalized)
      .maybeSingle();

    if (error) {
      // A tabela ainda não existe: o SQL de controle de acesso não rodou.
      // Cair na lista embutida evita trancar todo mundo para fora entre o
      // deploy do código e a execução do script. Seguro porque quem de fato
      // libera os dados é a RLS, não esta checagem.
      if (error.code === '42P01' || /does not exist/i.test(error.message)) {
        console.warn('[auth] tabela allowed_users ausente; usando lista embutida.');
        return { status: 'ok', session: buildSession(normalized) };
      }
      return { status: 'error', message: error.message };
    }

    if (!data) return { status: 'denied' };

    return {
      status: 'ok',
      session: {
        email: normalized,
        isMaster: !!data.is_master,
        isAuthenticated: true,
        permissions: {
          canEditHealthScore: !!data.can_edit_health_score || !!data.is_master,
          canEditProductivity: !!data.can_edit_productivity || !!data.is_master,
        },
      },
    };
  } catch (err: any) {
    return { status: 'error', message: err?.message || 'Falha ao verificar o acesso.' };
  }
};

/** Mensagens do Supabase são em inglês e genéricas; traduz as mais comuns. */
export const translateAuthError = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'E-mail ainda não confirmado. Peça ao administrador para confirmar sua conta.';
  // `shouldCreateUser: false` faz o Supabase recusar quem não tem conta.
  if (m.includes('signups not allowed') || m.includes('user not found')) {
    return 'Esse e-mail não tem acesso à ferramenta. Peça ao administrador para criar sua conta.';
  }
  // O SMTP embutido do Supabase libera poucos e-mails por hora.
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('over_email_send_rate')) {
    return 'Limite de envio de e-mails atingido. Aguarde alguns minutos e tente de novo.';
  }
  if (m.includes('error sending') || m.includes('smtp')) {
    return 'Falha no envio do e-mail. Avise o administrador — pode ser configuração de SMTP.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Sem conexão com o servidor de autenticação.';
  }
  return message;
};

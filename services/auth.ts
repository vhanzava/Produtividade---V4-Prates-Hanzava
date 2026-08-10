import { UserSession } from '../types';

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
 * Permissões derivadas do e-mail. A autenticação diz QUEM é a pessoa; isto
 * define o que ela pode fazer. Todo mundo da operação enxerga a ferramenta;
 * edição é restrita.
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

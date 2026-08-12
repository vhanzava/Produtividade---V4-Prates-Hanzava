import React, { useEffect, useState } from 'react';
import { Lock, AlertCircle, Loader, MailCheck, KeyRound } from 'lucide-react';
import { UserSession } from '../types';
import { supabase } from '../lib/supabase';
import { ALLOWED_EMAIL_DOMAIN, buildSession, translateAuthError } from '../services/auth';

interface LoginProps {
  onLogin: (session: UserSession) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [error, setError] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quando o link expira ou já foi usado, o Supabase devolve o motivo no hash
  // da URL. Sem ler isso, a pessoa voltaria para uma tela de login muda, sem
  // entender por que não entrou.
  useEffect(() => {
    if (!window.location.hash.includes('error')) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const description = params.get('error_description');
    if (description) {
      setError(
        /expired|invalid/i.test(description)
          ? 'Esse link expirou ou já foi usado. Peça um novo abaixo.'
          : decodeURIComponent(description.replace(/\+/g, ' ')),
      );
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const normalizedEmail = email.trim().toLowerCase();

  const validarEmail = (): boolean => {
    if (!normalizedEmail) {
      setError('Informe seu e-mail.');
      return false;
    }
    // Checagem local só para dar mensagem melhor. Quem autoriza é o Supabase,
    // e apenas contas já criadas por lá conseguem entrar.
    if (!normalizedEmail.endsWith(ALLOWED_EMAIL_DOMAIN)) {
      setError(`Acesso restrito a e-mails ${ALLOWED_EMAIL_DOMAIN}`);
      return false;
    }
    return true;
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validarEmail()) return;

    setIsSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: window.location.origin,
          // A conta se cria no primeiro acesso — assim ninguém precisa
          // cadastrar 13 pessoas na mão. Isso NÃO abre a base: quem autoriza é
          // a tabela `allowed_users` via RLS, e `@v4company.com` é o domínio de
          // toda a rede V4. Quem não está na lista consegue no máximo um login
          // vazio, e a tela avisa isso explicitamente.
          shouldCreateUser: true,
        },
      });

      if (authError) {
        setError(translateAuthError(authError.message));
        return;
      }
      setLinkSent(true);
    } catch (err: any) {
      setError(translateAuthError(err?.message || 'Falha ao enviar o link.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validarEmail()) return;
    if (!password) {
      setError('Informe a senha.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (authError) {
        setError(translateAuthError(authError.message));
        return;
      }
      if (!data.session) {
        setError('Não foi possível iniciar a sessão. Tente novamente.');
        return;
      }
      onLogin(buildSession(data.user?.email || normalizedEmail));
    } catch (err: any) {
      setError(translateAuthError(err?.message || 'Falha ao entrar.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm';

  if (linkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full space-y-6 bg-white p-10 rounded-xl shadow-lg border border-gray-100 text-center">
          <div className="mx-auto h-12 w-12 bg-green-100 flex items-center justify-center rounded-full">
            <MailCheck className="h-6 w-6 text-green-700" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Link enviado</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Enviamos um link de acesso para <strong>{normalizedEmail}</strong>.
            Abra o e-mail e clique no link para entrar — não precisa de senha.
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            O link vale por pouco tempo e só funciona uma vez. Se não chegar em
            alguns minutos, confira a caixa de spam.
          </p>
          <button
            onClick={() => { setLinkSent(false); setError(''); }}
            className="text-sm text-red-700 hover:text-red-800 font-medium"
          >
            Usar outro e-mail
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-red-100 flex items-center justify-center rounded-full mb-4">
            <Lock className="h-6 w-6 text-red-700" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">V4 Prates Hanzava</h2>
          <p className="mt-2 text-sm text-gray-600">Produtividade e Lucratividade</p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={usePassword ? handlePasswordLogin : handleMagicLink}>
          <input
            id="email-address"
            name="email"
            type="email"
            autoComplete="username"
            required
            className={inputClass}
            placeholder="seu.nome@v4company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
          />

          {usePassword && (
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          )}

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors shadow-sm"
          >
            {isSubmitting && <Loader size={14} className="animate-spin" />}
            {isSubmitting
              ? (usePassword ? 'Entrando...' : 'Enviando...')
              : (usePassword ? 'Entrar' : 'Receber link de acesso')}
          </button>

          {!usePassword && (
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Você recebe um link por e-mail e entra com um clique. Não precisa criar senha.
            </p>
          )}

          {/* Saída de emergência: se o envio de e-mail cair, o link mágico deixa
              de funcionar e ninguém entra. Quem tiver senha definida no painel
              continua conseguindo acessar por aqui. */}
          <button
            type="button"
            onClick={() => { setUsePassword(!usePassword); setError(''); setPassword(''); }}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors pt-2"
          >
            <KeyRound size={12} />
            {usePassword ? 'Voltar para o link por e-mail' : 'Entrar com senha'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

import React, { useState } from 'react';
import { Lock, AlertCircle, Loader } from 'lucide-react';
import { UserSession } from '../types';
import { supabase } from '../lib/supabase';
import { ALLOWED_EMAIL_DOMAIN, buildSession, translateAuthError } from '../services/auth';

interface LoginProps {
  onLogin: (session: UserSession) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }

    // Checagem local só para dar mensagem melhor — quem de fato autoriza é o
    // Supabase, e é lá que as contas são criadas.
    if (!normalizedEmail.endsWith(ALLOWED_EMAIL_DOMAIN)) {
      setError(`Acesso restrito a e-mails ${ALLOWED_EMAIL_DOMAIN}`);
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
    'appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm';

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

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="username"
              required
              className={`${inputClass} rounded-t-md`}
              placeholder="seu.nome@v4company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={`${inputClass} rounded-b-md`}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm justify-center bg-red-50 p-2 rounded">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="group relative w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors shadow-sm"
          >
            {isSubmitting && <Loader size={14} className="animate-spin" />}
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Acesso liberado pelo administrador. Se ainda não tem senha, peça a criação da conta.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;

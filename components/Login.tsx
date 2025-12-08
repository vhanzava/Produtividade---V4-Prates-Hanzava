import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { UserSession } from '../types';

interface LoginProps {
  onLogin: (session: UserSession) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError("Por favor, insira um e-mail.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Regra 1: Validar domínio
    if (!normalizedEmail.endsWith('@v4company.com')) {
      setError("Acesso restrito a e-mails @v4company.com");
      return;
    }

    // Regra 2: Definir Master
    const isMaster = normalizedEmail === 'vinicius.hanzava@v4company.com';
    
    onLogin({
      email: normalizedEmail,
      isMaster: isMaster,
      isAuthenticated: true
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-red-100 flex items-center justify-center rounded-full mb-4">
            <Lock className="h-6 w-6 text-red-700" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">V4 Prates Hanzava</h2>
          <p className="mt-2 text-sm text-gray-600">
            Produtividade e Lucratividade
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Endereço de E-mail</label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="seu.nome@v4company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm justify-center bg-red-50 p-2 rounded">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors shadow-sm"
            >
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
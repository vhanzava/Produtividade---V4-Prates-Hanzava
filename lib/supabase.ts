import { createClient } from '@supabase/supabase-js';

// Função auxiliar robusta para acessar variáveis de ambiente
const getEnv = (key: string): string | undefined => {
  // 1. Tenta via import.meta.env (Padrão Vite)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) { /* ignore */ }

  // 2. Tenta via process.env (Fallback para ambientes Node/Webpack/Compat)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) { /* ignore */ }

  return undefined;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Se não houver chaves (ambiente de teste), apenas loga modo offline e usa placeholder
const isTestEnv = !supabaseUrl || !supabaseAnonKey;

if (isTestEnv) {
  console.log('Environment: Modo de Teste/Offline detectado (Sem conexão Supabase).');
}

// Inicializa cliente. 
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

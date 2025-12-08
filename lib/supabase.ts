import { createClient } from '@supabase/supabase-js';

// Acesso seguro com optional chaining (?.) para evitar crash se import.meta.env for undefined
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('AVISO: Supabase URL ou Key não encontradas. Verifique as variáveis de ambiente (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) no painel da Vercel ou arquivo .env.');
}

// Cria o cliente se as chaves existirem, senão cria um placeholder seguro para não travar a aplicação no load
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder');

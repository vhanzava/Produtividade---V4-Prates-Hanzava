import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERRO CRÍTICO: Variáveis de ambiente do Supabase não encontradas.');
  console.error('Verifique se VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas corretamente no Vercel (Key = Nome, Value = Valor).');
}

// Cria o cliente. Se as variáveis estiverem vazias, criará um cliente inválido que falhará nas requisições,
// mas o erro será capturado pelo App.tsx com a mensagem correta.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);
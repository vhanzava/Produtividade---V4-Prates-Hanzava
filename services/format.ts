// Apresentação de nomes de pessoas.
//
// O eKyte devolve o e-mail quando o cadastro do usuário não tem nome
// preenchido. "bryan.alexander@v4company.com" numa coluna de gráfico estoura o
// eixo e empurra o rótulo para a diagonal, quebrando a leitura de todas as
// barras — o custo visual de um dado ausente recai sobre o gráfico inteiro.

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** "d'avila" -> "D'Avila", "mcdonald" -> "McDonald" fica como "Mcdonald" (aceitável). */
const capitalizarPalavra = (palavra: string): string => {
  if (!palavra) return palavra;
  if (PARTICULAS.has(palavra.toLowerCase())) return palavra.toLowerCase();
  // Nomes com apóstrofo precisam de maiúscula depois dele: d'avila -> D'Avila.
  return palavra
    .split("'")
    .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join("'");
};

/**
 * Nome legível a partir do que o eKyte mandou — que pode ser um nome de
 * verdade, um e-mail, ou um nome todo em minúsculas.
 */
export const formatPersonName = (bruto: string): string => {
  const valor = (bruto || '').trim();
  if (!valor) return 'Sem executor';

  // Já é um nome com maiúsculas: respeita como está.
  const arroba = valor.indexOf('@');
  if (arroba < 0 && /[A-ZÀ-Ý]/.test(valor)) return valor;

  const base = arroba >= 0 ? valor.slice(0, arroba) : valor;

  return base
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizarPalavra)
    .join(' ') || valor;
};

/**
 * Versão curta para eixos de gráfico, onde só cabe uma palavra.
 * Preserva a partícula quando o primeiro nome é curto demais para identificar.
 */
export const shortPersonName = (bruto: string): string => {
  const completo = formatPersonName(bruto);
  const partes = completo.split(/\s+/);
  return partes[0] || completo;
};

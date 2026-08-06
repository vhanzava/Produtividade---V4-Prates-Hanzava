import { ClientConfig, ClientCategory, ImplementationType } from '../types';

// Aplicação em lote de correções de cadastro de clientes.
//
// Existe porque corrigir 30 clientes campo a campo na tabela é inviável na
// prática — e foi justamente o cadastro manual que colocou valor de
// implementação no campo de fee recorrente. Aqui o operador cola um bloco JSON
// revisado contra os contratos e aplica de uma vez.

/** Um cliente no payload. Só `name` é obrigatório; o resto é opcional. */
export interface ClientImportRow {
  name: string;
  aliases?: string[];
  isActive?: boolean;
  category?: ClientCategory;
  /** Fee recorrente mensal, valor CHEIO de contrato (antes do repasse). */
  defaultFee?: number;
  /** Valor de implementação, CHEIO de contrato (antes do repasse). */
  oneTimeFee?: number;
  implementationType?: ImplementationType;
  implementationMonths?: number;
  repassePercent?: number;
  /** "YYYY-MM-DD" — abre a janela de amortização da implementação. */
  contractStartDate?: string;
  accountManager?: string;
  is_inadimplente?: boolean;
}

export interface BulkImportChange {
  clientName: string;
  field: string;
  from: unknown;
  to: unknown;
}

export interface BulkImportResult {
  clients: ClientConfig[];
  created: string[];
  updated: string[];
  /** Cadastros duplicados absorvidos por um apelido, no formato "EIVA → FT Containers". */
  merged: string[];
  /** Diferenças campo a campo, para revisar antes de aplicar. */
  changes: BulkImportChange[];
}

const CATEGORIES: ClientCategory[] = ['Saber', 'Ter', 'Executar'];
const IMPL_TYPES: ImplementationType[] = [
  'estruturacao',
  'destrava_receita',
  'setup',
  'ferramental',
  'outro',
];

/**
 * Valida e normaliza o texto colado. Devolve mensagem de erro em vez de lançar,
 * porque o destino é a tela — e um payload torto não pode derrubar o cadastro.
 */
export const parseClientImportPayload = (
  raw: string,
): { rows: ClientImportRow[]; error: null } | { rows: null; error: string } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { rows: null, error: 'JSON inválido. Verifique vírgulas, aspas e chaves.' };
  }

  // Aceita tanto o array direto quanto { clients: [...] }.
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { clients?: unknown })?.clients;

  if (!Array.isArray(list)) {
    return { rows: null, error: 'Esperado um array de clientes, ou { "clients": [...] }.' };
  }
  if (list.length === 0) {
    return { rows: null, error: 'A lista está vazia.' };
  }

  const rows: ClientImportRow[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i] as Record<string, unknown>;
    const posicao = `item ${i + 1}`;

    if (!item || typeof item !== 'object') {
      return { rows: null, error: `${posicao}: esperado um objeto.` };
    }
    if (typeof item.name !== 'string' || !item.name.trim()) {
      return { rows: null, error: `${posicao}: campo "name" ausente ou vazio.` };
    }

    const row: ClientImportRow = { name: item.name.trim() };

    if (item.aliases !== undefined) {
      if (!Array.isArray(item.aliases) || item.aliases.some(a => typeof a !== 'string')) {
        return { rows: null, error: `${posicao} (${row.name}): "aliases" deve ser uma lista de textos.` };
      }
      row.aliases = (item.aliases as string[]).map(a => a.trim()).filter(Boolean);
    }
    if (item.isActive !== undefined) {
      if (typeof item.isActive !== 'boolean') {
        return { rows: null, error: `${posicao} (${row.name}): "isActive" deve ser true ou false.` };
      }
      row.isActive = item.isActive;
    }
    if (item.category !== undefined) {
      if (!CATEGORIES.includes(item.category as ClientCategory)) {
        return { rows: null, error: `${posicao} (${row.name}): "category" deve ser Saber, Ter ou Executar.` };
      }
      row.category = item.category as ClientCategory;
    }
    if (item.implementationType !== undefined) {
      if (!IMPL_TYPES.includes(item.implementationType as ImplementationType)) {
        return {
          rows: null,
          error: `${posicao} (${row.name}): "implementationType" deve ser um de ${IMPL_TYPES.join(', ')}.`,
        };
      }
      row.implementationType = item.implementationType as ImplementationType;
    }

    const numericos: [keyof ClientImportRow, string, number, number][] = [
      ['defaultFee', 'defaultFee', 0, Number.MAX_SAFE_INTEGER],
      ['oneTimeFee', 'oneTimeFee', 0, Number.MAX_SAFE_INTEGER],
      ['implementationMonths', 'implementationMonths', 1, 120],
      ['repassePercent', 'repassePercent', 0, 100],
    ];
    for (const [campo, rotulo, min, max] of numericos) {
      const valor = item[rotulo as string];
      if (valor === undefined) continue;
      if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < min || valor > max) {
        return { rows: null, error: `${posicao} (${row.name}): "${rotulo}" deve ser um número entre ${min} e ${max}.` };
      }
      (row as unknown as Record<string, unknown>)[campo as string] = valor;
    }

    if (item.contractStartDate !== undefined) {
      if (typeof item.contractStartDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.contractStartDate)) {
        return { rows: null, error: `${posicao} (${row.name}): "contractStartDate" deve estar no formato AAAA-MM-DD.` };
      }
      row.contractStartDate = item.contractStartDate;
    }
    if (item.accountManager !== undefined) {
      if (typeof item.accountManager !== 'string') {
        return { rows: null, error: `${posicao} (${row.name}): "accountManager" deve ser texto.` };
      }
      row.accountManager = item.accountManager.trim();
    }
    if (item.is_inadimplente !== undefined) {
      if (typeof item.is_inadimplente !== 'boolean') {
        return { rows: null, error: `${posicao} (${row.name}): "is_inadimplente" deve ser true ou false.` };
      }
      row.is_inadimplente = item.is_inadimplente;
    }

    rows.push(row);
  }

  return { rows, error: null };
};

const mesmoValor = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
};

/**
 * Aplica as linhas sobre a lista atual, casando por nome (ignorando caixa e
 * espaços) e também pelos apelidos já cadastrados — assim um payload que usa o
 * nome da workspace encontra o cliente certo em vez de criar um duplicado.
 *
 * Campos ausentes na linha são PRESERVADOS: o payload descreve o que muda, não
 * o cadastro inteiro.
 */
export const applyClientImport = (
  current: ClientConfig[],
  rows: ClientImportRow[],
): BulkImportResult => {
  const key = (v: string) => v.trim().toLowerCase();

  const porNome = new Map<string, number>();
  current.forEach((client, index) => {
    porNome.set(key(client.name), index);
    client.aliases?.forEach(alias => {
      if (alias?.trim()) porNome.set(key(alias), index);
    });
  });

  const clients = current.map(c => ({ ...c }));
  const created: string[] = [];
  const updated = new Set<string>();
  const changes: BulkImportChange[] = [];

  rows.forEach(row => {
    const index = porNome.get(key(row.name));

    if (index === undefined) {
      const novo: ClientConfig = {
        name: row.name,
        aliases: row.aliases,
        isActive: row.isActive ?? true,
        category: row.category ?? 'Executar',
        defaultFee: row.defaultFee ?? 0,
        oneTimeFee: row.oneTimeFee,
        implementationType: row.implementationType,
        implementationMonths: row.implementationMonths,
        repassePercent: row.repassePercent,
        contractStartDate: row.contractStartDate,
        accountManager: row.accountManager,
        is_inadimplente: row.is_inadimplente,
        history: {},
      };
      clients.push(novo);
      porNome.set(key(row.name), clients.length - 1);
      created.push(row.name);
      return;
    }

    const alvo = clients[index] as unknown as Record<string, unknown>;
    (Object.keys(row) as (keyof ClientImportRow)[]).forEach(campo => {
      if (campo === 'name') return; // o nome cadastrado manda; o payload pode vir por apelido
      const novoValor = row[campo];
      if (novoValor === undefined) return;
      const anterior = alvo[campo as string];
      if (mesmoValor(anterior, novoValor)) return;
      changes.push({ clientName: clients[index].name, field: campo as string, from: anterior, to: novoValor });
      alvo[campo as string] = novoValor;
      updated.add(clients[index].name);
    });
  });

  // Declarar um apelido que é o nome de OUTRO cadastro significa que os dois
  // são o mesmo cliente. Sem absorver o duplicado, o apelido não teria efeito:
  // o nome próprio do registro antigo vence, e as horas continuariam separadas
  // do fee. É o caso EIVA (workspace) x FT Containers (cadastro).
  const merged: string[] = [];
  const canonicalByAlias = new Map<string, string>();
  clients.forEach(client => {
    client.aliases?.forEach(alias => {
      if (alias?.trim()) canonicalByAlias.set(key(alias), client.name);
    });
  });

  const survivors = clients.filter(client => {
    const canonical = canonicalByAlias.get(key(client.name));
    if (canonical && key(canonical) !== key(client.name)) {
      merged.push(`${client.name} → ${canonical}`);
      return false;
    }
    return true;
  });

  return { clients: survivors, created, updated: Array.from(updated), merged, changes };
};

import { EmployeeConfig, TimeEntry } from '../types';
import { formatPersonName } from './format';

// Fusão de colaboradores duplicados.
//
// O eKyte tem mais de uma identidade para a mesma pessoa: uma com nome
// ("Lara D'Avila") e outra só com e-mail ("lara.davila@v4company.com"). Cada
// identidade virava um colaborador separado, com capacidade própria — a pessoa
// contava em dobro na capacidade, a ocupação de cada metade saía pela metade e
// o histórico inteiro ficava distorcido. Dar baixa numa das metades não
// resolvia: a baixa grava a data de hoje, então no mês corrente a pessoa ainda
// estava "no período" e continuava somando capacidade.
//
// A fusão é feita por nome e sobrenome normalizados, na leitura: vale para
// qualquer período, presente ou passado, sem depender de migração de dados.

/** Chave de identidade: sem acento, apóstrofo, caixa ou domínio de e-mail. */
export const personKey = (bruto: string): string =>
  formatPersonName(bruto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const isEmail = (nome: string) => nome.includes('@');

/** Quanto do cadastro foi de fato preenchido — o mais completo vira a base. */
const riqueza = (e: EmployeeConfig): number =>
  (e.startDate ? 2 : 0) +
  (e.verticalHours && Object.values(e.verticalHours).some(v => (v ?? 0) > 0) ? 2 : 0) +
  (e.defaultCost > 0 ? 2 : 0) +
  (e.department && e.department !== 'Outros' ? 1 : 0) +
  Object.keys(e.history || {}).length +
  (isEmail(e.name) ? 0 : 1);

/** Nome que aparece: um nome de verdade, de preferência o mais completo. */
const melhorNome = (grupo: EmployeeConfig[]): string => {
  const reais = grupo.map(e => e.name).filter(n => !isEmail(n) && /[A-ZÀ-Ý]/.test(n));
  if (reais.length) return reais.sort((a, b) => b.length - a.length)[0];
  return formatPersonName(grupo[0].name);
};

export interface EmployeeMergeResult {
  employees: EmployeeConfig[];
  /** chave normalizada -> nome canônico */
  canonicalByKey: Map<string, string>;
  /** Fusões feitas, para mostrar ao usuário: "lara.davila@... → Lara D'Avila". */
  merged: { from: string; to: string }[];
}

export const mergeEmployees = (employees: EmployeeConfig[]): EmployeeMergeResult => {
  const grupos = new Map<string, EmployeeConfig[]>();
  employees.forEach(e => {
    const k = personKey(e.name);
    if (!k) return;
    grupos.set(k, [...(grupos.get(k) || []), e]);
  });

  const resultado: EmployeeConfig[] = [];
  const canonicalByKey = new Map<string, string>();
  const merged: { from: string; to: string }[] = [];

  grupos.forEach((grupo, k) => {
    const nome = melhorNome(grupo);
    canonicalByKey.set(k, nome);

    if (grupo.length === 1) {
      resultado.push({ ...grupo[0], name: nome });
      if (grupo[0].name !== nome) merged.push({ from: grupo[0].name, to: nome });
      return;
    }

    const base = [...grupo].sort((a, b) => riqueza(b) - riqueza(a))[0];
    const datas = (f: 'startDate' | 'endDate') => grupo.map(e => e[f]).filter(Boolean) as string[];
    const inicios = datas('startDate').sort();
    // Basta UMA identidade sem data de saída para a pessoa seguir ativa: a
    // baixa costuma ter sido dada justamente na identidade duplicada.
    const algumAtivo = grupo.some(e => !e.endDate);
    const saidas = datas('endDate').sort();

    resultado.push({
      ...base,
      name: nome,
      department: grupo.find(e => e.department && e.department !== 'Outros')?.department || base.department,
      defaultCost: base.defaultCost > 0 ? base.defaultCost : Math.max(...grupo.map(e => e.defaultCost || 0)),
      startDate: inicios[0] || base.startDate,
      endDate: algumAtivo ? undefined : saidas[saidas.length - 1],
      // Histórico mensal: a identidade mais completa prevalece mês a mês.
      history: Object.assign({}, ...[...grupo].sort((a, b) => riqueza(a) - riqueza(b)).map(e => e.history || {})),
    });

    grupo.forEach(e => { if (e.name !== nome) merged.push({ from: e.name, to: nome }); });
  });

  return { employees: resultado, canonicalByKey, merged };
};

/** Nome canônico do executor de um apontamento. */
export const resolveEmployeeName = (bruto: string, canonicalByKey: Map<string, string>): string =>
  canonicalByKey.get(personKey(bruto)) ?? formatPersonName(bruto);

/** Reescreve o executor dos apontamentos para o nome canônico. */
export const canonicalizeEntries = (entries: TimeEntry[], canonicalByKey: Map<string, string>): TimeEntry[] =>
  entries.map(e => {
    const nome = resolveEmployeeName(e.executor, canonicalByKey);
    return nome === e.executor ? e : { ...e, executor: nome };
  });

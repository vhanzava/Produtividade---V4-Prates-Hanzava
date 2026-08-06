import { TimeEntry } from '../types';
import { getMonthKey } from './dataProcessor';
import { supabase } from '../lib/supabase';

// Cliente de sincronização com o eKyte.
//
// Conversa apenas com o proxy interno (`/api/ekyte`), nunca direto com
// `api.ekyte.com` — a chave de API fica no servidor. Ver `api/ekyte.ts`.

const PROXY_URL = '/api/ekyte';

/**
 * O endpoint `/v1.0/time-trackings` filtra por `createdFrom`/`createdTo`, que
 * se referem à data em que o apontamento foi REGISTRADO — e não à data em que
 * o trabalho aconteceu (`startDate`). Como apontamentos retroativos são comuns,
 * buscamos uma janela mais larga e depois recortamos pelo `startDate` real.
 * Consequência conhecida: um apontamento lançado com mais de 15 dias de atraso
 * fica de fora. Aumente a constante se a operação lançar horas muito atrasadas.
 */
const BUFFER_DAYS = 15;

interface EkyteTimeTracking {
  id: number;
  effort?: number; // minutos
  startDate?: string;
  endDate?: string;
  comment?: string;
  executor?: { id?: string; userName?: string; email?: string } | null;
  workspace?: { id?: number; name?: string; active?: number } | null;
  ctcTask?: { id?: number; title?: string } | null;
}

interface EkyteWorkspace {
  id: number;
  name?: string;
  active?: number;
}

export interface EkyteWorkspaceInfo {
  name: string;
  isActive: boolean;
}

export interface EkyteSyncStats {
  /** Registros devolvidos pela API dentro da janela consultada. */
  fetched: number;
  /** Registros convertidos em apontamentos utilizáveis. */
  imported: number;
  /** Ignorados por não terem esforço (ex.: timer ainda rodando). */
  skippedNoEffort: number;
  /** Ignorados por terem acontecido fora do período pedido. */
  skippedOutOfRange: number;
}

export interface EkyteSyncResult {
  entries: TimeEntry[];
  workspaces: EkyteWorkspaceInfo[];
  stats: EkyteSyncStats;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** 90 -> "01:30" */
const minutesToHHMM = (minutes: number): string =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** "YYYY-MM-DD" -> "DD/MM/YYYY" */
const toDisplayDate = (date: Date): string =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

const shiftDays = (isoDate: string, days: number): string => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * O eKyte devolve datas no horário local da empresa e sem offset
 * ("2026-08-06T10:14:55"). Montamos o Date componente a componente para que o
 * runtime não interprete a string como UTC e jogue o apontamento para o dia
 * anterior nos horários da madrugada.
 */
const parseEkyteDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0), Number(s ?? 0));
};

const fetchResource = async <T>(
  resource: string,
  params: Record<string, string>,
): Promise<T[]> => {
  // O proxy exige sessão válida: sem isso o endpoint ficaria aberto e qualquer
  // um com a URL puxaria todos os dados do eKyte da empresa.
  const { data: auth } = await supabase.auth.getSession();
  const token = auth.session?.access_token;
  if (!token) {
    throw new Error('Sessão expirada. Faça login novamente para sincronizar.');
  }

  const query = new URLSearchParams({ resource, ...params });
  const response = await fetch(`${PROXY_URL}?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Lê como texto antes de parsear: quando a função serverless quebra, a Vercel
  // devolve uma página de erro em HTML. Sem o corpo cru, o diagnóstico vira
  // apenas "resposta inválida" e não dá para saber o que de fato falhou.
  const raw = await response.text();

  let body: { data?: T[]; error?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    if (response.status === 404) {
      throw new Error(
        'Endpoint /api/ekyte não encontrado. Confirme se a pasta api/ foi publicada como Serverless Function.',
      );
    }
    const snippet = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    console.error('[ekyte] resposta não-JSON do proxy:', response.status, raw.slice(0, 2000));
    throw new Error(
      `Servidor respondeu HTTP ${response.status} sem JSON${snippet ? `: ${snippet}` : '.'}`,
    );
  }

  if (!response.ok) {
    throw new Error(body.error || `Falha ao consultar o eKyte (HTTP ${response.status}).`);
  }
  return body.data ?? [];
};

export const fetchEkyteWorkspaces = async (): Promise<EkyteWorkspaceInfo[]> => {
  const raw = await fetchResource<EkyteWorkspace>('workspaces', {});
  return raw
    .filter((workspace) => !!workspace.name?.trim())
    .map((workspace) => ({
      name: workspace.name!.trim(),
      isActive: workspace.active !== 0,
    }));
};

/**
 * Busca os apontamentos de horas do eKyte no período informado e os converte
 * para o mesmo formato produzido pelo import de CSV (`TimeEntry`), de modo que
 * todo o cálculo de custo, margem e capacidade siga inalterado.
 *
 * @param startDate início do período, "YYYY-MM-DD"
 * @param endDate   fim do período (inclusive), "YYYY-MM-DD"
 */
export const syncFromEkyte = async (
  startDate: string,
  endDate: string,
): Promise<EkyteSyncResult> => {
  if (!startDate || !endDate) {
    throw new Error('Informe o período (data inicial e final) antes de sincronizar.');
  }
  if (startDate > endDate) {
    throw new Error('A data inicial não pode ser posterior à data final.');
  }

  const [trackings, workspaces] = await Promise.all([
    fetchResource<EkyteTimeTracking>('time-trackings', {
      createdFrom: shiftDays(startDate, -BUFFER_DAYS),
      createdTo: shiftDays(endDate, BUFFER_DAYS),
    }),
    fetchEkyteWorkspaces().catch(() => [] as EkyteWorkspaceInfo[]),
  ]);

  const rangeStart = parseEkyteDate(startDate)!;
  const rangeEnd = parseEkyteDate(endDate)!;
  rangeEnd.setHours(23, 59, 59, 999);

  const entries: TimeEntry[] = [];
  const stats: EkyteSyncStats = {
    fetched: trackings.length,
    imported: 0,
    skippedNoEffort: 0,
    skippedOutOfRange: 0,
  };

  trackings.forEach((tracking) => {
    const minutes = tracking.effort ?? 0;
    if (minutes <= 0) {
      // Timer em andamento ou apontamento zerado — equivale ao "00:00" do CSV.
      stats.skippedNoEffort += 1;
      return;
    }

    const date = parseEkyteDate(tracking.startDate);
    if (!date || date < rangeStart || date > rangeEnd) {
      stats.skippedOutOfRange += 1;
      return;
    }

    entries.push({
      id: `ekyte-${tracking.id}`,
      executor: tracking.executor?.userName?.trim() || 'Sem executor',
      workspace: tracking.workspace?.name?.trim() || 'Sem workspace',
      realizedTime: minutesToHHMM(minutes),
      realizedDecimal: minutes / 60,
      date,
      dateStr: toDisplayDate(date),
      monthKey: getMonthKey(date),
    });
    stats.imported += 1;
  });

  return { entries, workspaces, stats };
};

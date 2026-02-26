import { 
  HealthInput, 
  HealthScoreResult, 
  HealthFlagColor, 
  ClientConfig 
} from '../types';

// --- Constants ---

const WEIGHTS = {
  vertical_1: { base: 25, multiplier: 1.4 },
  vertical_2: { base: 25, multiplier: 1.0 },
  vertical_3: { base: 25, multiplier: 1.0 },
  vertical_4: { base: 25, multiplier: 0.6 }
};

const SCORES = {
  v1: {
    checkin: { semanal: 5, quinzenal: 3, mensal: 0, sem_frequencia: -10 },
    whatsapp: { na_hora: 5, mesmo_dia: 0, dia_seguinte: -2, dias_depois: -5, nao_responde: -10 },
    adimplencia: { em_dia: 8.75, ate_10_dias: -5, mais_30_dias: -15 },
    recarga: { no_dia: 6.25, ate_10_dias: -4, mais_30_dias: -10 }
  },
  v2: {
    roi: {
      lt_ate_2: { roi_lt_3: 15, roi_3: 12, roi_2: 10.5, roi_1: 7.5, roi_gt_1: -3 },
      lt_3_6: { roi_lt_3: 15, roi_3: 12, roi_2: 6, roi_1: 0, roi_gt_1: -7.5 },
      lt_gt_6: { roi_lt_3: 12, roi_3: 6, roi_2: 0, roi_1: -4.5, roi_gt_1: -15 }
    },
    growth: { perfil_a_lt_50k: 5, perfil_b_gt_50k: 5, negativo: -10 },
    engagement: { alta_perf: 5, estavel: 2.5, atencao: -2.5, critico: -10 }
  },
  v3: {
    checkin_produtivo: { sim: 4.81, parcial: 0, nao: -4.81 },
    progresso: { muito: 7.69, parcial: 0.96, nao: -4.81 },
    relacionamento_interno: { melhorou: 2.92, neutro: -1.17, piorou: -2.92 },
    aviso_previo: { gt_60_dias: 5.83, '30_60_dias': -1.17, lt_30_dias: -5.83 },
    pesquisa_respondida: { sim: 3.75, nao: -10 }
  },
  v4: {
    csat: { 'gt_4.5': 3.75, 'ate_4': 1.5, 'ate_3.5': -4, 'lt_3': -8 },
    nps: { promotor: 6.25, neutro: 2.5, detrator: -6.25 },
    mhs: { muito_desapontado: 8.75, pouco: 5, indiferente: -5, nada: -10 },
    pesquisa_geral: { sim: 6.25, nao: -10 }
  }
};

// --- Helpers ---

const calculateLifetimeMonths = (startDateStr?: string): number => {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30)); 
  return diffMonths;
};

const getFlag = (score: number): { color: HealthFlagColor; action: string } => {
  if (score >= 81) return { color: 'Green', action: 'Saudável, foco em Upsell' };
  if (score >= 51) return { color: 'Yellow', action: 'Atenção, gargalos operacionais' };
  if (score >= 26) return { color: 'Red', action: 'Risco Crítico, intervenção da Coordenação' };
  return { color: 'Black', action: 'Churn iminente, prioridade máxima' };
};

// --- Main Calculator ---

export const calculateHealthScore = (input: HealthInput, clientConfig: ClientConfig): HealthScoreResult => {
  
  // 1. Vertical 1: Engajamento
  let v1Raw = 0;
  v1Raw += SCORES.v1.checkin[input.checkin];
  v1Raw += SCORES.v1.whatsapp[input.whatsapp];
  v1Raw += SCORES.v1.adimplencia[input.adimplencia];
  v1Raw += SCORES.v1.recarga[input.recarga];
  
  const v1Final = v1Raw * WEIGHTS.vertical_1.multiplier;

  // 2. Vertical 2: Resultados
  let v2Raw = 0;
  const ltMonths = calculateLifetimeMonths(clientConfig.contractStartDate);
  
  // ROI Logic
  let roiScore = 0;
  if (ltMonths <= 2) {
    roiScore = SCORES.v2.roi.lt_ate_2[input.roi_bucket];
  } else if (ltMonths <= 6) {
    roiScore = SCORES.v2.roi.lt_3_6[input.roi_bucket];
  } else {
    roiScore = SCORES.v2.roi.lt_gt_6[input.roi_bucket];
  }
  v2Raw += roiScore;

  // Social Logic
  v2Raw += SCORES.v2.growth[input.growth];
  v2Raw += SCORES.v2.engagement[input.engagement_vs_avg];

  const v2Final = v2Raw * WEIGHTS.vertical_2.multiplier;

  // 3. Vertical 3: Relacionamento
  let v3Raw = 0;
  v3Raw += SCORES.v3.checkin_produtivo[input.checkin_produtivo];
  v3Raw += SCORES.v3.progresso[input.progresso];
  v3Raw += SCORES.v3.relacionamento_interno[input.relacionamento_interno];
  v3Raw += SCORES.v3.aviso_previo[input.aviso_previo];
  v3Raw += SCORES.v3.pesquisa_respondida[input.pesquisa_respondida];

  const v3Final = v3Raw * WEIGHTS.vertical_3.multiplier;

  // 4. Vertical 4: Pesquisas
  let v4Raw = 0;
  v4Raw += SCORES.v4.csat[input.csat_tecnico];
  v4Raw += SCORES.v4.nps[input.nps];
  v4Raw += SCORES.v4.mhs[input.mhs];
  v4Raw += SCORES.v4.pesquisa_geral[input.pesquisa_geral_respondida];

  const v4Final = v4Raw * WEIGHTS.vertical_4.multiplier;

  // Total
  const totalScore = Math.max(0, Math.min(100, v1Final + v2Final + v3Final + v4Final));
  const flagInfo = getFlag(totalScore);

  return {
    clientId: input.clientId,
    monthKey: input.monthKey,
    score: parseFloat(totalScore.toFixed(2)),
    flag: flagInfo.color,
    action: flagInfo.action,
    breakdown: {
      engagement: parseFloat(v1Final.toFixed(2)),
      results: parseFloat(v2Final.toFixed(2)),
      relationship: parseFloat(v3Final.toFixed(2)),
      surveys: parseFloat(v4Final.toFixed(2))
    }
  };
};

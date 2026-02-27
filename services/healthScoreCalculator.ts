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
    growth: { 
      perfil_a_lt_50k: 5, perfil_b_gt_50k: 5, negativo: -10,
      growth_high: 5, growth_medium: 2.5, growth_low: 0, growth_negative: -10
    },
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
  
  // 0. Check if client expects measurable results
  const expectsMeasurableResults = input.espera_resultado_mensuravel !== 'nao';

  // 1. Vertical 1: Engajamento
  let v1Raw = 0;
  v1Raw += SCORES.v1.checkin[input.checkin] || 0;
  v1Raw += SCORES.v1.whatsapp[input.whatsapp] || 0;
  v1Raw += SCORES.v1.adimplencia[input.adimplencia] || 0;
  v1Raw += SCORES.v1.recarga[input.recarga] || 0;
  
  // 2. Vertical 2: Resultados
  let v2Final = 0;

  if (expectsMeasurableResults) {
      let v2Raw = 0;
      const ltMonths = calculateLifetimeMonths(clientConfig.contractStartDate);
      
      // Determine Focus Weights
      const focus = input.results_focus || 'both'; // Default to both if undefined
      
      // ROI Score Calculation
      let roiScore = 0;
      let roiBaseScore = 0;
      
      // Check if we can measure financial results
      if (input.mensura_resultado_financeiro === 'nao') {
          // Penalty: -15 points (Applied as raw score for ROI component)
          roiBaseScore = -15; 
      } else {
          // Determine ROI score based on LT
          const bucket = input.roi_bucket || 'roi_3'; // Default to middle if missing
          if (ltMonths <= 2) {
            roiBaseScore = SCORES.v2.roi.lt_ate_2[bucket] || 0;
          } else if (ltMonths <= 6) {
            roiBaseScore = SCORES.v2.roi.lt_3_6[bucket] || 0;
          } else {
            roiBaseScore = SCORES.v2.roi.lt_gt_6[bucket] || 0;
          }
      }
    
      let rawRoiComponent = roiBaseScore;
    
      // Calculate Raw Social Component (Max 10 in current map)
      const growthScore = SCORES.v2.growth[input.growth] || 0;
      const engagementScore = SCORES.v2.engagement[input.engagement_vs_avg] || 0;
      let rawSocialComponent = growthScore + engagementScore;
    
      if (focus === 'roi') {
        // ROI Only: ROI is 25 pts (100%). Social is 0.
        // Scale ROI from 15 base to 25. (x 1.66)
        v2Raw = rawRoiComponent * (25/15);
      } else if (focus === 'social') {
        // Social Only: Social is 25 pts (100%). ROI is 0.
        // Scale Social from 10 base to 25. (x 2.5)
        v2Raw = rawSocialComponent * (2.5);
      } else {
        // Both: ROI 15 pts, Social 10 pts. (Default)
        // If mensura_resultado_financeiro is 'nao', roiBaseScore is -15.
        // So v2Raw = -15 + social.
        v2Raw = rawRoiComponent + rawSocialComponent;
      }
    
      v2Final = v2Raw * WEIGHTS.vertical_2.multiplier;
  } else {
      // If client does NOT expect measurable results, score is 0.
      v2Final = 0;
  }

  // 3. Vertical 3: Relacionamento
  let v3Raw = 0;
  v3Raw += SCORES.v3.checkin_produtivo[input.checkin_produtivo] || 0;
  v3Raw += SCORES.v3.progresso[input.progresso] || 0;
  v3Raw += SCORES.v3.relacionamento_interno[input.relacionamento_interno] || 0;
  v3Raw += SCORES.v3.aviso_previo[input.aviso_previo] || 0;
  v3Raw += SCORES.v3.pesquisa_respondida[input.pesquisa_respondida] || 0;

  // 4. Vertical 4: Pesquisas
  let v4Raw = 0;
  v4Raw += SCORES.v4.csat[input.csat_tecnico] || 0;
  v4Raw += SCORES.v4.nps[input.nps] || 0;
  v4Raw += SCORES.v4.mhs[input.mhs] || 0;
  v4Raw += SCORES.v4.pesquisa_geral[input.pesquisa_geral_respondida] || 0;

  // Apply Multipliers based on Expectation
  let v1Final, v3Final, v4Final;

  if (expectsMeasurableResults) {
      // Standard Multipliers
      v1Final = v1Raw * WEIGHTS.vertical_1.multiplier; // 1.4
      v3Final = v3Raw * WEIGHTS.vertical_3.multiplier; // 1.0
      v4Final = v4Raw * WEIGHTS.vertical_4.multiplier; // 0.6
  } else {
      // Redistributed Multipliers (Total 100 pts distributed to v1, v3, v4)
      // v1 (Engagement): Base 25 -> Target 35 (x1.4) -> Wait, standard is 35.
      // Let's re-calculate standard total:
      // v1: 25 * 1.4 = 35
      // v2: 25 * 1.0 = 25
      // v3: 25 * 1.0 = 25
      // v4: 25 * 0.6 = 15
      // Total = 100.
      
      // New Distribution (v2 = 0):
      // We have 25 points from v2 to distribute.
      // User: "Relacionamento receberá mais pontos que Pesquisa".
      // Let's add:
      // v3 (Relationship): +15 points -> Target 40. (Multiplier 1.6)
      // v1 (Engagement): +5 points -> Target 40. (Multiplier 1.6)
      // v4 (Surveys): +5 points -> Target 20. (Multiplier 0.8)
      // Total: 40 + 0 + 40 + 20 = 100.
      
      v1Final = v1Raw * 1.6;
      v3Final = v3Raw * 1.6;
      v4Final = v4Raw * 0.8;
  }

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

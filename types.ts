
export interface TimeEntry {
  id: string;
  executor: string;
  workspace: string;
  realizedTime: string; // "HH:MM"
  realizedDecimal: number; // 1.5
  date: Date;
  dateStr: string; // "DD/MM/YYYY" for display
  monthKey: string; // "YYYY-MM" for grouping
}

export type DepartmentType = 'Criação' | 'Atendimento' | 'Gestão de Tráfego' | 'Gestão' | 'Outros';

export type ClientCategory = 'Saber' | 'Ter' | 'Executar';

/**
 * O que foi entregue na implementação do contrato. Define em qual categoria a
 * receita de setup é contabilizada — que normalmente NÃO é a mesma do fee
 * recorrente. Um cliente de Executar com uma landing page no contrato gera
 * receita em Executar (recorrente) e em Ter (implementação).
 *
 * Regra: Estruturação e Destrava Receita são Saber; todo o resto é Ter
 * (setups, implementações e ferramental — site, CRM, landing page).
 */
export type ImplementationType =
  | 'estruturacao'
  | 'destrava_receita'
  | 'setup'
  | 'ferramental'
  | 'outro';

export interface MonthlyConfigEmp {
  cost: number;
  hours: number;
}

export interface EmployeeConfig {
  name: string;
  department: DepartmentType;
  defaultCost: number;
  defaultHours: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  verticals?: ClientCategory[]; // Verticais em que o player atua
  // Horas DIÁRIAS esperadas por vertical (manual). Quando preenchido,
  // substitui o "8h/dia útil" do cálculo automático para aquela vertical.
  // Ex: Vinicius → { Executar: 2, Saber: 5 } (2h/dia como coord, 5h/dia como consultor)
  verticalHours?: Partial<Record<ClientCategory, number>>;
  history: Record<string, MonthlyConfigEmp>; // key: "YYYY-MM"
}

export interface ClientConfig {
  name: string;
  // Outros nomes pelos quais este cliente aparece — normalmente o nome da
  // workspace no eKyte, que raramente coincide com o do cadastro. Sem isto o
  // cliente vira duas linhas: uma com as horas e outra com o fee.
  // Ex.: cadastro "FT Containers", workspace no eKyte "EIVA".
  aliases?: string[];
  isActive: boolean;
  // Categoria do fee RECORRENTE. A implementação é classificada à parte, em
  // `implementationType` — um cliente costuma pertencer a mais de uma categoria.
  category: ClientCategory;
  defaultFee: number;
  oneTimeFee?: number; // Valor de Implementação/Setup
  // O que foi implementado. Determina se a receita de setup entra em Saber ou
  // em Ter. Quando ausente, assume-se 'setup' (→ Ter).
  implementationType?: ImplementationType;
  // Percentual do valor de contrato que fica com esta unidade (0-100).
  // Contratos originados pela matriz ou por outra unidade repassam só uma
  // fração — na V4 Prates Hanzava, 30%. Os valores de `defaultFee`,
  // `history` e `oneTimeFee` guardam o valor CHEIO do contrato (que é o que
  // está no PDF); a receita reconhecida é esse valor vezes o repasse.
  // Ausente ou 100 = contrato próprio, receita integral.
  repassePercent?: number;
  // Em quantos meses a implementação é entregue. O oneTimeFee é reconhecido
  // diluído nessa janela (oneTimeFee / N por mês) em vez de 100% no mês 1:
  // o custo do setup se espalha por vários meses, então concentrar a receita
  // num só inflava a margem do primeiro mês e afundava a dos seguintes.
  // Use 1 para voltar ao reconhecimento integral no mês de início.
  implementationMonths?: number;
  contractStartDate?: string; // YYYY-MM-DD
  accountManager?: string;
  is_inadimplente?: boolean; // Exclui receita do lucro real quando true
  history: Record<string, number>; // key: "YYYY-MM", value: fee
}

export interface ClientSummary {
  name: string;
  totalHours: number;
  operationalCost: number;
  // Valor CHEIO de contrato reconhecido no período — recorrente + parcela de
  // implementação. É o número que bate com o PDF do contrato.
  grossRevenue: number;
  // O que de fato entra na unidade: bruto menos royalty da matriz e imposto
  // (e menos o repasse, quando o contrato é de outra origem). É sobre este
  // valor que lucro e margem são calculados.
  netRevenue: number;
  // Parcela de implementação dentro do netRevenue, já líquida.
  implementationRevenue: number;
  grossProfit: number;
  margin: number;
  isActive: boolean;
  category: ClientCategory; // Categoria do fee recorrente
  // Categoria em que a receita de implementação foi contabilizada. Só é
  // relevante quando houve setup reconhecido no período.
  implementationCategory: ClientCategory;
  // Todas as categorias que o cliente movimentou no período — normalmente
  // ['Executar'], mas ['Executar', 'Ter'] quando houve implementação.
  categories: ClientCategory[];
  is_inadimplente: boolean; // Receita excluída do total real quando true
}

export interface EmployeeSummary {
  name: string;
  totalHours: number;
  capacityHours: number;
  utilizationRate: number;
  costGenerated: number;
  department: string;
  verticals: ClientCategory[]; // Verticais em que o player atua
  endDate?: string; // YYYY-MM-DD — preenchido quando colaborador saiu
}

export interface DepartmentSummary {
  name: string;
  totalHoursRealized: number;
  totalCapacityHours: number;
  utilizationRate: number;
  headcount: number;
}

export interface DashboardSummary {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  overallMargin: number;
  totalHours: number;
  totalCapacityHours: number;
  globalCapacityRate: number;
  revenueByCategory: Record<ClientCategory, number>;
  // Horas realizadas distribuídas pela categoria do cliente atendido
  hoursByVertical: Record<ClientCategory, number>;
  // Capacidade total distribuída pelas verticais configuradas no player
  capacityByVertical: Record<ClientCategory, number>;
}

export interface UserSession {
  email: string;
  isMaster: boolean;
  isAuthenticated: boolean;
  permissions: {
    canEditHealthScore: boolean;
    canEditProductivity: boolean;
  };
}

export interface SystemBackup {
  entries: TimeEntry[];
  employees: EmployeeConfig[];
  clients: ClientConfig[];
  timestamp: string;
  version: string;
}

// --- Health Score Types ---

export type HealthCheckinFreq = 'semanal' | 'quinzenal' | 'mensal' | 'sem_frequencia';
export type HealthWhatsapp = 'na_hora' | 'mesmo_dia' | 'dia_seguinte' | 'dias_depois' | 'nao_responde';
export type HealthAdimplencia = 'em_dia' | 'ate_10_dias' | 'mais_30_dias';
export type HealthRecarga = 'no_dia' | 'ate_10_dias' | 'mais_30_dias';

export type HealthRoiBucket = 'roi_lt_3' | 'roi_3' | 'roi_2' | 'roi_1' | 'roi_gt_1';
export type HealthGrowth = 'perfil_a_lt_50k' | 'perfil_b_gt_50k' | 'negativo' | 'growth_high' | 'growth_medium' | 'growth_low' | 'growth_negative';
export type HealthEngagement = 'alta_perf' | 'estavel' | 'atencao' | 'critico';

export type HealthCheckinProdutivo = 'sim' | 'parcial' | 'nao';
export type HealthProgresso = 'muito' | 'parcial' | 'nao';
export type HealthRelacionamento = 'melhorou' | 'neutro' | 'piorou';
export type HealthAvisoPrevio = 'gt_60_dias' | '30_60_dias' | 'lt_30_dias';
export type HealthPesquisaRespondida = 'sim' | 'nao';

export type HealthCsatTecnico = 'gt_4.5' | 'ate_4' | 'ate_3.5' | 'lt_3';
export type HealthNps = 'promotor' | 'neutro' | 'detrator';
export type HealthMhs = 'muito_desapontado' | 'pouco' | 'indiferente' | 'nada';

export interface HealthInput {
  clientId: string;
  monthKey: string; // "YYYY-MM"
  
  // Vertical 1: Engajamento
  checkin: HealthCheckinFreq;
  whatsapp: HealthWhatsapp;
  adimplencia: HealthAdimplencia;
  recarga: HealthRecarga;
  
  // Vertical 2: Resultados
  roi_bucket: HealthRoiBucket;
  growth: HealthGrowth;
  engagement_vs_avg: HealthEngagement;

  // Vertical 3: Relacionamento
  checkin_produtivo: HealthCheckinProdutivo;
  progresso: HealthProgresso;
  relacionamento_interno: HealthRelacionamento;
  aviso_previo: HealthAvisoPrevio;
  pesquisa_respondida: HealthPesquisaRespondida;

  // Vertical 4: Pesquisas
  csat_tecnico: HealthCsatTecnico;
  nps: HealthNps;
  mhs: HealthMhs;
  pesquisa_geral_respondida: HealthPesquisaRespondida;
  
  // Metadata
  results_focus: 'roi' | 'social' | 'both';
  espera_resultado_mensuravel?: 'sim' | 'nao';
  mensura_resultado_financeiro?: 'sim' | 'nao';
  cliente_apto_pesquisa?: 'sim' | 'nao';
  social_profile?: 'A' | 'B'; // A (<50k), B (>50k)
  last_updated_engagement?: string;
  last_updated_results?: string;
  last_updated_relationship?: string;
  last_updated_surveys?: string;
  lastUpdated?: string; // Legacy/Global fallback
}

export type HealthFlagColor = 'Black' | 'Red' | 'Yellow' | 'Green';

export interface HealthVerticalBreakdown {
  engagement: number;
  results: number;
  relationship: number;
  surveys: number;
}

export interface HealthScoreResult {
  clientId: string;
  monthKey: string;
  score: number;
  flag: HealthFlagColor;
  action: string;
  breakdown: HealthVerticalBreakdown;
  // Teto de pontos de cada vertical PARA ESTE CLIENTE. Varia conforme as
  // verticais desativadas (resultados/pesquisas) redistribuem seus pontos.
  // A UI precisa disto para desenhar as barras: usar 35/25/25/15 fixo faz a
  // barra estourar quando há redistribuição.
  maxBreakdown: HealthVerticalBreakdown;
}

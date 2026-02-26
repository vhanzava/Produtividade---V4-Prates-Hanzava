
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

export interface MonthlyConfigEmp {
  cost: number;
  hours: number;
}

export interface EmployeeConfig {
  name: string;
  department: DepartmentType;
  defaultCost: number;
  defaultHours: number;
  history: Record<string, MonthlyConfigEmp>; // key: "YYYY-MM"
}

export interface ClientConfig {
  name: string;
  isActive: boolean;
  category: ClientCategory;
  defaultFee: number;
  oneTimeFee?: number; // Valor de Implementação/Setup
  contractStartDate?: string; // YYYY-MM-DD
  history: Record<string, number>; // key: "YYYY-MM", value: fee
}

export interface ClientSummary {
  name: string;
  totalHours: number;
  operationalCost: number;
  monthlyFee: number; // Sum of fees for the selected period
  oneTimeFee: number; // Included in revenue logic
  grossProfit: number;
  margin: number;
  isActive: boolean;
  category: ClientCategory;
}

export interface EmployeeSummary {
  name: string;
  totalHours: number;
  capacityHours: number; 
  utilizationRate: number; 
  costGenerated: number;
  department: string;
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
}

export interface UserSession {
  email: string;
  isMaster: boolean;
  isAuthenticated: boolean;
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
export type HealthGrowth = 'perfil_a_lt_50k' | 'perfil_b_gt_50k' | 'negativo';
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
  
  lastUpdated?: string; // ISO Date string
}

export type HealthFlagColor = 'Black' | 'Red' | 'Yellow' | 'Green';

export interface HealthScoreResult {
  clientId: string;
  monthKey: string;
  score: number;
  flag: HealthFlagColor;
  action: string;
  breakdown: {
    engagement: number;
    results: number;
    relationship: number;
    surveys: number;
  };
}

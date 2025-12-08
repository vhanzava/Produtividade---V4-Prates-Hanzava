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
  history: Record<string, number>; // key: "YYYY-MM", value: fee
}

export interface ClientSummary {
  name: string;
  totalHours: number;
  operationalCost: number;
  monthlyFee: number; // Sum of fees for the selected period
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
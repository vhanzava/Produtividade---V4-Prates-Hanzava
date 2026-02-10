import { TimeEntry, EmployeeConfig, ClientConfig, ClientSummary, EmployeeSummary, DashboardSummary, DepartmentSummary, DepartmentType, ClientCategory } from '../types';

// Helper: "01:30" -> 1.5
export const timeToDecimal = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours + (minutes / 60);
};

// Helper: "24/11/2025" -> Date
export const parseDate = (dateStr: string): Date => {
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
};

// Helper: Date -> "YYYY-MM"
export const getMonthKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

// Helper: Get months between two dates (inclusive)
export const getMonthsInRange = (start: Date, end: Date): string[] => {
  const months: string[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= last) {
    months.push(getMonthKey(current));
    current.setMonth(current.getMonth() + 1);
  }
  return months;
};

// CSV Parser
export const parseCSV = (csvContent: string): TimeEntry[] => {
  const lines = csvContent.split(/\r?\n/);
  const entries: TimeEntry[] = [];
  const clean = (str: string) => str ? str.replace(/^"|"$/g, '').trim() : '';

  let headerIndex = -1;
  for(let i=0; i<lines.length; i++) {
    if (lines[i].includes('Executor') && lines[i].includes('Workspace')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const headers = lines[headerIndex].split(';').map(clean);
  const executorIdx = headers.indexOf('Executor');
  const workspaceIdx = headers.indexOf('Workspace');
  const timeIdx = headers.indexOf('Realizado');
  const dateIdx = headers.indexOf('Data');

  if (executorIdx === -1 || workspaceIdx === -1 || timeIdx === -1 || dateIdx === -1) return [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const matches = line.match(/(".*?"|[^";]+)(?=\s*;|\s*$)/g);
    const columns = matches ? matches.map(clean) : line.split(';').map(clean);

    if (columns.length <= Math.max(executorIdx, workspaceIdx, timeIdx, dateIdx)) continue;

    const realizedTime = columns[timeIdx];
    if (!realizedTime || realizedTime === '00:00' || realizedTime === '') continue;

    const decimalTime = timeToDecimal(realizedTime);
    if (decimalTime === 0) continue;

    const dateObj = parseDate(columns[dateIdx]);

    entries.push({
      id: `${i}-${Math.random()}`,
      executor: columns[executorIdx],
      workspace: columns[workspaceIdx],
      realizedTime: realizedTime,
      realizedDecimal: decimalTime,
      dateStr: columns[dateIdx],
      date: dateObj,
      monthKey: getMonthKey(dateObj)
    });
  }

  return entries;
};

export const calculateSummary = (
  entries: TimeEntry[], 
  employees: EmployeeConfig[], 
  clients: ClientConfig[],
  startDateStr: string,
  endDateStr: string
): {
  clientSummaries: ClientSummary[];
  employeeSummaries: EmployeeSummary[];
  departmentSummaries: DepartmentSummary[];
  dashboard: DashboardSummary;
} => {
  
  const empMap = new Map(employees.map(e => [e.name, e]));
  const clientMap = new Map(clients.map(c => [c.name, c]));

  const start = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date();
  const end = endDateStr ? new Date(endDateStr + 'T00:00:00') : new Date();
  const activeMonths = startDateStr && endDateStr ? getMonthsInRange(start, end) : [];

  const getProRataRatio = (monthKey: string): number => {
    if (!startDateStr || !endDateStr) return 1;

    const [y, m] = monthKey.split('-').map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0); 
    monthEnd.setHours(23, 59, 59, 999);

    const filterStart = new Date(start);
    const filterEnd = new Date(end);
    filterEnd.setHours(23, 59, 59, 999); 

    const effectiveStart = filterStart > monthStart ? filterStart : monthStart;
    const effectiveEnd = filterEnd < monthEnd ? filterEnd : monthEnd;

    if (effectiveStart > effectiveEnd) return 0;

    const totalDaysInMonth = monthEnd.getDate();
    const diffMs = effectiveEnd.getTime() - effectiveStart.getTime();
    const daysOverlap = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    
    const safeDays = Math.max(0, Math.min(daysOverlap, totalDaysInMonth));

    return safeDays / totalDaysInMonth;
  };

  // 1. Calculate Costs
  const clientStats = new Map<string, { hours: number; cost: number }>();
  const empStats = new Map<string, { hours: number; cost: number }>();
  
  let totalHoursRealizedGlobal = 0;
  let totalCostGlobal = 0;

  entries.forEach(entry => {
    const empConfig = empMap.get(entry.executor);
    
    let hourlyRate = 0;
    if (empConfig) {
        const monthConfig = empConfig.history[entry.monthKey];
        const cost = monthConfig ? monthConfig.cost : empConfig.defaultCost;
        const hours = monthConfig ? monthConfig.hours : empConfig.defaultHours;
        hourlyRate = hours > 0 ? cost / hours : 0;
    }

    const taskCost = entry.realizedDecimal * hourlyRate;

    const cStat = clientStats.get(entry.workspace) || { hours: 0, cost: 0 };
    cStat.hours += entry.realizedDecimal;
    cStat.cost += taskCost;
    clientStats.set(entry.workspace, cStat);

    const eStat = empStats.get(entry.executor) || { hours: 0, cost: 0 };
    eStat.hours += entry.realizedDecimal;
    eStat.cost += taskCost;
    empStats.set(entry.executor, eStat);

    totalHoursRealizedGlobal += entry.realizedDecimal;
    totalCostGlobal += taskCost;
  });

  // 2. Calculate Revenue (Fee Recorrente + OneTime Fee)
  const clientSummaries: ClientSummary[] = [];
  let totalRevenueGlobal = 0;
  const revenueByCategory: Record<ClientCategory, number> = { 'Saber': 0, 'Ter': 0, 'Executar': 0 };

  const allClientNames = new Set([...clientMap.keys(), ...clientStats.keys()]);

  allClientNames.forEach(name => {
    const stat = clientStats.get(name) || { hours: 0, cost: 0 };
    const config = clientMap.get(name);
    
    let totalFee = 0;
    let realizedOneTimeFee = 0;
    let category: ClientCategory = 'Executar';
    let isActive = true;

    if (config) {
        category = config.category;
        isActive = config.isActive;
        
        // One Time Fee Logic:
        // Se houver um OneTimeFee configurado E o intervalo filtrado incluir a data de início do contrato
        // Se não houver data de início configurada, assumimos que se aplica ao primeiro mês dos dados processados ou filtro
        let shouldApplyOneTime = false;
        if (config.oneTimeFee && config.oneTimeFee > 0) {
            if (config.contractStartDate) {
                const contractStart = new Date(config.contractStartDate);
                // Verifica se a data de início do contrato está dentro do range filtrado
                if (contractStart >= start && contractStart <= end) {
                    shouldApplyOneTime = true;
                }
            } else {
                // Fallback: Se não tem data de contrato, aplica se o filtro estiver no início dos tempos (ex: é a primeira vez que aparece)
                // Para simplificar, vamos aplicar pro-rata se estivermos olhando para um período longo, mas o ideal é ter a data.
                // Como regra simples: Se não tiver data de contrato, NÃO aplicamos automaticamente para evitar duplicação em filtros futuros.
                // O usuário deve definir a data de início.
            }
        }

        if (shouldApplyOneTime) {
            realizedOneTimeFee = config.oneTimeFee || 0;
            totalFee += realizedOneTimeFee;
        }

        activeMonths.forEach(m => {
            const monthlyFee = config.history[m] !== undefined ? config.history[m] : config.defaultFee;
            const ratio = getProRataRatio(m);
            totalFee += monthlyFee * ratio;
        });
    }

    if (stat.hours > 0 || totalFee > 0 || config) {
        const grossProfit = totalFee - stat.cost;
        const margin = totalFee > 0 ? (grossProfit / totalFee) * 100 : 0;

        clientSummaries.push({
            name,
            totalHours: stat.hours,
            operationalCost: stat.cost,
            monthlyFee: totalFee, 
            oneTimeFee: realizedOneTimeFee,
            grossProfit,
            margin,
            isActive,
            category
        });

        if (isActive || totalFee > 0) {
            totalRevenueGlobal += totalFee;
            revenueByCategory[category] += totalFee;
        }
    }
  });

  // 3. Employee & Department Capacity
  const employeeSummaries: EmployeeSummary[] = [];
  const deptStats = new Map<string, { realized: number; capacity: number; count: number }>();
  const departments: DepartmentType[] = ['Criação', 'Atendimento', 'Gestão de Tráfego', 'Gestão', 'Outros'];
  departments.forEach(d => deptStats.set(d, { realized: 0, capacity: 0, count: 0 }));

  const allEmpNames = new Set([...empMap.keys(), ...empStats.keys()]);

  allEmpNames.forEach(name => {
      const stat = empStats.get(name) || { hours: 0, cost: 0 };
      const config = empMap.get(name);
      
      let totalCapacity = 0;
      let dept: string = 'Outros';

      if (config) {
          dept = config.department;
          activeMonths.forEach(m => {
             const mConfig = config.history[m];
             const monthlyCap = mConfig ? mConfig.hours : config.defaultHours;
             const ratio = getProRataRatio(m);
             totalCapacity += monthlyCap * ratio;
          });
      } else {
          activeMonths.forEach(m => {
            const ratio = getProRataRatio(m);
            totalCapacity += 160 * ratio;
          });
      }

      if (totalCapacity === 0 && activeMonths.length === 0) totalCapacity = 160;

      employeeSummaries.push({
          name,
          totalHours: stat.hours,
          capacityHours: totalCapacity,
          utilizationRate: totalCapacity > 0 ? (stat.hours / totalCapacity) * 100 : 0,
          costGenerated: stat.cost,
          department: dept
      });

      const dStat = deptStats.get(dept)!;
      dStat.realized += stat.hours;
      dStat.capacity += totalCapacity;
      dStat.count += 1;
      deptStats.set(dept, dStat);
  });

  const departmentSummaries: DepartmentSummary[] = [];
  let totalCapacityGlobal = 0;

  departments.forEach(dept => {
      const s = deptStats.get(dept)!;
      if (s.count > 0 || s.capacity > 0) {
          departmentSummaries.push({
              name: dept,
              totalHoursRealized: s.realized,
              totalCapacityHours: s.capacity,
              utilizationRate: s.capacity > 0 ? (s.realized / s.capacity) * 100 : 0,
              headcount: s.count
          });
          totalCapacityGlobal += s.capacity;
      }
  });

  const grossProfitGlobal = totalRevenueGlobal - totalCostGlobal;
  const overallMargin = totalRevenueGlobal > 0 ? (grossProfitGlobal / totalRevenueGlobal) * 100 : 0;
  const globalCapacityRate = totalCapacityGlobal > 0 ? (totalHoursRealizedGlobal / totalCapacityGlobal) * 100 : 0;

  return {
    clientSummaries: clientSummaries.sort((a, b) => b.grossProfit - a.grossProfit),
    employeeSummaries: employeeSummaries.sort((a, b) => b.utilizationRate - a.utilizationRate),
    departmentSummaries: departmentSummaries.sort((a, b) => b.utilizationRate - a.utilizationRate),
    dashboard: {
      totalRevenue: totalRevenueGlobal,
      totalCost: totalCostGlobal,
      grossProfit: grossProfitGlobal,
      overallMargin,
      totalHours: totalHoursRealizedGlobal,
      totalCapacityHours: totalCapacityGlobal,
      globalCapacityRate,
      revenueByCategory
    }
  };
};

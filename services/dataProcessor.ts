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

// Helper: Get Brazilian Holidays for a given year
const getHolidays = (year: number): string[] => {
  const fixed = [
    `${year}-01-01`, // Confraternização Universal
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Dia do Trabalho
    `${year}-09-07`, // Independência do Brasil
    `${year}-10-12`, // Nossa Senhora Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-11-20`, // Dia da Consciência Negra
    `${year}-12-25`, // Natal
  ];

  // Movable holidays (Easter based)
  const getEaster = (y: number) => {
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  };

  const easter = getEaster(year);
  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
  };

  const carnivalTue = addDays(easter, -47);
  const carnivalMon = addDays(easter, -48);
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  return [...fixed, carnivalMon, carnivalTue, goodFriday, corpusChristi];
};

// Helper: Count working days (Mon-Fri) in range, excluding ONLY weekends
const countWorkingDays = (start: Date, end: Date): number => {
  let count = 0;
  const current = new Date(start);
  current.setHours(0,0,0,0);
  const last = new Date(end);
  last.setHours(0,0,0,0);

  while (current <= last) {
    const day = current.getDay();
    
    // 0 is Sunday, 6 is Saturday. Mon(1)-Fri(5) are working days.
    // Holidays are considered working days as per user request.
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
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

  // Determine effective date range
  let start: Date;
  let end: Date;
  let hasDateFilter = !!(startDateStr && endDateStr);

  if (startDateStr && endDateStr) {
      start = new Date(startDateStr + 'T00:00:00');
      end = new Date(endDateStr + 'T00:00:00');
  } else if (entries.length > 0) {
      // Infer from entries if no filter provided
      const dates = entries.map(e => e.date.getTime());
      start = new Date(Math.min(...dates));
      end = new Date(Math.max(...dates));
      hasDateFilter = true; // Treat as if we have a range for calculation purposes
  } else {
      start = new Date();
      end = new Date();
      hasDateFilter = false;
  }

  const activeMonths = hasDateFilter ? getMonthsInRange(start, end) : [];

  const getProRataRatio = (monthKey: string, empStartStr?: string, empEndStr?: string): number => {
    // Base filter range
    let filterStart = new Date(start);
    let filterEnd = new Date(end);
    filterEnd.setHours(23, 59, 59, 999);

    // Apply Employee Constraints
    if (empStartStr) {
        const empStart = new Date(empStartStr + 'T00:00:00');
        if (empStart > filterStart) filterStart = empStart;
    }
    if (empEndStr) {
        const empEnd = new Date(empEndStr + 'T23:59:59');
        if (empEnd < filterEnd) filterEnd = empEnd;
    }

    if (!hasDateFilter && !empStartStr && !empEndStr) return 1;

    const [y, m] = monthKey.split('-').map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0); 
    monthEnd.setHours(23, 59, 59, 999);

    const effectiveStart = filterStart > monthStart ? filterStart : monthStart;
    const effectiveEnd = filterEnd < monthEnd ? filterEnd : monthEnd;

    if (effectiveStart > effectiveEnd) return 0;

    const totalWorkingDaysInMonth = countWorkingDays(monthStart, monthEnd);
    if (totalWorkingDaysInMonth === 0) return 0;

    const workingDaysOverlap = countWorkingDays(effectiveStart, effectiveEnd);
    
    return workingDaysOverlap / totalWorkingDaysInMonth;
  };

  // 1. Calculate Costs
  const clientStats = new Map<string, { hours: number; cost: number }>();
  const empStats = new Map<string, { hours: number; cost: number }>();

  let totalHoursRealizedGlobal = 0;
  let totalCostGlobal = 0;

  // Horas realizadas agrupadas pela categoria do cliente atendido
  const hoursByVertical: Record<ClientCategory, number> = { Saber: 0, Ter: 0, Executar: 0 };

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

    // Atribui horas à vertical do cliente que foi atendido
    const clientCat = clientMap.get(entry.workspace)?.category || 'Executar';
    hoursByVertical[clientCat] += entry.realizedDecimal;

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
        const isInadimplente = !!(config?.is_inadimplente);

        clientSummaries.push({
            name,
            totalHours: stat.hours,
            operationalCost: stat.cost,
            monthlyFee: totalFee,
            oneTimeFee: realizedOneTimeFee,
            grossProfit,
            margin,
            isActive,
            category,
            is_inadimplente: isInadimplente
        });

        // Inadimplentes: custo ainda é contabilizado, mas receita é excluída
        // do total real para não distorcer a lucratividade do período.
        if (isActive || totalFee > 0) {
            if (!isInadimplente) {
                totalRevenueGlobal += totalFee;
                revenueByCategory[category] += totalFee;
            }
        }
    }
  });

  // 3. Employee & Department Capacity
  const employeeSummaries: EmployeeSummary[] = [];
  const deptStats = new Map<string, { realized: number; capacity: number; count: number }>();
  const departments: DepartmentType[] = ['Criação', 'Atendimento', 'Gestão de Tráfego', 'Gestão', 'Outros'];
  departments.forEach(d => deptStats.set(d, { realized: 0, capacity: 0, count: 0 }));

  // Capacidade total distribuída pelas verticais configuradas em cada player
  const capacityByVertical: Record<ClientCategory, number> = { Saber: 0, Ter: 0, Executar: 0 };

  const allEmpNames = new Set([...empMap.keys(), ...empStats.keys()]);

  allEmpNames.forEach(name => {
      const stat = empStats.get(name) || { hours: 0, cost: 0 };
      const config = empMap.get(name);
      
      let totalCapacity = 0;
      let dept: string = 'Outros';

      if (config) {
          dept = config.department;
          activeMonths.forEach(m => {
             const [y, month] = m.split('-').map(Number);
             const monthStart = new Date(y, month - 1, 1);
             const monthEnd = new Date(y, month, 0);
             const totalWorkingDays = countWorkingDays(monthStart, monthEnd);
             const monthlyCap = totalWorkingDays * 8; // Dynamic capacity: 8h * working days

             const ratio = getProRataRatio(m, config.startDate, config.endDate);
             totalCapacity += monthlyCap * ratio;
          });
      } else {
          activeMonths.forEach(m => {
            const [y, month] = m.split('-').map(Number);
            const monthStart = new Date(y, month - 1, 1);
            const monthEnd = new Date(y, month, 0);
            const totalWorkingDays = countWorkingDays(monthStart, monthEnd);
            const monthlyCap = totalWorkingDays * 8;

            const ratio = getProRataRatio(m);
            totalCapacity += monthlyCap * ratio;
          });
      }

      if (totalCapacity === 0 && activeMonths.length === 0) totalCapacity = 160;

      // Distribui capacidade do player pelas verticais configuradas (split igual entre verticais)
      const playerVerticals: ClientCategory[] = config?.verticals?.length
          ? config.verticals
          : ['Executar']; // padrão: Executar se não configurado
      const verticalShare = totalCapacity / playerVerticals.length;
      playerVerticals.forEach(v => { capacityByVertical[v] += verticalShare; });

      employeeSummaries.push({
          name,
          totalHours: stat.hours,
          capacityHours: totalCapacity,
          utilizationRate: totalCapacity > 0 ? (stat.hours / totalCapacity) * 100 : 0,
          costGenerated: stat.cost,
          department: dept,
          verticals: playerVerticals
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
      revenueByCategory,
      hoursByVertical,
      capacityByVertical
    }
  };
};

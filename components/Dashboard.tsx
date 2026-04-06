import React, { useState } from 'react';
import { ClientSummary, EmployeeSummary, DashboardSummary, DepartmentSummary, ClientCategory } from '../types';
import { DollarSign, Clock, TrendingUp, AlertTriangle, Briefcase, ArrowUpDown, ArrowUp, ArrowDown, PieChart as PieIcon, BarChart as BarChartIcon, Users, Activity, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie, ReferenceLine } from 'recharts';

interface DashboardProps {
  summary: {
    clientSummaries: ClientSummary[];
    employeeSummaries: EmployeeSummary[];
    departmentSummaries: DepartmentSummary[];
    dashboard: DashboardSummary;
  };
}

const KPICard = ({ title, value, sub, icon: Icon, color }: any) => (
  <div className="bg-white overflow-hidden rounded-lg shadow-sm border border-gray-100 transition-all hover:shadow-md">
    <div className="p-5">
      <div className="flex items-center">
        <div className={`flex-shrink-0 rounded-md p-3 ${color}`}>
          <Icon className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="truncate text-sm font-medium text-gray-500">{title}</dt>
            <dd>
              <div className="text-lg font-bold text-gray-900">{value}</div>
            </dd>
          </dl>
        </div>
      </div>
    </div>
    <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
      <div className="text-sm">
        <span className="font-medium text-gray-500">{sub}</span>
      </div>
    </div>
  </div>
);

type ClientSortKey = keyof ClientSummary;
type EmployeeSortKey = keyof EmployeeSummary;
type TabKey = 'overview' | 'productivity' | 'profitability' | 'player';

const Dashboard: React.FC<DashboardProps> = ({ summary }) => {
  const { dashboard, clientSummaries, employeeSummaries, departmentSummaries } = summary;
  const [activeSubTab, setActiveSubTab] = useState<TabKey>('overview');
  
  // States
  const [clientSortConfig, setClientSortConfig] = useState<{ key: ClientSortKey; direction: 'asc' | 'desc' }>({ key: 'grossProfit', direction: 'asc' });
  const [employeeSortConfig, setEmployeeSortConfig] = useState<{ key: EmployeeSortKey; direction: 'asc' | 'desc' }>({ key: 'utilizationRate', direction: 'desc' });
  const [categoryFilter, setCategoryFilter] = useState<'All' | ClientCategory>('All');

  // Formatters
  const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const fmtPct = (val: number) => `${val.toFixed(2)}%`;
  const fmtNum = (val: number) => val.toFixed(2);

  // Sorting
  const handleClientSort = (key: ClientSortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (clientSortConfig.key === key && clientSortConfig.direction === 'asc') direction = 'desc';
    else if (clientSortConfig.key === key && clientSortConfig.direction === 'desc') direction = 'asc';
    else direction = 'desc';
    setClientSortConfig({ key, direction });
  };

  const handleEmployeeSort = (key: EmployeeSortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (employeeSortConfig.key === key && employeeSortConfig.direction === 'asc') direction = 'desc';
    else if (employeeSortConfig.key === key && employeeSortConfig.direction === 'desc') direction = 'asc';
    else direction = 'desc';
    setEmployeeSortConfig({ key, direction });
  };

  // FILTER LOGIC
  const activeClientSummaries = clientSummaries.filter(c => (c.isActive || c.totalHours > 0) && (categoryFilter === 'All' || c.category === categoryFilter));
  
  // Filter employees: show if totalHours > 0 OR (capacityHours > 0 AND totalHours > 0)
  // Request: "se o player não tem horas apontadas ... não deve aparecer"
  // Request: "se esse player já saiu, mas filtrei um período que tem apontamentos ... cabe mostra-lo"
  // Simplification: Show if totalHours > 0.
  const activeEmployeeSummaries = employeeSummaries.filter(e => e.totalHours > 0);

  const sortedClients = [...activeClientSummaries].sort((a, b) => {
    const valA = a[clientSortConfig.key];
    const valB = b[clientSortConfig.key];
    if (valA < valB) return clientSortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return clientSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const sortedEmployees = [...activeEmployeeSummaries].sort((a, b) => {
      const valA = a[employeeSortConfig.key];
      const valB = b[employeeSortConfig.key];
      if (valA < valB) return employeeSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return employeeSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
  });

  // Chart Data Prep
  const sortedByProfit = [...activeClientSummaries].sort((a, b) => b.grossProfit - a.grossProfit);
  let chartDataRaw = sortedByProfit;
  if (sortedByProfit.length > 20) chartDataRaw = [...sortedByProfit.slice(0, 10), ...sortedByProfit.slice(-5)];
  
  const clientChartData = chartDataRaw.map(c => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
    Lucro: parseFloat(c.grossProfit.toFixed(2)),
    Fee: c.monthlyFee,
    Custo: parseFloat(c.operationalCost.toFixed(2))
  }));

  const revenueByCatData = [
      { name: 'Executar', value: dashboard.revenueByCategory['Executar'] },
      { name: 'Ter', value: dashboard.revenueByCategory['Ter'] },
      { name: 'Saber', value: dashboard.revenueByCategory['Saber'] },
  ];
  // V4 Colors (Red/Black/Gray scale adapted for charts)
  const CAT_COLORS = ['#b91c1c', '#404040', '#9ca3af']; // Red-700, Neutral-700, Gray-400

  const capacityPieData = [
    { name: 'Utilizado', value: dashboard.totalHours },
    { name: 'Ocioso', value: Math.max(0, dashboard.totalCapacityHours - dashboard.totalHours) }
  ];
  const PIE_COLORS = ['#b91c1c', '#f3f4f6']; // Red, Light Gray

  const deptChartData = departmentSummaries.map(d => ({
      name: d.name,
      Capacidade: d.totalCapacityHours,
      Realizado: d.totalHoursRealized
  }));

  const employeeChartData = activeEmployeeSummaries.map(e => ({
      name: e.name.split(' ')[0], 
      Capacidade: e.capacityHours,
      Realizado: e.totalHours,
      Ocupacao: e.utilizationRate
  }));

  const ClientSortIcon = ({ columnKey }: { columnKey: ClientSortKey }) => {
      if (clientSortConfig.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 text-gray-400" />;
      return clientSortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-red-600" /> : <ArrowDown size={14} className="ml-1 text-red-600" />;
  };

  const EmployeeSortIcon = ({ columnKey }: { columnKey: EmployeeSortKey }) => {
      if (employeeSortConfig.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 text-gray-400" />;
      return employeeSortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1 text-red-600" /> : <ArrowDown size={14} className="ml-1 text-red-600" />;
  };

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: PieIcon },
    { id: 'productivity', label: 'Produtividade Geral', icon: Activity },
    { id: 'profitability', label: 'Lucratividade', icon: BarChartIcon },
    { id: 'player', label: 'Visão por Player', icon: Users },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Internal Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as TabKey)}
              className={`
                group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeSubTab === tab.id
                  ? 'border-red-600 text-red-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className={`-ml-0.5 mr-2 h-5 w-5 ${activeSubTab === tab.id ? 'text-red-600' : 'text-gray-400 group-hover:text-gray-500'}`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeSubTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
           <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            <KPICard title="Faturamento" value={fmt(dashboard.totalRevenue)} sub="Total Filtrado" icon={DollarSign} color="bg-green-600" />
            <KPICard title="Custo Operacional" value={fmt(dashboard.totalCost)} sub={`${fmtNum(dashboard.totalHours)} horas`} icon={Clock} color="bg-red-600" />
            <KPICard title="Lucro Bruto" value={fmt(dashboard.grossProfit)} sub={`${fmtPct(dashboard.overallMargin)} Margem`} icon={TrendingUp} color={dashboard.grossProfit >= 0 ? "bg-gray-800" : "bg-red-500"} />
            <KPICard title="Menor Margem" value={activeClientSummaries.length > 0 ? activeClientSummaries.sort((a,b) => a.margin - b.margin)[0].name : "N/A"} sub={activeClientSummaries.length > 0 ? fmtPct(activeClientSummaries.sort((a,b) => a.margin - b.margin)[0].margin) : "0%"} icon={AlertTriangle} color="bg-orange-500" />
            <KPICard title="Capacidade Geral" value={fmtPct(dashboard.globalCapacityRate)} sub="Ocupação" icon={Briefcase} color="bg-blue-600" />
          </div>

          {/* Carteira por Categoria (Saber × Ter × Executar) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(['Executar', 'Saber', 'Ter'] as const).map((cat) => {
              const catClients = activeClientSummaries.filter(c => c.category === cat);
              const catRevenue = dashboard.revenueByCategory[cat];
              const catCost = catClients.reduce((s, c) => s + c.operationalCost, 0);
              const catProfit = catRevenue - catCost;
              const catMargin = catRevenue > 0 ? (catProfit / catRevenue) * 100 : 0;
              const inadimplentesCount = catClients.filter(c => c.is_inadimplente).length;
              const colors: Record<string, { bg: string; bar: string; badge: string }> = {
                Executar: { bg: 'bg-red-50 border-red-200', bar: 'bg-red-600', badge: 'bg-red-100 text-red-700' },
                Saber:    { bg: 'bg-yellow-50 border-yellow-200', bar: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700' },
                Ter:      { bg: 'bg-green-50 border-green-200', bar: 'bg-green-600', badge: 'bg-green-100 text-green-700' },
              };
              const c = colors[cat];
              const totalRevAll = Object.values(dashboard.revenueByCategory).reduce((a, b) => a + b, 0);
              const sharePct = totalRevAll > 0 ? (catRevenue / totalRevAll) * 100 : 0;
              return (
                <div key={cat} className={`bg-white rounded-lg shadow-sm border p-6 ${c.bg}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-800">{cat}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${c.badge}`}>
                      {catClients.length} cliente{catClients.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between"><span>Receita</span><span className="font-semibold text-gray-900">{fmt(catRevenue)}</span></div>
                    <div className="flex justify-between"><span>Custo</span><span className="font-semibold text-gray-900">{fmt(catCost)}</span></div>
                    <div className="flex justify-between"><span>Lucro</span><span className={`font-bold ${catProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(catProfit)}</span></div>
                    <div className="flex justify-between"><span>Margem</span><span className="font-semibold text-gray-900">{fmtPct(catMargin)}</span></div>
                  </div>
                  {/* Barra de participação na receita total */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Participação na Receita</span>
                      <span>{sharePct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full ${c.bar}`} style={{ width: `${sharePct}%` }} />
                    </div>
                  </div>
                  {inadimplentesCount > 0 && (
                    <p className="mt-3 text-xs text-red-600 font-medium">
                      ⚠ {inadimplentesCount} inadimplente{inadimplentesCount > 1 ? 's' : ''} — receita excluída do total
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Capacidade e Ocupação por Vertical */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Gráfico Barras: Capacidade vs Realizado por Vertical */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Capacidade vs Realizado por Vertical</h3>
              <p className="text-xs text-gray-400 mb-4">Capacidade = horas configuradas por vertical do player · Realizado = horas lançadas por categoria de cliente</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(['Executar', 'Saber', 'Ter'] as const).map(cat => ({
                      name: cat,
                      Capacidade: parseFloat((dashboard.capacityByVertical[cat] || 0).toFixed(1)),
                      Realizado:  parseFloat((dashboard.hoursByVertical[cat]    || 0).toFixed(1)),
                      taxa: dashboard.capacityByVertical[cat] > 0
                        ? ((dashboard.hoursByVertical[cat] / dashboard.capacityByVertical[cat]) * 100).toFixed(0)
                        : '0'
                    }))}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 13, fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${fmtNum(v)}h`} />
                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 8 }} />
                    <Bar dataKey="Capacidade" fill="#e5e7eb" radius={[4,4,0,0]} />
                    <Bar dataKey="Realizado" radius={[4,4,0,0]}>
                      {(['Executar', 'Saber', 'Ter'] as const).map(cat => (
                        <Cell key={cat} fill={cat === 'Executar' ? '#b91c1c' : cat === 'Saber' ? '#d97706' : '#16a34a'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Taxa de ocupação por vertical */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                {(['Executar', 'Saber', 'Ter'] as const).map(cat => {
                  const cap = dashboard.capacityByVertical[cat] || 0;
                  const real = dashboard.hoursByVertical[cat] || 0;
                  const taxa = cap > 0 ? (real / cap) * 100 : 0;
                  const colorBar = cat === 'Executar' ? 'bg-red-600' : cat === 'Saber' ? 'bg-yellow-500' : 'bg-green-600';
                  const colorText = cat === 'Executar' ? 'text-red-700' : cat === 'Saber' ? 'text-yellow-700' : 'text-green-700';
                  return (
                    <div key={cat} className="text-center">
                      <p className={`text-sm font-bold ${colorText}`}>{cat}</p>
                      <p className="text-xl font-extrabold text-gray-800">{taxa.toFixed(0)}%</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className={`h-1.5 rounded-full ${colorBar}`} style={{ width: `${Math.min(taxa, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">{fmtNum(real)}h / {fmtNum(cap)}h</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Donut: distribuição das horas realizadas por vertical */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Distribuição de Horas por Vertical</h3>
              <p className="text-xs text-gray-400 mb-2">Baseado nas horas lançadas por categoria de cliente atendido</p>
              <div className="flex-1 relative min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(['Executar', 'Saber', 'Ter'] as const)
                        .map(cat => ({ name: cat, value: parseFloat((dashboard.hoursByVertical[cat] || 0).toFixed(1)) }))
                        .filter(d => d.value > 0)}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={95}
                      paddingAngle={4} dataKey="value"
                    >
                      {(['Executar', 'Saber', 'Ter'] as const).map(cat => (
                        <Cell key={cat} fill={cat === 'Executar' ? '#b91c1c' : cat === 'Saber' ? '#d97706' : '#16a34a'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${fmtNum(v)}h`} />
                    <Legend verticalAlign="bottom" height={28} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <span className="text-2xl font-bold text-gray-800">{fmtPct(dashboard.globalCapacityRate)}</span>
                  <br /><span className="text-gray-500 text-xs">Ocupação Global</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'productivity' && (
        <div className="space-y-8 animate-fade-in">
           <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-[600px]">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-6">Produtividade por Área</h3>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptChartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => fmtNum(value)} />
                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar dataKey="Capacidade" fill="#e5e7eb" />
                    <Bar dataKey="Realizado" fill="#b91c1c" />
                  </BarChart>
              </ResponsiveContainer>
           </div>
           <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Departamento</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Colaboradores</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Capacidade (h)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Realizado (h)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ocupação</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {departmentSummaries.map((dept, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{dept.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 text-right">{dept.headcount}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 text-right">{fmtNum(dept.totalCapacityHours)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 text-right">{fmtNum(dept.totalHoursRealized)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 text-right">{fmtPct(dept.utilizationRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
      )}

      {activeSubTab === 'profitability' && (
        <div className="space-y-8 animate-fade-in">
           
           {/* Filters */}
           <div className="flex justify-end">
               <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-md border border-gray-300 shadow-sm">
                   <Filter size={16} className="text-gray-500" />
                   <span className="text-xs font-medium text-gray-500">Filtrar Categoria:</span>
                   <select 
                       value={categoryFilter}
                       onChange={(e) => setCategoryFilter(e.target.value as any)}
                       className="text-sm border-none focus:ring-0 text-gray-700 font-medium bg-transparent cursor-pointer outline-none"
                   >
                       <option value="All">Todas</option>
                       <option value="Saber">Saber</option>
                       <option value="Ter">Ter</option>
                       <option value="Executar">Executar</option>
                   </select>
               </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-6">Visão Financeira por Cliente (Top e Bottom)</h3>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={clientChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={80} />
                                <YAxis />
                                <Tooltip formatter={(value: number) => fmt(value)} />
                                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                                <Bar dataKey="Fee" fill="#404040" />
                                <Bar dataKey="Custo" fill="#b91c1c" />
                                <Bar dataKey="Lucro">
                                    {clientChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.Lucro >= 0 ? '#16a34a' : '#dc2626'} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-6 text-center">Receita por Categoria</h3>
                    <div className="flex-1 min-h-0 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={revenueByCatData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} fill="#8884d8" paddingAngle={5} dataKey="value">
                                    {revenueByCatData.map((entry, index) => <Cell key={`cell-${index}`} fill={CAT_COLORS[index % CAT_COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(val: number) => fmt(val)} />
                                <Legend verticalAlign="bottom" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
           </div>

           <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Tabela de Lucratividade {categoryFilter !== 'All' ? `(${categoryFilter})` : ''}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleClientSort('name')}>
                          <div className="flex items-center">Cliente <ClientSortIcon columnKey="name" /></div>
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Categoria</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleClientSort('totalHours')}>
                          <div className="flex items-center justify-end">Horas <ClientSortIcon columnKey="totalHours" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleClientSort('operationalCost')}>
                          <div className="flex items-center justify-end">Custo <ClientSortIcon columnKey="operationalCost" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleClientSort('monthlyFee')}>
                          <div className="flex items-center justify-end">Fee <ClientSortIcon columnKey="monthlyFee" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleClientSort('grossProfit')}>
                          <div className="flex items-center justify-end">Lucro <ClientSortIcon columnKey="grossProfit" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleClientSort('margin')}>
                          <div className="flex items-center justify-end">Margem <ClientSortIcon columnKey="margin" /></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedClients.map((client, idx) => (
                      <tr key={idx} className={`hover:bg-gray-50 transition-colors ${!client.isActive ? 'bg-gray-50 opacity-70' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {client.name}
                            {!client.isActive && <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1 rounded">Inativo</span>}
                            {client.is_inadimplente && <span className="ml-2 text-[10px] bg-red-100 text-red-700 border border-red-200 px-1 rounded">Inadimplente</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs border ${
                                client.category === 'Saber' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                client.category === 'Ter' ? 'bg-green-50 text-green-700 border-green-200' :
                                'bg-red-50 text-red-700 border-red-200'
                            }`}>{client.category}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">{fmtNum(client.totalHours)}h</td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">{fmt(client.operationalCost)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">{fmt(client.monthlyFee)}</td>
                        <td className={`px-6 py-4 text-sm font-medium text-right ${client.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmt(client.grossProfit)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">
                          <span className={`px-2 rounded-full text-xs font-semibold ${client.margin >= 20 ? 'bg-green-100 text-green-800' : client.margin > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                            {fmtPct(client.margin)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {activeSubTab === 'player' && (
        <div className="space-y-8 animate-fade-in">
           <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-[600px]">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-6">Capacidade vs Realizado por Colaborador</h3>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={employeeChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} />
                      <YAxis />
                      <Tooltip formatter={(value: number) => fmtNum(value)} />
                      <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                      <Bar dataKey="Capacidade" fill="#f3f4f6" />
                      <Bar dataKey="Realizado">
                        {employeeChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.Ocupacao > 100 ? '#ef4444' : entry.Ocupacao > 85 ? '#eab308' : '#b91c1c'} />
                        ))}
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
           </div>
           <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleEmployeeSort('name')}>
                          <div className="flex items-center">Nome <EmployeeSortIcon columnKey="name" /></div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Depto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verticais</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleEmployeeSort('capacityHours')}>
                          <div className="flex items-center justify-end">Capacidade <EmployeeSortIcon columnKey="capacityHours" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleEmployeeSort('totalHours')}>
                          <div className="flex items-center justify-end">Realizado <EmployeeSortIcon columnKey="totalHours" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleEmployeeSort('utilizationRate')}>
                          <div className="flex items-center justify-end">Ocupação <EmployeeSortIcon columnKey="utilizationRate" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => handleEmployeeSort('costGenerated')}>
                          <div className="flex items-center justify-end">Custo <EmployeeSortIcon columnKey="costGenerated" /></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedEmployees.map((emp, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{emp.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{emp.department}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1 flex-wrap">
                            {(emp.verticals || ['Executar']).map(v => (
                              <span key={v} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                v === 'Executar' ? 'bg-red-100 text-red-700' :
                                v === 'Saber'    ? 'bg-yellow-100 text-yellow-700' :
                                                   'bg-green-100 text-green-700'
                              }`}>{v}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">{fmtNum(emp.capacityHours)}h</td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">{fmtNum(emp.totalHours)}h</td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">
                           <span className={`px-2 py-1 rounded text-xs font-bold ${
                               emp.utilizationRate > 100 ? 'bg-red-100 text-red-800' :
                               emp.utilizationRate > 85 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                           }`}>
                               {fmtPct(emp.utilizationRate)}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">{fmt(emp.costGenerated)}</td>
                      </tr>
                    ))}
                  </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
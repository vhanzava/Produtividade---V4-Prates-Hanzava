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
  
  const sortedClients = [...activeClientSummaries].sort((a, b) => {
    const valA = a[clientSortConfig.key];
    const valB = b[clientSortConfig.key];
    if (valA < valB) return clientSortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return clientSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const sortedEmployees = [...employeeSummaries].sort((a, b) => {
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

  const employeeChartData = employeeSummaries.map(e => ({
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
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center">
             <h3 className="text-xl font-medium leading-6 text-gray-900 mb-6 text-center">Utilização da Capacidade Global</h3>
             <div className="h-[500px] w-full max-w-2xl relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                      <Pie data={capacityPieData} cx="50%" cy="50%" innerRadius={120} outerRadius={180} fill="#8884d8" paddingAngle={5} dataKey="value">
                          {capacityPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(val: number) => `${fmtNum(val)}h`} />
                      <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                  <span className="text-4xl font-bold text-gray-800">{fmtPct(dashboard.globalCapacityRate)}</span>
                  <br/> <span className="text-gray-500 text-sm">Ocupado</span>
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
                      <ReferenceLine y={160} label="Ref 160h" stroke="red" strokeDasharray="3 3" />
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
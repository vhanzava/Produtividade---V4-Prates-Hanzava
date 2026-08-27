import React, { useState } from 'react';
import { ClientSummary, EmployeeSummary, DashboardSummary, DepartmentSummary, ClientCategory } from '../types';
import { DollarSign, Clock, TrendingUp, AlertTriangle, Briefcase, ArrowUpDown, ArrowUp, ArrowDown, PieChart as PieIcon, BarChart as BarChartIcon, Users, Activity, Filter, Eye, EyeOff, Lock } from 'lucide-react';
import { formatPersonName, shortPersonName } from '../services/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie, ReferenceLine } from 'recharts';

interface DashboardProps {
  /**
   * Custo por pessoa é dado sensível. Só quem tem esta permissão consegue
   * revelar a coluna, e a revelação é local e efêmera: vale para esta sessão
   * neste navegador, não fica salva nem afeta o que os outros veem.
   */
  canViewCost?: boolean;
  summary: {
    clientSummaries: ClientSummary[];
    employeeSummaries: EmployeeSummary[];
    departmentSummaries: DepartmentSummary[];
    dashboard: DashboardSummary;
  };
}

/**
 * Ladrilho de métrica.
 *
 * A versão anterior gastava metade da altura num quadrado de ícone colorido e
 * numa tarja de rodapé cinza, deixando o número — que é o conteúdo — como o
 * terceiro elemento mais evidente do card. Aqui o valor manda: rótulo discreto
 * em cima, número grande, contexto logo abaixo. `tone` colore apenas o número,
 * nunca o card inteiro, para que a cor signifique valor e não decoração.
 */
const KPICard = ({ title, value, sub, icon: Icon, tone = 'neutral' }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType;
  tone?: 'neutral' | 'pos' | 'neg';
}) => {
  const valueTone =
    tone === 'pos' ? 'text-pos-600' : tone === 'neg' ? 'text-neg-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <span className="text-sm font-medium text-gray-500">{title}</span>
      </div>
      <div className={`metric text-2xl font-semibold leading-none ${valueTone}`}>{value}</div>
      {sub && <div className="mt-2 text-sm text-gray-500 tnum">{sub}</div>}
    </div>
  );
};

type ClientSortKey = keyof ClientSummary;
type EmployeeSortKey = keyof EmployeeSummary;
type TabKey = 'overview' | 'productivity' | 'profitability' | 'player';

const Dashboard: React.FC<DashboardProps> = ({ summary, canViewCost = false }) => {
  const { dashboard, clientSummaries, employeeSummaries, departmentSummaries } = summary;
  const [activeSubTab, setActiveSubTab] = useState<TabKey>('overview');
  
  // States
  const [clientSortConfig, setClientSortConfig] = useState<{ key: ClientSortKey; direction: 'asc' | 'desc' }>({ key: 'operatingMargin', direction: 'asc' });
  const [employeeSortConfig, setEmployeeSortConfig] = useState<{ key: EmployeeSortKey; direction: 'asc' | 'desc' }>({ key: 'utilizationRate', direction: 'desc' });
  const [categoryFilter, setCategoryFilter] = useState<'All' | ClientCategory>('All');
  // Deliberadamente NÃO persistido: revelar é um ato pontual, e a próxima
  // abertura da tela volta a esconder.
  const [custoVisivel, setCustoVisivel] = useState(false);

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
  // Filtra por qualquer categoria que o cliente movimente — um cliente de
  // Executar com implementação em Ter aparece nos dois filtros.
  const activeClientSummaries = clientSummaries.filter(c => (c.isActive || c.totalHours > 0) && (categoryFilter === 'All' || c.categories.includes(categoryFilter)));
  
  // Filter employees: show if totalHours > 0 OR (capacityHours > 0 AND totalHours > 0)
  // Request: "se o player não tem horas apontadas ... não deve aparecer"
  // Request: "se esse player já saiu, mas filtrei um período que tem apontamentos ... cabe mostra-lo"
  // Simplification: Show if totalHours > 0.
  const activeEmployeeSummaries = employeeSummaries.filter(e => e.totalHours > 0);

  // Calculado uma vez: a versão anterior chamava .sort() dentro do JSX, que
  // ordena o array NO LUGAR — reembaralhando a mesma lista já usada na tabela.
  const piorCliente = activeClientSummaries.length
      ? activeClientSummaries.reduce((pior, c) => (c.margin < pior.margin ? c : pior))
      : null;

  const sortedClients = [...activeClientSummaries].sort((a, b) => {
    const valA = a[clientSortConfig.key];
    const valB = b[clientSortConfig.key];
    if (valA < valB) return clientSortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return clientSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const sortedEmployees = [...activeEmployeeSummaries].sort((a, b) => {
      const valA = a[employeeSortConfig.key] ?? '';
      const valB = b[employeeSortConfig.key] ?? '';
      if (valA < valB) return employeeSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return employeeSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
  });

  // Chart Data Prep
  const sortedByProfit = [...activeClientSummaries].sort((a, b) => b.operatingMargin - a.operatingMargin);
  let chartDataRaw = sortedByProfit;
  if (sortedByProfit.length > 20) chartDataRaw = [...sortedByProfit.slice(0, 10), ...sortedByProfit.slice(-5)];
  
  const clientChartData = chartDataRaw.map(c => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
    'Margem Op.': parseFloat(c.operatingMargin.toFixed(2)),
    Faturamento: c.netRevenue,
    Custo: parseFloat(c.operationalCost.toFixed(2))
  }));

  const revenueByCatData = [
      { name: 'Executar', value: dashboard.revenueByCategory['Executar'] },
      { name: 'Ter', value: dashboard.revenueByCategory['Ter'] },
      { name: 'Saber', value: dashboard.revenueByCategory['Saber'] },
  ];
  // V4 Colors (Red/Black/Gray scale adapted for charts)
  // Mesmas três cores das verticais em toda a ferramenta: Executar grafite,
  // Saber âmbar, Ter teal. Vermelho fica reservado para prejuízo.
  const CAT_COLORS = ['#1f2937', '#f59e0b', '#0d9488'];

  const capacityPieData = [
    { name: 'Utilizado', value: dashboard.totalHours },
    { name: 'Ocioso', value: Math.max(0, dashboard.totalCapacityHours - dashboard.totalHours) }
  ];
  const PIE_COLORS = ['#1f2937', '#e5e7eb'];

  const deptChartData = departmentSummaries.map(d => ({
      name: d.name,
      Capacidade: d.totalCapacityHours,
      Realizado: d.totalHoursRealized
  }));

  const employeeChartData = activeEmployeeSummaries.map(e => ({
      name: shortPersonName(e.name),
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
          {dashboard.monthsWithEntries < dashboard.monthsInPeriod && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold">Margem inflada: o período tem mais meses que apontamentos.</p>
                <p className="mt-1 text-amber-800 leading-relaxed">
                  O filtro cobre <strong className="tnum">{dashboard.monthsInPeriod}</strong>{" "}
                  {dashboard.monthsInPeriod === 1 ? "mês" : "meses"}, mas só{" "}
                  <strong className="tnum">{dashboard.monthsWithEntries}</strong>{" "}
                  {dashboard.monthsWithEntries === 1 ? "tem" : "têm"} horas lançadas. O faturamento é
                  gerado do cadastro para todo mês do período, mas o custo só existe onde há
                  apontamento — então a margem aparece bem maior do que é. Sincronize os meses que
                  faltam ou reduza o período.
                </p>
              </div>
            </div>
          )}

           <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            <KPICard title="Faturamento" value={fmt(dashboard.totalRevenue)} sub="líquido de matriz e imposto" icon={DollarSign} />
            <KPICard title="Custo Operacional" value={fmt(dashboard.totalCost)} sub={`${fmtNum(dashboard.totalHours)} horas apontadas`} icon={Clock} />
            <KPICard
              title="Margem Operacional"
              value={fmt(dashboard.operatingMargin)}
              sub={`${fmtPct(dashboard.overallMargin)} de margem`}
              icon={TrendingUp}
              tone={dashboard.operatingMargin >= 0 ? 'pos' : 'neg'}
            />
            <KPICard
              title="Menor Margem"
              value={piorCliente ? piorCliente.name : '—'}
              sub={piorCliente ? fmtPct(piorCliente.margin) : 'sem clientes no período'}
              icon={AlertTriangle}
              tone={piorCliente && piorCliente.margin < 0 ? 'neg' : 'neutral'}
            />
            <KPICard title="Capacidade Geral" value={fmtPct(dashboard.globalCapacityRate)} sub="das horas disponíveis" icon={Briefcase} />
          </div>

          {/* Carteira por Categoria (Saber × Ter × Executar) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(['Executar', 'Saber', 'Ter'] as const).map((cat) => {
              // Contagem inclui quem movimenta a categoria por qualquer via
              // (recorrente ou implementação), para bater com a receita.
              const catClients = activeClientSummaries.filter(c => c.categories.includes(cat));
              const catRevenue = dashboard.revenueByCategory[cat];
              // Custo fica na categoria do RECORRENTE. As horas do eKyte ainda não
              // são classificadas entre setup e recorrente, então rateá-las entre
              // duas categorias seria chute — e contá-las nas duas inflaria o custo.
              const catCost = activeClientSummaries
                .filter(c => c.category === cat)
                .reduce((s, c) => s + c.operationalCost, 0);
              const catProfit = catRevenue - catCost;
              const catMargin = catRevenue > 0 ? (catProfit / catRevenue) * 100 : 0;
              const inadimplentesCount = catClients.filter(c => c.is_inadimplente).length;
              // Só um ponto de cor, e não o card inteiro tingido. Com fundo
              // vermelho-50, "Executar" lia como alerta — num painel onde
              // vermelho já significa prejuízo, a categoria parecia um problema.
              const colors: Record<string, { dot: string; bar: string }> = {
                Executar: { dot: 'bg-gray-800', bar: 'bg-gray-800' },
                Saber:    { dot: 'bg-amber-500', bar: 'bg-amber-500' },
                Ter:      { dot: 'bg-teal-600', bar: 'bg-teal-600' },
              };
              const c = colors[cat];
              const totalRevAll = Object.values(dashboard.revenueByCategory).reduce((a, b) => a + b, 0);
              const sharePct = totalRevAll > 0 ? (catRevenue / totalRevAll) * 100 : 0;
              return (
                <div key={cat} className="bg-white rounded-xl border border-gray-200 shadow-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} aria-hidden="true" />
                      <h3 className="text-base font-semibold text-gray-900">{cat}</h3>
                    </div>
                    <span className="text-sm text-gray-500 tnum">
                      {catClients.length} cliente{catClients.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between"><span>Faturamento</span><span className="font-medium text-gray-900 tnum">{fmt(catRevenue)}</span></div>
                    <div className="flex justify-between"><span>Custo</span><span className="font-medium text-gray-900 tnum">{fmt(catCost)}</span></div>
                    <div className="flex justify-between"><span>Margem Op.</span><span className={`font-semibold tnum ${catProfit >= 0 ? 'text-pos-600' : 'text-neg-600'}`}>{fmt(catProfit)}</span></div>
                    <div className="flex justify-between"><span>Margem %</span><span className={`font-medium tnum ${catMargin >= 0 ? 'text-gray-900' : 'text-neg-600'}`}>{fmtPct(catMargin)}</span></div>
                  </div>
                  {/* Barra de participação na receita total */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
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
              <p className="text-xs text-gray-500 mb-4">Capacidade = horas configuradas por vertical do player · Realizado = horas lançadas por categoria de cliente</p>
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
                      <p className="text-[11px] text-gray-500 mt-1 tnum">{fmtNum(real)}h / {fmtNum(cap)}h</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Donut: distribuição das horas realizadas por vertical */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Distribuição de Horas por Vertical</h3>
              <p className="text-xs text-gray-500 mb-2">Baseado nas horas lançadas por categoria de cliente atendido</p>
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
           <div className="bg-white rounded-xl border border-gray-200 shadow-card overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="sticky-head bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-[13px] font-semibold text-gray-500">Departamento</th>
                    <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500">Colaboradores</th>
                    <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500">Capacidade (h)</th>
                    <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500">Realizado (h)</th>
                    <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500">Ocupação</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {departmentSummaries.map((dept, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-3.5 text-sm font-medium text-gray-900">{dept.name}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-500 text-right">{dept.headcount}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-500 text-right">{fmtNum(dept.totalCapacityHours)}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-500 text-right">{fmtNum(dept.totalHoursRealized)}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-500 text-right">{fmtPct(dept.utilizationRate)}</td>
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
                                <Bar dataKey="Margem Op.">
                                    {clientChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry['Margem Op.'] >= 0 ? '#047857' : '#DC2626'} />)}
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

           <div className="bg-white rounded-xl border border-gray-200 shadow-card overflow-hidden">
              <div className="px-6 py-3.5 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Tabela de Lucratividade {categoryFilter !== 'All' ? `(${categoryFilter})` : ''}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="sticky-head bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-[13px] font-semibold text-gray-500 cursor-pointer" onClick={() => handleClientSort('name')}>
                          <div className="flex items-center">Cliente <ClientSortIcon columnKey="name" /></div>
                      </th>
                      <th className="px-6 py-3 text-center text-[13px] font-semibold text-gray-500">Categoria</th>
                      <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500 cursor-pointer" onClick={() => handleClientSort('totalHours')}>
                          <div className="flex items-center justify-end">Horas <ClientSortIcon columnKey="totalHours" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500 cursor-pointer" onClick={() => handleClientSort('operationalCost')}>
                          <div className="flex items-center justify-end">Custo <ClientSortIcon columnKey="operationalCost" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500 cursor-pointer" onClick={() => handleClientSort('grossRevenue')} title="Valor cheio de contrato reconhecido no período — o número que bate com o PDF.">
                          <div className="flex items-center justify-end">Contrato <ClientSortIcon columnKey="grossRevenue" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500 cursor-pointer" onClick={() => handleClientSort('netRevenue')} title="O que entra de fato: contrato menos 20% de matriz e 6% de imposto. Em cliente de repasse, menos o repasse e só o imposto.">
                          <div className="flex items-center justify-end">Faturamento <ClientSortIcon columnKey="netRevenue" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500 cursor-pointer" onClick={() => handleClientSort('operatingMargin')}>
                          <div className="flex items-center justify-end">Margem Op. <ClientSortIcon columnKey="operatingMargin" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500 cursor-pointer" onClick={() => handleClientSort('margin')}>
                          <div className="flex items-center justify-end">Margem % <ClientSortIcon columnKey="margin" /></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedClients.map((client, idx) => (
                      <tr key={idx} className={`hover:bg-gray-50 transition-colors ${!client.isActive ? 'bg-gray-50 opacity-70' : ''}`}>
                        <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-gray-900">
                            {client.name}
                            {!client.isActive && <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1 rounded">Inativo</span>}
                            {client.is_inadimplente && <span className="ml-2 text-[10px] bg-red-100 text-red-700 border border-red-200 px-1 rounded">Inadimplente</span>}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                            <div className="flex flex-wrap gap-1 justify-center">
                                {client.categories.map(cat => (
                                    <span
                                        key={cat}
                                        title={cat === client.category
                                            ? 'Categoria do fee recorrente'
                                            : 'Categoria da implementação reconhecida no período'}
                                        className={`px-2 py-1 rounded text-xs border ${
                                            cat === 'Saber' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                            cat === 'Ter' ? 'bg-teal-50 text-teal-800 border-teal-200' :
                                            'bg-gray-100 text-gray-700 border-gray-300'
                                        }`}
                                    >{cat}</span>
                                ))}
                            </div>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-500 text-right">{fmtNum(client.totalHours)}h</td>
                        <td className="px-6 py-3.5 text-sm text-gray-500 text-right">{fmt(client.operationalCost)}</td>
                        <td className="px-6 py-3.5 text-sm text-gray-500 text-right">{fmt(client.grossRevenue)}</td>
                        <td className="px-6 py-3.5 text-sm text-gray-700 font-medium text-right">{fmt(client.netRevenue)}</td>
                        <td className={`px-6 py-4 text-sm font-medium text-right ${client.operatingMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmt(client.operatingMargin)}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-500 text-right">
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
           <div className="bg-white rounded-xl border border-gray-200 shadow-card overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="sticky-head bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-[13px] font-semibold text-gray-500 cursor-pointer" onClick={() => handleEmployeeSort('name')}>
                          <div className="flex items-center">Nome <EmployeeSortIcon columnKey="name" /></div>
                      </th>
                      <th className="px-6 py-3 text-left text-[13px] font-semibold text-gray-500">Depto</th>
                      <th className="px-6 py-3 text-left text-[13px] font-semibold text-gray-500">Verticais</th>
                      <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500 cursor-pointer" onClick={() => handleEmployeeSort('capacityHours')}>
                          <div className="flex items-center justify-end">Capacidade <EmployeeSortIcon columnKey="capacityHours" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500 cursor-pointer" onClick={() => handleEmployeeSort('totalHours')}>
                          <div className="flex items-center justify-end">Realizado <EmployeeSortIcon columnKey="totalHours" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500 cursor-pointer" onClick={() => handleEmployeeSort('utilizationRate')}>
                          <div className="flex items-center justify-end">Ocupação <EmployeeSortIcon columnKey="utilizationRate" /></div>
                      </th>
                      <th className="px-6 py-3 text-right text-[13px] font-semibold text-gray-500">
                          <div className="flex items-center justify-end gap-1.5">
                            {canViewCost ? (
                              <button
                                type="button"
                                onClick={() => setCustoVisivel(v => !v)}
                                className="flex items-center gap-1.5 hover:text-gray-700 transition-colors"
                                title={custoVisivel ? 'Ocultar custo por pessoa' : 'Mostrar custo por pessoa (só para você, nesta sessão)'}
                              >
                                {custoVisivel ? <Eye size={13} /> : <EyeOff size={13} />}
                                Custo
                              </button>
                            ) : (
                              <span className="flex items-center gap-1.5" title="Custo por pessoa é restrito">
                                <Lock size={12} /> Custo
                              </span>
                            )}
                            {custoVisivel && <EmployeeSortIcon columnKey="costGenerated" />}
                          </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedEmployees.map((emp, idx) => {
                      const empChurned = emp.endDate && new Date(emp.endDate + 'T00:00:00') <= new Date();
                      return (
                      <tr key={idx} className={`hover:bg-gray-50 ${empChurned ? 'opacity-75' : ''}`}>
                        <td className="px-6 py-3.5 text-sm font-medium text-gray-900">
                          <div className="flex flex-col gap-0.5">
                            <span>{formatPersonName(emp.name)}</span>
                            {empChurned && emp.endDate && (
                              <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded w-fit">
                                Saiu em {new Date(emp.endDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-500">{emp.department}</td>
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
                        <td className="px-6 py-3.5 text-sm text-gray-500 text-right">{fmtNum(emp.capacityHours)}h</td>
                        <td className="px-6 py-3.5 text-sm text-gray-500 text-right">{fmtNum(emp.totalHours)}h</td>
                        <td className="px-6 py-3.5 text-sm text-gray-500 text-right">
                           <span className={`px-2 py-1 rounded text-xs font-bold ${
                               emp.utilizationRate > 100 ? 'bg-red-100 text-red-800' :
                               emp.utilizationRate > 85 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                           }`}>
                               {fmtPct(emp.utilizationRate)}
                           </span>
                        </td>
                        <td className={`px-6 py-3.5 text-sm text-right ${custoVisivel ? 'text-gray-700' : 'text-gray-300 select-none'}`}>{custoVisivel ? fmt(emp.costGenerated) : '••••••'}</td>
                      </tr>
                      );
                    })}
                  </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
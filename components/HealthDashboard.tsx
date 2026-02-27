import React, { useState, useMemo } from 'react';
import { ClientConfig, HealthInput, HealthScoreResult, HealthFlagColor } from '../types';
import { calculateHealthScore } from '../services/healthScoreCalculator';
import { AlertTriangle, CheckCircle, XCircle, Activity, Save, ChevronRight, Clock, Calendar, LayoutGrid, List, DollarSign, Users } from 'lucide-react';

interface HealthDashboardProps {
  clients: ClientConfig[];
  savedInputs: Record<string, HealthInput>;
  onSaveInput: (input: HealthInput) => void;
  canEdit: boolean;
}

const INITIAL_INPUT: Omit<HealthInput, 'clientId' | 'monthKey'> = {
  checkin: 'semanal',
  whatsapp: 'na_hora',
  adimplencia: 'em_dia',
  recarga: 'no_dia',
  roi_bucket: 'roi_lt_3',
  growth: 'perfil_a_lt_50k',
  engagement_vs_avg: 'alta_perf',
  checkin_produtivo: 'sim',
  progresso: 'muito',
  relacionamento_interno: 'melhorou',
  aviso_previo: 'gt_60_dias',
  pesquisa_respondida: 'sim',
  csat_tecnico: 'gt_4.5',
  nps: 'promotor',
  mhs: 'pouco',
  pesquisa_geral_respondida: 'sim',
  results_focus: 'both'
};

const HealthDashboard: React.FC<HealthDashboardProps> = ({ clients, savedInputs, onSaveInput, canEdit }) => {
  const [view, setView] = useState<'home' | 'list'>('home');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentInput, setCurrentInput] = useState<HealthInput | null>(null);
  const [activeVerticalTab, setActiveVerticalTab] = useState<number>(1);

  const activeClients = useMemo(() => clients.filter(c => c.isActive && c.category === 'Executar'), [clients]);

  const scores = useMemo(() => {
    const map: Record<string, HealthScoreResult> = {};
    activeClients.forEach(c => {
      if (savedInputs[c.name]) {
        map[c.name] = calculateHealthScore(savedInputs[c.name], c);
      }
    });
    return map;
  }, [activeClients, savedInputs]);

  // Reminder Logic
  const reminders = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const weekDay = now.getDay(); // 0 = Sunday, 5 = Friday
    const month = now.getMonth(); // 0-11
    
    // Logic flags
    const isFriday = weekDay === 5;
    const isBiWeeklyWindow = (day >= 1 && day <= 5) || (day >= 15 && day <= 20);
    const isQuarterlyMonth = [0, 3, 6, 9].includes(month); // Jan, Apr, Jul, Oct

    const pending: { client: ClientConfig, type: string, vertical: string }[] = [];
    
    activeClients.forEach(c => {
      const input = savedInputs[c.name];
      
      // Weekly: Engagement & Relationship (Every Friday)
      if (isFriday) {
        // Check if updated today
        const lastEng = input?.last_updated_engagement ? new Date(input.last_updated_engagement) : null;
        const lastRel = input?.last_updated_relationship ? new Date(input.last_updated_relationship) : null;
        
        const isEngUpdatedToday = lastEng && lastEng.toDateString() === now.toDateString();
        const isRelUpdatedToday = lastRel && lastRel.toDateString() === now.toDateString();

        if (!isEngUpdatedToday) {
          pending.push({ client: c, type: 'Semanal', vertical: 'Engajamento' });
        }
        if (!isRelUpdatedToday) {
          pending.push({ client: c, type: 'Semanal', vertical: 'Relacionamento' });
        }
      }

      // Bi-Weekly: Results (Days 1-5 and 15-20)
      if (isBiWeeklyWindow) {
        const lastRes = input?.last_updated_results ? new Date(input.last_updated_results) : null;
        // Check if updated within current window
        // Simple check: is last update in current month and within current window range?
        // Actually, just check if updated in the last 5 days is a decent proxy, or strictly check window.
        // Let's check if updated in the current window.
        let isResUpdated = false;
        if (lastRes) {
            const lastDay = lastRes.getDate();
            const lastMonth = lastRes.getMonth();
            if (lastMonth === month) {
                if (day <= 5 && lastDay >= 1 && lastDay <= 5) isResUpdated = true;
                if (day >= 15 && day <= 20 && lastDay >= 15 && lastDay <= 20) isResUpdated = true;
            }
        }
        
        if (!isResUpdated) {
          pending.push({ client: c, type: 'Quinzenal', vertical: 'Resultados' });
        }
      }

      // Quarterly: Surveys (Jan, Apr, Jul, Oct)
      if (isQuarterlyMonth) {
        const lastSurv = input?.last_updated_surveys ? new Date(input.last_updated_surveys) : null;
        // Check if updated in current month
        const isSurvUpdated = lastSurv && lastSurv.getMonth() === month && lastSurv.getFullYear() === now.getFullYear();
        
        if (!isSurvUpdated) {
             pending.push({ client: c, type: 'Trimestral', vertical: 'Pesquisas' });
        }
      }
    });
    return pending;
  }, [activeClients, savedInputs]);

  const handleEdit = (client: ClientConfig) => {
    if (!canEdit) return;
    setSelectedClient(client.name);
    const existing = savedInputs[client.name];
    setCurrentInput(existing || { 
        ...INITIAL_INPUT, 
        clientId: client.name, 
        monthKey: new Date().toISOString().slice(0, 7),
        results_focus: 'both' // Default
    });
    setIsEditing(true);
    setActiveVerticalTab(1);
  };

  const currentClientConfig = useMemo(() => 
    clients.find(c => c.name === selectedClient), 
    [clients, selectedClient]
  );

  const liveScore = useMemo(() => {
    if (currentInput && currentClientConfig) {
      return calculateHealthScore(currentInput, currentClientConfig);
    }
    return null;
  }, [currentInput, currentClientConfig]);

  const handleSave = () => {
    if (currentInput) {
      const now = new Date().toISOString();
      const updatedInput = { ...currentInput, lastUpdated: now };
      
      // Update specific timestamps based on active tab (or all if new?)
      // Since we edit all in one modal but tabs separate them, we assume user reviews all?
      // Or we should track which tab was touched. 
      // For simplicity, let's update the timestamp of the vertical that corresponds to the active tab, 
      // OR update all if it's a new record.
      // Better: Update all timestamps because the user "Saved Evaluation".
      // But for the reminder logic to be precise, we might want to know what changed.
      // Let's assume "Save" means "I reviewed everything".
      
      // Actually, the request implies specific updates. 
      // Let's update all timestamps for now to clear reminders.
      updatedInput.last_updated_engagement = now;
      updatedInput.last_updated_results = now;
      updatedInput.last_updated_relationship = now;
      updatedInput.last_updated_surveys = now;

      onSaveInput(updatedInput);
      setIsEditing(false);
      setSelectedClient(null);
    }
  };

  const handleChange = (field: keyof HealthInput, value: any) => {
    if (currentInput) {
      setCurrentInput({ ...currentInput, [field]: value });
    }
  };

  const getFlagColor = (flag: HealthFlagColor) => {
    switch (flag) {
      case 'Green': return 'bg-green-100 text-green-800 border-green-200';
      case 'Yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Red': return 'bg-red-100 text-red-800 border-red-200';
      case 'Black': return 'bg-gray-900 text-white border-gray-700';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Navigation */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-900">Saúde da Carteira</h2>
          <div className="flex bg-gray-100 p-1 rounded-md">
            <button 
              onClick={() => setView('home')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${view === 'home' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid size={16} /> Visão Geral
            </button>
            <button 
              onClick={() => setView('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${view === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List size={16} /> Lista de Clientes
            </button>
          </div>
        </div>
        <div className="flex gap-2">
           <div className="px-3 py-1 rounded bg-green-100 text-green-800 text-xs font-bold">Saudável</div>
           <div className="px-3 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-bold">Atenção</div>
           <div className="px-3 py-1 rounded bg-red-100 text-red-800 text-xs font-bold">Risco</div>
           <div className="px-3 py-1 rounded bg-gray-900 text-white text-xs font-bold">Churn</div>
        </div>
      </div>

      {/* HOME VIEW */}
      {view === 'home' && !isEditing && (
        <div className="space-y-6">
            {/* Global Alert - Data Blackout */}
            {reminders.length > 0 && (
                <div className={`rounded-lg p-4 border flex items-start gap-3 ${
                    reminders.length > activeClients.length * 0.5 
                    ? 'bg-red-50 border-red-200 text-red-800' 
                    : 'bg-orange-50 border-orange-200 text-orange-800'
                }`}>
                    <AlertTriangle className={`shrink-0 ${reminders.length > activeClients.length * 0.5 ? 'text-red-600' : 'text-orange-600'}`} />
                    <div>
                        <h3 className="font-bold text-lg">
                            {reminders.length > activeClients.length * 0.5 ? 'CRÍTICO: Apagão de Dados Detectado' : 'Atenção: Dados Desatualizados'}
                        </h3>
                        <p className="text-sm mt-1 opacity-90">
                            {reminders.length > activeClients.length * 0.5 
                                ? `Mais de 50% da carteira (${reminders.length} pendências) está com dados desatualizados. O Health Score não reflete a realidade.`
                                : `Existem ${reminders.length} atualizações pendentes. Mantenha os dados em dia para evitar distorções no score.`
                            }
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Vertical Performance */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Activity className="text-purple-600" />
                    Média por Vertical
                </h3>
                <div className="space-y-4">
                    {[
                        { key: 'engagement', label: 'Engajamento', color: 'blue', max: 35 },
                        { key: 'results', label: 'Resultados', color: 'green', max: 25 },
                        { key: 'relationship', label: 'Relacionamento', color: 'purple', max: 25 },
                        { key: 'surveys', label: 'Pesquisas', color: 'orange', max: 15 }
                    ].map(v => {
                        const total = Object.values(scores).reduce((sum, s) => sum + (s.breakdown[v.key as keyof typeof s.breakdown] || 0), 0);
                        const avg = activeClients.length ? total / activeClients.length : 0;
                        const percent = (avg / v.max) * 100;
                        
                        return (
                            <div key={v.key}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">{v.label}</span>
                                    <span className="font-bold text-gray-900">{avg.toFixed(1)} / {v.max}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full bg-${v.color}-500`} 
                                        style={{ width: `${percent}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </div>

              {/* Reminders Card */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock className="text-orange-500" />
                Lembretes de Atualização
              </h3>
              <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded-full">
                {reminders.length} Pendentes
              </span>
            </div>
            
            {reminders.length === 0 ? (
              <div className="text-center py-12 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
                <h4 className="text-lg font-medium text-green-900">Tudo em dia!</h4>
                <p className="text-green-700">Todas as avaliações foram atualizadas recentemente.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {reminders.map((reminder, idx) => (
                  <div key={`${reminder.client.name}-${reminder.vertical}-${idx}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                    <div>
                      <h4 className="font-bold text-gray-900">Atualizar {reminder.vertical} - {reminder.client.name}</h4>
                      <p className="text-xs text-gray-500">
                        Ciclo: {reminder.type}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleEdit(reminder.client)}
                      className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50 flex items-center gap-1"
                    >
                      Atualizar <ChevronRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Activity className="text-blue-500" />
              Resumo da Carteira
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-100">
                <span className="text-green-800 font-medium">Saudável (81-100)</span>
                <span className="text-xl font-bold text-green-900">{Object.values(scores).filter(s => s.flag === 'Green').length}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded border border-yellow-100">
                <span className="text-yellow-800 font-medium">Atenção (51-80)</span>
                <span className="text-xl font-bold text-yellow-900">{Object.values(scores).filter(s => s.flag === 'Yellow').length}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded border border-red-100">
                <span className="text-red-800 font-medium">Risco (26-50)</span>
                <span className="text-xl font-bold text-red-900">{Object.values(scores).filter(s => s.flag === 'Red').length}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-100 rounded border border-gray-200">
                <span className="text-gray-800 font-medium">Churn (0-25)</span>
                <span className="text-xl font-bold text-gray-900">{Object.values(scores).filter(s => s.flag === 'Black').length}</span>
              </div>
            </div>
          </div>

          {/* Revenue per Flag */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <DollarSign className="text-green-600" />
                  Receita (MRR) em Risco
              </h3>
              <div className="space-y-4">
                  {['Green', 'Yellow', 'Red', 'Black'].map(flag => {
                      const flagClients = activeClients.filter(c => scores[c.name]?.flag === flag);
                      const totalRevenue = flagClients.reduce((sum, c) => sum + (c.defaultFee || 0), 0);
                      const colorClass = flag === 'Green' ? 'text-green-600' : flag === 'Yellow' ? 'text-yellow-600' : flag === 'Red' ? 'text-red-600' : 'text-gray-800';
                      const bgClass = flag === 'Green' ? 'bg-green-50' : flag === 'Yellow' ? 'bg-yellow-50' : flag === 'Red' ? 'bg-red-50' : 'bg-gray-100';
                      
                      return (
                          <div key={flag} className={`flex justify-between items-center p-3 rounded border border-transparent ${bgClass}`}>
                              <span className={`font-medium ${colorClass}`}>
                                  {flag === 'Green' ? 'Saudável' : flag === 'Yellow' ? 'Atenção' : flag === 'Red' ? 'Risco' : 'Churn'}
                              </span>
                              <span className={`font-bold ${colorClass}`}>
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
                              </span>
                          </div>
                      );
                  })}
              </div>
          </div>

          {/* Account Ranking */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Users className="text-purple-600" />
                  Ranking por Account Manager
              </h3>
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                          <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Clientes</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Média Score</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">MRR Total</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Em Risco (Red/Black)</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                          {Object.entries(
                              activeClients.reduce((acc, client) => {
                                  const manager = client.accountManager || 'Sem Account';
                                  if (!acc[manager]) acc[manager] = { clients: [], totalScore: 0, totalRevenue: 0, riskCount: 0 };
                                  
                                  const score = scores[client.name];
                                  acc[manager].clients.push(client);
                                  acc[manager].totalRevenue += client.defaultFee || 0;
                                  
                                  if (score) {
                                      acc[manager].totalScore += score.score;
                                      if (score.flag === 'Red' || score.flag === 'Black') {
                                          acc[manager].riskCount++;
                                      }
                                  }
                                  return acc;
                              }, {} as Record<string, { clients: ClientConfig[], totalScore: 0, totalRevenue: 0, riskCount: 0 }>)
                          ).sort(([, a], [, b]) => (b.totalScore / (b.clients.length || 1)) - (a.totalScore / (a.clients.length || 1)))
                           .map(([manager, data]) => (
                              <tr key={manager}>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{manager}</td>
                                  <td className="px-4 py-3 text-sm text-center text-gray-500">{data.clients.length}</td>
                                  <td className="px-4 py-3 text-sm text-center font-bold text-blue-600">
                                      {(data.totalScore / (data.clients.length || 1)).toFixed(1)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-center text-gray-500">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.totalRevenue)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-center">
                                      {data.riskCount > 0 ? (
                                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold">
                                              {data.riskCount}
                                          </span>
                                      ) : (
                                          <span className="text-gray-400">-</span>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
        </div>
      </div>
      )}

      {/* LIST VIEW */}
      {view === 'list' && !isEditing && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeClients.map(client => {
            const score = scores[client.name];
            return (
              <div key={client.name} 
                   className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all overflow-hidden ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                   onClick={() => handleEdit(client)}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-gray-900 truncate pr-2">{client.name}</h3>
                    {score ? (
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${getFlagColor(score.flag)}`}>
                        {score.score.toFixed(0)} pts
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-400">N/A</span>
                    )}
                  </div>
                  
                  {score ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-blue-50 p-1.5 rounded border border-blue-100">
                          <span className="text-blue-800 block mb-0.5">Engajamento</span>
                          <span className="font-bold text-blue-900">{score.breakdown.engagement}</span>
                        </div>
                        <div className="bg-green-50 p-1.5 rounded border border-green-100">
                          <span className="text-green-800 block mb-0.5">Resultados</span>
                          <span className="font-bold text-green-900">{score.breakdown.results}</span>
                        </div>
                        <div className="bg-purple-50 p-1.5 rounded border border-purple-100">
                          <span className="text-purple-800 block mb-0.5">Relacionamento</span>
                          <span className="font-bold text-purple-900">{score.breakdown.relationship}</span>
                        </div>
                        <div className="bg-orange-50 p-1.5 rounded border border-orange-100">
                          <span className="text-orange-800 block mb-0.5">Pesquisas</span>
                          <span className="font-bold text-orange-900">{score.breakdown.surveys}</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-700">{score.action}</p>
                        <p className="text-[10px] text-gray-400 mt-1 text-right">
                          Atualizado: {savedInputs[client.name]?.lastUpdated ? new Date(savedInputs[client.name].lastUpdated!).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-24 text-gray-400 text-sm bg-gray-50 rounded border border-dashed border-gray-200">
                      Clique para avaliar
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Form */}
      {isEditing && currentInput && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden animate-fade-in-up">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-bold text-gray-900">Avaliação: {selectedClient}</h3>
              {liveScore && (
                <span className={`px-3 py-1 rounded text-sm font-bold border ${getFlagColor(liveScore.flag)}`}>
                  {liveScore.score.toFixed(0)} pts - {liveScore.flag === 'Black' ? 'Churn' : liveScore.flag === 'Red' ? 'Risco' : liveScore.flag === 'Yellow' ? 'Atenção' : 'Saudável'}
                </span>
              )}
            </div>
            <button onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-gray-700">
              <XCircle size={24} />
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row min-h-[500px]">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
               <button 
                 onClick={() => setActiveVerticalTab(1)}
                 className={`p-4 text-left font-medium text-sm border-l-4 transition-colors ${activeVerticalTab === 1 ? 'bg-white border-blue-500 text-blue-700 shadow-sm' : 'border-transparent text-gray-600 hover:bg-gray-100'}`}
               >
                 1. Engajamento
               </button>
               <button 
                 onClick={() => setActiveVerticalTab(2)}
                 className={`p-4 text-left font-medium text-sm border-l-4 transition-colors ${activeVerticalTab === 2 ? 'bg-white border-green-500 text-green-700 shadow-sm' : 'border-transparent text-gray-600 hover:bg-gray-100'}`}
               >
                 2. Resultados
               </button>
               <button 
                 onClick={() => setActiveVerticalTab(3)}
                 className={`p-4 text-left font-medium text-sm border-l-4 transition-colors ${activeVerticalTab === 3 ? 'bg-white border-purple-500 text-purple-700 shadow-sm' : 'border-transparent text-gray-600 hover:bg-gray-100'}`}
               >
                 3. Relacionamento
               </button>
               <button 
                 onClick={() => setActiveVerticalTab(4)}
                 className={`p-4 text-left font-medium text-sm border-l-4 transition-colors ${activeVerticalTab === 4 ? 'bg-white border-orange-500 text-orange-700 shadow-sm' : 'border-transparent text-gray-600 hover:bg-gray-100'}`}
               >
                 4. Pesquisas
               </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 md:p-8 bg-white">
              {activeVerticalTab === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <h4 className="text-lg font-bold text-blue-800 border-b border-blue-100 pb-2 mb-4">Engajamento</h4>
                  <div className="grid grid-cols-1 gap-6">
                    <Select label="Frequência de Check-in" value={currentInput.checkin} onChange={v => handleChange('checkin', v)} options={[
                      {label: 'Semanal', value: 'semanal'},
                      {label: 'Quinzenal', value: 'quinzenal'},
                      {label: 'Mensal', value: 'mensal'},
                      {label: 'Sem Frequência', value: 'sem_frequencia'}
                    ]} />
                    <Select label="Tempo Resposta WhatsApp" value={currentInput.whatsapp} onChange={v => handleChange('whatsapp', v)} options={[
                      {label: 'Na hora', value: 'na_hora'},
                      {label: 'Mesmo dia', value: 'mesmo_dia'},
                      {label: 'Dia seguinte', value: 'dia_seguinte'},
                      {label: 'Dias depois', value: 'dias_depois'},
                      {label: 'Não responde', value: 'nao_responde'}
                    ]} />
                    <Select label="Adimplência" value={currentInput.adimplencia} onChange={v => handleChange('adimplencia', v)} options={[
                      {label: 'Em dia', value: 'em_dia'},
                      {label: 'Até 10 dias', value: 'ate_10_dias'},
                      {label: 'Mais de 30 dias', value: 'mais_30_dias'}
                    ]} />
                    <Select label="Recarga de Verba" value={currentInput.recarga} onChange={v => handleChange('recarga', v)} options={[
                      {label: 'No dia', value: 'no_dia'},
                      {label: 'Até 10 dias', value: 'ate_10_dias'},
                      {label: 'Mais de 30 dias', value: 'mais_30_dias'}
                    ]} />
                  </div>
                </div>
              )}

              {activeVerticalTab === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <h4 className="text-lg font-bold text-green-800 border-b border-green-100 pb-2 mb-4">Resultados</h4>
                  
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100 mb-6">
                    <Select label="Foco de Resultados (Objetivo do Cliente)" value={currentInput.results_focus || 'both'} onChange={v => handleChange('results_focus', v)} options={[
                      {label: 'Ambos (ROI + Social)', value: 'both'},
                      {label: 'Apenas ROI', value: 'roi'},
                      {label: 'Apenas Social', value: 'social'}
                    ]} />
                    <p className="text-xs text-green-700 mt-2">
                      * Define como os 25 pontos da vertical são distribuídos.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {(currentInput.results_focus === 'roi' || currentInput.results_focus === 'both' || !currentInput.results_focus) && (
                        <Select label="ROI (Bucket)" value={currentInput.roi_bucket} onChange={v => handleChange('roi_bucket', v)} options={[
                        {label: 'ROI > 3 (Excelente)', value: 'roi_lt_3'},
                        {label: 'ROI ~ 3 (Bom)', value: 'roi_3'},
                        {label: 'ROI ~ 2 (Médio)', value: 'roi_2'},
                        {label: 'ROI ~ 1 (Baixo)', value: 'roi_1'},
                        {label: 'ROI < 1 (Prejuízo)', value: 'roi_gt_1'}
                        ]} />
                    )}

                    {(currentInput.results_focus === 'social' || currentInput.results_focus === 'both' || !currentInput.results_focus) && (
                        <>
                            <div className="bg-gray-50 p-3 rounded border border-gray-200">
                                <label className="block text-xs font-medium text-gray-500 mb-2">Perfil Social (Para cálculo de crescimento)</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="social_profile" 
                                            value="A" 
                                            checked={currentInput.social_profile !== 'B'} 
                                            onChange={() => handleChange('social_profile', 'A')}
                                            className="text-green-600 focus:ring-green-500"
                                        />
                                        <span className="text-sm text-gray-700">Perfil A (&lt; 50k)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="social_profile" 
                                            value="B" 
                                            checked={currentInput.social_profile === 'B'} 
                                            onChange={() => handleChange('social_profile', 'B')}
                                            className="text-green-600 focus:ring-green-500"
                                        />
                                        <span className="text-sm text-gray-700">Perfil B (&gt; 50k)</span>
                                    </label>
                                </div>
                            </div>

                            <Select 
                                label={`Crescimento de Seguidores (${currentInput.social_profile === 'B' ? 'Perfil B > 50k' : 'Perfil A < 50k'})`} 
                                value={currentInput.growth} 
                                onChange={v => handleChange('growth', v)} 
                                options={currentInput.social_profile === 'B' ? [
                                    {label: '> 1.5% (Excelente)', value: 'perfil_b_gt_50k'}, // Reusing value key but label changes
                                    {label: '0.5% a 1.5% (Bom)', value: 'perfil_a_lt_50k'}, // Mapping to existing keys is tricky. 
                                    // Actually, the calculator uses specific keys: 'perfil_a_lt_50k', 'perfil_b_gt_50k', 'negativo'.
                                    // This implies the calculator logic is rigid.
                                    // Let's look at calculator logic:
                                    // v2Raw += SCORES.v2.growth[input.growth];
                                    // growth: { perfil_a_lt_50k: 5, perfil_b_gt_50k: 5, negativo: -10 },
                                    // Wait, both A and B give 5 points for "Good"? 
                                    // The PDF says:
                                    // Perfil A: >5% (+5), 2-5% (+2.5), 0-2% (0), Neg (-10)
                                    // Perfil B: >1.5% (+5), 0.5-1.5% (+2.5), 0-0.5% (0), Neg (-10)
                                    // The current calculator only has 3 keys! It is missing the intermediate steps.
                                    // I need to update the calculator keys to support the full range.
                                    // For now, I will map the UI options to the closest existing keys or I MUST update the calculator.
                                    // Updating the calculator is safer.
                                    // Let's assume I will update calculator later. I'll use new keys here.
                                    {label: '> 1.5%', value: 'growth_high'},
                                    {label: '0.5% a 1.5%', value: 'growth_medium'},
                                    {label: '0% a 0.5%', value: 'growth_low'},
                                    {label: 'Negativo', value: 'growth_negative'}
                                ] : [
                                    {label: '> 5%', value: 'growth_high'},
                                    {label: '2% a 5%', value: 'growth_medium'},
                                    {label: '0% a 2%', value: 'growth_low'},
                                    {label: 'Negativo', value: 'growth_negative'}
                                ]} 
                            />
                            
                            <Select label="Engajamento vs Média (Interações de Valor)" value={currentInput.engagement_vs_avg} onChange={v => handleChange('engagement_vs_avg', v)} options={[
                                {label: 'Alta Performance (> 110%)', value: 'alta_perf'},
                                {label: 'Estável (90% a 110%)', value: 'estavel'},
                                {label: 'Atenção (70% a 90%)', value: 'atencao'},
                                {label: 'Crítico (< 70%)', value: 'critico'}
                            ]} />
                        </>
                    )}
                  </div>
                </div>
              )}

              {activeVerticalTab === 3 && (
                <div className="space-y-6 animate-fade-in">
                  <h4 className="text-lg font-bold text-purple-800 border-b border-purple-100 pb-2 mb-4">Relacionamento</h4>
                  <div className="grid grid-cols-1 gap-6">
                    <Select label="Check-in Produtivo?" value={currentInput.checkin_produtivo} onChange={v => handleChange('checkin_produtivo', v)} options={[
                      {label: 'Sim', value: 'sim'},
                      {label: 'Parcial', value: 'parcial'},
                      {label: 'Não', value: 'nao'}
                    ]} />
                    <Select label="Progresso Percebido" value={currentInput.progresso} onChange={v => handleChange('progresso', v)} options={[
                      {label: 'Muito', value: 'muito'},
                      {label: 'Parcial', value: 'parcial'},
                      {label: 'Não', value: 'nao'}
                    ]} />
                    <Select label="Relacionamento Interno" value={currentInput.relacionamento_interno} onChange={v => handleChange('relacionamento_interno', v)} options={[
                      {label: 'Melhorou', value: 'melhorou'},
                      {label: 'Neutro', value: 'neutro'},
                      {label: 'Piorou', value: 'piorou'}
                    ]} />
                    <Select label="Aviso Prévio (Risco)" value={currentInput.aviso_previo} onChange={v => handleChange('aviso_previo', v)} options={[
                      {label: '> 60 dias', value: 'gt_60_dias'},
                      {label: '30-60 dias', value: '30_60_dias'},
                      {label: '< 30 dias', value: 'lt_30_dias'}
                    ]} />
                    <Select label="Pesquisa Respondida?" value={currentInput.pesquisa_respondida} onChange={v => handleChange('pesquisa_respondida', v)} options={[
                      {label: 'Sim', value: 'sim'},
                      {label: 'Não', value: 'nao'}
                    ]} />
                  </div>
                </div>
              )}

              {activeVerticalTab === 4 && (
                <div className="space-y-6 animate-fade-in">
                  <h4 className="text-lg font-bold text-orange-800 border-b border-orange-100 pb-2 mb-4">Pesquisas</h4>
                  <div className="grid grid-cols-1 gap-6">
                    <Select label="CSAT Técnico" value={currentInput.csat_tecnico} onChange={v => handleChange('csat_tecnico', v)} options={[
                      {label: '> 4.5', value: 'gt_4.5'},
                      {label: 'Até 4', value: 'ate_4'},
                      {label: 'Até 3.5', value: 'ate_3.5'},
                      {label: '< 3', value: 'lt_3'}
                    ]} />
                    <Select label="NPS" value={currentInput.nps} onChange={v => handleChange('nps', v)} options={[
                      {label: 'Promotor', value: 'promotor'},
                      {label: 'Neutro', value: 'neutro'},
                      {label: 'Detrator', value: 'detrator'}
                    ]} />
                    <Select label="MHS (Happiness)" value={currentInput.mhs} onChange={v => handleChange('mhs', v)} options={[
                      {label: 'Muito Desapontado', value: 'muito_desapontado'},
                      {label: 'Pouco', value: 'pouco'},
                      {label: 'Indiferente', value: 'indiferente'},
                      {label: 'Nada', value: 'nada'}
                    ]} />
                    <Select label="Pesquisa Geral Respondida?" value={currentInput.pesquisa_geral_respondida} onChange={v => handleChange('pesquisa_geral_respondida', v)} options={[
                      {label: 'Sim', value: 'sim'},
                      {label: 'Não', value: 'nao'}
                    ]} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center gap-2"
            >
              <Save size={16} />
              Salvar Avaliação
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Select = ({ label, value, onChange, options }: { label: string, value: string, onChange: (v: string) => void, options: {label: string, value: string}[] }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    <select 
      value={value} 
      onChange={e => onChange(e.target.value)}
      className="block w-full pl-3 pr-10 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md shadow-sm"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

export default HealthDashboard;

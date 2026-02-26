import React, { useState, useMemo } from 'react';
import { ClientConfig, HealthInput, HealthScoreResult, HealthFlagColor } from '../types';
import { calculateHealthScore } from '../services/healthScoreCalculator';
import { AlertTriangle, CheckCircle, XCircle, Activity, Save, ChevronRight, Clock, Calendar, LayoutGrid, List } from 'lucide-react';

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
  pesquisa_geral_respondida: 'sim'
};

const HealthDashboard: React.FC<HealthDashboardProps> = ({ clients, savedInputs, onSaveInput, canEdit }) => {
  const [view, setView] = useState<'home' | 'list'>('home');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentInput, setCurrentInput] = useState<HealthInput | null>(null);
  const [activeVerticalTab, setActiveVerticalTab] = useState<number>(1);

  const activeClients = useMemo(() => clients.filter(c => c.isActive), [clients]);

  const scores = useMemo(() => {
    const map: Record<string, HealthScoreResult> = {};
    activeClients.forEach(c => {
      if (savedInputs[c.name]) {
        map[c.name] = calculateHealthScore(savedInputs[c.name], c);
      }
    });
    return map;
  }, [activeClients, savedInputs]);

  // Reminder Logic: Check if updated in the last 7 days
  const reminders = useMemo(() => {
    const now = new Date();
    const pending: ClientConfig[] = [];
    
    activeClients.forEach(c => {
      const input = savedInputs[c.name];
      if (!input || !input.lastUpdated) {
        pending.push(c);
      } else {
        const lastUpdate = new Date(input.lastUpdated);
        const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) {
          pending.push(c);
        }
      }
    });
    return pending;
  }, [activeClients, savedInputs]);

  const handleEdit = (client: ClientConfig) => {
    if (!canEdit) return;
    setSelectedClient(client.name);
    const existing = savedInputs[client.name];
    setCurrentInput(existing || { ...INITIAL_INPUT, clientId: client.name, monthKey: new Date().toISOString().slice(0, 7) });
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
      onSaveInput({
        ...currentInput,
        lastUpdated: new Date().toISOString()
      });
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                {reminders.map(client => (
                  <div key={client.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                    <div>
                      <h4 className="font-bold text-gray-900">{client.name}</h4>
                      <p className="text-xs text-gray-500">
                        Última atualização: {savedInputs[client.name]?.lastUpdated ? new Date(savedInputs[client.name].lastUpdated!).toLocaleDateString() : 'Nunca'}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleEdit(client)}
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
                  <div className="grid grid-cols-1 gap-6">
                    <Select label="ROI (Bucket)" value={currentInput.roi_bucket} onChange={v => handleChange('roi_bucket', v)} options={[
                      {label: 'ROI > 3 (Excelente)', value: 'roi_lt_3'},
                      {label: 'ROI ~ 3 (Bom)', value: 'roi_3'},
                      {label: 'ROI ~ 2 (Médio)', value: 'roi_2'},
                      {label: 'ROI ~ 1 (Baixo)', value: 'roi_1'},
                      {label: 'ROI < 1 (Prejuízo)', value: 'roi_gt_1'}
                    ]} />
                    <Select label="Crescimento (Growth)" value={currentInput.growth} onChange={v => handleChange('growth', v)} options={[
                      {label: 'Perfil A < 50k', value: 'perfil_a_lt_50k'},
                      {label: 'Perfil B > 50k', value: 'perfil_b_gt_50k'},
                      {label: 'Negativo', value: 'negativo'}
                    ]} />
                    <Select label="Engajamento vs Média" value={currentInput.engagement_vs_avg} onChange={v => handleChange('engagement_vs_avg', v)} options={[
                      {label: 'Alta Performance', value: 'alta_perf'},
                      {label: 'Estável', value: 'estavel'},
                      {label: 'Atenção', value: 'atencao'},
                      {label: 'Crítico', value: 'critico'}
                    ]} />
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

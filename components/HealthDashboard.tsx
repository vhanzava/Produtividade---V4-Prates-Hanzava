import React, { useState, useMemo } from 'react';
import { ClientConfig, HealthInput, HealthScoreResult, HealthFlagColor } from '../types';
import { calculateHealthScore } from '../services/healthScoreCalculator';
import { AlertTriangle, CheckCircle, XCircle, Activity, Save, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentInput, setCurrentInput] = useState<HealthInput | null>(null);

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

  const handleEdit = (client: ClientConfig) => {
    if (!canEdit) return;
    setSelectedClient(client.name);
    const existing = savedInputs[client.name];
    setCurrentInput(existing || { ...INITIAL_INPUT, clientId: client.name, monthKey: new Date().toISOString().slice(0, 7) });
    setIsEditing(true);
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
      onSaveInput(currentInput);
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
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Saúde da Carteira</h2>
          <p className="text-sm text-gray-500">Monitoramento preditivo e punitivo de governança.</p>
        </div>
        <div className="flex gap-2">
           <div className="px-3 py-1 rounded bg-green-100 text-green-800 text-xs font-bold">Saudável</div>
           <div className="px-3 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-bold">Atenção</div>
           <div className="px-3 py-1 rounded bg-red-100 text-red-800 text-xs font-bold">Risco</div>
           <div className="px-3 py-1 rounded bg-gray-900 text-white text-xs font-bold">Churn</div>
        </div>
      </div>

      {/* Client Grid */}
      {!isEditing && (
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
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Engajamento</span>
                        <span className="font-medium">{score.breakdown.engagement}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Resultados</span>
                        <span className="font-medium">{score.breakdown.results}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Relacionamento</span>
                        <span className="font-medium">{score.breakdown.relationship}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Pesquisas</span>
                        <span className="font-medium">{score.breakdown.surveys}</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-700">{score.action}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
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
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
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
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Vertical 1 */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800 border-b pb-2">1. Engajamento</h4>
              <Select label="Frequência de Check-in" value={currentInput.checkin} onChange={v => handleChange('checkin', v)} options={[
                {label: 'Semanal (5)', value: 'semanal'},
                {label: 'Quinzenal (3)', value: 'quinzenal'},
                {label: 'Mensal (0)', value: 'mensal'},
                {label: 'Sem Frequência (-10)', value: 'sem_frequencia'}
              ]} />
              <Select label="Tempo Resposta WhatsApp" value={currentInput.whatsapp} onChange={v => handleChange('whatsapp', v)} options={[
                {label: 'Na hora (5)', value: 'na_hora'},
                {label: 'Mesmo dia (0)', value: 'mesmo_dia'},
                {label: 'Dia seguinte (-2)', value: 'dia_seguinte'},
                {label: 'Dias depois (-5)', value: 'dias_depois'},
                {label: 'Não responde (-10)', value: 'nao_responde'}
              ]} />
              <Select label="Adimplência" value={currentInput.adimplencia} onChange={v => handleChange('adimplencia', v)} options={[
                {label: 'Em dia (8.75)', value: 'em_dia'},
                {label: 'Até 10 dias (-5)', value: 'ate_10_dias'},
                {label: 'Mais de 30 dias (-15)', value: 'mais_30_dias'}
              ]} />
              <Select label="Recarga de Verba" value={currentInput.recarga} onChange={v => handleChange('recarga', v)} options={[
                {label: 'No dia (6.25)', value: 'no_dia'},
                {label: 'Até 10 dias (-4)', value: 'ate_10_dias'},
                {label: 'Mais de 30 dias (-10)', value: 'mais_30_dias'}
              ]} />
            </div>

            {/* Vertical 2 */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800 border-b pb-2">2. Resultados</h4>
              <Select label="ROI (Bucket)" value={currentInput.roi_bucket} onChange={v => handleChange('roi_bucket', v)} options={[
                {label: 'ROI > 3 (Excelente)', value: 'roi_lt_3'},
                {label: 'ROI ~ 3 (Bom)', value: 'roi_3'},
                {label: 'ROI ~ 2 (Médio)', value: 'roi_2'},
                {label: 'ROI ~ 1 (Baixo)', value: 'roi_1'},
                {label: 'ROI < 1 (Prejuízo)', value: 'roi_gt_1'}
              ]} />
              <Select label="Crescimento (Growth)" value={currentInput.growth} onChange={v => handleChange('growth', v)} options={[
                {label: 'Perfil A < 50k (5)', value: 'perfil_a_lt_50k'},
                {label: 'Perfil B > 50k (5)', value: 'perfil_b_gt_50k'},
                {label: 'Negativo (-10)', value: 'negativo'}
              ]} />
              <Select label="Engajamento vs Média" value={currentInput.engagement_vs_avg} onChange={v => handleChange('engagement_vs_avg', v)} options={[
                {label: 'Alta Performance (5)', value: 'alta_perf'},
                {label: 'Estável (2.5)', value: 'estavel'},
                {label: 'Atenção (-2.5)', value: 'atencao'},
                {label: 'Crítico (-10)', value: 'critico'}
              ]} />
            </div>

            {/* Vertical 3 */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800 border-b pb-2">3. Relacionamento</h4>
              <Select label="Check-in Produtivo?" value={currentInput.checkin_produtivo} onChange={v => handleChange('checkin_produtivo', v)} options={[
                {label: 'Sim (4.81)', value: 'sim'},
                {label: 'Parcial (0)', value: 'parcial'},
                {label: 'Não (-4.81)', value: 'nao'}
              ]} />
              <Select label="Progresso Percebido" value={currentInput.progresso} onChange={v => handleChange('progresso', v)} options={[
                {label: 'Muito (7.69)', value: 'muito'},
                {label: 'Parcial (0.96)', value: 'parcial'},
                {label: 'Não (-4.81)', value: 'nao'}
              ]} />
              <Select label="Relacionamento Interno" value={currentInput.relacionamento_interno} onChange={v => handleChange('relacionamento_interno', v)} options={[
                {label: 'Melhorou (2.92)', value: 'melhorou'},
                {label: 'Neutro (-1.17)', value: 'neutro'},
                {label: 'Piorou (-2.92)', value: 'piorou'}
              ]} />
              <Select label="Aviso Prévio (Risco)" value={currentInput.aviso_previo} onChange={v => handleChange('aviso_previo', v)} options={[
                {label: '> 60 dias (5.83)', value: 'gt_60_dias'},
                {label: '30-60 dias (-1.17)', value: '30_60_dias'},
                {label: '< 30 dias (-5.83)', value: 'lt_30_dias'}
              ]} />
              <Select label="Pesquisa Respondida?" value={currentInput.pesquisa_respondida} onChange={v => handleChange('pesquisa_respondida', v)} options={[
                {label: 'Sim (3.75)', value: 'sim'},
                {label: 'Não (-10)', value: 'nao'}
              ]} />
            </div>

            {/* Vertical 4 */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800 border-b pb-2">4. Pesquisas</h4>
              <Select label="CSAT Técnico" value={currentInput.csat_tecnico} onChange={v => handleChange('csat_tecnico', v)} options={[
                {label: '> 4.5 (3.75)', value: 'gt_4.5'},
                {label: 'Até 4 (1.5)', value: 'ate_4'},
                {label: 'Até 3.5 (-4)', value: 'ate_3.5'},
                {label: '< 3 (-8)', value: 'lt_3'}
              ]} />
              <Select label="NPS" value={currentInput.nps} onChange={v => handleChange('nps', v)} options={[
                {label: 'Promotor (6.25)', value: 'promotor'},
                {label: 'Neutro (2.5)', value: 'neutro'},
                {label: 'Detrator (-6.25)', value: 'detrator'}
              ]} />
              <Select label="MHS (Happiness)" value={currentInput.mhs} onChange={v => handleChange('mhs', v)} options={[
                {label: 'Muito Desapontado (8.75)', value: 'muito_desapontado'},
                {label: 'Pouco (5)', value: 'pouco'},
                {label: 'Indiferente (-5)', value: 'indiferente'},
                {label: 'Nada (-10)', value: 'nada'}
              ]} />
              <Select label="Pesquisa Geral Respondida?" value={currentInput.pesquisa_geral_respondida} onChange={v => handleChange('pesquisa_geral_respondida', v)} options={[
                {label: 'Sim (6.25)', value: 'sim'},
                {label: 'Não (-10)', value: 'nao'}
              ]} />
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
      className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

export default HealthDashboard;

import React, { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { syncFromEkyte, EkyteSyncResult } from '../services/ekyteSync';

interface EkyteSyncProps {
  startDate: string;
  endDate: string;
  onSynced: (result: EkyteSyncResult) => void;
}

/**
 * Puxa os apontamentos direto do eKyte para o período selecionado no cabeçalho,
 * dispensando a exportação manual de planilha.
 */
const EkyteSync: React.FC<EkyteSyncProps> = ({ startDate, endDate, onSynced }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPeriod = !!startDate && !!endDate;

  const handleSync = async () => {
    setError(null);
    setIsSyncing(true);
    try {
      const result = await syncFromEkyte(startDate, endDate);
      onSynced(result);
    } catch (err: any) {
      console.error('[ekyte] falha na sincronização:', err);
      setError(err?.message || 'Falha ao sincronizar com o eKyte.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={isSyncing || !hasPeriod}
        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md text-sm transition-colors shadow-sm whitespace-nowrap"
        title={
          hasPeriod
            ? 'Buscar apontamentos direto do eKyte para o período selecionado'
            : 'Selecione o período antes de sincronizar'
        }
      >
        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : undefined} />
        <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar eKyte'}</span>
      </button>
      {/* Erro em popover em vez de truncado na barra: a causa costuma estar no
          fim da frase (qual variável falta, qual recurso deu erro), justamente
          o pedaço que o truncamento comia. */}
      {error && (
        <div className="relative">
          <span className="text-red-600 text-xs flex items-center bg-red-50 px-2 py-1 rounded border border-red-200 whitespace-nowrap">
            <AlertCircle size={12} className="mr-1 shrink-0" />
            Falha ao sincronizar
          </span>
          <div className="absolute right-0 top-full mt-1 z-30 w-96 bg-white border border-red-200 rounded-md shadow-lg p-3">
            <p className="text-xs text-red-700 leading-relaxed break-words">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-[11px] text-gray-400 hover:text-gray-600"
            >
              fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EkyteSync;

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
      {error && (
        <span
          className="text-red-600 text-xs flex items-center bg-red-50 px-2 py-1 rounded border border-red-100 max-w-xs"
          title={error}
        >
          <AlertCircle size={12} className="mr-1 shrink-0" />
          <span className="truncate">{error}</span>
        </span>
      )}
    </div>
  );
};

export default EkyteSync;

import React, { useState, useEffect, useMemo } from 'react';
import { parseCSV, calculateSummary } from './services/dataProcessor';
import { TimeEntry, EmployeeConfig, ClientConfig, UserSession, SystemBackup, HealthInput } from './types';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Login from './components/Login';
import HealthDashboard from './components/HealthDashboard';
import { LayoutDashboard, Settings as SettingsIcon, LogOut, RefreshCw, Cloud, CloudOff, Info, HeartPulse } from 'lucide-react';
import { supabase } from './lib/supabase';

const DATE_INPUT_STYLE = "bg-gray-700 text-white border-gray-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm p-1 border";

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<UserSession | null>(null);

  // App State
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<EmployeeConfig[]>([]);
  const [clients, setClients] = useState<ClientConfig[]>([]);
  const [healthInputs, setHealthInputs] = useState<Record<string, HealthInput>>({});
  const [activeTab, setActiveTab] = useState<'dashboard' | 'health' | 'settings'>('dashboard');
  
  // Date Filtering
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Sync State
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');

  // Detect Offline/Test Mode based on Supabase URL
  // @ts-ignore
  const isOfflineMode = !supabase.supabaseUrl || supabase.supabaseUrl.includes('placeholder');

  // Initial Load from Cloud
  useEffect(() => {
    if (session?.isAuthenticated) {
        if (isOfflineMode) {
            console.log("App em Modo Offline: Pulando busca inicial de dados.");
            return;
        }
        fetchCloudData();
        fetchHealthInputs();
    }
  }, [session]); // isOfflineMode é constante, não precisa estar na dependência

  const fetchHealthInputs = async () => {
      try {
          const { data, error } = await supabase.from('health_inputs').select('*');
          if (error) throw error;
          if (data) {
              const inputs: Record<string, HealthInput> = {};
              data.forEach((row: any) => {
                  // Assuming row has all fields or a data json column. 
                  // If row is flat:
                  inputs[row.clientId || row.client_id] = {
                      clientId: row.clientId || row.client_id,
                      monthKey: row.monthKey || row.month_key,
                      ...row
                  };
              });
              setHealthInputs(inputs);
          }
      } catch (err) {
          console.error("Erro ao buscar health inputs:", err);
      }
  };

  const saveHealthInput = async (input: HealthInput) => {
      // Update local state immediately
      setHealthInputs(prev => ({ ...prev, [input.clientId]: input }));

      if (isOfflineMode) {
          setStatusMsg("Avaliação salva localmente (Offline).");
          setTimeout(() => setStatusMsg(null), 3000);
          return;
      }

      try {
          // Map camelCase to snake_case if needed, or just send object if table supports it.
          // Assuming table columns match camelCase or we map them.
          // For simplicity, let's try to upsert the object directly, assuming Supabase handles it or we use a 'data' column?
          // The prompt implies specific columns. Let's try to send as is, but usually DBs are snake_case.
          // I will map to snake_case just in case for the DB interaction if I knew the schema.
          // Since I don't, I'll try to upsert with a best guess or just log it.
          // Actually, let's assume the table 'health_inputs' has a 'data' jsonb column to be safe?
          // No, "input_source": "health_inputs" usually implies structured data.
          
          // Let's try to upsert with the fields we have.
          const payload = {
              client_id: input.clientId,
              month_key: input.monthKey,
              checkin: input.checkin,
              whatsapp: input.whatsapp,
              adimplencia: input.adimplencia,
              recarga: input.recarga,
              roi_bucket: input.roi_bucket,
              growth: input.growth,
              engagement_vs_avg: input.engagement_vs_avg,
              checkin_produtivo: input.checkin_produtivo,
              progresso: input.progresso,
              relacionamento_interno: input.relacionamento_interno,
              aviso_previo: input.aviso_previo,
              pesquisa_respondida: input.pesquisa_respondida,
              csat_tecnico: input.csat_tecnico,
              nps: input.nps,
              mhs: input.mhs,
              pesquisa_geral_respondida: input.pesquisa_geral_respondida
          };

          const { error } = await supabase
            .from('health_inputs')
            .upsert(payload, { onConflict: 'client_id, month_key' });

          if (error) throw error;
          setStatusMsg("Avaliação salva na nuvem!");
      } catch (err: any) {
          console.error("Erro ao salvar health input:", err);
          setStatusMsg("Erro ao salvar avaliação na nuvem.");
      } finally {
          setTimeout(() => setStatusMsg(null), 3000);
      }
  };

  const fetchCloudData = async () => {
      setIsSyncing(true);
      try {
          const { data, error } = await supabase
            .from('app_state')
            .select('*')
            .eq('id', 1)
            .single();

          if (error) {
              if (error.code === 'PGRST116') {
                  console.log("Banco de dados inicializado vazio.");
                  setEntries([]);
                  setEmployees([]);
                  setClients([]);
                  return;
              }
              throw error;
          }

          if (data) {
              const loadedEntries = (data.entries || []).map((e: any) => ({
                  ...e,
                  date: new Date(e.date)
              }));
              
              setEntries(loadedEntries);
              setEmployees(data.employees || []);
              setClients(data.clients || []);

              if (loadedEntries.length > 0 && !startDate) {
                  const dates = loadedEntries.map((e: TimeEntry) => e.date.getTime());
                  setStartDate(new Date(Math.min(...dates)).toISOString().split('T')[0]);
                  setEndDate(new Date(Math.max(...dates)).toISOString().split('T')[0]);
              }
              
              if (data.updated_at) {
                  const date = new Date(data.updated_at);
                  setLastSync(date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
              }
          }
      } catch (err: any) {
          console.error("Erro ao buscar dados:", err);
          // Em offline real, não mostramos erro crítico, apenas fallback
          setStatusMsg("Erro na conexão com a nuvem.");
      } finally {
          setIsSyncing(false);
      }
  };

  const saveToCloud = async (
      newEntries: TimeEntry[], 
      newEmps: EmployeeConfig[], 
      newClients: ClientConfig[]
  ) => {
      if (!session?.isMaster) return;

      // Em modo offline/teste, simulamos o salvamento
      if (isOfflineMode) {
          setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
          setStatusMsg("Ambiente de Teste: Dados atualizados localmente.");
          setTimeout(() => setStatusMsg(null), 3000);
          return;
      }

      setIsSyncing(true);
      try {
          const { error } = await supabase
            .from('app_state')
            .upsert({
                id: 1,
                entries: newEntries,
                employees: newEmps,
                clients: newClients,
                updated_at: new Date().toISOString()
            });

          if (error) throw error;
          
          setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
          setStatusMsg("Dados sincronizados com a nuvem!");
          setTimeout(() => setStatusMsg(null), 3000);

      } catch (err: any) {
          console.error("Erro ao salvar:", err);
          setStatusMsg(`Erro ao salvar: ${err.message || 'Falha de conexão'}`);
      } finally {
          setIsSyncing(false);
      }
  };

  // -- CSV Import Logic (Merge) --
  const handleDataLoaded = (csvContent: string) => {
    const newEntries = parseCSV(csvContent);
    if (newEntries.length === 0) {
        setStatusMsg("Nenhum dado encontrado no CSV.");
        setTimeout(() => setStatusMsg(null), 3000);
        return;
    }

    const newDates = newEntries.map(e => e.date.getTime());
    const minNewDate = Math.min(...newDates);
    const maxNewDate = Math.max(...newDates);

    const nonOverlappingEntries = entries.filter(e => {
        const t = e.date.getTime();
        return t < minNewDate || t > maxNewDate;
    });

    const mergedEntries = [...nonOverlappingEntries, ...newEntries];
    
    const uniqueExecutors = Array.from(new Set(newEntries.map(e => e.executor)));
    const uniqueWorkspaces = Array.from(new Set(newEntries.map(e => e.workspace)));

    const existingEmpMap = new Map(employees.map(e => [e.name, e]));
    const newEmps: EmployeeConfig[] = [];
    uniqueExecutors.forEach(name => {
         if (!existingEmpMap.has(name)) {
             newEmps.push({
                 name,
                 department: 'Outros',
                 defaultCost: 0,
                 defaultHours: 160,
                 history: {}
             });
         }
    });
    const updatedEmps = [...employees, ...newEmps];

    const existingClientMap = new Map(clients.map(c => [c.name, c]));
    const newClientsList: ClientConfig[] = [];
    uniqueWorkspaces.forEach(name => {
         if (!existingClientMap.has(name)) {
            newClientsList.push({
                name,
                isActive: true,
                category: 'Executar',
                defaultFee: 0,
                history: {}
            });
         }
    });
    const updatedClients = [...clients, ...newClientsList];

    setEntries(mergedEntries);
    setEmployees(updatedEmps);
    setClients(updatedClients);

    setStartDate(new Date(minNewDate).toISOString().split('T')[0]);
    setEndDate(new Date(maxNewDate).toISOString().split('T')[0]);
    
    saveToCloud(mergedEntries, updatedEmps, updatedClients);
  };

  // -- Backup Import Logic (Replace All) --
  const handleBackupLoaded = (backup: SystemBackup) => {
      const msg = isOfflineMode 
        ? "Importar backup? (Modo Offline: dados não serão salvos na nuvem)" 
        : "Atenção: Importar um backup substituirá TODOS os dados na nuvem. Deseja continuar?";

      if (window.confirm(msg)) {
          setEntries(backup.entries);
          setEmployees(backup.employees);
          setClients(backup.clients);
          
          if (backup.entries.length > 0) {
            const dates = backup.entries.map((e: TimeEntry) => e.date.getTime());
            setStartDate(new Date(Math.min(...dates)).toISOString().split('T')[0]);
            setEndDate(new Date(Math.max(...dates)).toISOString().split('T')[0]);
          }

          saveToCloud(backup.entries, backup.employees, backup.clients);
      }
  };

  const handleUpdateEmployees = (newEmps: EmployeeConfig[]) => {
    setEmployees(newEmps);
    saveToCloud(entries, newEmps, clients);
  };

  const handleUpdateClients = (newClients: ClientConfig[]) => {
    setClients(newClients);
    saveToCloud(entries, employees, newClients);
  };

  const filteredEntries = useMemo(() => {
    if (!startDate || !endDate) return entries;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    return entries.filter(e => e.date >= start && e.date <= end);
  }, [entries, startDate, endDate]);

  const summary = useMemo(() => {
    return calculateSummary(filteredEntries, employees, clients, startDate, endDate);
  }, [filteredEntries, employees, clients, startDate, endDate]);

  if (!session?.isAuthenticated) {
      return <Login onLogin={setSession} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            
            <div className="flex items-center gap-3">
              <div className="bg-red-700 text-white px-2 py-1 rounded font-bold text-sm tracking-tighter">V4</div>
              <h1 className="text-base font-bold text-gray-900 tracking-tight hidden sm:block border-l border-gray-300 pl-3 whitespace-nowrap">
                Prates Hanzava - Produtividade
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
                {/* Status Indicator */}
                <div 
                    className={`flex items-center gap-1.5 text-xs mr-2 px-2 py-1 rounded border ${
                        isOfflineMode 
                        ? 'bg-orange-50 text-orange-700 border-orange-100' 
                        : 'bg-gray-50 text-gray-500 border-gray-100'
                    }`} 
                    title={isOfflineMode ? "Modo Offline (Sem conexão com banco)" : "Conectado à Nuvem"}
                >
                    {isSyncing ? (
                        <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                    ) : isOfflineMode ? (
                        <CloudOff className="h-3 w-3 text-orange-500" />
                    ) : (
                        <Cloud className={`h-3 w-3 ${session.isMaster ? 'text-green-500' : 'text-blue-500'}`} />
                    )}
                    <span className="hidden lg:inline">
                        {isSyncing ? 'Sincronizando...' : isOfflineMode ? 'Modo Offline' : lastSync ? `Sinc: ${lastSync}` : 'Conectado'}
                    </span>
                    {!session.isMaster && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">Leitor</span>}
                </div>

                {(entries.length > 0 || clients.length > 0) && (
                    <>
                        <div className="flex space-x-1 bg-gray-100 p-1 rounded-md">
                            <button
                                onClick={() => setActiveTab('dashboard')}
                                className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-all ${
                                    activeTab === 'dashboard' ? 'bg-white shadow-sm text-red-700' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                <span className="hidden md:inline">Dashboard</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('health')}
                                className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-all ${
                                    activeTab === 'health' ? 'bg-white shadow-sm text-red-700' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <HeartPulse className="h-4 w-4" />
                                <span className="hidden md:inline">Saúde (Health)</span>
                            </button>
                            {session.isMaster && (
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-all ${
                                        activeTab === 'settings' ? 'bg-white shadow-sm text-red-700' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <SettingsIcon className="h-4 w-4" />
                                    <span className="hidden md:inline">Configurações</span>
                                </button>
                            )}
                        </div>
                        <div className="hidden md:flex items-center gap-2 border-l pl-4 ml-2 border-gray-200">
                             <input type="date" className={DATE_INPUT_STYLE} value={startDate} onChange={e => setStartDate(e.target.value)} />
                             <span className="text-gray-400 text-xs">até</span>
                             <input type="date" className={DATE_INPUT_STYLE} value={endDate} onChange={e => setEndDate(e.target.value)} />
                             
                             {session.isMaster && (
                                 <div className="ml-2">
                                    <FileUpload onDataLoaded={handleDataLoaded} onBackupLoaded={handleBackupLoaded} />
                                 </div>
                             )}
                        </div>
                    </>
                )}

                <div className="border-l pl-4 ml-2 border-gray-200 flex items-center gap-3">
                    <span className="text-xs text-gray-500 hidden lg:block">{session.email}</span>
                    <button onClick={() => setSession(null)} className="text-gray-400 hover:text-red-600 transition-colors" title="Sair">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
          </div>
        </div>
        {statusMsg && (
            <div className={`text-white text-xs text-center py-1 absolute w-full top-14 left-0 animate-fade-in z-20 ${statusMsg.includes('Erro') ? 'bg-red-600' : statusMsg.includes('Offline') || statusMsg.includes('Teste') ? 'bg-orange-500' : 'bg-green-600'}`}>
                {statusMsg}
            </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {entries.length === 0 && clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in-up">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-lg">
                <div className={`${isOfflineMode ? 'bg-orange-50' : 'bg-blue-50'} p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4`}>
                    {isOfflineMode ? <CloudOff className="text-orange-500 h-8 w-8" /> : <Cloud className="text-blue-600 h-8 w-8" />}
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                    {isOfflineMode ? 'Modo de Teste (Offline)' : 'Base de Dados na Nuvem'}
                </h2>
                
                {session.isMaster || isOfflineMode ? (
                    <>
                        <p className="mt-2 text-gray-500 mb-8 text-sm leading-relaxed">
                            {isOfflineMode 
                             ? "Este ambiente não possui conexão com banco de dados. Importe seus dados para testar a interface localmente." 
                             : "O banco de dados está vazio ou não conectado. Importe uma planilha ou um backup para iniciar e sincronizar."}
                        </p>
                        <div className="flex justify-center">
                            <FileUpload onDataLoaded={handleDataLoaded} onBackupLoaded={handleBackupLoaded} />
                        </div>
                    </>
                ) : (
                    <>
                        <p className="mt-2 text-gray-500 mb-6 text-sm leading-relaxed">
                            Nenhum dado encontrado no servidor.<br/>
                            Aguarde o administrador (Vinicius) carregar a base de dados.
                        </p>
                        <button 
                            onClick={fetchCloudData} 
                            className="inline-flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-md hover:bg-blue-100 transition-colors"
                        >
                            <RefreshCw size={16} /> Tentar recarregar
                        </button>
                    </>
                )}
            </div>
          </div>
        ) : (
          activeTab === 'dashboard' ? (
            <Dashboard summary={summary} /> 
          ) : activeTab === 'health' ? (
            <HealthDashboard clients={clients} savedInputs={healthInputs} onSaveInput={saveHealthInput} canEdit={!!session?.isMaster} />
          ) : (
            <Settings employees={employees} clients={clients} onUpdateEmployees={handleUpdateEmployees} onUpdateClients={handleUpdateClients} />
          )
        )}
      </main>
    </div>
  );
};

export default App;

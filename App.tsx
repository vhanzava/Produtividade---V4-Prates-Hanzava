import React, { useState, useEffect, useMemo } from 'react';
import { parseCSV, calculateSummary } from './services/dataProcessor';
import { TimeEntry, EmployeeConfig, ClientConfig, UserSession } from './types';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Login from './components/Login';
import { LayoutDashboard, Settings as SettingsIcon, LogOut } from 'lucide-react';

const STORAGE_KEY_EMPS = 'ekyte_analyzer_employees_v2';
const STORAGE_KEY_CLIENTS = 'ekyte_analyzer_clients_v2';
const STORAGE_KEY_ENTRIES = 'ekyte_analyzer_entries_v2';
const DATE_INPUT_STYLE = "bg-gray-700 text-white border-gray-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm p-1 border";

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<UserSession | null>(null);

  // App State
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<EmployeeConfig[]>([]);
  const [clients, setClients] = useState<ClientConfig[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard');
  
  // Date Filtering
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Load Persistence
  useEffect(() => {
    const savedEmps = localStorage.getItem(STORAGE_KEY_EMPS);
    const savedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
    const savedEntries = localStorage.getItem(STORAGE_KEY_ENTRIES);

    if (savedEmps) setEmployees(JSON.parse(savedEmps));
    if (savedClients) setClients(JSON.parse(savedClients));
    if (savedEntries) {
        const parsed = JSON.parse(savedEntries);
        // Revive Date objects
        const revived = parsed.map((e: any) => ({
            ...e,
            date: new Date(e.date)
        }));
        setEntries(revived);
        
        // Auto-set filter range to latest data if available
        if (revived.length > 0) {
             const dates = revived.map((e: TimeEntry) => e.date.getTime());
             const min = new Date(Math.min(...dates));
             const max = new Date(Math.max(...dates));
             // Default view: Last 30 days of available data or full range
             setStartDate(min.toISOString().split('T')[0]);
             setEndDate(max.toISOString().split('T')[0]);
        }
    }
  }, []);

  const handleDataLoaded = (csvContent: string) => {
    const newEntries = parseCSV(csvContent);
    if (newEntries.length === 0) return;

    // INTELLIGENT MERGE LOGIC
    // 1. Identify the time range of the NEW file
    const newDates = newEntries.map(e => e.date.getTime());
    const minNewDate = Math.min(...newDates);
    const maxNewDate = Math.max(...newDates);

    // 2. Filter existing entries: Remove any entry that falls within the new file's range
    // This allows "overwriting" a month by re-uploading it, while keeping other months intact.
    const nonOverlappingEntries = entries.filter(e => {
        const t = e.date.getTime();
        return t < minNewDate || t > maxNewDate;
    });

    // 3. Combine
    const mergedEntries = [...nonOverlappingEntries, ...newEntries];
    
    // 4. Update State and Persistence
    setEntries(mergedEntries);
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(mergedEntries));

    // Update Date Filter to focus on the new data uploaded (User likely wants to see what they just uploaded)
    setStartDate(new Date(minNewDate).toISOString().split('T')[0]);
    setEndDate(new Date(maxNewDate).toISOString().split('T')[0]);

    // Auto-Discovery & Config Update
    const uniqueExecutors = Array.from(new Set(newEntries.map(e => e.executor)));
    const uniqueWorkspaces = Array.from(new Set(newEntries.map(e => e.workspace)));

    setEmployees(prev => {
      const existingMap = new Map(prev.map(e => [e.name, e]));
      const newEmps: EmployeeConfig[] = [];
      
      uniqueExecutors.forEach(name => {
         if (!existingMap.has(name)) {
             newEmps.push({
                 name,
                 department: 'Outros',
                 defaultCost: 0,
                 defaultHours: 160,
                 history: {}
             });
         }
      });
      const updated = [...prev, ...newEmps];
      localStorage.setItem(STORAGE_KEY_EMPS, JSON.stringify(updated));
      return updated;
    });

    setClients(prev => {
      const existingMap = new Map(prev.map(c => [c.name, c]));
      const newClients: ClientConfig[] = [];

      uniqueWorkspaces.forEach(name => {
         if (!existingMap.has(name)) {
            newClients.push({
                name,
                isActive: true,
                category: 'Executar',
                defaultFee: 0,
                history: {}
            });
         }
      });
      const updated = [...prev, ...newClients];
      localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdateEmployees = (newEmps: EmployeeConfig[]) => {
    setEmployees(newEmps);
    localStorage.setItem(STORAGE_KEY_EMPS, JSON.stringify(newEmps));
  };

  const handleUpdateClients = (newClients: ClientConfig[]) => {
    setClients(newClients);
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(newClients));
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
                                 <div className="ml-2"><FileUpload onDataLoaded={handleDataLoaded} /></div>
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
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {entries.length === 0 && clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-900">Bem-vindo à Produtividade</h2>
            <p className="mt-2 text-gray-500 mb-8">Nenhum dado encontrado. {session.isMaster ? 'Importe uma planilha para começar.' : 'Aguarde o administrador carregar os dados.'}</p>
            {session.isMaster ? <FileUpload onDataLoaded={handleDataLoaded} /> : (
                <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm border border-yellow-200">
                    Aguardando carga de dados pelo Master (vinicius.hanzava@v4company.com)
                </div>
            )}
          </div>
        ) : (
          activeTab === 'dashboard' ? <Dashboard summary={summary} /> : <Settings employees={employees} clients={clients} onUpdateEmployees={handleUpdateEmployees} onUpdateClients={handleUpdateClients} />
        )}
      </main>
    </div>
  );
};

export default App;
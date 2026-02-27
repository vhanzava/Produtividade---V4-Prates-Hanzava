import React, { useState, useRef } from 'react';
import { EmployeeConfig, ClientConfig, DepartmentType, ClientCategory } from '../types';
import { Save, User, Briefcase, Plus, Archive, RefreshCw, Calendar, FileText, Loader, Upload } from 'lucide-react';
import { extractContractData } from '../services/contractParser';

interface SettingsProps {
  employees: EmployeeConfig[];
  clients: ClientConfig[];
  onUpdateEmployees: (emps: EmployeeConfig[]) => void;
  onUpdateClients: (clients: ClientConfig[]) => void;
}

const DEPARTMENTS: DepartmentType[] = ['Criação', 'Atendimento', 'Gestão de Tráfego', 'Gestão', 'Outros'];
const CATEGORIES: ClientCategory[] = ['Saber', 'Ter', 'Executar'];

const generateMonthOptions = () => {
    const options = [{ label: 'Padrão (Geral)', value: 'default' }];
    const today = new Date();
    for (let i = -6; i <= 6; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        options.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value: val });
    }
    return options;
};

const monthOptions = generateMonthOptions();
const INPUT_STYLE = "bg-gray-700 text-white border-gray-600 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 block w-full sm:text-sm p-1.5 border";

const Settings: React.FC<SettingsProps> = ({ employees, clients, onUpdateEmployees, onUpdateClients }) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'clients'>('employees');
  const [selectedMonth, setSelectedMonth] = useState<string>('default');
  
  const [localEmps, setLocalEmps] = useState(employees);
  const [localClients, setLocalClients] = useState(clients);
  const [isSaved, setIsSaved] = useState(false);
  
  // Loading state for PDF parsing
  const [processingClientIndex, setProcessingClientIndex] = useState<number | null>(null);

  const [newClientName, setNewClientName] = useState('');
  const [newClientFee, setNewClientFee] = useState('');
  const [newClientCategory, setNewClientCategory] = useState<ClientCategory>('Executar');
  
  // Ref for hidden file input used for contract uploads
  const fileInputRefs = useRef<{[key: number]: HTMLInputElement | null}>({});

  const handleEmpChange = (index: number, field: string, value: string) => {
    const newEmps = [...localEmps];
    const emp = newEmps[index];
    
    if (field === 'department' || field === 'name') {
        // @ts-ignore
        emp[field] = value;
    } else {
        const numValue = parseFloat(value) || 0;
        
        if (selectedMonth === 'default') {
            if (field === 'monthlyCost') emp.defaultCost = numValue;
            if (field === 'monthlyHours') emp.defaultHours = numValue;
        } else {
            if (!emp.history) emp.history = {};
            if (!emp.history[selectedMonth]) {
                emp.history[selectedMonth] = { cost: emp.defaultCost, hours: emp.defaultHours };
            }
            if (field === 'monthlyCost') emp.history[selectedMonth].cost = numValue;
            if (field === 'monthlyHours') emp.history[selectedMonth].hours = numValue;
        }
    }
    setLocalEmps(newEmps);
    setIsSaved(false);
  };

  const handleClientChange = (index: number, field: string, value: any) => {
    const newClients = [...localClients];
    const client = newClients[index];

    if (field === 'monthlyFee') {
        const numValue = parseFloat(value) || 0;
        if (selectedMonth === 'default') {
            client.defaultFee = numValue;
        } else {
            if (!client.history) client.history = {};
            client.history[selectedMonth] = numValue;
        }
    } else if (field === 'oneTimeFee') {
         client.oneTimeFee = parseFloat(value) || 0;
    } else {
        // @ts-ignore
        client[field] = value;
    }
    setLocalClients(newClients);
    setIsSaved(false);
  };

  const handleAddClient = () => {
      if (!newClientName) return;
      const fee = parseFloat(newClientFee) || 0;
      const newClient: ClientConfig = {
          name: newClientName,
          isActive: true,
          category: newClientCategory,
          defaultFee: selectedMonth === 'default' ? fee : 0,
          history: selectedMonth !== 'default' ? { [selectedMonth]: fee } : {}
      };
      setLocalClients([...localClients, newClient]);
      setNewClientName('');
      setNewClientFee('');
      setIsSaved(false);
  };

  const handleSave = () => {
    onUpdateEmployees(localEmps);
    onUpdateClients(localClients);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleContractUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setProcessingClientIndex(index);
      try {
          const data = await extractContractData(file);
          
          const newClients = [...localClients];
          const client = newClients[index];

          if (data.recurringFee > 0) {
              if (selectedMonth === 'default') {
                  client.defaultFee = data.recurringFee;
              } else {
                  if (!client.history) client.history = {};
                  client.history[selectedMonth] = data.recurringFee;
              }
          }

          if (data.oneTimeFee > 0) {
              client.oneTimeFee = data.oneTimeFee;
          }

          if (data.startDate) {
              client.contractStartDate = data.startDate;
          }
          
          if (!client.name && data.clientName) {
              client.name = data.clientName;
          }

          setLocalClients(newClients);
          setIsSaved(false);
          alert(`Contrato Processado!\nFee Recorrente: R$ ${data.recurringFee}\nSetup (One-Time): R$ ${data.oneTimeFee}\nInício: ${data.startDate || 'Não detectado'}`);

      } catch (err: any) {
          console.error("PDF Error:", err);
          // Mensagem de erro mais detalhada para facilitar debug
          alert(`Erro ao ler o PDF: ${err.message || err}`);
      } finally {
          setProcessingClientIndex(null);
          // Clear input
          if (e.target) e.target.value = '';
      }
  };

  const getEmpValue = (emp: EmployeeConfig, type: 'cost' | 'hours') => {
      if (selectedMonth === 'default') {
          return type === 'cost' ? emp.defaultCost : emp.defaultHours;
      }
      const hist = emp.history && emp.history[selectedMonth];
      return hist ? (type === 'cost' ? hist.cost : hist.hours) : (type === 'cost' ? emp.defaultCost : emp.defaultHours);
  };

  const getClientFee = (client: ClientConfig) => {
      if (selectedMonth === 'default') return client.defaultFee;
      return client.history && client.history[selectedMonth] !== undefined ? client.history[selectedMonth] : client.defaultFee;
  };

  const sortedClients = [...localClients].sort((a, b) => {
      if (a.isActive === b.isActive) return a.name.localeCompare(b.name);
      return a.isActive ? -1 : 1;
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 flex flex-col md:flex-row justify-between items-center bg-gray-50 px-6 py-4 gap-4">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('employees')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'employees' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User size={16} />
            <span>Colaboradores</span>
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'clients' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Briefcase size={16} />
            <span>Clientes</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-md border border-gray-300">
            <Calendar size={16} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-500">Mês de Competência:</span>
            <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm border-none focus:ring-0 text-gray-700 font-medium bg-transparent cursor-pointer"
            >
                {monthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center space-x-2 bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-md text-sm transition-colors"
        >
          <Save size={16} />
          <span>{isSaved ? 'Salvo!' : 'Salvar Alterações'}</span>
        </button>
      </div>

      <div className="p-6">
        {selectedMonth !== 'default' && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-6">
                <p className="text-sm text-yellow-700">
                    <strong>Atenção:</strong> Você está editando valores específicos para <strong>{monthOptions.find(o => o.value === selectedMonth)?.label}</strong>. 
                </p>
            </div>
        )}

        {activeTab === 'employees' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departamento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Custo Mensal {selectedMonth !== 'default' && '(Exceção)'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Capacidade {selectedMonth !== 'default' && '(Exceção)'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {localEmps.map((emp, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{emp.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <select 
                            className={INPUT_STYLE}
                            value={emp.department || 'Outros'}
                            onChange={(e) => handleEmpChange(idx, 'department', e.target.value)}
                        >
                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <input
                        type="number"
                        className={INPUT_STYLE}
                        value={getEmpValue(emp, 'cost')}
                        onChange={(e) => handleEmpChange(idx, 'monthlyCost', e.target.value)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <input
                        type="number"
                        className={INPUT_STYLE}
                        value={getEmpValue(emp, 'hours')}
                        onChange={(e) => handleEmpChange(idx, 'monthlyHours', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-6">
             <div className="bg-gray-50 p-4 rounded-md border border-gray-200 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Cliente/Projeto</label>
                    <input 
                        type="text" 
                        className={INPUT_STYLE}
                        placeholder="Nome do Cliente"
                        value={newClientName}
                        onChange={e => setNewClientName(e.target.value)}
                    />
                </div>
                <div className="w-32">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
                    <select 
                        className={INPUT_STYLE}
                        value={newClientCategory}
                        onChange={e => setNewClientCategory(e.target.value as ClientCategory)}
                    >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="w-40">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Fee {selectedMonth !== 'default' ? 'Mês' : 'Padrão'}</label>
                    <input 
                        type="number" 
                        className={INPUT_STYLE}
                        placeholder="0.00"
                        value={newClientFee}
                        onChange={e => setNewClientFee(e.target.value)}
                    />
                </div>
                <div className="w-40">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Account Manager</label>
                    <select 
                        className={INPUT_STYLE}
                        value={(localClients.find(c => c.name === newClientName)?.accountManager) || ''}
                        onChange={e => {
                            // This is tricky because we are adding a new client. 
                            // We need a state for newClientAccountManager.
                            // But for now let's just add it to the table row editing.
                        }}
                        disabled
                    >
                        <option value="">(Adicionar na tabela)</option>
                    </select>
                </div>
                <button 
                    onClick={handleAddClient}
                    disabled={!newClientName}
                    className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 h-9"
                >
                    <Plus size={16} /> Adicionar
                </button>
             </div>

             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead>
                    <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">Contrato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Início</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fee Recorrente {selectedMonth !== 'default' && '(Mês)'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Setup (One-Time)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {sortedClients.map((client, idx) => {
                        const realIndex = localClients.findIndex(c => c.name === client.name);
                        return (
                        <tr key={realIndex} className={client.isActive ? '' : 'bg-gray-50 opacity-75'}>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <button
                                    onClick={() => fileInputRefs.current[realIndex]?.click()}
                                    className="text-red-600 hover:text-red-800 transition-colors p-1 rounded hover:bg-red-50"
                                    title="Carregar PDF do Contrato"
                                    disabled={processingClientIndex === realIndex}
                                >
                                    {processingClientIndex === realIndex ? (
                                        <Loader size={18} className="animate-spin" />
                                    ) : (
                                        <FileText size={18} />
                                    )}
                                </button>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="application/pdf"
                                    ref={el => fileInputRefs.current[realIndex] = el}
                                    onChange={(e) => handleContractUpload(e, realIndex)}
                                />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <input
                                    type="date"
                                    className={INPUT_STYLE}
                                    value={client.contractStartDate || ''}
                                    onChange={(e) => handleClientChange(realIndex, 'contractStartDate', e.target.value)}
                                />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${client.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {client.isActive ? 'Ativo' : 'Inativo'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <select 
                                    className={INPUT_STYLE}
                                    value={client.category || 'Executar'}
                                    onChange={(e) => handleClientChange(realIndex, 'category', e.target.value)}
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <select 
                                    className={INPUT_STYLE}
                                    value={client.accountManager || ''}
                                    onChange={(e) => handleClientChange(realIndex, 'accountManager', e.target.value)}
                                >
                                    <option value="">Selecione...</option>
                                    {localEmps.map(emp => (
                                        <option key={emp.name} value={emp.name}>{emp.name}</option>
                                    ))}
                                </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <input
                                    type="number"
                                    className={INPUT_STYLE}
                                    value={getClientFee(client)}
                                    onChange={(e) => handleClientChange(realIndex, 'monthlyFee', e.target.value)}
                                />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <input
                                    type="number"
                                    className={INPUT_STYLE}
                                    value={client.oneTimeFee || 0}
                                    onChange={(e) => handleClientChange(realIndex, 'oneTimeFee', e.target.value)}
                                    placeholder="0.00"
                                />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                    onClick={() => handleClientChange(realIndex, 'isActive', !client.isActive)}
                                    className={`text-sm flex items-center gap-1 ml-auto ${client.isActive ? 'text-gray-500 hover:text-gray-700' : 'text-green-600 hover:text-green-800'}`}
                                    title={client.isActive ? "Arquivar Cliente" : "Restaurar Cliente"}
                                >
                                    {client.isActive ? <Archive size={16} /> : <RefreshCw size={16} />}
                                </button>
                            </td>
                        </tr>
                    )})}
                </tbody>
                </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;

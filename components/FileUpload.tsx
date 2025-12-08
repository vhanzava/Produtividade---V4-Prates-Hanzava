import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, FileJson, FileSpreadsheet } from 'lucide-react';
import { SystemBackup } from '../types';

interface FileUploadProps {
  onDataLoaded: (content: string) => void;
  onBackupLoaded: (backup: SystemBackup) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, onBackupLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const processFile = (file: File) => {
    setError(null);
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const isJson = file.name.toLowerCase().endsWith('.json');

    if (!isCsv && !isJson) {
      setError("Formato inválido. Use .csv ou .json");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        try {
            if (isJson) {
                const json = JSON.parse(text);
                // Basic validation
                if (json.entries && json.employees && json.clients) {
                    // Revive dates in entries
                    json.entries = json.entries.map((e: any) => ({
                        ...e,
                        date: new Date(e.date)
                    }));
                    onBackupLoaded(json as SystemBackup);
                } else {
                    setError("Arquivo de backup inválido.");
                }
            } else {
                onDataLoaded(text);
            }
        } catch (err) {
            setError("Erro ao processar arquivo.");
            console.error(err);
        }
      }
    };
    reader.onerror = () => setError("Erro na leitura");
    reader.readAsText(file, isCsv ? 'ISO-8859-1' : 'UTF-8'); 
  };

  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center space-x-2 bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded-md text-sm transition-colors shadow-sm whitespace-nowrap"
        title="Importar Planilha (.csv) ou Backup (.json)"
      >
        <Upload size={14} />
        <span>Importar Dados</span>
      </button>
      <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept=".csv,.json"
      />
      {error && (
        <span className="text-red-600 text-xs flex items-center bg-red-50 px-2 py-1 rounded border border-red-100 animate-pulse">
          <AlertCircle size={12} className="mr-1" />
          {error}
        </span>
      )}
    </div>
  );
};

export default FileUpload;
import React, { useRef, useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onDataLoaded: (content: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setError(null);
    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      setError("Arquivo inválido");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        onDataLoaded(text);
      }
    };
    reader.onerror = () => setError("Erro na leitura");
    reader.readAsText(file, 'ISO-8859-1'); 
  };

  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center space-x-2 bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded-md text-sm transition-colors shadow-sm whitespace-nowrap"
      >
        <Upload size={14} />
        <span>Importar CSV</span>
      </button>
      <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept=".csv"
      />
      {error && (
        <span className="text-red-600 text-xs flex items-center bg-red-50 px-2 py-1 rounded">
          <AlertCircle size={12} className="mr-1" />
          {error}
        </span>
      )}
    </div>
  );
};

export default FileUpload;
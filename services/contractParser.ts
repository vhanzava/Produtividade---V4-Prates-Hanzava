import * as pdfjsLib from 'pdfjs-dist';

// --- PDF.js v4+ Polyfill Setup ---
// A versão 4 do PDF.js exige Promise.withResolvers, que é muito recente.
// Adicionamos este polyfill para evitar falhas em navegadores/ambientes que ainda não suportam nativamente.
// @ts-ignore
if (typeof Promise.withResolvers === 'undefined') {
  // @ts-ignore
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Configura o worker via CDN
// Usamos a versão minificada (.min.mjs) para garantir compatibilidade e performance
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export interface ContractData {
  clientName: string | null;
  recurringFee: number;
  oneTimeFee: number;
  startDate: string | null;
}

const parseBrazilianCurrency = (valueStr: string): number => {
  if (!valueStr) return 0;
  // Remove pontos de milhar, troca vírgula decimal por ponto
  const cleanStr = valueStr.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanStr);
};

const parseBrazilianDate = (dateStr: string): string | null => {
    // Ex: "21 de fevereiro de 2026"
    const months: {[key: string]: string} = {
        'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04', 'maio': '05', 'junho': '06',
        'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
    };
    
    try {
        // Limpeza básica para remover caracteres extras que o OCR possa ter pego
        const cleanDateStr = dateStr.replace(/;/g, '').replace(/\./g, '').trim();
        const parts = cleanDateStr.toLowerCase().split(' de ');
        
        if (parts.length === 3) {
            const day = parts[0].trim().padStart(2, '0');
            const month = months[parts[1].trim()];
            const year = parts[2].trim();
            
            if (day && month && year) {
                return `${year}-${month}-${day}`;
            }
        }
    } catch (e) { console.error('Date parse error', e); }
    return null;
};

export const extractContractData = async (file: File): Promise<ContractData> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Carrega o documento usando o worker configurado
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  // Limita a leitura às primeiras 5 páginas onde geralmente estão os valores
  const maxPages = Math.min(pdf.numPages, 5);
  
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // @ts-ignore
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  // Regex Patterns refinados
  const patterns = {
    // Busca nome após "Contratante"
    clientName: /Contratante\s*([\s\S]*?)(?=\s*,?\s*pessoa jurídica|\s*,?\s*inscrita no CNPJ)/i,
    
    // "Valor da Parcela: R$ 6.602,01"
    recurringFee: /Valor da Parcela:\s*R\$\s*([\d\.,]+)/i,
    
    // "Valor de implementação (pontual): R$ 27.735,00"
    oneTimeFee: /Valor de implementação \(pontual\):\s*R\$\s*([\d\.,]+)/i,

    // "Data de início do projeto: 21 de fevereiro de 2026" - Captura até ; ou fim de linha
    startDate: /Data de início do projeto:\s*(.*?)(;|$)/i
  };

  const data: ContractData = {
    clientName: null,
    recurringFee: 0,
    oneTimeFee: 0,
    startDate: null
  };

  // 1. Extract Name
  const nameMatch = fullText.match(patterns.clientName);
  if (nameMatch && nameMatch[1]) {
      data.clientName = nameMatch[1].trim();
  }

  // 2. Extract Recurring Fee
  const recMatch = fullText.match(patterns.recurringFee);
  if (recMatch && recMatch[1]) {
      data.recurringFee = parseBrazilianCurrency(recMatch[1]);
  }

  // 3. Extract One Time Fee
  const oneTimeMatch = fullText.match(patterns.oneTimeFee);
  if (oneTimeMatch && oneTimeMatch[1]) {
      data.oneTimeFee = parseBrazilianCurrency(oneTimeMatch[1]);
  }

  // 4. Extract Start Date
  const dateMatch = fullText.match(patterns.startDate);
  if (dateMatch && dateMatch[1]) {
      data.startDate = parseBrazilianDate(dateMatch[1]);
  }

  return data;
};

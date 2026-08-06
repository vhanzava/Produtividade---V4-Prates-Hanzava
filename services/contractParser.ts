import * as pdfjsLib from 'pdfjs-dist';

// --- PDF.js v4+ Polyfill Setup ---
// A versão 4 do PDF.js exige Promise.withResolvers.
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

// Configura o worker via CDN dinamicamente
// Usa a propriedade .version da própria biblioteca para garantir que o Worker 
// seja exatamente da mesma versão do pacote instalado via npm (Ex: 4.10.38)
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface ContractData {
  clientName: string | null;
  recurringFee: number;
  oneTimeFee: number;
  startDate: string | null;
  /** Número de parcelas do pagamento. É o PRAZO DE COBRANÇA, não o de entrega. */
  installments: number | null;
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

  // O SOW atual traz dois blocos independentes no topo — "Recorrência" e
  // "Implementação (Pontual)" — e um contrato pode ter só um dos dois.
  // Cada campo aceita mais de uma redação: a primeira que casar vence, então a
  // ordem importa (a redação atual vem antes da legada).
  const patterns = {
    // Busca nome após "Contratante"
    clientName: [
      /Contratante\s*:?\s*([\s\S]*?)(?=\s*,?\s*pessoa jurídica|\s*,?\s*inscrita no CNPJ)/i,
    ],

    // "Valor mensal do projeto: R$ 495,94"  (redação atual)
    // "Valor da Parcela: R$ 6.602,01"       (redação legada)
    // Cuidado: "Valor TOTAL do projeto" aparece logo antes do mensal e não pode
    // ser confundido com ele — daí o "mensal" explícito no padrão.
    recurringFee: [
      /Valor\s+mensal\s+do\s+projeto\s*:?\s*R\$\s*([\d.,]+)/i,
      /Valor\s+da\s+Parcela\s*:?\s*R\$\s*([\d.,]+)/i,
    ],

    // "Valor de implementação (pontual): R$ 7.023,95"
    oneTimeFee: [
      /Valor\s+de\s+implementa[çc][ãa]o\s*\(pontual\)\s*:?\s*R\$\s*([\d.,]+)/i,
      /Valor\s+de\s+implementa[çc][ãa]o\s*:?\s*R\$\s*([\d.,]+)/i,
    ],

    // Contratos com recorrência usam "Data de início do projeto"; os que só têm
    // implementação usam "Data de início do escopo fechado".
    startDate: [
      /Data\s+de\s+in[íi]cio\s+do\s+projeto\s*:?\s*(.*?)(?:;|\n|Valor|Forma|Data|$)/i,
      /Data\s+de\s+in[íi]cio\s+do\s+escopo\s+fechado\s*:?\s*(.*?)(?:;|\n|Valor|Forma|Data|$)/i,
    ],

    // "Quantidade de parcelas: 6"
    installments: [
      /Quantidade\s+de\s+parcelas\s*:?\s*(\d+)/i,
    ],
  };

  const firstMatch = (candidates: RegExp[]): string | null => {
    for (const pattern of candidates) {
      const match = fullText.match(pattern);
      if (match && match[1] && match[1].trim()) return match[1].trim();
    }
    return null;
  };

  const name = firstMatch(patterns.clientName);
  const recurring = firstMatch(patterns.recurringFee);
  const oneTime = firstMatch(patterns.oneTimeFee);
  const start = firstMatch(patterns.startDate);
  const parcels = firstMatch(patterns.installments);

  return {
    clientName: name,
    // Ausência do bloco de recorrência significa contrato só de implementação —
    // zero recorrente é resposta correta, não falha de leitura.
    recurringFee: recurring ? parseBrazilianCurrency(recurring) : 0,
    oneTimeFee: oneTime ? parseBrazilianCurrency(oneTime) : 0,
    startDate: start ? parseBrazilianDate(start) : null,
    installments: parcels ? parseInt(parcels, 10) : null,
  };
};

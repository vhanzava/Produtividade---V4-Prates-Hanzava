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

  const firstMatch = (text: string, candidates: RegExp[]): string | null => {
    for (const pattern of candidates) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim()) return match[1].trim();
    }
    return null;
  };

  // Os contratos V4 vêm em três formatos, e todos separam recorrência de
  // implementação em blocos. O problema é que o rótulo "Valor total do projeto"
  // aparece nos DOIS blocos com significados diferentes — no de recorrência é a
  // soma das mensalidades, no de implementação é o valor do setup. Ler o
  // documento inteiro de uma vez confunde os dois, então cortamos no cabeçalho
  // da implementação e procuramos cada valor só na metade a que ele pertence.
  //
  //   "Implementação (Pontual)"      → SOW atual
  //   "Implementação  Descrição ..." → tabela de Condições Comerciais
  const implHeader = /Implementa[çc][ãa]o\s*(?:\(\s*Pontual\s*\)|Descri[çc][ãa]o)/i;
  const headerAt = fullText.search(implHeader);
  const recurringSection = headerAt >= 0 ? fullText.slice(0, headerAt) : fullText;
  const implementationSection = headerAt >= 0 ? fullText.slice(headerAt) : '';

  const name = firstMatch(fullText, [
    /Contratante\s*:?\s*([\s\S]*?)(?=\s*,?\s*pessoa jurídica|\s*,?\s*inscrita no CNPJ)/i,
  ]);

  const recurring = firstMatch(recurringSection, [
    // "Valor mensal do projeto: R$ 495,94"
    /Valor\s+mensal\s+do\s+projeto\s*:?\s*R\$\s*([\d.,]+)/i,
    // "Valor mensal da parcela, se houver: R$ 6.039,34"
    // Quantificador preguiçoso e limitado até o "R$" mais próximo. Uma classe
    // negada como [^:R] não serve aqui: sob o flag /i ela também exclui "r"
    // minúsculo, e trava no "r" de "houver" antes de alcançar o valor.
    /Valor\s+mensal\s+da\s+parcela[\s\S]{0,40}?R\$\s*([\d.,]+)/i,
    // "Valor da Parcela: R$ 6.602,01" (redação legada)
    /Valor\s+da\s+Parcela\s*:?\s*R\$\s*([\d.,]+)/i,
  ]);

  const oneTime = firstMatch(implementationSection, [
    /Valor\s+de\s+implementa[çc][ãa]o\s*\(\s*pontual\s*\)\s*:?\s*R\$\s*([\d.,]+)/i,
    /Valor\s+de\s+implementa[çc][ãa]o\s*:?\s*R\$\s*([\d.,]+)/i,
    // Dentro do bloco de implementação, "valor total do projeto" É o setup.
    /Valor\s+total\s+do\s+projeto\s*:?\s*R\$\s*([\d.,]+)/i,
  ]);

  // Contratos com recorrência usam "Data de início do projeto"; os que só têm
  // escopo fechado usam "Data de início do escopo fechado".
  const start = firstMatch(fullText, [
    /Data\s+de\s+in[íi]cio\s+do\s+projeto\s*:?\s*(.*?)(?:;|\n|Valor|Forma|Data|Vig[êe]ncia|$)/i,
    /Data\s+de\s+in[íi]cio\s+do\s+escopo\s+fechado\s*:?\s*(.*?)(?:;|\n|Valor|Forma|Data|$)/i,
  ]);

  const parcels = firstMatch(fullText, [
    /Quantidade\s+de\s+[Pp]arcelas\s*:?\s*(\d+)/i,
  ]);

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

// Proxy HTTP para a API do eKyte.
//
// Existe por dois motivos:
//   1. A chave da API do eKyte dá acesso a TODOS os dados da empresa. Ela fica
//      apenas na variável de ambiente `EKYTE_API_KEY` do servidor e nunca chega
//      ao bundle do browser.
//   2. `api.ekyte.com` não envia cabeçalhos de CORS, então o fetch direto a
//      partir da SPA seria bloqueado pelo navegador.
//
// Em produção roda como Vercel Serverless Function (`/api/ekyte`).
// Em desenvolvimento, o plugin em `vite.config.ts` monta o mesmo handler.

import {
  EkyteError,
  ekyteFetchAll,
  getApiKey,
  isEkyteResource,
  pickAllowedParams,
} from './_ekyte';

type Query = Record<string, string | string[] | undefined>;

export interface EkyteHandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Núcleo do endpoint, independente de framework — usado tanto pela função
 * serverless quanto pelo middleware de desenvolvimento.
 */
export const handleEkyteRequest = async (query: Query): Promise<EkyteHandlerResult> => {
  const rawResource = Array.isArray(query.resource) ? query.resource[0] : query.resource;

  if (!isEkyteResource(rawResource)) {
    return {
      status: 400,
      body: { error: 'Parâmetro "resource" inválido. Use time-trackings, workspaces ou users.' },
    };
  }

  try {
    const apiKey = getApiKey();
    const params = pickAllowedParams(rawResource, query);
    const { data, pages } = await ekyteFetchAll(rawResource, params, apiKey);
    return { status: 200, body: { data, count: data.length, pages } };
  } catch (err) {
    if (err instanceof EkyteError) {
      // Status vindo do eKyte pode ser 402/403; normaliza para faixa HTTP válida.
      const status = err.status >= 400 && err.status <= 599 ? err.status : 502;
      return { status, body: { error: err.message } };
    }
    return { status: 500, body: { error: 'Erro inesperado ao consultar o eKyte.' } };
  }
};

// --- Adaptador Vercel ---------------------------------------------------

interface VercelLikeRequest {
  method?: string;
  query: Query;
}

interface VercelLikeResponse {
  setHeader(name: string, value: string): void;
  status(code: number): VercelLikeResponse;
  json(body: unknown): void;
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  // Resposta sempre fresca: o dashboard sincroniza sob demanda.
  res.setHeader('Cache-Control', 'no-store');

  const { status, body } = await handleEkyteRequest(req.query || {});
  res.status(status).json(body);
}

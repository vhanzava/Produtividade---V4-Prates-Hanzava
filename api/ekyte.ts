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
//
// NOTA: este arquivo é deliberadamente autocontido, sem imports relativos.
// O package.json declara `"type": "module"`, e sob resolução ESM nativa do Node
// um import relativo sem extensão (`'./_ekyte'`) falha em runtime na Vercel —
// a função respondia HTTP 500 com página de erro em HTML.
//
// Referência: https://developers.ekyte.com/api-reference/

// Declarado localmente (o projeto não tem @types/node instalado). Por estar
// dentro de um módulo, não vaza para o escopo global.
declare const process: { env: Record<string, string | undefined> };

const EKYTE_BASE_URL = 'https://api.ekyte.com';

/**
 * Recursos liberados para consulta através do proxy.
 * `allowedParams` funciona como whitelist: qualquer outro parâmetro vindo do
 * browser é descartado, para que ninguém consiga montar uma query arbitrária.
 */
const EKYTE_RESOURCES = {
  'time-trackings': {
    path: '/v1.0/time-trackings',
    allowedParams: ['createdFrom', 'createdTo', 'workspaceId', 'squadId'],
  },
  workspaces: {
    path: '/v1.0/workspaces',
    allowedParams: ['situationId', 'name', 'squadId'],
  },
  users: {
    path: '/v1.0/users',
    allowedParams: [],
  },
} as const;

type EkyteResource = keyof typeof EKYTE_RESOURCES;

const isEkyteResource = (value: unknown): value is EkyteResource =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(EKYTE_RESOURCES, value);

interface EkyteEnvelope {
  error?: { id?: string; message?: string; code?: string; details?: unknown } | null;
  data?: unknown[] | null;
  paging?: {
    currentPage?: { size?: number; number?: number };
    totalCollectionSize?: number;
    totalPages?: number;
  } | null;
}

class EkyteError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'EkyteError';
    this.status = status;
  }
}

/** Teto de páginas por requisição — evita varrer a base inteira se um filtro vier errado. */
const MAX_PAGES = 60;

const getApiKey = (): string => {
  const key = typeof process !== 'undefined' ? process.env?.EKYTE_API_KEY : undefined;
  if (!key) {
    throw new EkyteError(
      'EKYTE_API_KEY não configurada no servidor. Defina a variável de ambiente e faça o redeploy.',
      500,
    );
  }
  return key;
};

/**
 * Busca todas as páginas de um recurso e devolve os registros concatenados.
 * A API do eKyte responde `{ error, data, paging }` e pagina via `?page=N`,
 * sinalizando o fim quando `paging.currentPage.number >= paging.totalPages`.
 */
const ekyteFetchAll = async (
  resource: EkyteResource,
  params: Record<string, string>,
  apiKey: string,
): Promise<{ data: unknown[]; pages: number }> => {
  const { path } = EKYTE_RESOURCES[resource];
  const all: unknown[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const url = new URL(path, EKYTE_BASE_URL);
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('page', String(page));
    for (const key of Object.keys(params)) {
      if (params[key] !== '') url.searchParams.set(key, params[key]);
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    } catch {
      // A mensagem original pode conter a URL completa (com a apiKey) — descartada de propósito.
      throw new EkyteError('Falha de rede ao contatar a API do eKyte.', 502);
    }

    let body: EkyteEnvelope;
    try {
      body = (await response.json()) as EkyteEnvelope;
    } catch {
      throw new EkyteError(`Resposta inválida da API do eKyte (HTTP ${response.status}).`, 502);
    }

    if (body.error) {
      const detail = body.error.message || 'erro não especificado';
      // `error.code` é um código interno do eKyte, não um status HTTP: um token
      // inválido chega como HTTP 401 com `code: "404"`. Vale o status da resposta.
      const status = response.status >= 400 ? response.status : 502;
      throw new EkyteError(`eKyte respondeu: ${detail}`, status);
    }

    if (!response.ok) {
      throw new EkyteError(`eKyte respondeu HTTP ${response.status}.`, response.status);
    }

    if (Array.isArray(body.data)) all.push(...body.data);

    const totalPages = body.paging?.totalPages ?? 1;
    const currentPage = body.paging?.currentPage?.number ?? page;
    if (currentPage >= totalPages) {
      return { data: all, pages: page };
    }
    page = currentPage + 1;
  }

  throw new EkyteError(
    `Consulta excedeu o limite de ${MAX_PAGES} páginas. Reduza o período sincronizado.`,
    413,
  );
};

type Query = Record<string, string | string[] | undefined>;

/** Aplica a whitelist do recurso sobre os parâmetros recebidos do browser. */
const pickAllowedParams = (resource: EkyteResource, query: Query): Record<string, string> => {
  const allowed: readonly string[] = EKYTE_RESOURCES[resource].allowedParams;
  const params: Record<string, string> = {};
  for (const name of allowed) {
    const raw = query[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && value.trim() !== '') {
      params[name] = value.trim();
    }
  }
  return params;
};

export interface EkyteHandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Confere se o token pertence a uma sessão válida do Supabase.
 *
 * O endpoint estava aberto: qualquer um com a URL puxava todos os dados do
 * eKyte da empresa. Aqui a checagem é delegada ao próprio Supabase — não
 * guardamos segredo de JWT nem reimplementamos validação de assinatura, que é
 * onde esse tipo de código costuma errar.
 */
const isAuthenticated = async (token: string | undefined): Promise<boolean> => {
  if (!token) return false;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  // Sem as variáveis o proxy não tem como validar. Nega — falhar fechado é o
  // comportamento certo aqui; falhar aberto reabriria o buraco silenciosamente.
  if (!supabaseUrl || !supabaseAnonKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
};

const bearerToken = (header: string | undefined): string | undefined => {
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : undefined;
};

/**
 * Núcleo do endpoint, independente de framework — usado tanto pela função
 * serverless quanto pelo middleware de desenvolvimento em `vite.config.ts`.
 */
export const handleEkyteRequest = async (
  query: Query,
  authorizationHeader?: string,
): Promise<EkyteHandlerResult> => {
  if (!(await isAuthenticated(bearerToken(authorizationHeader)))) {
    return { status: 401, body: { error: 'Sessão inválida ou expirada. Faça login novamente.' } };
  }

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
    const detail = err instanceof Error ? err.message : String(err);
    return { status: 500, body: { error: `Erro inesperado ao consultar o eKyte: ${detail}` } };
  }
};

// --- Adaptador Vercel ---------------------------------------------------

interface VercelLikeRequest {
  method?: string;
  query?: Query;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}

interface VercelLikeResponse {
  setHeader(name: string, value: string): void;
  status(code: number): VercelLikeResponse;
  json(body: unknown): void;
}

export default async function handler(req: VercelLikeRequest, res: VercelLikeResponse) {
  try {
    if (req.method && req.method !== 'GET') {
      res.status(405).json({ error: 'Método não permitido.' });
      return;
    }

    // Resposta sempre fresca: o dashboard sincroniza sob demanda.
    res.setHeader('Cache-Control', 'no-store');

    // `req.query` é populado pela Vercel; o fallback pela URL cobre runtimes
    // que entreguem apenas a request crua.
    let query: Query = req.query || {};
    if (Object.keys(query).length === 0 && req.url) {
      query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams.entries());
    }

    const rawAuth = req.headers?.authorization ?? req.headers?.Authorization;
    const authorization = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

    const { status, body } = await handleEkyteRequest(query, authorization);
    res.status(status).json(body);
  } catch (err) {
    // Rede de segurança: sem isto, um throw aqui vira página de erro em HTML da
    // Vercel e o front-end só consegue dizer "resposta inválida do servidor".
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Falha no handler /api/ekyte: ${detail}` });
  }
}

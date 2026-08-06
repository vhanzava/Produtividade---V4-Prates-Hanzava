// Núcleo de acesso à API REST do eKyte.
//
// Roda SEMPRE do lado do servidor (Vercel Serverless Function em produção,
// middleware do Vite em desenvolvimento). Nunca importe este arquivo a partir
// de código do browser: a chave de API dá acesso a todos os dados da empresa
// e não pode ir para o bundle.
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
 * Page size conforme a documentação de cada endpoint.
 */
export const EKYTE_RESOURCES = {
  'time-trackings': {
    path: '/v1.0/time-trackings',
    allowedParams: ['createdFrom', 'createdTo', 'workspaceId', 'squadId'],
    pageSize: 100,
  },
  workspaces: {
    path: '/v1.0/workspaces',
    allowedParams: ['situationId', 'name', 'squadId'],
    pageSize: 100,
  },
  users: {
    path: '/v1.0/users',
    allowedParams: [],
    pageSize: 500,
  },
} as const;

export type EkyteResource = keyof typeof EKYTE_RESOURCES;

export const isEkyteResource = (value: unknown): value is EkyteResource =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(EKYTE_RESOURCES, value);

interface EkytePaging {
  currentPage?: { size?: number; number?: number };
  totalCollectionSize?: number;
  totalPages?: number;
}

interface EkyteEnvelope<T> {
  error?: { id?: string; message?: string; code?: string; details?: unknown } | null;
  data?: T[] | null;
  paging?: EkytePaging | null;
}

export class EkyteError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'EkyteError';
  }
}

/** Teto de páginas por requisição — evita varrer a base inteira se um filtro vier errado. */
const MAX_PAGES = 60;

export const getApiKey = (): string => {
  const key = process.env.EKYTE_API_KEY;
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
export const ekyteFetchAll = async <T>(
  resource: EkyteResource,
  params: Record<string, string>,
  apiKey: string,
): Promise<{ data: T[]; pages: number }> => {
  const { path } = EKYTE_RESOURCES[resource];
  const all: T[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const url = new URL(path, EKYTE_BASE_URL);
    url.searchParams.set('apiKey', apiKey);
    url.searchParams.set('page', String(page));
    for (const [key, value] of Object.entries(params)) {
      if (value !== '') url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      // A mensagem original pode conter a URL completa (com a apiKey) — descartada de propósito.
      throw new EkyteError('Falha de rede ao contatar a API do eKyte.', 502);
    }

    let body: EkyteEnvelope<T>;
    try {
      body = (await response.json()) as EkyteEnvelope<T>;
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

    all.push(...(body.data ?? []));

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

/** Aplica a whitelist do recurso sobre os parâmetros recebidos do browser. */
export const pickAllowedParams = (
  resource: EkyteResource,
  query: Record<string, string | string[] | undefined>,
): Record<string, string> => {
  const { allowedParams } = EKYTE_RESOURCES[resource];
  const params: Record<string, string> = {};
  for (const name of allowedParams as readonly string[]) {
    const raw = query[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && value.trim() !== '') {
      params[name] = value.trim();
    }
  }
  return params;
};

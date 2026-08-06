import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleEkyteRequest } from './api/ekyte';

// Tipagem mínima do Node (o projeto não instala @types/node). Por estar em um
// módulo, fica restrita a este arquivo.
declare const process: { cwd(): string; env: Record<string, string | undefined> };

/**
 * Em produção `/api/ekyte` é uma Serverless Function da Vercel. O `vite dev`
 * não executa a pasta `api/`, então este plugin monta o MESMO handler no
 * servidor de desenvolvimento — assim `npm run dev` se comporta como o deploy.
 *
 * A chave vem de `EKYTE_API_KEY` no `.env.local` (sem prefixo `VITE_`, para não
 * ser exposta no bundle do browser).
 */
const ekyteDevApi = (env: Record<string, string>): Plugin => ({
  name: 'ekyte-dev-api',
  apply: 'serve',
  configureServer(server) {
    if (env.EKYTE_API_KEY) {
      process.env.EKYTE_API_KEY = env.EKYTE_API_KEY;
    }

    server.middlewares.use('/api/ekyte', (req, res) => {
      // Sem @types/node instalado, IncomingMessage/ServerResponse chegam como
      // stubs incompletos — daí os casts estruturais abaixo.
      const { url: rawUrl } = req as unknown as { url?: string };
      const response = res as unknown as {
        statusCode: number;
        setHeader(name: string, value: string): void;
        end(chunk: string): void;
      };

      const url = new URL(rawUrl || '/', 'http://localhost');
      const query = Object.fromEntries(url.searchParams.entries());

      handleEkyteRequest(query).then(({ status, body }) => {
        response.statusCode = status;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(body));
      });
    });
  },
});

export default defineConfig(({ mode }) => {
  // Prefixo vazio: carrega também variáveis sem `VITE_`, que ficam só no servidor.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), ekyteDevApi(env)],
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});

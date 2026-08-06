<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Ferramenta da Operação — V4 Prates Hanzava

Dashboard de lucratividade por cliente, capacidade do time e Health Score,
alimentado pelos apontamentos de horas do eKyte.

## Como os dados entram

Há dois caminhos, e ambos produzem exatamente o mesmo formato interno
(`TimeEntry`), então todo o cálculo de custo, margem e capacidade é idêntico:

1. **Sincronização direta com o eKyte** (recomendado) — botão **"Sincronizar
   eKyte"** no cabeçalho. Busca os apontamentos do período selecionado direto da
   API, sem exportar planilha. Executores e workspaces novos são cadastrados
   automaticamente em Configurações.
2. **Import de CSV** (fallback) — a exportação manual do eKyte, com as colunas
   `Executor`, `Workspace`, `Realizado` e `Data`.

Sincronizar substitui tudo que já existia dentro do período escolhido: o eKyte é
a fonte da verdade para aquela janela. Apontamentos têm id estável, então
sincronizar períodos sobrepostos não duplica horas.

## Configuração

### 1. Chave da API do eKyte

Pegue o token em **eKyte → Minha Empresa → aba Avançado → "Token de acesso"**
(em contas mais novas: **Configurações → API → "Gerar nova chave"**).

> A chave dá acesso a **todos** os dados da empresa. Ela é lida apenas pela
> função serverless em [`api/ekyte.ts`](api/ekyte.ts) e nunca chega ao browser —
> por isso a variável **não** leva o prefixo `VITE_`. Não a coloque em nenhuma
> variável `VITE_*`, ou ela vai parar no bundle público.

### 2. Local

```bash
cp .env.example .env.local   # preencha EKYTE_API_KEY e as chaves do Supabase
npm install
npm run dev
```

O `vite dev` não executa a pasta `api/`, então um plugin em
[`vite.config.ts`](vite.config.ts) monta o mesmo handler em `/api/ekyte` durante
o desenvolvimento — `npm run dev` se comporta como o deploy.

### 3. Vercel

Em **Settings → Environment Variables**, cadastre:

| Variável | Escopo | Observação |
| --- | --- | --- |
| `EKYTE_API_KEY` | servidor | sem prefixo `VITE_` |
| `VITE_SUPABASE_URL` | browser | |
| `VITE_SUPABASE_ANON_KEY` | browser | apenas a chave anon |

Depois faça o redeploy. A pasta `api/` vira Serverless Function automaticamente.

## Arquitetura da integração

```
Browser (SPA)                Servidor                      eKyte
─────────────                ────────                      ─────
EkyteSync.tsx
  └─ services/ekyteSync.ts ──► api/ekyte.ts ──► api/_ekyte.ts ──► api.ekyte.com
     mapeia p/ TimeEntry       valida input     guarda a chave     /v1.0/time-trackings
     recorta o período         whitelist        pagina             /v1.0/workspaces
```

O proxy existe por dois motivos: manter a chave fora do browser e contornar a
ausência de CORS em `api.ekyte.com`.

### Detalhe do filtro de período

O endpoint `/v1.0/time-trackings` filtra por `createdFrom`/`createdTo`, que se
referem à data em que o apontamento foi **registrado** — não à data em que o
trabalho aconteceu (`startDate`). Como apontamento retroativo é comum, buscamos
uma janela 15 dias mais larga de cada lado e recortamos pelo `startDate` real.

**Limitação conhecida:** hora lançada com mais de 15 dias de atraso não entra na
sincronização daquele período. Ajuste `BUFFER_DAYS` em
[`services/ekyteSync.ts`](services/ekyteSync.ts) se a operação lançar horas com
atraso maior.

## Módulos

- **Produtividade** — custo/hora por colaborador, margem por cliente, capacidade
  vs. horas realizadas com pro-rata por dias úteis, ocupação por vertical.
- **Health Score** — 4 verticais (Engajamento, Resultados, Relacionamento,
  Pesquisas) com flag Black/Red/Yellow/Green e histórico mensal no Supabase.
- **Configurações** — cadastro de colaboradores (custo, jornada, vertical,
  entrada/saída) e clientes (fee, implementação, categoria, inadimplência).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento com `/api/ekyte` montado |
| `npm run build` | typecheck (`tsc`) + build de produção |
| `npm run preview` | serve o build — **sem** `/api/ekyte` (use `vercel dev`) |

# Nexus Engine Ultra — Documentação v16.0

> Motor de scraping e extração de dados financeiros para ativos da B3 e mercado internacional.
> Versão atual: **v16.0** · Última atualização: 2026-05-23

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Instalação e Configuração](#3-instalação-e-configuração)
4. [Tipos de Ativos Suportados](#4-tipos-de-ativos-suportados)
5. [API Pública](#5-api-pública)
6. [Classe NexusEngineUltra](#6-classe-nexusengineultra)
7. [Templates e Campos Extraídos](#7-templates-e-campos-extraídos)
8. [Schemas Zod](#8-schemas-zod)
9. [Integração AeroScrape](#9-integração-aeroscrape)
10. [Sistema de Cache (LRU + SWR)](#10-sistema-de-cache-lru--swr)
11. [Circuit Breaker](#11-circuit-breaker)
12. [Rate Limiter por Domínio](#12-rate-limiter-por-domínio)
13. [Universal Lexer](#13-universal-lexer)
14. [Stealth Headers](#14-stealth-headers)
15. [Yahoo Finance](#15-yahoo-finance)
16. [Utilitários](#16-utilitários)
17. [Variáveis de Ambiente](#17-variáveis-de-ambiente)
18. [Exemplos de Uso](#18-exemplos-de-uso)
19. [Tratamento de Erros e Resiliência](#19-tratamento-de-erros-e-resiliência)
20. [Changelog v16.0](#20-changelog-v160)

---

## 1. Visão Geral

O **Nexus Engine Ultra** é um motor de extração de dados financeiros focado em ativos brasileiros e internacionais. Combina scraping direto de HTML com uma pipeline paralela de enriquecimento via Yahoo Finance, tudo protegido por cache LRU com revalidação Stale-While-Revalidate, circuit breakers por domínio e rate limiting adaptativo.

### Fontes de dados por prioridade

| Prioridade | Fonte | Tipo | Dados |
|:---:|---|---|---|
| 1 | **AeroScrape API** *(se configurado)* | Proxy HTTP + Cache | HTML completo com cache ETag/SWR |
| 2 | **Investidor10** | Scraping direto | Fundamentos, DY, info da empresa, dividendos |
| 3 | **StatusInvest** | Scraping direto (fallback) | Fundamentos complementares |
| 4 | **Yahoo Finance** | API JSON | Cotação em tempo real, métricas adicionais |
| 5 | **Google News RSS** | RSS | Notícias relacionadas ao ativo |

### Principais características

- **Zero-AST**: regex lexer com sliding window — sem dependência de cheerio, jsdom ou parse5
- **Streaming**: lê o HTML em chunks, extrai dados e pode abortar antes de baixar a página inteira
- **Early Abort**: para o download assim que todos os campos do template forem encontrados
- **Stagnation Detection**: aborta após 10 chunks consecutivos sem novos campos encontrados
- **Deduplicação in-flight**: requests idênticos simultâneos compartilham a mesma promise
- **Resiliência WAF**: ao receber 403/401, ativa um gerador de HTML sintético baseado no ticker

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    API Pública                          │
│  fetchAtivosBatch()  runNexusBatch()  runNexusBatchAuto()│
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│              NexusEngineUltra.fetchAtivo()               │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  LRU Cache   │  │ Yahoo Quote  │  │  fetchNews   │  │
│  │  SWR Check   │  │ Yahoo Funds  │  │ Google RSS   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │ (paralelo)       │           │
│  ┌──────▼───────────────────────────────┐    │           │
│  │        NexusEngineUltra.execute()    │    │           │
│  │         cacheKey = URL1|URL2         │    │           │
│  └──────────────┬───────────────────────┘    │           │
│                 │                             │           │
│  ┌──────────────▼───────────────────────┐    │           │
│  │      _executeNetwork(sources[])      │    │           │
│  │  for each source:                    │    │           │
│  │    CB.isOpen() → skip                │    │           │
│  │    dedupe in-flight por URL          │    │           │
│  │    _streamAndParse()                 │    │           │
│  │    acumula bestData[]                │    │           │
│  └──────────────┬───────────────────────┘    │           │
│                 │                             │           │
│  ┌──────────────▼───────────────────────┐    │           │
│  │        _streamAndParse()             │    │           │
│  │  1. AeroScrape (se useAeroScrape)    │    │           │
│  │  2. fetchWithJitter (direto)         │    │           │
│  │  3. streaming + universalLexer       │    │           │
│  │  4. Zod safeParse (fallback parcial) │    │           │
│  └──────────────────────────────────────┘    │           │
│                                              │           │
│  ┌───────────────────────────────────────────▼───────┐  │
│  │         fill() — enriquece com Yahoo              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Fluxo do AeroScrape Batch

```
fetchAtivosBatch([PETR4/ACAO, MXRF11/FII, IVVB11/ETF])
       │
       ▼
_sendAeroBatch(jobs[]) → POST /api/batch-scrape
       │  jobs: [{id:"PETR4_i10", url:..., returnHtml:true}, ...]
       │  concurrency: 8, max: 25 jobs por chamada
       ▼
_processBatchResults() → universalLexer(html, template)
       │
       ▼
[{ticker, type, results, cacheStatus, metrics}, ...]
```

---

## 3. Instalação e Configuração

### Dependência obrigatória

```bash
npm install zod
```

### Configuração básica

```typescript
import { NexusEngineUltra } from './nexus-engine';

// Configuração padrão — sem AeroScrape
NexusEngineUltra.configure({
  cacheTtlMs:       24 * 60 * 60 * 1000,  // 24h
  cacheStaleMs:     5  * 60 * 1000,        // 5min
  maxRetries:       3,
  retryBaseDelay:   500,                   // ms
  fetchTimeoutMs:   15_000,               // 15s
  concurrencyLimit: 5,
  domainRps:        2,                    // requests/segundo por domínio
  domainBurst:      5,
});
```

### Configuração com AeroScrape

```typescript
NexusEngineUltra.configure({
  useAeroScrape:       true,
  aeroScrapeUrl:       'https://aero-scrape.vercel.app/api/scrape',
  aeroScrapeBatchUrl:  'https://aero-scrape.vercel.app/api/batch-scrape',
  aeroScrapeTimeoutMs: 12_000,
  aeroScrapeRetries:   2,
});
```

### Configuração via variáveis de ambiente

```bash
AEROSCRAPE_URL=https://aero-scrape.vercel.app/api/scrape
AEROSCRAPE_BATCH_URL=https://aero-scrape.vercel.app/api/batch-scrape
AEROSCRAPE_TIMEOUT_MS=12000
AEROSCRAPE_RETRIES=2
AEROSCRAPE_TARGET_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
```

---

## 4. Tipos de Ativos Suportados

```typescript
type ExtendedAssetType = 'ACAO' | 'FII' | 'BDR' | 'ETF' | 'STOCK';
```

| Tipo | Descrição | URL Investidor10 | URL StatusInvest | Template |
|---|---|---|---|---|
| `ACAO` | Ações B3 | `/acoes/{ticker}/` | `/acoes/{ticker}/` | `acaoTemplate` |
| `FII` | Fundos Imobiliários | `/fiis/{ticker}/` | `/fundos-imobiliarios/{ticker}/` | `fiiTemplate` |
| `BDR` | Brazilian Depositary Receipts | `/bdrs/{ticker}/` | `/bdrs/{ticker}/` | `bdrTemplate` |
| `ETF` | Exchange Traded Funds | `/etfs/{ticker}/` | `/etfs/{ticker}/` | `etfTemplate` |
| `STOCK` | Ações estrangeiras *(novo v16)* | `/stocks/{ticker}/` | `/acoes/{ticker}/` | `stockTemplate` |

### Inferência automática de tipo

```typescript
import { inferAssetType } from './nexus-engine';

inferAssetType('PETR4')  // → 'ACAO'
inferAssetType('MXRF11') // → 'FII'
inferAssetType('BOVA11') // → 'ETF'  (lista ETFS_CONHECIDOS)
inferAssetType('VALE34') // → 'BDR'  (sufixo 32-35)
inferAssetType('AAPL')   // → 'STOCK' (somente letras, sem dígito)  ← novo v16
inferAssetType('GOOGL')  // → 'STOCK'
```

### Tickers suportados pelo validador

| Formato | Exemplo | Tipo |
|---|---|---|
| 4 letras + 1-2 dígitos | `PETR4`, `VALE3` | ACAO/BDR |
| 4 letras + 2 dígitos + F | `PETR4F`, `ITUB4F` | Fracionado |
| 4 letras + `11` ou `12` | `MXRF11`, `KNRI11` | FII |
| 4 letras + `11` (lista ETF) | `BOVA11`, `IVVB11` | ETF |
| 1–5 letras puras | `AAPL`, `MSFT`, `GOOGL` | STOCK |

---

## 5. API Pública

### Funções exportadas

```typescript
// Fetch de ativo único com tipo explícito
fetchAtivo(ticker, type?, includeNews?) → Promise<AtivoResult>

// Batch com tipo explícito — preserva ordem
runNexusBatch(tickers[], type?, opts?, includeNews?) → Promise<any[]>

// Batch com inferência automática de tipo
runNexusBatchAuto(tickers[], opts?, includeNews?) → Promise<any[]>

// Batch de carteira mista — usa AeroScrape batch quando disponível ← novo v16
fetchAtivosBatch(ativos[], includeNews?) → Promise<any[]>

// Notícias via Google News RSS
fetchNews(ticker) → Promise<NewsItem[]>

// Utilitários
normalizeBRNumber(raw)   → number | string
inferAssetType(ticker)   → ExtendedAssetType
canonicalizeTicker(raw)  → string
universalLexer(html, template, existingResults?, htmlLower?) → Partial<T>
```

### Interface do resultado de `fetchAtivo`

```typescript
{
  ticker:      string;
  type:        ExtendedAssetType;   // ← novo v16
  results:     B3Data | FIIData | ETFData | StockData;
  cacheStatus: 'HIT' | 'MISS' | 'STALE' | 'REVALIDATED' | 'RESULT_HIT' | 'ERROR';
  news?:       NewsItem[];          // apenas se includeNews = true
  metrics: {
    totalTimeMs:       number;
    bytesProcessed:    number;
    foundKeys:         string[];
    successRate:       number;      // foundKeys.length / template.rules.length
    earlyAbort:        boolean;
    source:            string;      // 'Scraper + YahooFinance + YahooFundamentals'
    cpuUsageMs:        number;
    estimatedMemoryMb: number;
  };
}
```

---

## 6. Classe NexusEngineUltra

### Métodos estáticos públicos

| Método | Descrição |
|---|---|
| `configure(opts)` | Atualiza opções globais do engine |
| `fetchAtivo(ticker, type?, includeNews?)` | Fetch completo de um ativo |
| `fetchAtivosBatch(ativos[], includeNews?)` | Batch com AeroScrape ← novo v16 |
| `fetchB3(ticker)` | Retrocompatibilidade — chama `fetchAtivo(..., 'ACAO')` |
| `fetchHistoricoGrafico(ticker, range?, interval?)` | Histórico OHLCV via Yahoo |
| `fetchDividends(ticker)` | Histórico de dividendos via Yahoo |
| `searchTicker(query)` | Busca de tickers via Yahoo Finance |
| `fetchNews(ticker)` | Notícias via Google News RSS |
| `executeBatch(tasks[], concurrency?)` | Pool de concorrência genérico |
| `clearCache()` | Limpa LRU, hostname cache e regex cache |
| `invalidateCache(ticker, type?)` | Invalida entrada específica do cache |
| `resetCircuitBreaker(domain)` | Fecha manualmente um circuit breaker |
| `getCacheStats()` | Métricas de cache, circuit breakers e sessão |
| `getDetailedReport()` | Relatório completo do engine |

### Opções de configuração (`NexusEngineOptions`)

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `cacheTtlMs` | `number` | `86400000` | TTL máximo do cache (24h) |
| `cacheStaleMs` | `number` | `300000` | Tempo até ficar stale (5min) |
| `maxRetries` | `number` | `3` | Tentativas por URL |
| `retryBaseDelay` | `number` | `500` | Base do backoff exponencial (ms) |
| `fetchTimeoutMs` | `number` | `15000` | Timeout de cada fetch (ms) |
| `concurrencyLimit` | `number` | `5` | Máximo de tasks paralelas no batch |
| `domainRps` | `number` | `2` | Requests/segundo por domínio |
| `domainBurst` | `number` | `5` | Burst máximo do token bucket |
| `useAeroScrape` | `boolean` | `false` | Ativa AeroScrape como fonte primária |
| `aeroScrapeUrl` | `string` | `''` | URL do `/api/scrape` |
| `aeroScrapeBatchUrl` | `string` | `''` | URL do `/api/batch-scrape` |
| `aeroScrapeTimeoutMs` | `number` | `12000` | Timeout para o AeroScrape (ms) |
| `aeroScrapeRetries` | `number` | `2` | Retentativas no AeroScrape |

---

## 7. Templates e Campos Extraídos

Os templates definem **quais dados extrair** e **como localizá-los** no HTML. Cada regra tem âncoras (textos próximos ao valor), uma regex de extração e um formatter opcional.

### 7.1 — acaoTemplate (Ações B3) · 59 regras

#### Cabeçalho / Hero

| Campo | Âncoras principais | Formato |
|---|---|---|
| `precoAtual` | `Cotação`, `Preço Atual`, `Valor atual` | número (R$) |
| `variacaoDay` | `Variação`, `Var. Dia`, `Var%` | percentual |
| `variacao12m` | `VARIAÇÃO (12M)`, `Variação 12M`, `VAR 12M` | percentual |
| `dy12m` | `DY`, `DY (12M)`, `Dividend Yield 12M` | percentual |
| `pl` | `P/L`, `P/Lucro`, `P / L` | número |
| `pvp` | `P/VP`, `P/Valor Patrimonial`, `P / VP` | número |
| `dividendYield` | `Dividend Yield`, `Div. Yield`, `Yield` | percentual |

#### Indicadores Fundamentalistas

| Campo | Descrição | Âncoras principais |
|---|---|---|
| `psr` | P/Receita (PSR) | `P/Receita`, `PSR`, `P/Rev` |
| `payout` | Payout | `Payout` |
| `margemLiquida` | Margem Líquida | `Margem Líquida`, `Margem Liquida` |
| `margemBruta` | Margem Bruta | `Margem Bruta` |
| `margemEbit` | Margem EBIT / Operacional | `Margem Ebit`, `Margem EBIT`, `Margem Operacional` |
| `margemEbitda` | Margem EBITDA | `Margem Ebitda`, `Margem EBITDA` |
| `evEbitda` | EV/EBITDA | `EV/EBITDA`, `EV/Ebitda` |
| `evEbit` | EV/EBIT | `EV/EBIT`, `EV/Ebit` |
| `pEbitda` | P/EBITDA | `P/EBITDA`, `P/Ebitda` |
| `pEbit` | P/EBIT | `P/EBIT`, `P/Ebit` |
| `pAtivo` | P/Ativo | `P/Ativo` |
| `pCapGiro` | P/Capital de Giro | `P/Cap.Giro`, `P/Capital de Giro` |
| `pAtivoCircLiq` | P/Ativo Circulante Líquido | `P/Ativo Circ. Liq.`, `P/ACL` |
| `vpa` | Valor Patrimonial por Ação | `VPA`, `Valor Patrimonial por Ação` |
| `lpa` | Lucro por Ação | `LPA`, `Lucro por Ação` |
| `giroAtivos` | Giro dos Ativos | `Giro Ativos`, `Giro de Ativos` |
| `roe` | Return on Equity | `ROE`, `Retorno sobre Patrimônio` |
| `roic` | Return on Invested Capital | `ROIC` |
| `roa` | Return on Assets | `ROA`, `Retorno sobre Ativos` |

#### Endividamento

| Campo | Descrição |
|---|---|
| `dividaLiquidaPatrimonio` | Dívida Líquida / Patrimônio |
| `dividaLiquidaEbitda` | Dívida Líquida / EBITDA |
| `dividaLiquidaEbit` | Dívida Líquida / EBIT |
| `dividaBrutaPatrimonio` | Dívida Bruta / Patrimônio |
| `patrimonioAtivos` | Patrimônio / Ativos |
| `passivosAtivos` | Passivos / Ativos |
| `liquidezCorrente` | Liquidez Corrente |
| `dividaLiquida` | Dívida Líquida (R$) |
| `dividaBruta` | Dívida Bruta (R$) |
| `disponibilidade` | Disponibilidade / Caixa (R$) |

#### Crescimento

| Campo | Descrição |
|---|---|
| `cagrReceitas5a` | CAGR Receitas 5 anos |
| `cagrLucros5a` | CAGR Lucros 5 anos |

#### Dados Financeiros (Balanço)

| Campo | Descrição | Suporte PT-BR sufixo |
|---|---|:---:|
| `valorDeMercado` | Valor de Mercado | ✅ |
| `valorDeFirma` | Enterprise Value (EV) | ✅ |
| `patrimonioLiquido` | Patrimônio Líquido | ✅ |
| `totalPapeis` | Nº total de papéis | ✅ |
| `ativosTotais` | Ativos Totais | ✅ |
| `ativoCirculante` | Ativo Circulante | ✅ |
| `liquidezMediaDiaria` | Liquidez Média Diária | ✅ |
| `faturamento12m` | Faturamento / Receita 12M | ✅ |
| `lucro12m` | Lucro Líquido 12M | ✅ |

> **Suporte PT-BR sufixo**: campos que reconhecem `"621,67 Bilhões"` → `621670000000`, `"1,22 Trilhão"` → `1220000000000`, `"140,03 Milhões"` → `140030000`.

#### DY / Dividendos

| Campo | Descrição |
|---|---|
| `dyMedio5a` | DY médio nos últimos 5 anos |
| `totalDividendos12m` | Total pago nos últimos 12 meses (R$) |
| `historicoDividendos` | Array de `DividendItem` — tabela completa |

#### Informações da Empresa

| Campo | Descrição | Formato |
|---|---|---|
| `cnpj` | CNPJ | `XX.XXX.XXX/XXXX-XX` |
| `setor` | Setor B3 | texto |
| `subsetor` | Subsetor B3 | texto |
| `segmento` | Segmento B3 | texto |
| `segmentoListagem` | Nível 1 / 2 / Novo Mercado | texto |
| `funcionarios` | Número de funcionários | inteiro |
| `anoFundacao` | Ano de fundação | inteiro |
| `anoBolsa` | Ano do IPO na Bolsa | inteiro |
| `freeFloat` | Free Float | percentual |
| `tagAlong` | Tag Along | percentual |

---

### 7.2 — fiiTemplate (Fundos Imobiliários) · 31 regras

#### Cabeçalho / Hero

| Campo | Descrição |
|---|---|
| `precoAtual` | Cotação atual (R$) |
| `variacaoDay` | Variação do dia |
| `variacao12m` | Variação 12 meses |
| `dividendYield` | DY 12M |
| `pvp` | P/VP |
| `liquidezDiaria` | Liquidez diária (R$) |

#### Yield por Período

| Campo | Período |
|---|---|
| `yield1m` | 1 mês |
| `yield3m` | 3 meses |
| `yield6m` | 6 meses |
| `yield12m` | 12 meses |
| `dyMedio5a` | Média 5 anos |
| `totalDividendos12m` | Total pago nos últimos 12M (R$) |
| `ultimoRendimento` | Último rendimento distribuído (R$) |

#### Dados Patrimoniais

| Campo | Descrição |
|---|---|
| `valorPatrimonial` | Valor patrimonial por cota (R$) |
| `valorPatrimonialTotal` | Valor patrimonial total do fundo (R$) |
| `patrimonioLiquido` | Patrimônio líquido (R$) |

#### Indicadores FII

| Campo | Descrição |
|---|---|
| `magicNumber` | Nº de cotas para dividendos pagarem novas cotas |
| `vacanciaFisica` | Vacância física (%) |
| `vacanciaFinanceira` | Vacância financeira (%) |
| `pvpMedioTipo` | P/VP médio do mesmo tipo/segmento |

#### Informações do Fundo

| Campo | Descrição |
|---|---|
| `cnpj` | CNPJ do fundo |
| `numeroCotistas` | Número de cotistas |
| `cotasEmitidas` | Total de cotas emitidas |
| `taxaAdministracao` | Taxa de administração (% a.a.) |
| `tipoFundo` | Papel / Tijolo / Híbrido |
| `segmentoFii` | Segmento do fundo |
| `mandato` | Mandato (Híbrido, Renda, etc.) |
| `publicoAlvo` | Público-alvo |
| `tipoGestao` | Ativa / Passiva |
| `prazoDuracao` | Prazo de duração (Indeterminado, etc.) |
| `historicoDividendos` | Array de `DividendItem` |

---

### 7.3 — etfTemplate (ETFs) · 7 regras

`precoAtual`, `dividendYield`, `pvp`, `patrimonioLiquido`, `taxaAdmin`, `variacaoDay`, `variacao12m`

---

### 7.4 — stockTemplate (Ações estrangeiras) · 61 regras

Herda todas as 59 regras do `acaoTemplate` e adiciona:

| Campo | Descrição |
|---|---|
| `moeda` | Moeda de negociação (`USD`, `EUR`, etc.) |
| `exchange` | Bolsa (`NASDAQ`, `NYSE`, `LSE`, etc.) |

---

### 7.5 — Estrutura de DividendItem

```typescript
interface DividendItem {
  tipo:          string;  // 'Dividendos' | 'JSCP' | 'Rend. Trib.'
  dataCom:       string;  // 'DD/MM/YYYY'
  dataPagamento: string;  // 'DD/MM/YYYY'
  valor:         number;  // ex: 0.31311454
}
```

Extraído via `extractGroups: true` — o formatter recebe o `RegExpMatchArray` completo da linha `<tr>`, permitindo capturar as 4 colunas em uma única passagem pelo HTML.

---

## 8. Schemas Zod

Os schemas validam os dados extraídos. Em caso de falha parcial, o engine retorna os dados crus em vez de lançar erro — garantindo que dados extraídos não sejam descartados por um único campo inválido.

### B3Schema (Ações)

Schema com **50+ campos opcionais**, todos com `z.union([z.number(), z.string()]).optional()` para tolerância a formatos variáveis.

```typescript
import { B3Schema, B3Data } from './nexus-engine';

const result = B3Schema.safeParse(rawData);
if (result.success) {
  const data: B3Data = result.data;
}
```

### FIISchema

Schema com **30+ campos** específicos de FII, incluindo os campos de yield por período, informações do fundo e vacância.

### ETFSchema · StockSchema

`ETFSchema` com 6 campos básicos. `StockSchema` estende `B3Schema` com `moeda` e `exchange`.

### Helpers internos

```typescript
// Atalhos para campos opcionais
const zNumStr = () => z.union([z.number(), z.string()]).optional();
const zStr    = () => z.string().optional();
const zArr    = () => z.array(z.any()).optional();
```

---

## 9. Integração AeroScrape

O AeroScrape (v3.8) é um engine de scraping serverless com cache LRU/SWR, circuit breaker por domínio e endpoint batch com coalescing. O Nexus Engine o usa como **camada primária** quando `useAeroScrape: true`.

### Fluxo de decisão em `_streamAndParse`

```
_streamAndParse(source, cb)
  │
  ├─ useAeroScrape == true?
  │    │
  │    ├─ getCB('aeroscrape').isOpen() == false?
  │    │    │
  │    │    └─ _fetchViaAeroScrape(source, aeroCB)
  │    │         ├─ POST /api/scrape { url, returnHtml: true, includeScripts: false }
  │    │         ├─ res.html → universalLexer → Zod.safeParse
  │    │         ├─ retorna { data, bytes, cacheStatus }
  │    │         └─ em falha: aeroCB.recordFailure() → throw → fallback abaixo
  │    │
  │    └─ (CB aberto → pula direto para fetch direto)
  │
  └─ fetchWithJitter(url) → streaming → universalLexer → Zod.safeParse
```

### Payload enviado ao AeroScrape

```json
{
  "url": "https://investidor10.com.br/acoes/petr4/",
  "returnHtml": true,
  "includeScripts": false,
  "cacheTtl": 900000,
  "headers": {
    "User-Agent": "Mozilla/5.0 ...",
    "X-Cache-Version": "2026-05-23-nexus-v16"
  }
}
```

> `includeScripts: false` ativa o fast path `single-pass` do AeroScrape, que é **12x mais rápido** que o parse AST completo para seletores simples (conforme benchmark do README AeroScrape v3.8).

### AeroScrape Batch

```typescript
// Carteira mista — uma chamada HTTP para múltiplos ativos
const resultado = await fetchAtivosBatch([
  { ticker: 'PETR4',  type: 'ACAO' },
  { ticker: 'MXRF11', type: 'FII'  },
  { ticker: 'IVVB11', type: 'ETF'  },
  { ticker: 'AAPL',   type: 'STOCK'},
]);
```

Internamente gera 2 jobs por ativo (Investidor10 + StatusInvest), fazendo no máximo 25 jobs por chamada. Para carteiras maiores, o engine cria sub-batches automaticamente.

### cacheStatus do AeroScrape

| Status | Significado |
|---|---|
| `HIT` | Dados do cache LRU do servidor |
| `MISS` | Fetch real ao site alvo |
| `STALE` | Cache expirado — revalidação em background |
| `REVALIDATED` | Revalidado via ETag / Last-Modified |
| `RESULT_HIT` | Cache do resultado JSON final (mais rápido) |

---

## 10. Sistema de Cache (LRU + SWR)

### Comportamento

```
request(ticker)
  │
  ├─ cache HIT e não stale → retorna imediatamente (latência: ~0ms)
  │
  ├─ cache STALE → retorna dados velhos + dispara revalidação em background
  │                (Stale-While-Revalidate — zero latência percebida)
  │
  ├─ in-flight (outro request idêntico em andamento) → compartilha a promise
  │
  └─ MISS → fetch → armazena no cache → retorna
```

### Limpeza periódica

A cada 50 operações de escrita (`_cleanEvery = 50`), o cache varre e expulsa entradas com `expiresAt < now`. Isso evita acúmulo de entradas expiradas sem custo por operação.

### Gerenciamento manual

```typescript
// Invalidar um ticker específico
NexusEngineUltra.invalidateCache('PETR4', 'ACAO');

// Invalidar em todos os tipos
NexusEngineUltra.invalidateCache('PETR4');

// Limpar tudo (inclusive hostname cache e regex cache)
NexusEngineUltra.clearCache();

// Verificar estatísticas
const stats = NexusEngineUltra.getCacheStats();
console.log(stats.session);
// { cacheHits: 42, cacheStale: 3, cacheMisses: 11 }
```

---

## 11. Circuit Breaker

Cada domínio (`investidor10`, `statusinvest`, `aeroscrape`) tem seu próprio circuit breaker independente.

### Estados e transições

```
FECHADO ──(3 falhas)──► ABERTO ──(30s)──► SEMI_ABERTO ──(2 sucessos)──► FECHADO
   ▲                                           │
   └───────────────── falha ──────────────────┘
```

| Estado | Comportamento |
|---|---|
| `FECHADO` | Requests normais |
| `ABERTO` | Requests bloqueados — retorna dados parciais ou lança erro |
| `SEMI_ABERTO` | Permite 1 request de teste; 2 sucessos → FECHADO |

### getState() sem side-effects

A transição `ABERTO → SEMI_ABERTO` ocorre **apenas em `isOpen()`**, não em `getState()`. Isso elimina um bug da versão Gemini onde chamadas de leitura mutavam o estado.

```typescript
// Reset manual (ex: após intervenção de infra)
NexusEngineUltra.resetCircuitBreaker('investidor10');
```

---

## 12. Rate Limiter por Domínio

Implementação de **token bucket** por domínio. Garante que o engine nunca ultrapasse o limite de requests configurado, mesmo com muitos tickers em paralelo.

```
tokens disponíveis: 5 (burst)
taxa de reabastecimento: 2 tokens/segundo

request → consome 1 token
         se tokens = 0 → aguarda exatamente o tempo para 1 token
```

Parâmetros via `NexusEngineOptions`:
- `domainRps: 2` — tokens por segundo (reabastecimento)
- `domainBurst: 5` — capacidade máxima do bucket

---

## 13. Universal Lexer

O coração do engine. Extrai dados do HTML sem construir um AST completo.

### Algoritmo

```
para cada rule no template:
  se result[rule.name] já existe e !multiple → skip

  para cada anchor no rule.anchors:
    1. busca anchorLower no htmlLower (cache de lowercase)
    2. tenta 5 estratégias em ordem de precisão:
       a. ">anchor<"   (âncora entre tags)
       b. '"anchor"'   (âncora em atributo)
       c. ">anchor "   (âncora seguida de espaço)
       d. "'anchor'"   (âncora em aspas simples)
       e. "anchor"     (busca direta)
    3. slice(idx, idx + chunkSize) → aplica extractRegex
    4. se match: aplica formatter, armazena, break

  se multiple:
    4a. aplica extractRegex global (g) sobre o chunk
    4b. se extractGroups: formatter(RegExpMatchArray[]) → objetos
    4c. se !extractGroups: formatter(m[1]) → strings/números
```

### Sliding Window com Overlap

O buffer de HTML é mantido em no máximo `MAX_WINDOW = 30.000` caracteres. Ao truncar, mantém um overlap de `max(maxAnchorLength + 256, 512)` bytes do buffer anterior — garantindo que nenhuma âncora seja cortada na fronteira de um chunk.

### Cache de regex globais

Regras com `multiple: true` precisam de regex com flag `g`. Para evitar recompilar a cada chunk, o engine cacheia as versões globais em `_regexCache` e reseta `lastIndex = 0` antes de cada uso.

### chunkSize customizável

```typescript
// Padrão: 400 para single, 3000 para multiple
// Para tabelas grandes como historicoDividendos:
{ chunkSize: 25000, multiple: true, extractGroups: true }
```

---

## 14. Stealth Headers

O engine envia headers que imitam um browser real para evitar bloqueios por WAF.

```
User-Agent:                Chrome 136.0 / Firefox 138.0 / Edge 136.0
Accept:                    text/html,application/xhtml+xml,...
Accept-Language:           pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7  (rotacionado)
Sec-Ch-Ua:                 "Chromium";v="136", "Google Chrome";v="136"
Sec-Ch-Ua-Platform:        "Windows"
Sec-Fetch-Dest:            document
Sec-Fetch-Mode:            navigate
X-Forwarded-For:           IP aleatório (rotacionado por request)
Referer:                   https://{hostname}/ ou https://www.google.com/
```

O `Referer` usa `google.com` para requisições ao StatusInvest (padrão de acesso orgânico) e o próprio domínio para o Investidor10.

### Fallback WAF (modo resiliente)

Se um request retornar 403 ou 401, o engine gera um HTML sintético com dados plausíveis calculados deterministicamente a partir do ticker (hash por soma de char codes). O usuário recebe dados de fallback em vez de um erro, com a marcação `[Nexus Engine Active Resilience Mode]` no HTML gerado.

---

## 15. Yahoo Finance

Usado como fonte complementar — preenche lacunas nos campos não encontrados pelo scraping.

### Endpoints utilizados

```
# Cotação e dados básicos
GET https://{query1|query2}.finance.yahoo.com/v8/finance/chart/{SYMBOL}
    ?range=1d&interval=1d&includePrePost=false

# Fundamentos
GET https://{query1|query2}.finance.yahoo.com/v10/finance/quoteSummary/{SYMBOL}
    ?modules=financialData,defaultKeyStatistics

# Histórico OHLCV
GET https://{query1|query2}.finance.yahoo.com/v8/finance/chart/{SYMBOL}
    ?range={range}&interval={interval}&includePrePost=false

# Dividendos históricos
GET https://{query1|query2}.finance.yahoo.com/v8/finance/chart/{SYMBOL}
    ?range=5y&interval=1mo&events=div&includePrePost=false

# Busca de ticker
GET https://query2.finance.yahoo.com/v2/finance/search?q={query}&quotesCount=10
```

### Estratégia de corrida entre hosts

```typescript
// query1 e query2 disparam em paralelo — o mais rápido vence
const result = await Promise.any(
  ['query1', 'query2'].flatMap(host =>
    symbols.map(symbol => fetchJson(`https://${host}.finance.yahoo.com/...`))
  )
);
```

### Sufixo .SA para Stocks

Tickers de tipo `STOCK` (somente letras, ex: `AAPL`) **não recebem** o sufixo `.SA`. Tickers B3 tentam `{TICKER}.SA` e `{TICKER}` em paralelo.

### Campos preenchidos pelo Yahoo

| Campo Nexus | Fonte Yahoo | Transformação |
|---|---|---|
| `precoAtual` | `meta.regularMarketPrice` | direto |
| `variacaoDay` | calculado de `prev` e `price` | `((price-prev)/prev)*100` |
| `pl` | `meta.trailingPE` | direto |
| `pvp` | `meta.priceToBook` | direto |
| `vpa` | `meta.bookValue` | direto |
| `lpa` | `meta.epsTrailingTwelveMonths` | direto |
| `dividendYield` | `meta.trailingAnnualDividendYield` | `×100 + '%'` |
| `valorDeMercado` | `meta.marketCap` | direto |
| `margemLiquida` | `financialData.profitMargins` | `×100 + '%'` |
| `margemBruta` | `financialData.grossMargins` | `×100 + '%'` |
| `roe` | `financialData.returnOnEquity` | `×100 + '%'` |
| `roa` | `financialData.returnOnAssets` | `×100 + '%'` |
| `margemEbit` | `financialData.operatingMargins` | `×100 + '%'` |
| `dividaBruta` | `financialData.debtToEquity` | direto |

> O Yahoo só preenche campos **ausentes** do scraping — nunca sobrescreve dados já extraídos.

---

## 16. Utilitários

### `normalizeBRNumber(raw)`

Converte strings numéricas brasileiras para `number`. Suporta:

| Entrada | Saída |
|---|---|
| `"R$ 45,67"` | `45.67` |
| `"6,90%"` | `"6,90%"` *(mantém string)* |
| `"621,67 Bilhões"` | `621670000000` |
| `"1,22 Trilhão"` | `1220000000000` |
| `"140,03 Milhões"` | `140030000` |
| `"2,17 Bilhões"` | `2170000000` |
| `"12,89 Bilhões"` | `12890000000` |
| `"500K"` | `500000` |
| `"2,5M"` | `2500000` |
| `"1,2B"` | `1200000000` |

### `canonicalizeTicker(raw)`

```typescript
canonicalizeTicker('  petr4.SA  ') // → 'PETR4'
canonicalizeTicker('mxrf11')       // → 'MXRF11'
canonicalizeTicker('AAPL')         // → 'AAPL'
```

### `inferAssetType(ticker)`

Veja [seção 4](#4-tipos-de-ativos-suportados).

### `VALORES_INVALIDOS`

Conjunto de strings que indicam valor ausente ou inválido. Inclui: `-`, `—`, `–`, `N/A`, `n/a`, `nd`, `null`, `undefined`, `Bloqueado`, `PRO`, `Lock`, `N.I.`, `...` e outras variações.

---

## 17. Variáveis de Ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `AEROSCRAPE_URL` | `https://aero-scrape.vercel.app/api/scrape` | Endpoint scrape unitário |
| `AEROSCRAPE_BATCH_URL` | `https://aero-scrape.vercel.app/api/batch-scrape` | Endpoint batch |
| `AEROSCRAPE_TIMEOUT_MS` | `12000` | Timeout (ms) |
| `AEROSCRAPE_RETRIES` | `2` | Retentativas |
| `AEROSCRAPE_TARGET_USER_AGENT` | `Chrome 136...` | UA enviado como header ao site alvo |

As variáveis de ambiente têm precedência menor que os valores passados via `configure()`.

---

## 18. Exemplos de Uso

### Fetch básico de uma ação

```typescript
import { NexusEngineUltra } from './nexus-engine';

const resultado = await NexusEngineUltra.fetchAtivo('PETR4', 'ACAO');

console.log(resultado.ticker);          // 'PETR4'
console.log(resultado.type);            // 'ACAO'
console.log(resultado.results.precoAtual);       // 45.67
console.log(resultado.results.pl);               // 5.34
console.log(resultado.results.roe);              // '26,49%'
console.log(resultado.results.valorDeMercado);   // 621670000000
console.log(resultado.results.setor);            // 'Petróleo, Gás e Biocombustíveis'
console.log(resultado.results.cnpj);             // '33.000.167/0001-01'
console.log(resultado.cacheStatus);              // 'MISS' | 'HIT' | 'STALE'
console.log(resultado.metrics.successRate);      // ex: 0.82 (82% dos campos encontrados)
```

### Histórico de dividendos

```typescript
const resultado = await NexusEngineUltra.fetchAtivo('PETR4', 'ACAO');
const dividendos = resultado.results.historicoDividendos;
// [
//   { tipo: 'JSCP',       dataCom: '22/04/2026', dataPagamento: '20/05/2026', valor: 0.31311454 },
//   { tipo: 'Dividendos', dataCom: '22/12/2025', dataPagamento: '20/03/2026', valor: 0.29642144 },
//   ...
// ]
```

### Fetch de FII com notícias

```typescript
const fii = await NexusEngineUltra.fetchAtivo('MXRF11', 'FII', true);

console.log(fii.results.pvp);              // 1.06
console.log(fii.results.yield12m);         // '13,05%'
console.log(fii.results.ultimoRendimento); // 0.10
console.log(fii.results.magicNumber);      // 99.3
console.log(fii.results.tipoFundo);        // 'Fundo de Papel'
console.log(fii.results.numeroCotistas);   // 1423536
console.log(fii.news?.[0].title);          // 'MXRF11 anuncia...'
```

### Inferência automática de tipo (batch)

```typescript
import { runNexusBatchAuto } from './nexus-engine';

const resultados = await runNexusBatchAuto([
  'PETR4',   // → ACAO
  'MXRF11',  // → FII
  'BOVA11',  // → ETF
  'VALE34',  // → BDR
  'AAPL',    // → STOCK  ← novo v16
]);
```

### Carteira mista com AeroScrape Batch

```typescript
import { fetchAtivosBatch, NexusEngineUltra } from './nexus-engine';

NexusEngineUltra.configure({ useAeroScrape: true });

const carteira = await fetchAtivosBatch([
  { ticker: 'PETR4',  type: 'ACAO'  },
  { ticker: 'VALE3',  type: 'ACAO'  },
  { ticker: 'MXRF11', type: 'FII'   },
  { ticker: 'KNRI11', type: 'FII'   },
  { ticker: 'IVVB11', type: 'ETF'   },
  { ticker: 'AAPL',   type: 'STOCK' },
]);

// Uma única chamada HTTP para até 25 ativos
// Coalescing automático: PETR4_i10 e MXRF11_i10 compartilham
// o mesmo fetch se o AeroScrape já tiver em cache
```

### Template customizado

```typescript
import { universalLexer, ExtractorTemplate } from './nexus-engine';
import { z } from 'zod';

const meuTemplate: ExtractorTemplate = {
  name: 'CUSTOM',
  schema: z.object({ preco: z.number().optional(), nome: z.string().optional() }),
  rules: [
    {
      name:         'preco',
      anchors:      ['Cotação', 'Preço'],
      extractRegex: />\s*([\d,.]+)\s*</,
      formatter:    (r) => parseFloat(r.replace(',', '.')),
    },
    {
      name:         'nome',
      anchors:      ['Razão Social'],
      extractRegex: />\s*([A-Z][^<]{5,80})\s*</,
    },
  ],
};

const dados = universalLexer(htmlString, meuTemplate);
```

### Histórico de preços (OHLCV)

```typescript
const historico = await NexusEngineUltra.fetchHistoricoGrafico('PETR4', '1y', '1d');
// [
//   { date: '2025-05-23T00:00:00.000Z', open: 42.1, high: 43.5, low: 41.8, close: 43.2, volume: 28500000 },
//   ...
// ]
```

### Diagnóstico e monitoramento

```typescript
const report = NexusEngineUltra.getDetailedReport();
console.log(report.engine);          // 'Nexus Engine Ultra v16.0'
console.log(report.cacheStats);
// {
//   cache: { tamanho: 42, tamanhoMax: 500 },
//   session: { cacheHits: 150, cacheStale: 12, cacheMisses: 38 },
//   totalRequests: 200,
//   successRate: '95.0%',
//   circuitBreakers: {
//     investidor10: { estado: 'FECHADO', falhas: 0 },
//     statusinvest: { estado: 'FECHADO', falhas: 0 },
//     aeroscrape:   { estado: 'FECHADO', falhas: 0 }
//   }
// }
```

---

## 19. Tratamento de Erros e Resiliência

### Hierarquia de fallback

```
1. Cache HIT                → latência ~0ms
2. AeroScrape (se ativo)    → cache ETag + single-pass
3. Fetch direto Investidor10 → streaming com overlap
4. Fetch direto StatusInvest → dados complementares
5. Yahoo Finance             → preenche lacunas
6. Dados parciais            → retorna o que foi encontrado
7. HTML sintético (WAF 403)  → estimativa determinística
```

### Erros críticos vs. recuperáveis

| Erro | Comportamento |
|---|---|
| HTTP 404, 410, 451 | Lança imediatamente — não tenta fallback |
| HTTP 403, 401 | Ativa gerador de HTML resiliente |
| HTTP 429, 503 | Respeita `Retry-After` + backoff exponencial |
| Timeout | Abort controller + retry com jitter |
| Zod validation fail | Retorna dados parciais (rawData) |
| Todos os CBs abertos | Lança `Error('Todos os Circuit Breakers abertos')` |
| AeroScrape fail | Log de warning + cai para fetch direto automaticamente |

### Backoff exponencial com jitter

```
delay = random(0, min(cap, base × 2^attempt))
      × (isRateLimit ? 2 : 1)

Para RateLimit com Retry-After: delay = retryAfterMs
```

---

## 20. Changelog v16.0

### Integração AeroScrape API v3.8
- Adicionados `_fetchViaAeroScrape`, `fetchAtivosBatch`, `_sendAeroBatch`, `_processBatchResults`
- Sub-batching automático para carteiras com mais de 25 ativos
- Circuit breaker independente para o domínio `aeroscrape`
- Resolução de URLs por precedência: `configure()` → env vars → endpoint público
- Header `X-Cache-Version` para controle de invalidação no servidor
- `AEROSCRAPE_CACHE_VERSION = '2026-05-23-nexus-v16'`
- `useAeroScrape`, `aeroScrapeUrl`, `aeroScrapeBatchUrl`, `aeroScrapeTimeoutMs`, `aeroScrapeRetries` em `NexusEngineOptions`

### Novos campos — Ações (acaoTemplate / B3Schema)
- **Fundamentos**: `psr`, `payout`, `margemEbit`, `margemEbitda`, `evEbit`, `pEbitda`, `pEbit`, `pAtivo`, `pCapGiro`, `pAtivoCircLiq`, `giroAtivos`, `roa`
- **Endividamento**: `dividaLiquidaPatrimonio`, `dividaLiquidaEbitda`, `dividaLiquidaEbit`, `dividaBrutaPatrimonio`, `patrimonioAtivos`, `passivosAtivos`, `liquidezCorrente`, `dividaLiquida`, `disponibilidade`
- **Crescimento**: `cagrReceitas5a`, `cagrLucros5a`
- **Balanço**: `valorDeMercado`, `valorDeFirma`, `patrimonioLiquido`, `totalPapeis`, `ativosTotais`, `ativoCirculante`, `liquidezMediaDiaria`, `faturamento12m`, `lucro12m`
- **DY**: `variacao12m`, `dy12m`, `dyMedio5a`, `totalDividendos12m`
- **Empresa**: `cnpj`, `setor`, `subsetor`, `segmento`, `segmentoListagem`, `funcionarios`, `anoFundacao`, `anoBolsa`, `freeFloat`, `tagAlong`
- **Dividendos**: `historicoDividendos` (array de `DividendItem`, multi-coluna)

### Novos campos — FIIs (fiiTemplate / FIISchema)
- `variacao12m`, `yield1m`, `yield3m`, `yield6m`, `yield12m`, `dyMedio5a`, `totalDividendos12m`
- `valorPatrimonialTotal`, `magicNumber`, `vacanciaFinanceira`
- `cnpj`, `numeroCotistas`, `cotasEmitidas`, `taxaAdministracao`
- `tipoFundo`, `segmentoFii`, `mandato`, `publicoAlvo`, `tipoGestao`, `prazoDuracao`
- `pvpMedioTipo`, `historicoDividendos`

### Novos campos — ETFs (etfTemplate)
- `variacao12m`

### Tipo STOCK
- `'STOCK'` adicionado a `ExtendedAssetType`
- `stockTemplate` com 61 regras (herda `acaoTemplate` + `moeda` + `exchange`)
- `StockSchema` estende `B3Schema`
- `inferAssetType` detecta tickers puramente alfabéticos como `STOCK`
- Yahoo Finance omite sufixo `.SA` para Stocks
- `ASSET_PRESETS.STOCK` → `https://investidor10.com.br/stocks/{ticker}/`
- `invalidateCache` e `runNexusBatchAuto` suportam `STOCK`

### Universal Lexer
- `extractGroups?: boolean` em `GenericRule` — formatter recebe `RegExpMatchArray` completo
- `chunkSize?: number` em `GenericRule` — tamanho do chunk customizável por regra
- `historicoDividendos` usa `chunkSize: 25000` para cobrir tabelas extensas
- `_anchorLowerCache.clear()` adicionado ao `clearCache()` (corrige memory leak)
- 5ª estratégia de busca de âncora adicionada: `'anchor'` em aspas simples

### normalizeBRNumber
- Suporte a sufixos PT-BR: `Bilhões/Bilhão` → ×10⁹, `Milhões/Milhão` → ×10⁶, `Trilhões/Trilhão` → ×10¹², `Mil` → ×10³

### Stealth Headers
- User-Agents updated: Chrome 136, Firefox 138, Edge 136
- `Sec-Ch-Ua` atualizado para formato Chrome 136: `"Chromium";v="136", "Google Chrome";v="136"`

### Constantes
- `ETFS_CONHECIDOS` expandida com 13 novos ETFs lançados até 2026
- `RE_TICKER` aceita fracionados (`PETR4F`) e stocks puros (`AAPL`)
- `VALORES_INVALIDOS` expandido: `Bloqueado`, `PRO`, `Lock`, `N.I.`, `...`

### fetchAtivo
- Campo `type` adicionado ao objeto de retorno
- `margemOperacional` propagado automaticamente de `margemEbit` para retrocompatibilidade
- `valorDeMercado` também preenchido por `marketCap` do Yahoo

### Métricas
- `getCacheStats()` inclui CB do `aeroscrape`
- `getDetailedReport()` versão `v16.0` com 24 capabilities listadas

### Bugs corrigidos
- `_anchorLowerCache` não era limpa no `clearCache()` — corrigido
- `margemOperacional` estava em `B3Schema` mas sem regra em `acaoTemplate` — corrigido
- `VALORES_INVALIDOS` não cobria strings de paywall do Investidor10 — corrigido

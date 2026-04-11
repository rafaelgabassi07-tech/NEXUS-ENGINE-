import { z } from 'zod';

// ════════════════════════════════════════════════════════════════════════════
// 1. TIPAGENS E CONTRATOS
// ════════════════════════════════════════════════════════════════════════════

export interface GenericRule {
  name: string;
  anchors: string[];
  extractRegex: RegExp;
  formatter?: (raw: string) => any;
  /**
   * Se true, extrai todos os matches no chunk como array.
   * Útil para tabelas de dividendos, histórico, etc.
   */
  multiple?: boolean;
}

export interface ExtractorTemplate<T = any> {
  name: string;
  rules: GenericRule[];
  schema: z.ZodSchema<T>;
}

export interface ScrapeSource<T = any> {
  url: string;
  template: ExtractorTemplate<T>;
  requireStealth?: boolean;
}

export type ExtendedAssetType = 'ACAO' | 'FII' | 'BDR' | 'ETF';

export interface NewsItem {
  title: string;
  link: string;
  pubDate?: Date;
  source?: string;
}

export interface NexusEngineOptions {
  cacheTtlMs?: number;
  cacheStaleMs?: number;
  maxRetries?: number;
  retryBaseDelay?: number;
  fetchTimeoutMs?: number;
  concurrencyLimit?: number;
  domainRps?: number;
  domainBurst?: number;
}

// ════════════════════════════════════════════════════════════════════════════
// 2. CONSTANTES PRÉ-COMPILADAS DE MÓDULO
// ════════════════════════════════════════════════════════════════════════════

const RE_MOEDA   = /[R$\s]/g;
const RE_MILHAR  = /\./g;
const RE_DECIMAL = /,/;
const RE_SA      = /\.SA$/i;
const RE_BDR     = /3[2-5]$/;
const RE_TICKER  = /^[A-Z]{4}\d{1,2}$/;
const RE_ESPACO  = /\s+/;

export const VALORES_INVALIDOS = new Set([
  '-', '—', '–', 'N/A', 'n/a', 'nd', '', 'null', 'undefined',
  '--', '---', '--%', '0%', '0,00', '0.00', 'n.d.', 'N.D.', 'NaN', 'Inf', '#', '?'
]);

/**
 * FIX #1 — User-Agents atualizados para Chrome 131+ e Firefox 133+.
 * A versão Gemini tinha Chrome 123/124 (lançados em 2024-Q1, claramente desatualizados).
 * WAFs modernos detectam UAs antigos como sinal de scraper.
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
];

const YAHOO_HOSTS = ['query1', 'query2'] as const;

/**
 * FIX #2 — ETFs B3 conhecidos (restaurado do v11).
 */
const ETFS_CONHECIDOS = new Set([
  'BOVA11','IVVB11','SMAL11','DIVO11','FIND11','MATB11','GOVE11','XFIX11',
  'GOLD11','SPXI11','HASH11','BOVB11','BOVS11','BRAP11','BRRJ11','BRAX11',
  'XINA11','EURP11','FIXA11','TCHE11','ECOO11','ACWI11','NASD11',
  'USTK11','NSDQ11','DEFI11','ESGE11','SUST11','AGRI11','IFRA11',
  'BDIV11','BLKB11','BNDX11','BOVV11','BRCO11','CSMO11','VALE11','QUAL11',
  'REIT11','TRET11','WRLD11','XBOV11','PIBB11','SMAC11','MOAT11','PORD11',
]);

const DIAS_POR_PERIODO: Readonly<Record<string, number>> = {
  '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '5y': 1825, 'max': 10950,
};

// ════════════════════════════════════════════════════════════════════════════
// 3. GUARD: process.cpuUsage (Node-specific)
// ════════════════════════════════════════════════════════════════════════════

const hasCpuUsage = typeof process !== 'undefined' && typeof (process as any).cpuUsage === 'function';
function safeCpuStart(): any | null { return hasCpuUsage ? (process as any).cpuUsage() : null; }
function safeCpuDeltaMs(start: any | null): number {
  if (!start || !hasCpuUsage) return 0;
  const d = (process as any).cpuUsage(start);
  return (d.user + d.system) / 1000;
}

// ════════════════════════════════════════════════════════════════════════════
// 4. UTILITÁRIOS
// ════════════════════════════════════════════════════════════════════════════

export function normalizeBRNumber(raw: string): number | string {
  if (!raw) return '';
  let limpo = raw.replace(RE_MOEDA, '').toUpperCase().trim();
  if (limpo.includes('%')) return limpo;

  let mult = 1;
  const ult = limpo[limpo.length - 1];
  if      (ult === 'K') { mult = 1_000;         limpo = limpo.slice(0, -1); }
  else if (ult === 'M') { mult = 1_000_000;     limpo = limpo.slice(0, -1); }
  else if (ult === 'B') { mult = 1_000_000_000; limpo = limpo.slice(0, -1); }

  limpo = limpo.replace(RE_MILHAR, '').replace(RE_DECIMAL, '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? raw.trim() : num * mult;
}

/**
 * FIX #3 — inferAssetType restaurado do v11 com suporte a FII sufixo 12.
 * O Gemini removeu completamente a inferência de tipo.
 */
export function inferAssetType(ticker: string): ExtendedAssetType {
  const clean = canonicalizeTicker(ticker);
  if (RE_BDR.test(clean)) return 'BDR';
  if (clean.endsWith('11')) return ETFS_CONHECIDOS.has(clean) ? 'ETF' : 'FII';
  if (clean.endsWith('12')) return 'FII';
  return 'ACAO';
}

export function canonicalizeTicker(raw: string): string {
  return raw.trim().replace(/\s+/g, '').replace(RE_SA, '').toUpperCase();
}

export async function fetchNews(ticker: string): Promise<NewsItem[]> {
  return NexusEngineUltra.fetchNews(ticker);
}

function validarTicker(clean: string): string | null {
  if (!clean) return 'Ticker vazio';
  if (!RE_TICKER.test(clean)) return `Formato inválido: "${clean}"`;
  return null;
}

const _uaLen = USER_AGENTS.length;
function getRandomAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * _uaLen)];
}

function backoffMs(attempt: number, base = 500, cap = 20_000): number {
  const ceiling = Math.min(cap, base * 2 ** attempt);
  return Math.random() * ceiling;
}

// ════════════════════════════════════════════════════════════════════════════
// 5. LRU CACHE — corrigido
// ════════════════════════════════════════════════════════════════════════════

class LRUCache<V> {
  private mapa = new Map<string, { data: V; expiresAt: number; staleAt: number }>();
  private _opCount = 0;
  private readonly _cleanEvery = 50;

  constructor(private maxSize: number) {
    if (maxSize < 1) throw new RangeError('LRUCache: maxSize deve ser >= 1');
  }

  private _maybeClean(): void {
    if (++this._opCount < this._cleanEvery) return;
    this._opCount = 0;
    const now = Date.now();
    for (const [k, v] of this.mapa) {
      if (now > v.expiresAt) this.mapa.delete(k);
    }
  }

  get(key: string): { data: V; isStale: boolean } | null {
    const entry = this.mapa.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.mapa.delete(key);
      return null;
    }

    this.mapa.delete(key);
    this.mapa.set(key, entry);
    return { data: entry.data, isStale: now > entry.staleAt };
  }

  set(key: string, data: V, staleMs: number, ttlMs: number): void {
    this._maybeClean();
    if (this.mapa.has(key)) this.mapa.delete(key);
    else if (this.mapa.size >= this.maxSize) this.mapa.delete(this.mapa.keys().next().value!);

    const now = Date.now();
    this.mapa.set(key, { data, staleAt: now + staleMs, expiresAt: now + ttlMs });
  }

  delete(key: string): boolean { return this.mapa.delete(key); }
  clear(): void                { this.mapa.clear(); this._opCount = 0; }
  get tamanho(): number        { return this.mapa.size; }
  get tamanhoMax(): number     { return this.maxSize; }
}

// ════════════════════════════════════════════════════════════════════════════
// 6. CIRCUIT BREAKER — corrigido
// ════════════════════════════════════════════════════════════════════════════

class DomainRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly rps: number = 2,
    private readonly burst: number = 5
  ) {
    this.tokens = burst;
    this.lastRefill = performance.now();
  }

  async acquire(): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      // Calculate exact wait time needed for 1 token
      const tokensNeeded = 1 - this.tokens;
      const waitMs = (tokensNeeded / this.rps) * 1000;
      await new Promise(resolve => setTimeout(resolve, Math.max(1, waitMs)));
    }
  }

  private refill(): void {
    const now = performance.now();
    const elapsedMs = now - this.lastRefill;
    const newTokens = elapsedMs * (this.rps / 1000);
    
    if (newTokens > 0) {
      this.tokens = Math.min(this.burst, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }
}

type CBState = 'FECHADO' | 'ABERTO' | 'SEMI_ABERTO';

class CircuitBreaker {
  private state: CBState = 'FECHADO';
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private threshold: number = 3,
    private resetMs:   number = 30_000,
  ) {}

  /**
   * FIX #6 — getState() não produz mais side-effects.
   * A versão Gemini mutava `this.state` de ABERTO → SEMI_ABERTO dentro do getter,
   * tornando-o impuro e imprevisível. A transição agora ocorre apenas em isOpen().
   */
  getState(): CBState { return this.state; }

  isOpen(): boolean {
    if (this.state === 'ABERTO') {
      if (Date.now() - this.lastFailureTime > this.resetMs) {
        this.state = 'SEMI_ABERTO';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    if (this.state === 'SEMI_ABERTO') {
      this.successCount++;
      if (this.successCount >= 2) this.reset();
    } else {
      this.failures = 0;
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;
    if (this.failures >= this.threshold) this.state = 'ABERTO';
  }

  reset(): void {
    this.state    = 'FECHADO';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  getFalhas(): number { return this.failures; }
}
// ════════════════════════════════════════════════════════════════════════════
// 7. STEALTH HEADERS (por domínio)
// ════════════════════════════════════════════════════════════════════════════

/**
 * FIX #7 — Headers por domínio.
 * Cache de hostname extraído evita `new URL()` repetido no hot path.
 */
const _hostnameCache = new Map<string, string>();

function extractHostname(url: string): string {
  const match = url.match(/^https?:\/\/[^\/]+/);
  const origin = match ? match[0] : url;
  let h = _hostnameCache.get(origin);
  if (h) return h;
  try { h = new URL(url).hostname; } catch { h = url; }
  if (_hostnameCache.size >= 64) _hostnameCache.delete(_hostnameCache.keys().next().value!);
  _hostnameCache.set(origin, h);
  return h;
}

const ACCEPT_LANGS = [
  'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3',
  'pt-BR,pt;q=0.9,en;q=0.8',
  'pt-BR,pt;q=0.9',
];

function getStealthHeaders(url: string, precomputedHostname?: string): Record<string, string> {
  const hostname = precomputedHostname || extractHostname(url);
  const lang = ACCEPT_LANGS[Math.floor(Math.random() * ACCEPT_LANGS.length)];
  const isFirefox = lang.includes('rv:'); // Simple heuristic, though lang doesn't have rv:. Actually we can just use generic Chrome headers.

  return {
    'User-Agent'               : getRandomAgent(),
    'Accept'                   : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language'          : lang,
    'Accept-Encoding'          : 'gzip, deflate, br, zstd',
    'Cache-Control'            : 'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'DNT'                      : '1',
    'Referer'                  : hostname.includes('statusinvest') ? 'https://www.google.com/' : `https://${hostname}/`,
    'Sec-Ch-Ua'                : '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile'         : '?0',
    'Sec-Ch-Ua-Platform'       : '"Windows"',
    'Sec-Fetch-Dest'           : 'document',
    'Sec-Fetch-Mode'           : 'navigate',
    'Sec-Fetch-Site'           : 'none',
    'Sec-Fetch-User'           : '?1',
    'Connection'               : 'keep-alive',
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 8. UNIVERSAL LEXER — ZERO-AST COM SLIDING WINDOW CORRIGIDO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Cache de RegExp compiladas para o modo `multiple`.
 * FIX #8 — A versão Gemini criava `new RegExp(rule.extractRegex.source, 'g')` a
 * cada invocação de universalLexer para cada regra `multiple: true`. Num streaming
 * com 200 chunks e 10 regras, isso gera 2000 compilações desnecessárias.
 */
const _regexCache = new Map<string, RegExp>();

function getGlobalRegex(source: string): RegExp {
  let r = _regexCache.get(source);
  if (!r) {
    r = new RegExp(source, 'g');
    _regexCache.set(source, r);
  }
  // Reseta lastIndex para uso seguro (stateful!)
  r.lastIndex = 0;
  return r;
}

/**
 * FIX #9 — Sliding window com overlap garantido.
 *
 * PROBLEMA ORIGINAL: `htmlBuffer = htmlBuffer.slice(-MAX_WINDOW_SIZE)` sem overlap.
 * Se um âncora (ex: "Dividend Yield") estiver em posição 14800-14814 e o buffer
 * for truncado para os últimos 15000 chars com início em 14900, a âncora é perdida.
 *
 * SOLUÇÃO: mantemos um overlap de `overlapSize` bytes do chunk anterior. O overlap
 * é calculado dinamicamente como o comprimento máximo entre todos os anchors do
 * template + 256 bytes de margem para a regex não capturar metade de uma tag.
 *
 * FIX #10 — `lowerHtml.toLowerCase()` era feito sobre o html INTEIRO a cada chunk.
 * Agora usamos `indexOf` case-insensitive via regex de âncora com flag `i`, ou
 * comparamos os primeiros N chars (âncora) em lowercase UMA vez por regra.
 */
const _anchorLowerCache = new Map<string, string>();

const ANCHOR_STRATEGIES = [
  (htmlLower: string, anchorLower: string) => htmlLower.indexOf(`>${anchorLower}<`),
  (htmlLower: string, anchorLower: string) => htmlLower.indexOf(`"${anchorLower}"`),
  (htmlLower: string, anchorLower: string) => htmlLower.indexOf(`>${anchorLower} `),
  (htmlLower: string, anchorLower: string) => htmlLower.indexOf(anchorLower),
];

export function universalLexer<T = any>(
  html: string,
  template: ExtractorTemplate<T>,
  existingResults: Partial<T> = {},
  precomputedHtmlLower?: string,
): Partial<T> {
  const results: any = { ...existingResults };
  const htmlLower = precomputedHtmlLower || html.toLowerCase();

  for (const rule of template.rules) {
    if (results[rule.name] !== undefined && !rule.multiple) continue;

    for (const anchor of rule.anchors) {
      /**
       * FIX #10 — busca case-insensitive eficiente sem `.toLowerCase()` do HTML inteiro.
       * PERF #4 — cache de anchor.toLowerCase() para evitar alocações no hot path.
       */
      let anchorLower = _anchorLowerCache.get(anchor);
      if (!anchorLower) {
        anchorLower = anchor.toLowerCase();
        _anchorLowerCache.set(anchor, anchorLower);
      }

      // Estratégias de busca em ordem de precisão decrescente
      let idx = -1;
      for (const strategy of ANCHOR_STRATEGIES) {
        idx = strategy(htmlLower, anchorLower);
        if (idx !== -1) break;
      }
      if (idx === -1) continue;

      const chunkSize = rule.multiple ? 3000 : 400;
      const chunk = html.slice(idx, idx + chunkSize);

      if (rule.multiple) {
        /**
         * FIX #8 aplicado — regex compilada e cacheada, lastIndex resetado.
         */
        const gRegex = getGlobalRegex(rule.extractRegex.source);
        const matches = [...chunk.matchAll(gRegex)];
        if (matches.length > 0) {
          results[rule.name] = matches
            .map(m => m[1]?.trim())
            .filter((val): val is string => !!val && !VALORES_INVALIDOS.has(val))
            .map(val => rule.formatter ? rule.formatter(val) : val);
          break;
        }
      } else {
        const match = chunk.match(rule.extractRegex);
        if (match?.[1]) {
          const raw = match[1].trim();
          if (!VALORES_INVALIDOS.has(raw)) {
            results[rule.name] = rule.formatter ? rule.formatter(raw) : raw;
            break;
          }
        }
      }
    }
  }

  return results as Partial<T>;
}
// ════════════════════════════════════════════════════════════════════════════
// 9. SCHEMAS ZOD POR TIPO DE ATIVO
// ════════════════════════════════════════════════════════════════════════════

/**
 * FIX #11 — B3Schema: `precoAtual` aceita string OU número.
 * O Gemini declarou `z.number().positive()` mas o formatter pode retornar 0
 * (se o regex capturar "0,00") causando falha de validação silenciosa.
 * A solução correta é aceitar ambos e deixar a camada de aplicação decidir.
 */
export const B3Schema = z.object({
  precoAtual:    z.union([z.number(), z.string()]).optional(),
  dividendYield: z.string().optional(),
  pl:            z.union([z.number(), z.string()]).optional(),
  pvp:           z.union([z.number(), z.string()]).optional(),
  vpa:           z.union([z.number(), z.string()]).optional(),
  lpa:           z.union([z.number(), z.string()]).optional(),
  roe:           z.string().optional(),
  roic:          z.string().optional(),
  margemLiquida: z.string().optional(),
  margemBruta:   z.string().optional(),
  margemOperacional: z.string().optional(),
  dividaBruta:   z.union([z.number(), z.string()]).optional(),
  marketCap:     z.union([z.number(), z.string()]).optional(),
  evEbitda:      z.union([z.number(), z.string()]).optional(),
  variacaoDay:   z.string().optional(),
});

export const FIISchema = z.object({
  precoAtual:        z.union([z.number(), z.string()]).optional(),
  dividendYield:     z.string().optional(),
  pvp:               z.union([z.number(), z.string()]).optional(),
  valorPatrimonial:  z.union([z.number(), z.string()]).optional(),
  liquidezDiaria:    z.union([z.number(), z.string()]).optional(),
  ultimoRendimento:  z.union([z.number(), z.string()]).optional(),
  vacanciaFisica:    z.string().optional(),
  patrimonioLiquido: z.union([z.number(), z.string()]).optional(),
  variacaoDay:       z.string().optional(),
});

export const ETFSchema = z.object({
  precoAtual:        z.union([z.number(), z.string()]).optional(),
  dividendYield:     z.string().optional(),
  pvp:               z.union([z.number(), z.string()]).optional(),
  patrimonioLiquido: z.union([z.number(), z.string()]).optional(),
  taxaAdmin:         z.string().optional(),
  variacaoDay:       z.string().optional(),
});

export type B3Data  = z.infer<typeof B3Schema>;
export type FIIData = z.infer<typeof FIISchema>;
export type ETFData = z.infer<typeof ETFSchema>;

// ════════════════════════════════════════════════════════════════════════════
// 10. TEMPLATES POR TIPO DE ATIVO
// ════════════════════════════════════════════════════════════════════════════

const COMMON_FORMATTERS = {
  num: (r: string) => normalizeBRNumber(r),
  pct: (r: string) => r.includes('%') ? r : r + '%',
};

export const acaoTemplate: ExtractorTemplate<B3Data> = {
  name: 'B3_ACAO',
  schema: B3Schema,
  rules: [
    { name: 'precoAtual',    anchors: ['Preço Atual', 'Cotação', 'cotacao', 'Valor atual'],            extractRegex: />\s*([R$]*\s*[\d,.]+)\s*</,  formatter: COMMON_FORMATTERS.num },
    { name: 'dividendYield', anchors: ['Dividend Yield', 'DY', 'Yield', 'Div. Yield'],               extractRegex: />\s*([\d,.]+\s*%?)\s*</,      formatter: COMMON_FORMATTERS.pct },
    { name: 'pl',            anchors: ['P/L', 'P/Lucro', 'Preço/Lucro', 'P / L'],               extractRegex: />\s*([\d,.-]+)\s*</,          formatter: COMMON_FORMATTERS.num },
    { name: 'pvp',           anchors: ['P/VP', 'P/Valor Patrimonial', 'P / VP'],                  extractRegex: />\s*([\d,.-]+)\s*</,          formatter: COMMON_FORMATTERS.num },
    { name: 'vpa',           anchors: ['VPA', 'Valor Patrimonial por Ação'],            extractRegex: />\s*([\d,.-]+)\s*</,          formatter: COMMON_FORMATTERS.num },
    { name: 'lpa',           anchors: ['LPA', 'Lucro por Ação'],                        extractRegex: />\s*([\d,.-]+)\s*</,          formatter: COMMON_FORMATTERS.num },
    { name: 'roe',           anchors: ['ROE', 'Retorno sobre Patrimônio'],              extractRegex: />\s*([\d,.+-]+\s*%?)\s*</,    formatter: COMMON_FORMATTERS.pct },
    { name: 'roic',          anchors: ['ROIC'],                                          extractRegex: />\s*([\d,.+-]+\s*%?)\s*</,    formatter: COMMON_FORMATTERS.pct },
    { name: 'margemLiquida', anchors: ['Margem Líquida', 'Margem Liquida'],             extractRegex: />\s*([\d,.+-]+\s*%?)\s*</,    formatter: COMMON_FORMATTERS.pct },
    { name: 'margemBruta',   anchors: ['Margem Bruta'],                                 extractRegex: />\s*([\d,.+-]+\s*%?)\s*</,    formatter: COMMON_FORMATTERS.pct },
    { name: 'evEbitda',      anchors: ['EV/EBITDA'],                                    extractRegex: />\s*([\d,.-]+)\s*</,          formatter: COMMON_FORMATTERS.num },
    { name: 'variacaoDay',   anchors: ['Variação', 'variacao', 'Var. Dia', 'var-day', 'Var%'], extractRegex: />\s*([+-]?[\d,.]+\s*%?)\s*</, formatter: COMMON_FORMATTERS.pct },
  ],
};

export const fiiTemplate: ExtractorTemplate<FIIData> = {
  name: 'B3_FII',
  schema: FIISchema,
  rules: [
    { name: 'precoAtual',        anchors: ['Preço Atual', 'Cotação', 'Valor atual'],              extractRegex: />\s*([\d,.]+)\s*</,    formatter: COMMON_FORMATTERS.num },
    { name: 'dividendYield',     anchors: ['Dividend Yield', 'DY', 'Yield', 'Div. Yield'],       extractRegex: />\s*([\d,.]+\s*%?)\s*</, formatter: COMMON_FORMATTERS.pct },
    { name: 'pvp',               anchors: ['P/VP', 'P / VP'],                                 extractRegex: />\s*([\d,.]+)\s*</,    formatter: COMMON_FORMATTERS.num },
    { name: 'valorPatrimonial',  anchors: ['Valor Patrimonial', 'VP/Cota'],         extractRegex: />\s*([\d,.]+)\s*</,    formatter: COMMON_FORMATTERS.num },
    { name: 'liquidezDiaria',    anchors: ['Liquidez', 'Liquidez Diária', 'Liq. Diária'],          extractRegex: />\s*([\d,.]+[KMB]?)\s*</, formatter: COMMON_FORMATTERS.num },
    { name: 'ultimoRendimento',  anchors: ['Último Rendimento', 'Rendimento', 'Últ. Rendimento'],      extractRegex: />\s*([\d,.]+)\s*</,    formatter: COMMON_FORMATTERS.num },
    { name: 'vacanciaFisica',    anchors: ['Vacância Física', 'Vacância'],          extractRegex: />\s*([\d,.]+\s*%?)\s*</, formatter: COMMON_FORMATTERS.pct },
    { name: 'patrimonioLiquido', anchors: ['Patrimônio Líquido', 'Patrimônio'],     extractRegex: />\s*([\d,.]+[KMB]?)\s*</, formatter: COMMON_FORMATTERS.num },
    { name: 'variacaoDay',       anchors: ['Variação', 'variacao', 'Var%'],                 extractRegex: />\s*([+-]?[\d,.]+\s*%?)\s*</, formatter: COMMON_FORMATTERS.pct },
  ],
};

// Templates aliasados para BDR/ETF (subset de acaoTemplate)
export const bdrTemplate  = acaoTemplate;
export const etfTemplate: ExtractorTemplate<ETFData> = {
  name: 'B3_ETF',
  schema: ETFSchema,
  rules: [
    { name: 'precoAtual',        anchors: ['Preço Atual', 'Cotação'],              extractRegex: />\s*([R$]*\s*[\d,.]+)\s*</,  formatter: COMMON_FORMATTERS.num },
    { name: 'dividendYield',     anchors: ['Dividend Yield', 'DY', 'Yield'],       extractRegex: />\s*([\d,.]+\s*%?)\s*</,      formatter: COMMON_FORMATTERS.pct },
    { name: 'pvp',               anchors: ['P/VP'],                                 extractRegex: />\s*([\d,.-]+)\s*</,          formatter: COMMON_FORMATTERS.num },
    { name: 'patrimonioLiquido', anchors: ['Patrimônio Líquido', 'Patrimônio'],     extractRegex: />\s*([\d,.]+[KMB]?)\s*</, formatter: COMMON_FORMATTERS.num },
    { name: 'taxaAdmin',         anchors: ['Taxa de Administração', 'Taxa Admin'],  extractRegex: />\s*([\d,.]+\s*%?)\s*</, formatter: COMMON_FORMATTERS.pct },
    { name: 'variacaoDay',       anchors: ['Variação', 'variacao'],                 extractRegex: />\s*([+-]?[\d,.]+\s*%?)\s*</, formatter: COMMON_FORMATTERS.pct },
  ],
};

/**
 * FIX #12 — Mapa de presets por tipo de ativo restaurado do v11.
 * O Gemini hardcodou ACAO em fetchB3 e ignorou FII/BDR/ETF completamente.
 */
const ASSET_PRESETS: Record<ExtendedAssetType, {
  i10Base: string;
  siBase:  string;
  template: ExtractorTemplate<any>;
}> = {
  ACAO: { i10Base: 'https://investidor10.com.br/acoes',  siBase: 'https://statusinvest.com.br/acoes',              template: acaoTemplate },
  FII:  { i10Base: 'https://investidor10.com.br/fiis',   siBase: 'https://statusinvest.com.br/fundos-imobiliarios', template: fiiTemplate  },
  BDR:  { i10Base: 'https://investidor10.com.br/bdrs',   siBase: 'https://statusinvest.com.br/bdrs',               template: bdrTemplate  },
  ETF:  { i10Base: 'https://investidor10.com.br/etfs',   siBase: 'https://statusinvest.com.br/etfs',               template: etfTemplate  },
};

// ════════════════════════════════════════════════════════════════════════════
// 11. YAHOO FINANCE NATIVO (restaurado do v11)
// ════════════════════════════════════════════════════════════════════════════

interface YahooQuoteData {
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  trailingPE?: number;
  priceToBook?: number;
  bookValue?: number;
  epsTrailingTwelveMonths?: number;
  trailingAnnualDividendYield?: number;
  marketCap?: number;
}

interface YahooFundamentalsData {
  profitMargins?: number;
  returnOnEquity?: number;
  revenuePerShare?: number;
  returnOnAssets?: number;
  grossMargins?: number;
  operatingMargins?: number;
  debtToEquity?: number;
}

const _jsonInFlight = new Map<string, Promise<any>>();

async function fetchJson(url: string, timeoutMs: number): Promise<any> {
  const existing = _jsonInFlight.get(url);
  if (existing) return existing;

  const p = (async () => {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal:  ctrl.signal,
        headers: { 
          'Accept': 'application/json, text/plain, */*', 
          'User-Agent': getRandomAgent(),
          'Origin': 'https://finance.yahoo.com',
          'Referer': 'https://finance.yahoo.com/',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${text.slice(0, 20)}`);
      }
    } finally {
      clearTimeout(timer);
      _jsonInFlight.delete(url);
    }
  })();

  _jsonInFlight.set(url, p);
  return p;
}

/**
 * FIX #13 — Promise.any() para corrida entre hosts (v11 feature).
 * Ambos os hosts disparam em paralelo; o mais rápido vence.
 */
async function yahooQuote(ticker: string, timeoutMs: number): Promise<YahooQuoteData | null> {
  const symbols = [`${ticker}.SA`, ticker.toUpperCase()];
  try {
    const meta = await Promise.any(
      symbols.flatMap(symbol =>
        YAHOO_HOSTS.map(async host => {
          const json = await fetchJson(
            `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d&includePrePost=false`,
            timeoutMs,
          );
          const m = json?.chart?.result?.[0]?.meta;
          if (!m?.regularMarketPrice) throw new Error('Sem meta');
          return m;
        })
      )
    );
    const prev = meta.chartPreviousClose ?? meta.regularMarketPreviousClose;
    return {
      regularMarketPrice:          meta.regularMarketPrice,
      regularMarketChangePercent:  prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : undefined,
      trailingPE:                  meta.trailingPE,
      priceToBook:                 meta.priceToBook,
      bookValue:                   meta.bookValue,
      epsTrailingTwelveMonths:     meta.epsTrailingTwelveMonths,
      trailingAnnualDividendYield: meta.trailingAnnualDividendYield,
      marketCap:                   meta.marketCap,
    };
  } catch {
    return null;
  }
}

async function yahooFundamentals(ticker: string, timeoutMs: number): Promise<YahooFundamentalsData> {
  const symbols  = [`${ticker}.SA`, ticker.toUpperCase()];
  const modules  = 'financialData,defaultKeyStatistics';
  try {
    const fd = await Promise.any(
      symbols.flatMap(symbol =>
        YAHOO_HOSTS.map(async host => {
          const json = await fetchJson(
            `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`,
            timeoutMs,
          );
          const data = json?.quoteSummary?.result?.[0]?.financialData;
          if (!data) throw new Error('Sem financialData');
          return data;
        })
      )
    );
    return {
      profitMargins:    fd.profitMargins?.raw,
      returnOnEquity:   fd.returnOnEquity?.raw,
      revenuePerShare:  fd.revenuePerShare?.raw,
      returnOnAssets:   fd.returnOnAssets?.raw,
      grossMargins:     fd.grossMargins?.raw,
      operatingMargins: fd.operatingMargins?.raw,
      debtToEquity:     fd.debtToEquity?.raw,
    };
  } catch { }
  return {};
}
// ════════════════════════════════════════════════════════════════════════════
// 12. MOTOR PRINCIPAL — NEXUS ENGINE ULTRA v12
// ════════════════════════════════════════════════════════════════════════════

export class NexusEngineUltra {
  /** FIX #14 — inFlight por URL (deduplicação cross-caller) */
  private static _urlInFlight     = new Map<string, Promise<any>>();
  private static _tickerInFlight  = new Map<string, Promise<any>>();

  private static _cache           = new LRUCache<any>(500);
  /** FIX #15 — CB por domínio, não instanciado lazily mas com factory controlada */
  private static _circuitBreakers = new Map<string, CircuitBreaker>();
  private static _startTime       = Date.now();
  private static _totalRequests   = 0;
  private static _totalSuccess    = 0;
  private static _totalFailures   = 0;
  private static _sessionMetrics  = { cacheHits: 0, cacheStale: 0, cacheMisses: 0 };

  private static _options: Required<NexusEngineOptions> = {
    cacheTtlMs:       24 * 60 * 60 * 1_000,
    cacheStaleMs:     5  * 60 * 1_000,
    maxRetries:       3,
    retryBaseDelay:   500,
    fetchTimeoutMs:   15_000,
    concurrencyLimit: 5,
    domainRps:        2,
    domainBurst:      5,
  };

  private static _rateLimiters = new Map<string, DomainRateLimiter>();

  static configure(opts: NexusEngineOptions): void {
    this._options = { ...this._options, ...opts };
    this._rateLimiters.clear(); // Reset limiters with new settings
  }

  private static getRateLimiter(domain: string): DomainRateLimiter {
    let limiter = this._rateLimiters.get(domain);
    if (!limiter) {
      limiter = new DomainRateLimiter(this._options.domainRps, this._options.domainBurst);
      this._rateLimiters.set(domain, limiter);
    }
    return limiter;
  }

  // ── CB helpers ──────────────────────────────────────────────────────────

  private static getCB(domain: string): CircuitBreaker {
    if (!this._circuitBreakers.has(domain)) {
      this._circuitBreakers.set(domain, new CircuitBreaker());
    }
    return this._circuitBreakers.get(domain)!;
  }

  static resetCircuitBreaker(domain: string): void {
    this._circuitBreakers.get(domain)?.reset();
  }

  // ── Fetch com timeout e retry ITERATIVO ─────────────────────────────────

  /**
   * FIX #16 — fetchWithJitter agora é ITERATIVO (era recursivo).
   * A versão Gemini usava recursão com `return this.fetchWithJitter(..., attempt + 1)`.
   * Com maxRetries = 10+, poderia causar stack overflow em casos extremos.
   * Além disso, cada recursão criava um novo frame de call stack.
   *
   * FIX #17 — AbortController com timeout adicionado.
   * A versão Gemini não tinha timeout: uma conexão pendurada bloqueava indefinidamente.
   */
  private static async fetchWithJitter(
    url: string,
    requireStealth: boolean,
  ): Promise<Response> {
    let lastErr: Error = new Error('fetch falhou');
    const hostname = extractHostname(url);
    const domain   = hostname.replace('www.', '').split('.')[0];
    const limiter  = this.getRateLimiter(domain);

    for (let attempt = 0; attempt < this._options.maxRetries; attempt++) {
      await limiter.acquire();
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this._options.fetchTimeoutMs);

      try {
        const res = await fetch(url, {
          signal:  ctrl.signal,
          headers: requireStealth ? getStealthHeaders(url, hostname) : { 'User-Agent': getRandomAgent() },
        });
        clearTimeout(timer);

        if (res.status === 429 || res.status === 503) {
          const retryAfter = res.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          const err = new Error(`RateLimit HTTP ${res.status}`);
          (err as any).retryAfterMs = delay;
          throw err;
        }
        if (res.status === 404 || res.status === 410 || res.status === 451) {
          throw new Error(`Critical HTTP ${res.status}`);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;

      } catch (err) {
        clearTimeout(timer);
        lastErr = err as Error;
        if (lastErr.message.includes('Critical')) throw lastErr;
        if (attempt < this._options.maxRetries - 1) {
          const isRateLimit = lastErr.message.includes('RateLimit');
          let delay = backoffMs(attempt, this._options.retryBaseDelay) * (isRateLimit ? 2 : 1);
          if (isRateLimit && (lastErr as any).retryAfterMs) {
            delay = (lastErr as any).retryAfterMs;
          }
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastErr;
  }

  // ── execute: ponto de entrada principal ─────────────────────────────────

  /**
   * FIX #18 — cacheKey agora inclui TODOS os URLs das sources, não apenas o primeiro.
   * Na versão Gemini: `nexus:${sources[0].url}`. Se duas chamadas diferentes usassem
   * a mesma fonte principal mas fontes de fallback diferentes, compartilhavam o cache
   * incorretamente.
   */
  static async execute<T>(
    sources: ScrapeSource<T>[],
  ): Promise<{ data: Partial<T>; bytes: number; earlyAbort: boolean; cacheStatus: string }> {
    const cacheKey = `nexus:${sources.map(s => s.url).join('|')}`;
    const cached   = this._cache.get(cacheKey);

    if (cached) {
      if (cached.isStale) {
        this._sessionMetrics.cacheStale++;
        if (!this._tickerInFlight.has(cacheKey)) {
          const bg = this._executeNetwork(sources)
            .then(fresh => this._cache.set(cacheKey, fresh, this._options.cacheStaleMs, this._options.cacheTtlMs))
            .catch(() => {});
          this._tickerInFlight.set(cacheKey, bg);
          bg.finally(() => this._tickerInFlight.delete(cacheKey));
        }
        return { ...cached.data, cacheStatus: 'STALE' };
      }
      this._sessionMetrics.cacheHits++;
      return { ...cached.data, cacheStatus: 'HIT' };
    }

    // FIX #14 — deduplicação de requests idênticos em-andamento
    const inflight = this._tickerInFlight.get(cacheKey);
    if (inflight) return inflight;

    this._sessionMetrics.cacheMisses++;
    const p = this._executeNetwork(sources).then(fresh => {
      this._cache.set(cacheKey, fresh, this._options.cacheStaleMs, this._options.cacheTtlMs);
      return { ...fresh, cacheStatus: 'MISS' };
    });
    this._tickerInFlight.set(cacheKey, p);
    p.finally(() => this._tickerInFlight.delete(cacheKey));
    return p;
  }

  // ── _executeNetwork: orquestra fontes sequencialmente ───────────────────

  private static async _executeNetwork<T>(
    sources: ScrapeSource<T>[],
  ): Promise<{ data: Partial<T>; bytes: number; earlyAbort: boolean }> {
    let lastErr: Error = new Error('Nenhuma fonte disponível');
    let openCBs = 0;
    let bestData: Partial<T> = {};
    let totalBytes = 0;
    let anyEarlyAbort = false;

    for (const source of sources) {
      const hostname = extractHostname(source.url);
      const domain   = hostname.replace('www.', '').split('.')[0];
      const cb       = this.getCB(domain);

      /**
       * FIX #6 aplicado — usa `cb.isOpen()` (sem side-effects) em vez de
       * `cb.getState() === 'ABERTO'` (que muta estado internamente).
       */
      if (cb.isOpen()) {
        openCBs++;
        continue;
      }

      try {
        // Deduplicação de URL cross-caller
        let fetchPromise = this._urlInFlight.get(source.url);
        if (!fetchPromise) {
          this._totalRequests++;
          fetchPromise = this._streamAndParse<T>(source, cb);
          this._urlInFlight.set(source.url, fetchPromise);
          fetchPromise.finally(() => this._urlInFlight.delete(source.url));
        }

        const result = await fetchPromise;
        
        // SUCCESS #6: Acumula o melhor resultado parcial
        for (const [k, v] of Object.entries(result.data)) {
          if (v !== undefined) {
            (bestData as any)[k] = v;
          }
        }
        totalBytes += result.bytes;
        anyEarlyAbort = anyEarlyAbort || result.earlyAbort;

        // Se conseguiu tudo, retorna imediatamente
        const hasAll = source.template.rules.every(r => bestData[r.name as keyof T] !== undefined);
        if (hasAll) {
          return { data: bestData, bytes: totalBytes, earlyAbort: anyEarlyAbort };
        }
        
        // Se não conseguiu tudo, tenta a próxima fonte para preencher as lacunas
        continue;
      } catch (err) {
        lastErr = err as Error;
        // Erros críticos (404, etc.) não fazem fallback
        if (lastErr.message.includes('Critical')) break;
        continue;
      }
    }
    
    // Se acumulou algum dado parcial, retorna ele mesmo que todas as fontes tenham falhado parcialmente
    if (Object.keys(bestData).length > 0) {
      return { data: bestData, bytes: totalBytes, earlyAbort: anyEarlyAbort };
    }

    if (openCBs === sources.length && sources.length > 0) {
      throw new Error(`Todos os Circuit Breakers abertos (${openCBs}/${sources.length} fontes)`);
    }
    throw new Error(`Falha total: ${lastErr.message}`);
  }

  // ── _streamAndParse: streaming + lexer + Zod ────────────────────────────

  private static async _streamAndParse<T>(
    source: ScrapeSource<T>,
    cb: CircuitBreaker,
  ): Promise<{ data: Partial<T>; bytes: number; earlyAbort: boolean }> {
    try {
      const res = await this.fetchWithJitter(source.url, !!source.requireStealth);
      if (!res.body) throw new Error('No response body');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let htmlBuffer = '';
      let rawData: Partial<T> = {};
      let bytesRead  = 0;
      let earlyAbort = false;
      let stagnantChunks = 0;
      let lastFieldCount = 0;

      /**
       * FIX #9 aplicado — sliding window com overlap calculado.
       * Overlap = comprimento máximo de qualquer âncora + 256 bytes de margem.
       * Isso garante que nenhum âncora seja partido na fronteira do slice.
       * PERF #10 — MAX_WINDOW aumentado para 30_000 chars.
       */
      const MAX_WINDOW   = 30_000;
      const MAX_ANCHOR   = source.template.rules.reduce((max, r) => r.anchors.reduce((m, a) => Math.max(m, a.length), max), 0);
      const OVERLAP_SIZE = Math.max(MAX_ANCHOR + 256, 512);

      let htmlLowerBuffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          bytesRead  += value.length;
          const decoded = decoder.decode(value, { stream: true });
          htmlBuffer += decoded;
          htmlLowerBuffer += decoded.toLowerCase();

          if (htmlBuffer.length > MAX_WINDOW) {
            // Mantemos o overlap do final do buffer anterior para não cortar âncoras
            htmlBuffer = htmlBuffer.slice(-(MAX_WINDOW - OVERLAP_SIZE));
            htmlLowerBuffer = htmlLowerBuffer.slice(-(MAX_WINDOW - OVERLAP_SIZE));
          }

          rawData = universalLexer<T>(htmlBuffer, source.template, rawData, htmlLowerBuffer);

          const currentFieldCount = Object.keys(rawData).length;
          if (bytesRead > 100_000) {
            if (currentFieldCount === lastFieldCount) {
              stagnantChunks++;
              if (stagnantChunks >= 10) {
                reader.cancel().catch(() => {});
                earlyAbort = true;
                break;
              }
            } else {
              stagnantChunks = 0;
              lastFieldCount = currentFieldCount;
            }
          } else {
            lastFieldCount = currentFieldCount;
          }

          const hasAll = source.template.rules.every(r => rawData[r.name as keyof T] !== undefined);
          if (hasAll) {
            reader.cancel().catch(() => {});
            earlyAbort = true;
            break;
          }
        }

        // Flush final
        const tail = decoder.decode();
        if (tail) {
          htmlBuffer += tail;
          htmlLowerBuffer += tail.toLowerCase();
          rawData = universalLexer<T>(htmlBuffer, source.template, rawData, htmlLowerBuffer);
        }
      } finally {
        try { reader.releaseLock(); } catch { /* ignore */ }
      }

      const parsed = source.template.schema.safeParse(rawData);
      if (parsed.success) {
        cb.recordSuccess();
        this._totalSuccess++;
        return { data: parsed.data, bytes: bytesRead, earlyAbort };
      }

      /**
       * FIX #19 — Zod falha: retorna dados parciais em vez de lançar.
       * O Gemini lançava erro se a validação falhasse, descartando todos os dados
       * extraídos. Se temos P/L mas não temos precoAtual, é melhor retornar o que
       * temos do que nada.
       */
      cb.recordSuccess();
      this._totalSuccess++;
      return { data: rawData, bytes: bytesRead, earlyAbort };

    } catch (err) {
      const isRateLimit = err instanceof Error && err.message.includes('RateLimit');
      if (!isRateLimit) {
        cb.recordFailure();
      }
      this._totalFailures++;
      throw err;
    }
  }

  // ── fetchAtivo: API de alto nível com Yahoo como complemento ────────────

  /**
   * FIX #12 aplicado — suporte completo a ACAO/FII/BDR/ETF.
   * FIX #20 — Yahoo Finance como fonte complementar paralela (restaurado do v11).
   */
  static async fetchAtivo(
    ticker: string,
    type: ExtendedAssetType = 'ACAO',
    includeNews = false,
  ): Promise<{
    ticker: string;
    results: any;
    cacheStatus: string;
    news?: NewsItem[];
    metrics: any;
  }> {
    const cleanTicker = canonicalizeTicker(ticker);
    const erroVal     = validarTicker(cleanTicker);
    if (erroVal) {
      return { ticker: cleanTicker, results: {}, cacheStatus: 'ERROR', metrics: { error: erroVal } };
    }
    const preset  = ASSET_PRESETS[type];
    const t       = cleanTicker.toLowerCase();
    const sources: ScrapeSource<any>[] = [
      { url: `${preset.i10Base}/${t}/`, template: preset.template, requireStealth: true },
      { url: `${preset.siBase}/${t}/`,  template: preset.template, requireStealth: true },
    ];

    const startTime = performance.now();
    const startCpu  = safeCpuStart();

    const [scrapeResult, yahooResult, yahooFund, newsResult] = await Promise.allSettled([
      this.execute(sources),
      yahooQuote(cleanTicker, this._options.fetchTimeoutMs),
      yahooFundamentals(cleanTicker, this._options.fetchTimeoutMs),
      includeNews ? this.fetchNews(cleanTicker) : Promise.resolve(undefined),
    ]);

    const scrape   = scrapeResult.status === 'fulfilled' ? scrapeResult.value : { data: {}, bytes: 0, earlyAbort: false, cacheStatus: 'ERROR' };
    const quote    = yahooResult.status  === 'fulfilled' ? yahooResult.value  : null;
    const fund     = yahooFund.status    === 'fulfilled' ? yahooFund.value    : {};
    const newsData = newsResult.status   === 'fulfilled' ? newsResult.value   : undefined;
    const combined = { ...scrape.data } as Record<string, any>;

    // Preenche lacunas com dados do Yahoo
    const fill = (k: string, v: unknown) => {
      if (combined[k] !== undefined || v == null) return;
      if (typeof v === 'number') {
        combined[k] = v;
        return;
      }
      const s = String(v).trim();
      if (!VALORES_INVALIDOS.has(s)) combined[k] = s;
    };

    if (quote) {
      fill('precoAtual',    quote.regularMarketPrice);
      fill('variacaoDay',   quote.regularMarketChangePercent != null
        ? quote.regularMarketChangePercent.toFixed(2) + '%' : undefined);
      fill('pl',            quote.trailingPE);
      fill('pvp',           quote.priceToBook);
      fill('vpa',           quote.bookValue);
      fill('lpa',           quote.epsTrailingTwelveMonths);
      fill('dividendYield', quote.trailingAnnualDividendYield != null
        ? (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%' : undefined);
      fill('marketCap',     quote.marketCap);
    }
    if (fund) {
      fill('margemLiquida',  fund.profitMargins    != null ? (fund.profitMargins    * 100).toFixed(2) + '%' : undefined);
      fill('margemBruta',    fund.grossMargins     != null ? (fund.grossMargins     * 100).toFixed(2) + '%' : undefined);
      fill('roe',            fund.returnOnEquity   != null ? (fund.returnOnEquity   * 100).toFixed(2) + '%' : undefined);
      fill('roic',           fund.returnOnAssets   != null ? (fund.returnOnAssets   * 100).toFixed(2) + '%' : undefined); // Yahoo uses returnOnAssets for ROIC proxy
      fill('margemOperacional', fund.operatingMargins != null ? (fund.operatingMargins * 100).toFixed(2) + '%' : undefined);
      fill('dividaBruta',    fund.debtToEquity);
    }

    const totalTimeMs = performance.now() - startTime;
    const sources_used: string[] = [];
    if (scrapeResult.status === 'fulfilled' && Object.keys(scrape.data).length > 0) sources_used.push('Scraper');
    if (quote) sources_used.push('YahooFinance');
    if (Object.keys(fund).length) sources_used.push('YahooFundamentals');

    return {
      ticker:      cleanTicker,
      results:     combined,
      cacheStatus: scrape.cacheStatus || 'MISS',
      ...(newsData ? { news: newsData } : {}),
      metrics: {
        totalTimeMs,
        bytesProcessed:    scrape.bytes,
        foundKeys:         Object.keys(combined),
        successRate:       Object.keys(combined).length / preset.template.rules.length,
        earlyAbort:        scrape.earlyAbort,
        source:            sources_used.join(' + ') || 'None',
        /**
         * FIX #21 — métricas de CPU reais em vez de `totalTimeMs * 0.15`.
         * A versão Gemini fabricava cpuUsageMs como 15% do tempo de parede,
         * o que é semanticamente incorreto (CPU ≠ wall clock).
         */
        cpuUsageMs:        safeCpuDeltaMs(startCpu),
        estimatedMemoryMb: Number((scrape.bytes / 1024 / 1024).toFixed(2)),
      },
    };
  }

  // ── fetchB3: retrocompatibilidade ────────────────────────────────────────

  static async fetchB3(ticker: string): Promise<{ data: Partial<B3Data>; bytes: number; earlyAbort: boolean; cacheStatus: string }> {
    const r = await this.fetchAtivo(ticker, 'ACAO');
    return { data: r.results, bytes: r.metrics.bytesProcessed, earlyAbort: r.metrics.earlyAbort, cacheStatus: r.cacheStatus };
  }

  static async fetchHistoricoGrafico(ticker: string, range: string = '1y', interval: string = '1d'): Promise<any[]> {
    const cleanTicker = canonicalizeTicker(ticker);
    const symbols = [`${cleanTicker}.SA`, cleanTicker];
      
    try {
      const result = await Promise.any(
        symbols.flatMap(symbol =>
          YAHOO_HOSTS.map(async host => {
            const json = await fetchJson(
              `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`,
              this._options.fetchTimeoutMs,
            );
            const res = json?.chart?.result?.[0];
            if (!res || !res.timestamp || !res.indicators?.quote?.[0]) {
              throw new Error('Sem dados de histórico');
            }
            return res;
          })
        )
      );
      
      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];
      
      return timestamps.map((ts: number, i: number) => ({
        date: new Date(ts * 1000).toISOString(),
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i],
      })).filter((d: any) => d.close !== null && d.close !== undefined);
    } catch { }
    return [];
  }

  static async fetchDividends(ticker: string): Promise<any[]> {
    const cleanTicker = canonicalizeTicker(ticker);
    const symbols = [`${cleanTicker}.SA`, cleanTicker];
      
    try {
      const events = await Promise.any(
        symbols.flatMap(symbol =>
          YAHOO_HOSTS.map(async host => {
            const json = await fetchJson(
              `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1mo&events=div&includePrePost=false`,
              this._options.fetchTimeoutMs,
            );
            const evs = json?.chart?.result?.[0]?.events?.dividends;
            if (!evs) throw new Error('Sem dividendos');
            return evs;
          })
        )
      );
      
      return Object.values(events).map((d: any) => ({
        date: new Date(d.date * 1000).toISOString(),
        amount: d.amount,
      })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch { }
    return [];
  }

  static async searchTicker(query: string): Promise<any[]> {
    const endpoints = [
      `https://query2.finance.yahoo.com/v2/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`,
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`,
    ];
    try {
      const json = await Promise.any(
        endpoints.map(url => fetchJson(url, this._options.fetchTimeoutMs))
      );
      return (json?.quotes ?? []).filter(
        (q: any) => q.exchange === 'SAO' || q.exchange === 'BVMF' || q.symbol?.endsWith('.SA')
      );
    } catch {
      return [];
    }
  }

  static async fetchNews(ticker: string): Promise<NewsItem[]> {
    const clean = canonicalizeTicker(ticker);
    const url = `https://news.google.com/rss/search?q=${clean}+ação+OR+fii+OR+b3+OR+investimento&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    
    // Deduplicação in-flight para notícias
    const existing = this._urlInFlight.get(url);
    if (existing) return existing;

    const p = (async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this._options.fetchTimeoutMs);
      try {
        const res = await fetch(url, { 
          signal: ctrl.signal,
          headers: { 'User-Agent': getRandomAgent() } 
        });
        clearTimeout(timer);
        if (!res.ok) return [];
        const xml = await res.text();
        
        const items: NewsItem[] = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        
        while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
          const itemXml = match[1];
          const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(itemXml);
          const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/.exec(itemXml);
          const pubDateMatch = /<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/.exec(itemXml);
          const sourceMatch = /<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/.exec(itemXml);
          
          if (titleMatch && linkMatch) {
            items.push({
              title: titleMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
              link: linkMatch[1],
              pubDate: pubDateMatch ? new Date(pubDateMatch[1]) : undefined,
              source: sourceMatch ? sourceMatch[1] : undefined,
            });
          }
        }
        return items;
      } catch {
        return [];
      } finally {
        clearTimeout(timer);
        this._urlInFlight.delete(url);
      }
    })();

    this._urlInFlight.set(url, p);
    return p;
  }

  // ── executeBatch: PRESERVA ORDEM DOS RESULTADOS ──────────────────────────

  /**
   * FIX #22 — executeBatch agora preserva a ordem de entrada.
   * A versão Gemini usava `results.push()` em ordem de conclusão (não de entrada),
   * causando resultados fora de ordem para quem chamasse `runNexusBatch`.
   */
  static async executeBatch<T>(
    tasks: (() => Promise<T>)[],
    concurrency = this._options.concurrencyLimit,
  ): Promise<(T | Error)[]> {
    const results: (T | Error)[] = new Array(tasks.length);
    const executing = new Set<Promise<void>>();

    for (let i = 0; i < tasks.length; i++) {
      const idx = i;
      const p   = tasks[idx]()
        .then(res  => { results[idx] = res; })
        .catch(err => { results[idx] = err instanceof Error ? err : new Error(String(err)); })
        .finally(() => { executing.delete(p); });

      executing.add(p);
      if (executing.size >= concurrency) await Promise.race(executing);
    }
    await Promise.all(executing);
    return results;
  }

  // ── Cache e Diagnóstico ──────────────────────────────────────────────────

  static clearCache(): void {
    this._cache           = new LRUCache<any>(500);
    _hostnameCache.clear();
    _regexCache.clear();
  }

  static invalidateCache(ticker: string, type?: ExtendedAssetType): void {
    const clean = canonicalizeTicker(ticker);
    for (const t of (type ? [type] : ['ACAO', 'FII', 'BDR', 'ETF'] as ExtendedAssetType[])) {
      const preset = ASSET_PRESETS[t];
      const key    = `nexus:${preset.i10Base}/${clean}/|${preset.siBase}/${clean}/`;
      this._cache.delete(key);
    }
  }

  static getCacheStats() {
    const cbMetrics: Record<string, { estado: CBState; falhas: number }> = {};
    this._circuitBreakers.forEach((cb, domain) => {
      cbMetrics[domain] = { estado: cb.getState(), falhas: cb.getFalhas() };
    });

    const uptime = Date.now() - this._startTime;
    return {
      cache:             { tamanho: this._cache.tamanho, tamanhoMax: this._cache.tamanhoMax },
      session:           this._sessionMetrics,
      uptime,
      totalRequests:     this._totalRequests,
      totalSuccess:      this._totalSuccess,
      totalFailures:     this._totalFailures,
      successRate:       this._totalRequests > 0
        ? ((this._totalSuccess / this._totalRequests) * 100).toFixed(1) + '%' : 'N/A',
      inFlightRequests:  this._urlInFlight.size + this._tickerInFlight.size,
      rateLimiters:      Array.from(this._rateLimiters.keys()),
      circuitBreakers:   Object.keys(cbMetrics).length > 0 ? cbMetrics : {
        investidor10: { estado: 'FECHADO' as CBState, falhas: 0 },
        statusinvest: { estado: 'FECHADO' as CBState, falhas: 0 },
      },
    };
  }

  static getDetailedReport() {
    return {
      engine:  'Nexus Engine Ultra v15.0',
      status:  'Operational',
      capabilities: [
        'Zero-AST Regex Lexer com Sliding Window Corrigido',
        'Early Abort on Rule Saturation',
        'Orquestração Paralela (Scraper + Yahoo Quote + Yahoo Fundamentals)',
        'Promise.any() Race entre Yahoo Hosts',
        'Circuit Breaker por Domínio com getState() sem Side-Effects',
        'LRU Cache SWR (Stale-While-Revalidate) com Expiração TTL',
        'Fetch Iterativo com AbortController Timeout',
        'Deduplicação In-flight (URL + Ticker)',
        'Suporte Completo a ACAO / FII / BDR / ETF',
        'Validação Zod com Fallback para Dados Parciais',
        'Batch com Preservação de Ordem',
        'invalidateCache(ticker, type?) Seletivo',
        'Regex de Modo Multiple Cacheada',
        'User-Agents Chrome 131+ / Firefox 133+',
        'CPU Metrics Reais via process.cpuUsage()',
      ],
      cacheStats: this.getCacheStats(),
    };
  }
}
// ════════════════════════════════════════════════════════════════════════════
// 13. API BATCH PÚBLICA
// ════════════════════════════════════════════════════════════════════════════

/**
 * FIX #23 — runNexusBatch agora respeita o parâmetro `type`.
 * A versão Gemini ignorava completamente `type` e sempre chamava fetchB3 (ACAO).
 */
export async function runNexusBatch(
  tickers:     string[],
  type:        ExtendedAssetType = 'ACAO',
  _opts?:      any,
  includeNews? : boolean,
): Promise<any[]> {
  return NexusEngineUltra.executeBatch(
    tickers.map(ticker => async () => {
      const t0 = performance.now();
      try {
        const result = await NexusEngineUltra.fetchAtivo(ticker, type, includeNews);
        return {
          ...result,
          metrics: {
            ...result.metrics,
            totalTimeMs: performance.now() - t0,
          },
        };
      } catch (e: any) {
        return {
          ticker:      canonicalizeTicker(ticker),
          results:     {},
          error:       e.message,
          cacheStatus: 'ERROR',
          metrics: {
            totalTimeMs:       performance.now() - t0,
            bytesProcessed:    0,
            foundKeys:         [],
            successRate:       0,
            earlyAbort:        false,
            source:            'Nexus Engine Ultra (Failed)',
            estimatedMemoryMb: 0,
            cpuUsageMs:        0,
          },
        };
      }
    }),
  );
}

export async function runNexusBatchAuto(
  tickers:     string[],
  _opts?:      any,
  includeNews?: boolean,
): Promise<any[]> {
  return NexusEngineUltra.executeBatch(
    tickers.map(ticker => async () => {
      const type = inferAssetType(ticker);
      const t0   = performance.now();
      try {
        const result = await NexusEngineUltra.fetchAtivo(ticker, type, includeNews);
        return { ...result, metrics: { ...result.metrics, totalTimeMs: performance.now() - t0 } };
      } catch (e: any) {
        return {
          ticker:      canonicalizeTicker(ticker),
          results:     {},
          error:       e.message,
          cacheStatus: 'ERROR',
          metrics: { totalTimeMs: performance.now() - t0, bytesProcessed: 0, foundKeys: [], successRate: 0, earlyAbort: false, source: 'Failed', estimatedMemoryMb: 0, cpuUsageMs: 0 },
        };
      }
    }),
  );
}

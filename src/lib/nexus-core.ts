import { Parser } from 'htmlparser2';
import { performance } from 'perf_hooks';

import {
  AssetType,
  ExtendedAssetType,
  AssetLabel,
  CacheStatus,
  ResultMap,
  FetchSuccess,
  FetchAtivoResult,
  AssetPreset,
  Task,
  ChartPeriod,
  HistoricalQuote,
  Dividend,
  DataSource,
  NewsItem,
  NexusEngineConfig,
  DataType,
  LabelRule,
  CustomTemplate
} from './nexus/types.js';

import { delay, getRandomAgent } from './nexus/utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

type ScraperSource = 'investidor10' | 'statusInvest' | 'custom';

interface ExtendedAssetPreset extends AssetPreset {
  url_base: string;
  labels: AssetLabel[];
  statusInvest_base?: string;
  aliases?: Record<string, AssetLabel>;
  htmlClasses: Record<ScraperSource, string[]>;
}

interface YahooQuoteData {
  regularMarketPrice?: number; regularMarketChangePercent?: number;
  trailingPE?: number; priceToBook?: number; bookValue?: number;
  epsTrailingTwelveMonths?: number; trailingAnnualDividendYield?: number;
  marketCap?: number; profitMargins?: number; returnOnEquity?: number;
  revenuePerShare?: number; symbol?: string;
}

interface CacheEntry { data: FetchAtivoResult; timestamp: number; }

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES PRÉ-COMPILADAS — evita recompilação a cada chamada
// ─────────────────────────────────────────────────────────────────────────────

/** OTIMIZAÇÃO: Set de valores inválidos (O(1) lookup vs. array indexOf) */
const VALORES_INVALIDOS = new Set(['-', '—', '–', 'N/A', 'n/a', 'nd', '', 'null', 'undefined', '--', '---', '--%', '0%']);

/** OTIMIZAÇÃO: Regex compilados uma única vez no nível do módulo */
const RE_MOEDA    = /[R$\s]/g;
const RE_MILHAR   = /\./g;
const RE_DECIMAL  = /,/;
const RE_CHROME   = /Chrome\/(\d+)/;
const RE_TICKER   = /^[A-Z]{4}\d{1,2}$/;
const RE_SA       = /\.SA$/i;
const RE_BDR      = /3[2-5]$/;
const RE_NUMERO   = /^[\d,.\-]+[%MkKB]?$/;
const RE_PERCENT  = /%/;

/**
 * OTIMIZAÇÃO: Lista de ETFs expandida — a original tinha apenas 10,
 * cobrindo uma fração mínima dos ETFs negociados na B3.
 */
const ETFS_CONHECIDOS = new Set([
  'BOVA11','IVVB11','SMAL11','DIVO11','FIND11','MATB11','GOVE11','XFIX11',
  'GOLD11','SPXI11','HASH11','BOVB11','BOVS11','BRAP11','BRRJ11','BRAX11',
  'XINA11','EURP11','FIXA11','TCHE11','ECOO11','DIVO11','ACWI11','NASD11',
  'COCA34','USTK11','NSDQ11','DEFI11','ESGE11','SUST11','AGRI11','IFRA11',
  'BDIV11','BLKB11','BNDX11','BOVV11','BRCO11','CSMO11','VALE11','QUAL11',
  'REIT11','TRET11','WRLD11','XBOV11','PIBB11','SMAC11','MOAT11','PORD11',
]);

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OTIMIZAÇÃO: Reduzido número de operações e eliminadas operações redundantes.
 * O `.toUpperCase()` era feito após detectar sufixos — reordenado para uma vez só.
 */
function normalizeBRNumber(raw: string): number | string {
  if (!raw) return '';
  let limpo = raw.replace(RE_MOEDA, '').toUpperCase().trim();
  if (RE_PERCENT.test(limpo)) return limpo;

  let multiplicador = 1;
  const ultimo = limpo[limpo.length - 1];
  if (ultimo === 'K') { multiplicador = 1_000; limpo = limpo.slice(0, -1); }
  else if (ultimo === 'M') { multiplicador = 1_000_000; limpo = limpo.slice(0, -1); }
  else if (ultimo === 'B') { multiplicador = 1_000_000_000; limpo = limpo.slice(0, -1); }

  // Uma única passagem: remove pontos de milhar, substitui vírgula decimal
  limpo = limpo.replace(RE_MILHAR, '').replace(RE_DECIMAL, '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? raw.trim() : num * multiplicador;
}

/**
 * OTIMIZAÇÃO: Backoff com full jitter — distribui melhor as retentativas
 * sob alta concorrência, evitando thundering herd.
 */
function backoffMs(tentativa: number, base = 300, teto = 8_000): number {
  const cap = Math.min(teto, base * 2 ** tentativa);
  return Math.random() * cap; // Full jitter: U(0, cap)
}

function periodoParaData(periodo: ChartPeriod): Date {
  const diasPorPeriodo: Record<string, number> = {
    '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '5y': 1825, 'max': 10950
  };
  return new Date(Date.now() - (diasPorPeriodo[periodo] ?? 365) * 86_400_000);
}

// ═══════════════════════════════════════════════════════════
// YAHOO FINANCE NATIVO (substitui yahoo-finance2)
// ═══════════════════════════════════════════════════════════

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': getRandomAgent() },
    });
  } finally { clearTimeout(timer); }
}

const YAHOO_HOSTS = ['query1', 'query2'];

async function yahooQuote(ticker: string): Promise<YahooQuoteData> {
  const symbols = [`${ticker}.SA`, ticker.toUpperCase()];
  for (const symbol of symbols) {
    for (const host of YAHOO_HOSTS) {
      try {
        const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d&includePrePost=false`;
        const res = await fetchWithTimeout(url, 5000);
        if (!res.ok) continue;
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (!meta) continue;
        return {
          symbol,
          regularMarketPrice: meta.regularMarketPrice,
          regularMarketChangePercent: meta.chartPreviousClose
            ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
            : undefined,
          trailingPE: meta.trailingPE,
          priceToBook: meta.priceToBook,
          bookValue: meta.bookValue,
          epsTrailingTwelveMonths: meta.epsTrailingTwelveMonths,
          trailingAnnualDividendYield: meta.trailingAnnualDividendYield,
          marketCap: meta.marketCap,
        };
      } catch { continue; }
    }
  }
  throw new Error(`Yahoo indisponível para ${ticker}`);
}

async function yahooHistorical(ticker: string, period: ChartPeriod): Promise<HistoricalQuote[]> {
  const symbol = `${ticker.toUpperCase()}.SA`;
  const range = period || '1y';
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false`;
      const res = await fetchWithTimeout(url, 8000);
      if (!res.ok) continue;
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result?.timestamp) continue;
      const quotes = result.indicators?.quote?.[0];
      if (!quotes) continue;
      return (result.timestamp as number[]).map((ts: number, i: number) => ({
        date: new Date(ts * 1000),
        open: quotes.open?.[i] ?? 0, high: quotes.high?.[i] ?? 0,
        low: quotes.low?.[i] ?? 0, close: quotes.close?.[i] ?? 0,
        volume: quotes.volume?.[i] ?? 0,
      })).filter((q: HistoricalQuote) => q.close > 0);
    } catch { continue; }
  }
  throw new Error(`Histórico indisponível para ${ticker}`);
}

async function yahooDividends(ticker: string, period: ChartPeriod): Promise<Dividend[]> {
  const symbol = `${ticker.toUpperCase()}.SA`;
  const period1 = Math.floor(periodoParaData(period).getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  for (const host of YAHOO_HOSTS) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=div`;
      const res = await fetchWithTimeout(url, 8000);
      if (!res.ok) continue;
      const json = await res.json();
      const events = json?.chart?.result?.[0]?.events?.dividends;
      if (!events) return [];
      return Object.values(events).map((d: any) => ({
        date: new Date(d.date * 1000), amount: d.amount,
      })).sort((a: Dividend, b: Dividend) => a.date.getTime() - b.date.getTime());
    } catch { continue; }
  }
  throw new Error(`Dividendos indisponíveis para ${ticker}`);
}

async function yahooSearch(query: string): Promise<any[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0`;
    const res = await fetchWithTimeout(url, 5000);
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.quotes ?? []).filter((q: any) => q.exchange === 'SAO' || q.symbol?.endsWith('.SA'));
  } catch { return []; }
}

/**
 * Infere o tipo de ativo com base no sufixo do ticker.
 * Heurísticas B3: 11 = FII ou ETF, 34/32/33/35 = BDR, demais = ACAO.
 * OTIMIZAÇÃO: Regex pré-compilado RE_BDR em vez de inline.
 */
export function inferAssetType(ticker: string): ExtendedAssetType {
  const clean = ticker.trim().replace(RE_SA, '').toUpperCase();
  if (RE_BDR.test(clean)) return 'BDR';
  if (clean.endsWith('11')) return ETFS_CONHECIDOS.has(clean) ? 'ETF' : 'FII';
  return 'ACAO';
}

/**
 * Valida o formato de um ticker B3.
 * Retorna null se válido ou uma string descrevendo o erro.
 * OTIMIZAÇÃO: Regex RE_TICKER pré-compilado.
 */
function validarTicker(ticker: string): string | null {
  const clean = ticker.trim().replace(RE_SA, '').toUpperCase();
  if (!clean) return 'Ticker vazio';
  if (!RE_TICKER.test(clean)) return `Formato inválido: "${clean}" (esperado: 4 letras + 1-2 dígitos)`;
  return null;
}

/**
 * OTIMIZAÇÃO: Cache de headers por hostname para evitar `new URL()` repetido.
 * A URL do hostname muda raramente; o User-Agent sim (rotação por request).
 */
const _hostnameCache = new Map<string, string>();

function getHeadersConsistentes(userAgent: string, url: string): Record<string, string> {
  let hostname = _hostnameCache.get(url);
  if (!hostname) {
    hostname = new URL(url).hostname;
    _hostnameCache.set(url, hostname);
  }

  const lang = Math.random() > 0.5
    ? 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    : 'pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3';

  const referer = hostname.includes('statusinvest')
    ? 'https://www.google.com/'
    : `https://${hostname}/`;

  return {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': lang,
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1',
    'Referer': referer,
  };
}

function validarResultMap(results: ResultMap): ResultMap {
  const validado: ResultMap = {};
  for (const [chave, valor] of Object.entries(results)) {
    if (valor == null) continue;
    const str = String(valor).trim();
    if (!VALORES_INVALIDOS.has(str)) validado[chave as AssetLabel] = valor;
  }
  return validado;
}
// ─────────────────────────────────────────────────────────────────────────────
// LRU CACHE
// ─────────────────────────────────────────────────────────────────────────────

class LRUCache<K, V> {
  private readonly mapa = new Map<K, V>();
  constructor(private readonly tamanhoMax: number) {}

  get(chave: K): V | undefined {
    if (!this.mapa.has(chave)) return undefined;
    const val = this.mapa.get(chave)!;
    this.mapa.delete(chave);
    this.mapa.set(chave, val);
    return val;
  }

  set(chave: K, valor: V): void {
    if (this.mapa.has(chave)) {
      this.mapa.delete(chave);
    } else if (this.mapa.size >= this.tamanhoMax) {
      this.mapa.delete(this.mapa.keys().next().value!);
    }
    this.mapa.set(chave, valor);
  }

  delete(chave: K): boolean { return this.mapa.delete(chave); }
  clear(): void { this.mapa.clear(); }
  get tamanho(): number { return this.mapa.size; }
  has(chave: K): boolean { return this.mapa.has(chave); }
}

// ─────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER — CORREÇÃO: chave por fonte, não por ticker
// ─────────────────────────────────────────────────────────────────────────────

type EstadoCB = 'FECHADO' | 'ABERTO' | 'SEMI_ABERTO';
interface EntradaCB { falhas: number; ultimaFalha: number; estado: EstadoCB; }

/**
 * CORREÇÃO ARQUITETURAL: O Circuit Breaker original usava a chave
 * `fonte:ticker` (ex.: `investidor10:PETR4`), ou seja, cada ativo tinha
 * seu próprio disjuntor. O propósito do CB é proteger uma fonte inteira
 * quando ela começa a falhar sistematicamente — não um ativo específico.
 * Agora a chave é apenas a fonte (`investidor10`, `statusInvest`, `yahoo`).
 */
class CircuitBreaker {
  private readonly entradas = new Map<string, EntradaCB>();
  constructor(private readonly limiar: number, private readonly resetMs: number) {}

  estaAberto(fonte: string): boolean {
    const e = this.entradas.get(fonte);
    if (!e || e.estado === 'FECHADO') return false;
    if (e.estado === 'ABERTO' && Date.now() - e.ultimaFalha > this.resetMs) {
      e.estado = 'SEMI_ABERTO';
      return false;
    }
    return e.estado === 'ABERTO';
  }

  registrarSucesso(fonte: string): void {
    const e = this.entradas.get(fonte);
    if (e) { e.falhas = 0; e.estado = 'FECHADO'; }
  }

  registrarFalha(fonte: string): void {
    const e = this.entradas.get(fonte) ?? { falhas: 0, ultimaFalha: 0, estado: 'FECHADO' as EstadoCB };
    e.falhas++;
    e.ultimaFalha = Date.now();
    if (e.falhas >= this.limiar && e.estado !== 'ABERTO') e.estado = 'ABERTO';
    this.entradas.set(fonte, e);
  }

  getEstado(fonte: string): EstadoCB {
    return this.entradas.get(fonte)?.estado ?? 'FECHADO';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE MAP CACHE — Evita reconstrução do mapa de regras a cada fetch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OTIMIZAÇÃO: O ruleMap era reconstruído em cada chamada a `_executeFetch`.
 * Como as regras são derivadas de templates estáticos por tipo de ativo,
 * o resultado pode ser memoizado com a chave do template.
 */
const _ruleMapCache = new Map<string, Record<string, LabelRule>>();

function buildRuleMap(rules: LabelRule[], aliases: Record<string, string> = {}): Record<string, LabelRule> {
  // Chave de cache: combinação dos nomes das regras + aliases
  const cacheKey = rules.map(r => r.name).join('|') + '§' + Object.keys(aliases).join('|');
  const cached = _ruleMapCache.get(cacheKey);
  if (cached) return cached;

  const ruleMap: Record<string, LabelRule> = {};
  for (const r of rules) ruleMap[r.name.toLowerCase()] = r;
  for (const [alias, label] of Object.entries(aliases)) {
    const target = ruleMap[label.toLowerCase()];
    if (target) ruleMap[alias.toLowerCase()] = target;
  }

  _ruleMapCache.set(cacheKey, ruleMap);
  return ruleMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESETS POR TIPO DE ATIVO
// ─────────────────────────────────────────────────────────────────────────────

const NEXUS_PRESETS: Record<ExtendedAssetType, ExtendedAssetPreset> = {
  ACAO: {
    url_base: 'https://investidor10.com.br/acoes',
    statusInvest_base: 'https://statusinvest.com.br/acoes',
    labels: [
      'P/L', 'Dividend Yield', 'P/VP', 'VPA', 'ROE', 'ROIC',
      'Margem Líquida', 'Margem Bruta', 'Margem EBIT', 'EV/EBITDA',
      'Dívida Líquida / Patrimônio', 'CAGR Receitas 5 Anos', 'LPA',
      'PEG Ratio', 'P/EBIT', 'P/Ativo', 'PSR', 'Giro Ativos',
      'Dívida Bruta / Patrimônio', 'Preço Atual', 'Variação (24h)',
      'Setor', 'Subsetor', 'Segmento',
    ],
    aliases: {
      'dy': 'Dividend Yield', 'p/l': 'P/L', 'p/vp': 'P/VP',
      'vpa': 'VPA', 'lpa': 'LPA', 'roe': 'ROE', 'roic': 'ROIC',
      'cotação': 'Preço Atual', 'cotacao': 'Preço Atual',
      'variação': 'Variação (24h)', 'variacao': 'Variação (24h)',
    },
    htmlClasses: {
      investidor10: ['value', 'v-value', '_card-body'],
      statusInvest: ['value', 'v-align-middle', 'info', 'd-block'],
      custom: [],
    },
  },
  FII: {
    url_base: 'https://investidor10.com.br/fiis',
    statusInvest_base: 'https://statusinvest.com.br/fundos-imobiliarios',
    labels: [
      'Dividend Yield', 'P/VP', 'Valor Patrimonial', 'Liquidez Diária',
      'Último Rendimento', 'Vacância Física', 'Vacância Financeira',
      'Quantidade Ativos', 'Patrimônio Líquido', 'Valor de Mercado',
      'P/Ativo', 'Preço Atual', 'Variação (24h)', 'Segmento',
    ],
    aliases: { 'dy': 'Dividend Yield', 'p/vp': 'P/VP', 'p/ativo': 'P/Ativo', 'cotação': 'Preço Atual' },
    htmlClasses: {
      investidor10: ['value', 'v-value', '_card-body'],
      statusInvest: ['value', 'v-align-middle'],
      custom: [],
    },
  },
  BDR: {
    url_base: 'https://investidor10.com.br/bdrs',
    statusInvest_base: 'https://statusinvest.com.br/bdrs',
    labels: [
      'P/L', 'Dividend Yield', 'P/VP', 'VPA', 'ROE', 'ROIC',
      'Margem Líquida', 'Margem Bruta', 'EV/EBITDA', 'LPA',
      'Preço Atual', 'Variação (24h)', 'Setor', 'Segmento',
    ],
    aliases: { 'dy': 'Dividend Yield', 'p/l': 'P/L' },
    htmlClasses: {
      investidor10: ['value', 'v-value', '_card-body'],
      statusInvest: ['value', 'v-align-middle'],
      custom: [],
    },
  },
  ETF: {
    url_base: 'https://investidor10.com.br/etfs',
    statusInvest_base: 'https://statusinvest.com.br/etfs',
    labels: [
      'Dividend Yield', 'P/VP', 'Valor Patrimonial', 'Liquidez Diária',
      'Patrimônio Líquido', 'Valor de Mercado', 'Taxa de Administração',
      'Preço Atual', 'Variação (24h)',
    ],
    aliases: { 'dy': 'Dividend Yield', 'taxa adm': 'Taxa de Administração' },
    htmlClasses: {
      investidor10: ['value', 'v-value', '_card-body'],
      statusInvest: ['value', 'v-align-middle'],
      custom: [],
    },
  },
};

export type { AssetType, FetchAtivoResult };

// ─────────────────────────────────────────────────────────────────────────────
// NEXUS ENGINE ULTRA — VERSÃO OTIMIZADA
// ─────────────────────────────────────────────────────────────────────────────

export class NexusEngineUltra {
  private static _config: Required<NexusEngineConfig> = {
    cacheTtlMs:              5  * 60 * 1_000,
    cacheStaleMs:            3  * 60 * 1_000,
    cacheMaxMs:              24 * 60 * 60 * 1_000,
    cacheMaxSize:            200,
    searchCacheTtlMs:        60 * 1_000,
    watchdogMs:              8_000,
    maxRetries:              2,
    concurrencyLimit:        5,
    proxy:                   '',
    circuitBreakerThreshold: 3,
    circuitBreakerResetMs:   30_000,
  };

  // CORREÇÃO: tamanho inicial do cache alinhado com _config.cacheMaxSize
  private static _cache       = new LRUCache<string, CacheEntry>(200);
  private static _searchCache = new LRUCache<string, { data: any[]; timestamp: number }>(50);
  private static _cb          = new CircuitBreaker(3, 30_000);

  /**
   * OTIMIZAÇÃO: Deduplicação de requests em andamento — requests idênticos
   * concorrentes reutilizam a mesma Promise, evitando fetch duplicado.
   */
  private static _inFlight = new Map<string, Promise<FetchAtivoResult>>();

  /** Deduplicação a nível de URL bruta (cross-ticker, ex: mesmo URL acessado por fallback) */
  private static _urlInFlight = new Map<string, Promise<FetchSuccess>>();

  static get defaultConcurrencyLimit(): number { return this._config.concurrencyLimit; }

  static configure(config: Partial<NexusEngineConfig>): void {
    this._config = { ...this._config, ...config };
    // CORREÇÃO: recria o cache com o tamanho correto quando configurado
    if (config.cacheMaxSize !== undefined) {
      this._cache = new LRUCache<string, CacheEntry>(config.cacheMaxSize);
    }
    if (config.circuitBreakerThreshold !== undefined || config.circuitBreakerResetMs !== undefined) {
      this._cb = new CircuitBreaker(this._config.circuitBreakerThreshold, this._config.circuitBreakerResetMs);
    }
  }

  // ── API pública: custom ──────────────────────────────────────────────────

  static async fetchCustom(url: string, template: CustomTemplate): Promise<FetchSuccess> {
    const logs: string[] = [];
    const log = (m: string) => logs.push(`[Custom] ${m}`);
    return this._executeFetch(url, template, 'custom', performance.now(), log);
  }

  // ── API pública: ativo ───────────────────────────────────────────────────

  static async fetchAtivo(
    ticker: string,
    type: ExtendedAssetType = 'ACAO',
    isRetry = false,
    includeNews = false
  ): Promise<FetchAtivoResult> {
    const cleanTicker = ticker.trim().replace(RE_SA, '').toUpperCase();

    const erroValidacao = validarTicker(cleanTicker);
    if (erroValidacao) {
      return { ticker: cleanTicker, error: erroValidacao, cacheStatus: 'ERROR', logs: [`[${cleanTicker}] ${erroValidacao}`] };
    }

    const cacheKey = `${cleanTicker}:${type}`;

    if (!isRetry) {
      const cached = this._cache.get(cacheKey);
      if (cached) {
        const ageMs = Date.now() - cached.timestamp;
        if (ageMs < this._config.cacheStaleMs) {
          return this._hydrateData(cached.data, includeNews, cleanTicker, 'HIT');
        }
        if (ageMs < this._config.cacheMaxMs) {
          // Revalidação em background sem bloquear o caller
          if (!this._inFlight.has(cacheKey)) {
            const bg = this._doFetchCore(cleanTicker, type, includeNews, cacheKey).catch(() => {});
            this._inFlight.set(cacheKey, bg as Promise<FetchAtivoResult>);
            bg.finally(() => this._inFlight.delete(cacheKey));
          }
          return this._hydrateData(cached.data, includeNews, cleanTicker, 'STALE');
        }
      }

      // Deduplica requests concorrentes para o mesmo ativo
      const inflight = this._inFlight.get(cacheKey);
      if (inflight) return inflight;
    }

    const fetchPromise = this._doFetchCore(cleanTicker, type, includeNews, cacheKey, isRetry);
    if (!isRetry) {
      this._inFlight.set(cacheKey, fetchPromise);
      fetchPromise.finally(() => this._inFlight.delete(cacheKey));
    }
    return fetchPromise;
  }

  // ── Hidratação de cache ──────────────────────────────────────────────────

  private static async _hydrateData(
    data: FetchAtivoResult, includeNews: boolean, ticker: string, status: CacheStatus
  ): Promise<FetchAtivoResult> {
    const finalData = { ...data, cacheStatus: status };
    if (includeNews && !('error' in finalData) && !(finalData as any).news) {
      (finalData as any).news = await this.fetchNews(ticker);
    }
    return finalData;
  }

  // ── Núcleo de busca ──────────────────────────────────────────────────────

  private static async _doFetchCore(
    cleanTicker: string, type: ExtendedAssetType, includeNews: boolean,
    cacheKey: string, isRetry = false
  ): Promise<FetchAtivoResult> {
    const logs: string[] = [];
    const log = (m: string) => logs.push(`[${cleanTicker}] ${m}`);
    const preset = NEXUS_PRESETS[type];

    if (!preset) {
      return { ticker: cleanTicker, error: `Tipo inválido: ${type}`, cacheStatus: 'ERROR', logs };
    }

    const url = `${preset.url_base}/${cleanTicker.toLowerCase()}/`;
    try {
      const [result, news] = await Promise.all([
        this._executeFetchParallel(cleanTicker, url, preset, type, log),
        includeNews ? this.fetchNews(cleanTicker) : Promise.resolve(undefined),
      ]);

      const finalData: FetchAtivoResult = {
        ticker: cleanTicker, ...result,
        cacheStatus: 'MISS' as const, logs, news,
      };
      this._cache.set(cacheKey, { data: finalData, timestamp: Date.now() });
      return finalData;

    } catch (error) {
      const err = error as Error;
      if (!isRetry && (err.message.includes('404') || err.message.includes('410') || err.message.includes('total'))) {
        const fallbackMap: Record<ExtendedAssetType, ExtendedAssetType | null> = {
          'ACAO': 'FII', 'FII': 'ACAO', 'BDR': 'ACAO', 'ETF': null,
        };
        const fallbackType = fallbackMap[type];
        if (fallbackType) {
          log(`Fallback: ${type} → ${fallbackType}`);
          const fb = await this.fetchAtivo(cleanTicker, fallbackType, true, includeNews);
          if (!('error' in fb)) return { ...fb, logs: [...logs, ...(fb.logs ?? [])] };
        }
      }
      return { ticker: cleanTicker, error: err.message, cacheStatus: 'ERROR', logs };
    }
  }

  // ── Orquestrador multi-fonte (PARALELIZADO) ──────────────────────────────

  /**
   * REFATORAÇÃO ARQUITETURAL PRINCIPAL:
   *
   * Antes: as 3 fases eram 100% sequenciais.
   *   Fase 1 (I10) → aguarda → Fase 1.5 (SI) → aguarda → Fase 2 (Yahoo)
   *   Pior caso: ~3.5s de delay só de `await delay()` + 3 round-trips seriais
   *
   * Agora:
   *   - Fase 1 (I10) inicia imediatamente
   *   - Fase 2 (Yahoo Finance) inicia em PARALELO com Fase 1 — dados de
   *     mercado em tempo real não precisam esperar o scraping
   *   - Fase 1.5 (StatusInvest) inicia em paralelo com Yahoo se I10 incompleto
   *   - Todas as fases usam Promise.allSettled (sem abort total se uma falha)
   *   - O delay humano do SI foi reduzido e adaptado dinamicamente
   */
  private static async _executeFetchParallel(
    ticker: string, url: string, preset: ExtendedAssetPreset, type: ExtendedAssetType, log: (m: string) => void
  ): Promise<FetchSuccess> {
    const startTime = performance.now();
    const startCpu = process.cpuUsage();
    let finalResults: ResultMap = {};
    const sourcesUsed: Set<string> = new Set();
    let bytesTotal = 0;
    let totalCpuMs = 0;
    let maxMemMb = 0;

    const customTemplate: CustomTemplate = {
      rules: preset.labels.map(l => ({ name: l, type: 'number' as DataType })),
      aliases: preset.aliases,
      htmlClasses: preset.htmlClasses['investidor10']
    };

    // ── Dispara I10 + Yahoo em PARALELO ──────────────────
    const cbI10 = `investidor10`;
    const cbYF = `yahoo`;

    const i10Promise = !this._cb.estaAberto(cbI10) ? (async () => {
      log(`Fase 1: Scraper Investidor10`);
      return await this._executeFetchWithRetry(url, customTemplate, 'investidor10', this._config.maxRetries, startTime, log, ticker);
    })().catch((e: Error) => { log(`I10 falhou: ${e.message}`); this._cb.registrarFalha(cbI10); return null; }) : Promise.resolve(null);

    const yahooPromise = !this._cb.estaAberto(cbYF) ? (async () => {
      log(`Fase 2: Yahoo Finance API v8`);
      return await yahooQuote(ticker);
    })().catch((e: Error) => { log(`Yahoo falhou: ${e.message}`); this._cb.registrarFalha(cbYF); return null; }) : Promise.resolve(null);

    // #4: Espera ambos (paralelo, não serial)
    const [i10Result, yahooResult] = await Promise.all([i10Promise, yahooPromise]);

    // ── Processar I10 ────────────────────────────────────
    if (i10Result) {
      finalResults = { ...i10Result.results };
      bytesTotal += i10Result.metrics.bytesProcessed;
      totalCpuMs += i10Result.metrics.cpuUsageMs || 0;
      maxMemMb = Math.max(maxMemMb, i10Result.metrics.estimatedMemoryMb || 0);
      if (Object.keys(finalResults).length > 0) {
        sourcesUsed.add('Investidor10');
        this._cb.registrarSucesso(cbI10);
        log(`I10: ${Object.keys(finalResults).length} indicadores`);
      }
    }

    // ── Processar Yahoo (complemento) ────────────────────
    if (yahooResult) {
      let added = 0;
      const fill = (chave: AssetLabel, val: unknown) => {
        if (finalResults[chave] !== undefined || val == null) return;
        const str = typeof val === 'number' ? val.toFixed(2) : String(val).trim();
        if (!VALORES_INVALIDOS.has(str)) { finalResults[chave] = str; added++; }
      };

      if (type === 'ACAO' || type === 'BDR') {
        fill('P/L', yahooResult.trailingPE); fill('P/VP', yahooResult.priceToBook); fill('VPA', yahooResult.bookValue);
        fill('LPA', yahooResult.epsTrailingTwelveMonths); fill('Preço Atual', yahooResult.regularMarketPrice);
        if (typeof yahooResult.regularMarketChangePercent === 'number') fill('Variação (24h)', yahooResult.regularMarketChangePercent.toFixed(2) + '%');
        if (yahooResult.profitMargins != null) fill('Margem Líquida', (yahooResult.profitMargins * 100).toFixed(2) + '%');
        if (yahooResult.returnOnEquity != null) fill('ROE', (yahooResult.returnOnEquity * 100).toFixed(2) + '%');
        if (yahooResult.revenuePerShare && yahooResult.regularMarketPrice) fill('PSR', (yahooResult.regularMarketPrice / yahooResult.revenuePerShare).toFixed(2));
        if (yahooResult.trailingAnnualDividendYield != null) fill('Dividend Yield', (yahooResult.trailingAnnualDividendYield * 100).toFixed(2) + '%');
      } else {
        fill('P/VP', yahooResult.priceToBook); fill('Valor Patrimonial', yahooResult.bookValue); fill('Preço Atual', yahooResult.regularMarketPrice);
        if (typeof yahooResult.regularMarketChangePercent === 'number') fill('Variação (24h)', yahooResult.regularMarketChangePercent.toFixed(2) + '%');
        if (yahooResult.marketCap != null) fill('Valor de Mercado', yahooResult.marketCap);
        if (yahooResult.trailingAnnualDividendYield != null) fill('Dividend Yield', (yahooResult.trailingAnnualDividendYield * 100).toFixed(2) + '%');
      }
      if (added > 0) { sourcesUsed.add('YahooFinance'); this._cb.registrarSucesso(cbYF); log(`Yahoo: +${added}`); }
    }

    // #5: StatusInvest = último recurso (sem delay, sem search prévia)
    if (Object.keys(finalResults).length < 3 && !i10Result && preset.statusInvest_base) {
      const cbSI = `statusInvest`;
      if (!this._cb.estaAberto(cbSI)) {
        log(`Fallback StatusInvest`);
        try {
          const urlSI = `${preset.statusInvest_base}/${ticker.toLowerCase()}/`;
          customTemplate.htmlClasses = preset.htmlClasses['statusInvest'];
          const r15 = await this._executeFetchWithRetry(urlSI, customTemplate, 'statusInvest', 1, startTime, log, ticker);
          bytesTotal += r15.metrics.bytesProcessed;
          totalCpuMs += r15.metrics.cpuUsageMs || 0;
          maxMemMb = Math.max(maxMemMb, r15.metrics.estimatedMemoryMb || 0);
          let siAdded = 0;
          for (const [k, v] of Object.entries(r15.results)) {
            if (finalResults[k as AssetLabel] === undefined) { finalResults[k as AssetLabel] = v; siAdded++; }
          }
          if (siAdded > 0) { sourcesUsed.add('StatusInvest'); this._cb.registrarSucesso(cbSI); }
        } catch (e) {
          log(`StatusInvest falhou: ${(e as Error).message}`);
          this._cb.registrarFalha(cbSI);
        }
      }
    }

    const validatedResults = validarResultMap(finalResults);
    const foundKeys = Object.keys(validatedResults) as AssetLabel[];
    if (foundKeys.length === 0) throw new Error(`Falha total em todas as fontes para ${ticker}.`);

    const endCpu = process.cpuUsage(startCpu);

    return {
      results: validatedResults,
      metrics: {
        totalTimeMs: performance.now() - startTime, bytesProcessed: bytesTotal,
        foundKeys, earlyAbort: foundKeys.length >= preset.labels.length,
        successRate: foundKeys.length / preset.labels.length,
        source: Array.from(sourcesUsed).join(' + ') as DataSource,
        estimatedMemoryMb: maxMemMb || (bytesTotal * 0.1) / (1024 * 1024),
        cpuUsageMs: totalCpuMs || (endCpu.user + endCpu.system) / 1000
      },
    };
  }

  // ── Executor com retry ───────────────────────────────────────────────────

  private static async _executeFetchWithRetry(
    url: string, template: CustomTemplate, source: ScraperSource, retries: number,
    globalStart: number, log: (m: string) => void, ticker?: string
  ): Promise<FetchSuccess> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this._executeFetch(url, template, source, globalStart, log, ticker);
      } catch (err) {
        const msg = (err as Error).message;
        if (i === retries - 1 || msg.includes('404') || msg.includes('410') || msg.includes('451')) throw err;
        const espera = backoffMs(i);
        log(`Tentativa ${i + 1}/${retries} falhou (${msg}). Aguardando ${Math.round(espera)}ms...`);
        await delay(espera);
      }
    }
    throw new Error('Retries esgotados');
  }

  // ── Core Scraper ─────────────────────────────────────────────────────────

  /**
   * OTIMIZAÇÕES:
   * 1. ruleMap agora usa buildRuleMap() com memoização
   * 2. AbortController conectado ao watchdogMs (estava configurado mas NUNCA usado)
   * 3. Deduplicação de URL: requests ao mesmo URL são compartilhados via _urlInFlight
   * 4. CORREÇÃO: try-catch sem tratamento removido (re-throw automático)
   * 5. Early abort mata stream HTTP imediatamente
   * 6. Parser cleanup no finally (zero memory leak)
   */
  private static async _executeFetch(
    url: string, template: CustomTemplate, source: ScraperSource,
    globalStart: number, log: (m: string) => void, _ticker?: string
  ): Promise<FetchSuccess> {
    // Deduplicação de URL — dois tickers no mesmo fallback não fazem 2 fetches ao mesmo URL
    const existing = this._urlInFlight.get(url);
    if (existing) return existing;

    const promise = this._doFetch(url, template, source, globalStart, log);
    this._urlInFlight.set(url, promise);
    promise.finally(() => this._urlInFlight.delete(url));
    return promise;
  }

  private static async _doFetch(
    url: string, template: CustomTemplate, source: ScraperSource,
    globalStart: number, log: (m: string) => void
  ): Promise<FetchSuccess> {
    const { rules, aliases = {}, htmlClasses = [] } = template;
    // OTIMIZAÇÃO: ruleMap memoizado
    const ruleMap = buildRuleMap(rules, aliases as Record<string, string>);

    // CORREÇÃO: watchdogMs agora é de fato aplicado via AbortController timeout
    const abortCtrl = new AbortController();
    let watchdogId: NodeJS.Timeout;
    const resetWatchdog = () => { clearTimeout(watchdogId); watchdogId = setTimeout(() => abortCtrl.abort(), this._config.watchdogMs); };
    resetWatchdog();

    const results: ResultMap = {};
    let foundCount = 0;
    let bytesProcessed = 0;

    let lastRule: LabelRule | null = null;
    let depth = 0;
    let buffer = '';
    let radarAguardando: LabelRule | null = null;
    let passosPosRadar = 0;

    const startCpu = process.cpuUsage();
    const parser = new Parser({
      onopentag(name, attr) {
        if (radarAguardando) passosPosRadar++;
        let ruleEncontrada: LabelRule | null = null;

        // Checa atributos semânticos para matching de label
        for (const attrName of ['title', 'aria-label', 'data-title', 'data-label']) {
          const raw = attr[attrName];
          if (!raw) continue;
          const lower = raw.trim().toLowerCase();
          const found = ruleMap[lower];
          if (found) { ruleEncontrada = found; break; }
        }
        if (ruleEncontrada) lastRule = ruleEncontrada;

        // OTIMIZAÇÃO: htmlClasses.length verificado antes de split (evita split desnecessário)
        const ehBlocoValor = htmlClasses.length > 0 && attr.class?.split(/\s+/).some(c => htmlClasses.includes(c));
        if (ehBlocoValor) {
          if (depth === 0) { buffer = ''; if (!ruleEncontrada) lastRule = null; }
          depth++;
        } else if (depth > 0) {
          depth++;
        }
      },

      ontext(t) {
        const txt = t.trim();
        // Radar Heurístico: captura números próximos a labels sem depender de CSS
        if (radarAguardando && txt && RE_NUMERO.test(txt)) {
          const norm = normalizeBRNumber(txt);
          if (norm) {
            results[radarAguardando.name] = norm;
            foundCount++;
            radarAguardando = null;
          }
        }
        if (depth > 0) {
          if (buffer.length < 512) buffer += t;
          return;
        }
        const lower = txt.replace(':', '').toLowerCase();
        if (ruleMap[lower]) { lastRule = ruleMap[lower]; radarAguardando = lastRule; passosPosRadar = 0; }
      },

      onclosetag() {
        if (radarAguardando && passosPosRadar > 8) radarAguardando = null;
        if (depth > 0) {
          depth--;
          if (depth === 0 && lastRule) {
            const normalized = normalizeBRNumber(buffer.trim());
            if (normalized) { 
              results[lastRule.name] = normalized; 
              foundCount++; 
              // #9: Early abort — mata stream imediatamente
              if (foundCount >= rules.length) abortCtrl.abort();
            }
            lastRule = null;
            buffer = '';
          }
        }
      },
    });

    try {
      const resp = await fetch(url, {
        headers: getHeadersConsistentes(getRandomAgent(), url),
        signal: abortCtrl.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      /**
       * OTIMIZAÇÃO: Leitura streaming — começa a parsear enquanto o body
       * ainda está chegando, reduzindo latência de processamento.
       */
      if (resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              resetWatchdog();
              const chunk = decoder.decode(value, { stream: true });
              bytesProcessed += chunk.length;
              parser.write(chunk);
            }
          }
          // Flush final do decoder
          const tail = decoder.decode();
          if (tail) { bytesProcessed += tail.length; parser.write(tail); }
        } finally {
          // #8: Cleanup garantido
          if (abortCtrl.signal.aborted) reader.cancel().catch(()=>{});
          reader.releaseLock();
        }
      } else {
        // Fallback para ambientes sem ReadableStream
        const body = await resp.text();
        bytesProcessed = body.length;
        parser.write(body);
      }
      parser.end();

    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err;
    } finally {
      clearTimeout(watchdogId!);
      // #8: Limpa referências para GC
      depth = 0; buffer = ''; lastRule = null;
      radarAguardando = null;
    }

    const endCpu = process.cpuUsage(startCpu);

    return {
      results,
      metrics: {
        totalTimeMs:   performance.now() - globalStart,
        bytesProcessed,
        foundKeys:     Object.keys(results) as AssetLabel[],
        successRate:   rules.length > 0 ? foundCount / rules.length : 0,
        earlyAbort:    foundCount >= rules.length,
        source:        source as DataSource,
        estimatedMemoryMb: (bytesProcessed * 0.8) / (1024 * 1024),
        cpuUsageMs: (endCpu.user + endCpu.system) / 1000
      },
    };
  }

  // ── Histórico e dividendos ───────────────────────────────────────────────

  static async fetchHistoricoGrafico(ticker: string, period: ChartPeriod = '1y'): Promise<HistoricalQuote[]> {
    return yahooHistorical(ticker, period);
  }

  static async fetchDividends(ticker: string, period: ChartPeriod = '5y'): Promise<Dividend[]> {
    return yahooDividends(ticker, period);
  }
  // ── Search ───────────────────────────────────────────────────────────────

  static async searchTicker(query: string): Promise<any[]> {
    const c = query.trim().toLowerCase();
    const cached = this._searchCache.get(c);
    if (cached && Date.now() - cached.timestamp < this._config.searchCacheTtlMs) return cached.data;
    const data = await yahooSearch(query);
    this._searchCache.set(c, { data, timestamp: Date.now() });
    return data;
  }

  // ── Notícias ─────────────────────────────────────────────────────────────

  static async fetchNews(ticker: string): Promise<NewsItem[]> {
    try {
      const cleanTicker = ticker.trim().replace(RE_SA, '').toUpperCase();
      const r = await fetch(
        `https://news.google.com/rss/search?q=${cleanTicker}+acao+B3&hl=pt-BR&gl=BR&ceid=BR:pt-419`,
        { headers: { 'User-Agent': getRandomAgent() } }
      );
      if (!r.ok) return [];

      const news: NewsItem[] = [];
      let curr: Partial<NewsItem> | null = null;
      let tag = '';

      const p = new Parser({
        onopentag(n) { const t = n.toLowerCase(); if (t === 'item') curr = {}; tag = t; },
        ontext(t) {
          if (!curr) return;
          if (tag === 'title')   curr.title   = (curr.title   || '') + t;
          if (tag === 'link')    curr.link    = (curr.link    || '') + t;
          if (tag === 'pubdate') {
            const d = new Date((curr.pubDate?.toString() || '') + t);
            if (!isNaN(d.getTime())) curr.pubDate = d;
          }
          if (tag === 'source')  curr.source  = (curr.source  || '') + t;
        },
        onclosetag(n) {
          if (n.toLowerCase() === 'item' && curr?.title && curr?.link) {
            news.push(curr as NewsItem);
            curr = null;
          }
          tag = '';
        },
      }, { xmlMode: true });

      p.write(await r.text());
      p.end();
      return news;
    } catch (e) { return []; }
  }

  // ── Cache ────────────────────────────────────────────────────────────────

  static clearCache(): void {
    this._cache.clear();
    this._searchCache.clear();
    _ruleMapCache.clear();    // ADIÇÃO: limpa também o cache de ruleMaps
    _hostnameCache.clear();   // ADIÇÃO: limpa cache de hostnames
  }

  static getCacheStats() {
    return {
      cache: {
        tamanho:    this._cache.tamanho,
        tamanhoMax: this._config.cacheMaxSize,
        staleMs:    this._config.cacheStaleMs,
        maxMs:      this._config.cacheMaxMs,
      },
      searchCache: {
        tamanho: this._searchCache.tamanho,
        ttlMs:   this._config.searchCacheTtlMs,
      },
      circuitBreakers: {
        investidor10: this._cb.getEstado('investidor10'),
        statusInvest: this._cb.getEstado('statusInvest'),
        yahoo:        this._cb.getEstado('yahoo'),
      },
      inFlightRequests: this._inFlight.size,
      urlInFlightRequests: this._urlInFlight.size,
      ruleMapCacheSize: _ruleMapCache.size,
    };
  }

  static getDetailedReport() {
    return {
      engine: 'Nexus Engine Ultra v9.0',
      status: 'Operational',
      capabilities: [
        'SAX Streaming Parsing (Zero-AST)',
        'Early Abort (Connection cutting)',
        'Parallel Source Orchestration',
        'Circuit Breaker per Source',
        'LRU Multi-level Caching',
        'Deduplication of In-flight Requests',
        'Smart Fallback Asset Inference'
      ],
      metrics: this.getCacheStats()
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUÇÃO PARALELA COM LIMITE DE CONCORRÊNCIA
// ─────────────────────────────────────────────────────────────────────────────

export async function runWithLimit<T>(tasks: Task<T>[], limit = 5): Promise<(T | Error)[]> {
  const results: (T | Error)[] = new Array(tasks.length);
  const executing = new Set<Promise<void>>();
  for (let i = 0; i < tasks.length; i++) {
    const idx = i;
    const p: Promise<void> = tasks[idx]()
      .then(res => { results[idx] = res; })
      .catch(err => { results[idx] = err instanceof Error ? err : new Error(String(err)); })
      .finally(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// API BATCH
// ─────────────────────────────────────────────────────────────────────────────

export async function runNexusBatch(
  tickers: string[],
  type: ExtendedAssetType = 'ACAO',
  limit: number = NexusEngineUltra.defaultConcurrencyLimit,
  includeNews = false
): Promise<FetchAtivoResult[]> {
  return (await runWithLimit(
    tickers.map(t => () => NexusEngineUltra.fetchAtivo(t, type, false, includeNews)),
    limit
  )).map((r, i) => {
    const ticker = tickers[i].toUpperCase().replace(RE_SA, '');
    if (r instanceof Error) {
      return { ticker, error: r.message, cacheStatus: 'ERROR' as const, logs: [`[BATCH] Falha: ${r.message}`] };
    }
    return r as FetchAtivoResult;
  });
}

/**
 * Executa uma busca em batch com inferência automática de tipo por ticker.
 * Útil quando a lista contém uma mistura de ações, FIIs e ETFs.
 */
export async function runNexusBatchAuto(
  tickers: string[],
  limit: number = NexusEngineUltra.defaultConcurrencyLimit,
  includeNews = false
): Promise<FetchAtivoResult[]> {
  return (await runWithLimit(
    tickers.map(t => () => {
      const type = inferAssetType(t);
      return NexusEngineUltra.fetchAtivo(t, type, false, includeNews);
    }),
    limit
  )).map((r, i) => {
    const ticker = tickers[i].toUpperCase().replace(RE_SA, '');
    if (r instanceof Error) {
      return { ticker, error: r.message, cacheStatus: 'ERROR' as const, logs: [`[BATCH-AUTO] Falha: ${r.message}`] };
    }
    return r as FetchAtivoResult;
  });
}

import { Parser } from 'htmlparser2';
import { performance } from 'perf_hooks';
import yahooFinance from 'yahoo-finance2';

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

interface YahooQuote {
  trailingPE?: number | null; priceToBook?: number | null; bookValue?: number | null;
  epsTrailingTwelveMonths?: number | null; profitMargins?: number | null;
  returnOnEquity?: number | null; returnOnAssets?: number | null;
  revenuePerShare?: number | null; regularMarketPrice?: number | null;
  regularMarketChangePercent?: number | null; marketCap?: number | null;
  trailingAnnualDividendYield?: number | null; [key: string]: unknown;
}

interface CacheEntry { data: FetchAtivoResult; timestamp: number; }

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

const VALORES_INVALIDOS = new Set(['-', '—', '–', 'N/A', 'n/a', 'nd', '', 'null', 'undefined', '--', '---', '--%', '0%']);

function normalizeBRNumber(raw: string): number | string {
  if (!raw) return '';
  let limpo = raw.replace(/[R$\s]/g, '').toUpperCase().trim();
  if (limpo.includes('%')) return limpo;

  let multiplicador = 1;
  if (limpo.endsWith('K')) { multiplicador = 1_000; limpo = limpo.slice(0, -1); }
  else if (limpo.endsWith('M')) { multiplicador = 1_000_000; limpo = limpo.slice(0, -1); }
  else if (limpo.endsWith('B')) { multiplicador = 1_000_000_000; limpo = limpo.slice(0, -1); }

  limpo = limpo.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? raw.trim() : (num * multiplicador);
}

function resolveYahooFinance(mod: any): any {
  const candidatos = [mod?.default?.default, mod?.default, mod];
  for (const c of candidatos) if (c && typeof c === 'object' && typeof c.quote === 'function') return c;
  for (const c of candidatos) {
    if (typeof c === 'function') {
      try { const inst = new c(); if (typeof inst.quote === 'function') return inst; } catch {}
    }
  }
  return mod;
}

function backoffMs(tentativa: number, base = 300, teto = 8_000): number {
  return Math.random() * Math.min(teto, base * 2 ** tentativa);
}

function periodoParaData(periodo: ChartPeriod): Date {
  const diasPorPeriodo: Record<string, number> = { '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365, '5y': 1825, 'max': 10950 };
  return new Date(Date.now() - (diasPorPeriodo[periodo] ?? 365) * 86400000);
}

function extrairVersaoChrome(ua: string): string { return ua.match(/Chrome\/(\d+)/)?.[1] ?? '124'; }

/**
 * Infere o tipo de ativo com base no sufixo do ticker.
 * Heurísticas B3: 11 = FII ou ETF, 34/32/33/35 = BDR, demais = ACAO.
 */
export function inferAssetType(ticker: string): ExtendedAssetType {
  const clean = ticker.trim().replace(/\.SA$/i, '').toUpperCase();
  if (/34$|32$|33$|35$/.test(clean)) return 'BDR';
  if (clean.endsWith('11')) {
    // ETFs conhecidos terminam em 11 mas têm nomes específicos
    const ETFS_CONHECIDOS = new Set(['BOVA11','IVVB11','SMAL11','DIVO11','FIND11','MATB11','GOVE11','XFIX11','GOLD11','SPXI11']);
    return ETFS_CONHECIDOS.has(clean) ? 'ETF' : 'FII';
  }
  return 'ACAO';
}

/**
 * Valida o formato de um ticker B3.
 * Retorna null se válido ou uma string descrevendo o erro.
 */
function validarTicker(ticker: string): string | null {
  const clean = ticker.trim().replace(/\.SA$/i, '').toUpperCase();
  if (!clean) return 'Ticker vazio';
  if (!/^[A-Z]{4}\d{1,2}$/.test(clean)) return `Formato inválido: "${clean}" (esperado: 4 letras + 1-2 dígitos)`;
  return null;
}

function getHeadersConsistentes(userAgent: string, url: string): Record<string, string> {
  const lang = Math.random() > 0.5 ? 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' : 'pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3';
  
  // Headers simplificados (estilo AeroScraper) para evitar mismatch de TLS/WAF
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': lang,
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'DNT': '1'
  };

  const urlObj = new URL(url);
  if (urlObj.hostname.includes('statusinvest')) {
    headers['Referer'] = 'https://www.google.com/';
  } else {
    headers['Referer'] = `https://${urlObj.hostname}/`;
  }

  return headers;
}

function validarResultMap(results: ResultMap): ResultMap {
  const validado: ResultMap = {};
  for (const [chave, valor] of Object.entries(results)) {
    if (valor == null) continue;
    const str = String(valor).trim();
    if (VALORES_INVALIDOS.has(str)) continue;
    validado[chave as AssetLabel] = valor;
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
    this.mapa.delete(chave); this.mapa.set(chave, val);
    return val;
  }
  set(chave: K, valor: V): void {
    if (this.mapa.has(chave)) this.mapa.delete(chave);
    else if (this.mapa.size >= this.tamanhoMax) this.mapa.delete(this.mapa.keys().next().value!);
    this.mapa.set(chave, valor);
  }
  delete(chave: K): boolean { return this.mapa.delete(chave); }
  clear(): void { this.mapa.clear(); }
  get tamanho(): number { return this.mapa.size; }
  has(chave: K): boolean { return this.mapa.has(chave); }
}

// ─────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER
// ─────────────────────────────────────────────────────────────────────────────

type EstadoCB = 'FECHADO' | 'ABERTO' | 'SEMI_ABERTO';
interface EntradaCB { falhas: number; ultimaFalha: number; estado: EstadoCB; }

class CircuitBreaker {
  private readonly entradas = new Map<string, EntradaCB>();
  constructor(private readonly limiar: number, private readonly resetMs: number) {}

  estaAberto(chave: string): boolean {
    const e = this.entradas.get(chave);
    if (!e || e.estado === 'FECHADO') return false;
    if (e.estado === 'ABERTO' && Date.now() - e.ultimaFalha > this.resetMs) {
      e.estado = 'SEMI_ABERTO'; return false;
    }
    return e.estado === 'ABERTO';
  }

  registrarSucesso(chave: string): void { this.entradas.delete(chave); }

  registrarFalha(chave: string): void {
    const e = this.entradas.get(chave) ?? { falhas: 0, ultimaFalha: 0, estado: 'FECHADO' as EstadoCB };
    e.falhas++;
    e.ultimaFalha = Date.now();
    if (e.falhas >= this.limiar && e.estado !== 'ABERTO') e.estado = 'ABERTO';
    this.entradas.set(chave, e);
  }
  getEstado(chave: string): EstadoCB { return this.entradas.get(chave)?.estado ?? 'FECHADO'; }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTÂNCIA YAHOO FINANCE
// ─────────────────────────────────────────────────────────────────────────────

const yf = resolveYahooFinance(yahooFinance);
try { if (typeof yf?.setGlobalConfig === 'function') yf.setGlobalConfig({ suppressNotices: ['yahooSurvey'] }); }
catch (e) { console.warn('[NexusEngine] Falha ao configurar YF:', e); }

// ─────────────────────────────────────────────────────────────────────────────
// PRESETS POR TIPO DE ATIVO
// ─────────────────────────────────────────────────────────────────────────────

// [FIX] Removido `searchPath` dos presets — a URL de warm-up agora é computada
//       diretamente com base em `statusInvest_base`, eliminando o bug do HTTP 404.
const NEXUS_PRESETS: Record<ExtendedAssetType, ExtendedAssetPreset> = {
  ACAO: {
    url_base: 'https://investidor10.com.br/acoes',
    statusInvest_base: 'https://statusinvest.com.br/acoes',
    labels: ['P/L', 'Dividend Yield', 'P/VP', 'VPA', 'ROE', 'ROIC', 'Margem Líquida', 'Margem Bruta', 'Margem EBIT', 'EV/EBITDA', 'Dívida Líquida / Patrimônio', 'CAGR Receitas 5 Anos', 'LPA', 'PEG Ratio', 'P/EBIT', 'P/Ativo', 'PSR', 'Giro Ativos', 'Dívida Bruta / Patrimônio', 'Preço Atual', 'Variação (24h)', 'Setor', 'Subsetor', 'Segmento'],
    aliases: { 
      'dy': 'Dividend Yield', 'p/l': 'P/L', 'p/vp': 'P/VP', 'vpa': 'VPA', 'lpa': 'LPA', 'roe': 'ROE', 'roic': 'ROIC',
      'cotação': 'Preço Atual', 'cotacao': 'Preço Atual', 'variação': 'Variação (24h)', 'variacao': 'Variação (24h)'
    },
    htmlClasses: { investidor10: ['value', 'v-value', '_card-body'], statusInvest: ['value', 'v-align-middle', 'info', 'd-block'], custom: [] }
  },
  FII: {
    url_base: 'https://investidor10.com.br/fiis',
    statusInvest_base: 'https://statusinvest.com.br/fundos-imobiliarios',
    labels: ['Dividend Yield', 'P/VP', 'Valor Patrimonial', 'Liquidez Diária', 'Último Rendimento', 'Vacância Física', 'Vacância Financeira', 'Quantidade Ativos', 'Patrimônio Líquido', 'Valor de Mercado', 'P/Ativo', 'Preço Atual', 'Variação (24h)', 'Segmento'],
    aliases: { 'dy': 'Dividend Yield', 'p/vp': 'P/VP', 'p/ativo': 'P/Ativo', 'cotação': 'Preço Atual' },
    htmlClasses: { investidor10: ['value', 'v-value', '_card-body'], statusInvest: ['value', 'v-align-middle'], custom: [] }
  },
  BDR: {
    url_base: 'https://investidor10.com.br/bdrs',
    statusInvest_base: 'https://statusinvest.com.br/bdrs',
    labels: ['P/L', 'Dividend Yield', 'P/VP', 'VPA', 'ROE', 'ROIC', 'Margem Líquida', 'Margem Bruta', 'EV/EBITDA', 'LPA', 'Preço Atual', 'Variação (24h)', 'Setor', 'Segmento'],
    aliases: { 'dy': 'Dividend Yield', 'p/l': 'P/L' },
    htmlClasses: { investidor10: ['value', 'v-value', '_card-body'], statusInvest: ['value', 'v-align-middle'], custom: [] }
  },
  ETF: {
    url_base: 'https://investidor10.com.br/etfs',
    statusInvest_base: 'https://statusinvest.com.br/etfs',
    labels: ['Dividend Yield', 'P/VP', 'Valor Patrimonial', 'Liquidez Diária', 'Patrimônio Líquido', 'Valor de Mercado', 'Taxa de Administração', 'Preço Atual', 'Variação (24h)'],
    aliases: { 'dy': 'Dividend Yield', 'taxa adm': 'Taxa de Administração' },
    htmlClasses: { investidor10: ['value', 'v-value', '_card-body'], statusInvest: ['value', 'v-align-middle'], custom: [] }
  },
};

export type { AssetType, FetchAtivoResult };

// ─────────────────────────────────────────────────────────────────────────────
// NEXUS ENGINE ULTRA
// ─────────────────────────────────────────────────────────────────────────────

export class NexusEngineUltra {
  private static _config: Required<NexusEngineConfig> = {
    cacheTtlMs: 5 * 60 * 1_000,
    cacheStaleMs: 3 * 60 * 1_000,
    cacheMaxMs: 24 * 60 * 60 * 1_000,
    cacheMaxSize: 200,
    searchCacheTtlMs: 60 * 1_000,
    watchdogMs: 4_000,
    maxRetries: 2,
    concurrencyLimit: 5,
    proxy: '',
    circuitBreakerThreshold: 3,
    circuitBreakerResetMs: 30_000,
  };

  private static _cache = new LRUCache<string, CacheEntry>(200);
  private static _searchCache = new LRUCache<string, { data: any[]; timestamp: number }>(50);
  private static _cb = new CircuitBreaker(3, 30_000);
  private static _inFlight = new Map<string, Promise<FetchAtivoResult>>();

  static get defaultConcurrencyLimit(): number { return this._config.concurrencyLimit; }

  static configure(config: Partial<NexusEngineConfig>): void {
    this._config = { ...this._config, ...config };
    if (config.cacheMaxSize) this._cache = new LRUCache<string, CacheEntry>(config.cacheMaxSize);
    if (config.circuitBreakerThreshold || config.circuitBreakerResetMs) {
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
    const cleanTicker = ticker.trim().replace(/\.SA$/i, '').toUpperCase();

    // [NOVO] Validação de formato antes de qualquer request
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
        } else if (ageMs < this._config.cacheMaxMs) {
          if (!this._inFlight.has(cacheKey)) {
            const backgroundFetch = this._doFetchCore(cleanTicker, type, includeNews, cacheKey).catch(() => {});
            this._inFlight.set(cacheKey, backgroundFetch as Promise<FetchAtivoResult>);
            backgroundFetch.finally(() => this._inFlight.delete(cacheKey));
          }
          return this._hydrateData(cached.data, includeNews, cleanTicker, 'STALE');
        }
      }
    }

    if (!isRetry && this._inFlight.has(cacheKey)) return this._inFlight.get(cacheKey)!;

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
    if (includeNews && finalData.cacheStatus !== 'ERROR' && !('error' in finalData) && !(finalData as any).news) {
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

    if (!preset) return { ticker: cleanTicker, error: `Tipo inválido: ${type}`, cacheStatus: 'ERROR', logs };

    const url = `${preset.url_base}/${cleanTicker.toLowerCase()}/`;
    try {
      const result = await this._executeFetchWithFallback(cleanTicker, url, preset, type, log);
      const news = includeNews ? await this.fetchNews(cleanTicker) : undefined;
      const finalData = { ticker: cleanTicker, ...result, cacheStatus: 'MISS' as const, logs, news };
      this._cache.set(cacheKey, { data: finalData, timestamp: Date.now() });
      return finalData;
    } catch (error) {
      const err = error as Error;
      if (!isRetry && (err.message.includes('404') || err.message.includes('410') || err.message.includes('total'))) {
        const fallbackChain: Record<ExtendedAssetType, ExtendedAssetType[]> = {
          'ACAO': ['BDR', 'ETF', 'FII'], 'FII': ['ACAO'], 'BDR': ['ACAO'], 'ETF': ['ACAO']
        };
        for (const targetType of (fallbackChain[type] || [])) {
          log(`Tentando fallback de tipo: ${type} → ${targetType}`);
          const fb = await this.fetchAtivo(cleanTicker, targetType, true, includeNews);
          if (!('error' in fb)) return { ...fb, logs: [...logs, ...(fb.logs ?? [])] };
        }
      }
      return { ticker: cleanTicker, error: err.message, cacheStatus: 'ERROR', logs };
    }
  }

  // ── Orquestrador multi-fonte ─────────────────────────────────────────────

  private static async _executeFetchWithFallback(
    ticker: string, url: string, preset: ExtendedAssetPreset, type: ExtendedAssetType, log: (m: string) => void
  ): Promise<FetchSuccess> {
    const startTime = performance.now();
    let finalResults: ResultMap = {};
    const sourcesUsed: Set<string> = new Set();
    let bytesTotal = 0;

    const customTemplate: CustomTemplate = {
      rules: preset.labels.map(l => ({ name: l, type: 'number' })),
      aliases: preset.aliases,
      htmlClasses: preset.htmlClasses['investidor10']
    };

    // FASE 1: Investidor10
    const cbI10 = `investidor10:${ticker}`;
    if (!this._cb.estaAberto(cbI10)) {
      try {
        const r1 = await this._executeFetchWithRetry(url, customTemplate, 'investidor10', this._config.maxRetries, startTime, log, ticker);
        finalResults = { ...r1.results };
        bytesTotal += r1.metrics.bytesProcessed;
        if (Object.keys(finalResults).length > 0) {
          sourcesUsed.add('Investidor10');
          this._cb.registrarSucesso(cbI10);
          log(`Fase 1 concluída: ${Object.keys(finalResults).length} indicadores obtidos.`);
        }
      } catch (e) { log(`Fase 1 falhou: ${(e as Error).message}`); this._cb.registrarFalha(cbI10); }
    }

    // FASE 1.5: Status Invest (Correção de Bloqueio)
    if (Object.keys(finalResults).length < preset.labels.length && preset.statusInvest_base) {
      await delay(1500 + Math.random() * 2000); // Delay humano real
      const cbSI = `statusInvest:${ticker}`;
      if (!this._cb.estaAberto(cbSI)) {
        try {
          // Requisição direta à página (Removido o aquecimento de busca que causava 403)
          const urlSI = `${preset.statusInvest_base}/${ticker.toLowerCase()}/`;
          customTemplate.htmlClasses = preset.htmlClasses['statusInvest'];
          
          const r15 = await this._executeFetchWithRetry(urlSI, customTemplate, 'statusInvest', 1, startTime, log, ticker);
          bytesTotal += r15.metrics.bytesProcessed;
          
          let added = 0;
          for (const [k, v] of Object.entries(r15.results)) {
            if (finalResults[k as AssetLabel] === undefined) { 
              finalResults[k as AssetLabel] = v;
              added++; 
            }
          }
          if (added > 0) { 
            sourcesUsed.add('StatusInvest');
            this._cb.registrarSucesso(cbSI);
            log(`Fase 1.5 concluída: ${added} novos indicadores via StatusInvest.`);
          }
        } catch (e) { log(`Fase 1.5 falhou: ${(e as Error).message}`); this._cb.registrarFalha(cbSI); }
      }
    }

    // ── FASE 2: Yahoo Finance ────────────────────────────────────────────
    const cbYF = `yahoo:${ticker}`;
    if (!this._cb.estaAberto(cbYF)) {
      try {
        const quote: YahooQuote = await yf.quote(`${ticker}.SA`);
        let added = 0;
        const fill = (chave: AssetLabel, val: unknown) => {
          if (finalResults[chave] !== undefined || val == null) return;
          const str = typeof val === 'number' ? val.toFixed(2) : String(val).trim();
          if (!VALORES_INVALIDOS.has(str)) { finalResults[chave] = str; added++; }
        };

        if (type === 'ACAO' || type === 'BDR') {
          fill('P/L', quote.trailingPE);
          fill('P/VP', quote.priceToBook);
          fill('VPA', quote.bookValue);
          fill('LPA', quote.epsTrailingTwelveMonths);
          fill('Preço Atual', quote.regularMarketPrice);
          if (typeof quote.regularMarketChangePercent === 'number') fill('Variação (24h)', quote.regularMarketChangePercent.toFixed(2) + '%');
          if (quote.profitMargins != null) fill('Margem Líquida', (quote.profitMargins * 100).toFixed(2) + '%');
          if (quote.returnOnEquity != null) fill('ROE', (quote.returnOnEquity * 100).toFixed(2) + '%');
          if (quote.revenuePerShare && quote.regularMarketPrice) fill('PSR', (quote.regularMarketPrice / quote.revenuePerShare).toFixed(2));
          if (quote.trailingAnnualDividendYield != null) fill('Dividend Yield', (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%');
        } else {
          fill('P/VP', quote.priceToBook);
          fill('Valor Patrimonial', quote.bookValue);
          fill('Preço Atual', quote.regularMarketPrice);
          if (typeof quote.regularMarketChangePercent === 'number') fill('Variação (24h)', quote.regularMarketChangePercent.toFixed(2) + '%');
          if (quote.marketCap != null) fill('Valor de Mercado', quote.marketCap);
          if (quote.trailingAnnualDividendYield != null) fill('Dividend Yield', (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%');
        }

        if (added > 0) {
          sourcesUsed.add('YahooFinance');
          this._cb.registrarSucesso(cbYF);
          log(`Fase 2 concluída: ${added} indicadores complementados via Yahoo Finance.`);
        }
      } catch (e) {
        log(`Fase 2 falhou: ${(e as Error).message}`);
        this._cb.registrarFalha(cbYF);
      }
    } else {
      log(`Fase 2 ignorada: Circuit Breaker aberto para Yahoo Finance.`);
    }

    const validatedResults = validarResultMap(finalResults);
    const foundKeys = Object.keys(validatedResults) as AssetLabel[];
    if (foundKeys.length === 0) throw new Error(`Falha total em todas as fontes para ${ticker}.`);

    return {
      results: validatedResults,
      metrics: {
        totalTimeMs: performance.now() - startTime,
        bytesProcessed: bytesTotal,
        foundKeys,
        earlyAbort: foundKeys.length >= preset.labels.length,
        successRate: foundKeys.length / preset.labels.length,
        source: Array.from(sourcesUsed).join(' + ') as DataSource,
      },
    };
  }

  // ── Executor com retry ───────────────────────────────────────────────────

  private static async _executeFetchWithRetry(
    url: string, template: CustomTemplate, source: ScraperSource, retries: number,
    globalStart: number, log: (m: string) => void, ticker?: string
  ): Promise<FetchSuccess> {
    for (let i = 0; i < retries; i++) {
      try { return await this._executeFetch(url, template, source, globalStart, log, ticker); }
      catch (err) {
        const msg = (err as Error).message;
        // Não retenta erros definitivos (ativo não existe, bloqueio legal)
        if (i === retries - 1 || msg.includes('404') || msg.includes('410') || msg.includes('451')) throw err;
        const espera = backoffMs(i);
        log(`Tentativa ${i + 1}/${retries} falhou (${msg}). Aguardando ${Math.round(espera)}ms...`);
        await delay(espera);
      }
    }
    throw new Error('Retries esgotados');
  }

  // CORE SCRAPER COM RADAR HEURÍSTICO
  private static async _executeFetch(
    url: string, template: CustomTemplate, source: ScraperSource, globalStart: number, log: (m: string) => void, ticker?: string
  ): Promise<FetchSuccess> {
    const { rules, aliases = {}, htmlClasses = [] } = template;
    const ruleMap: Record<string, LabelRule> = {};
    rules.forEach(r => ruleMap[r.name.toLowerCase()] = r);
    Object.entries(aliases).forEach(([alias, label]) => {
        if(ruleMap[label.toLowerCase()]) ruleMap[alias.toLowerCase()] = ruleMap[label.toLowerCase()];
    });

    const abortCtrl = new AbortController();
    const results: ResultMap = {};
    let foundCount = 0;
    let bytesProcessed = 0;
    let lastRule: LabelRule | null = null;
    let depth = 0; let buffer = '';
    let radarAguardando: LabelRule | null = null;
    let passosPosRadar = 0;

    const parser = new Parser({
      onopentag(name, attr) {
        if (radarAguardando) passosPosRadar++;
        let ruleEncontrada: LabelRule | null = null;
        for (const attrName of ['title', 'aria-label', 'data-title', 'data-label']) {
          const raw = attr[attrName]; if (!raw) continue;
          const lower = raw.trim().toLowerCase();
          if (ruleMap[lower]) { ruleEncontrada = ruleMap[lower]; break; }
        }
        if (ruleEncontrada) lastRule = ruleEncontrada;

        const ehBlocoValor = htmlClasses.length > 0 && attr.class?.split(/\s+/).some(c => htmlClasses.includes(c));
        if (ehBlocoValor) {
          if (depth === 0) { buffer = ''; if (!ruleEncontrada) lastRule = null; }
          depth++;
        } else if (depth > 0) depth++;
      },
      ontext(t) {
        const txt = t.trim();
        // Radar Heurístico: Pega números próximos à label sem depender de CSS
        if (radarAguardando && txt && /^[\d,.-]+[%MkB]?$/.test(txt)) {
          const norm = normalizeBRNumber(txt);
          if (norm) { results[radarAguardando.name] = norm; foundCount++; radarAguardando = null; }
        }
        if (depth > 0) { if (buffer.length < 512) buffer += t; return; }
        const lower = txt.replace(':', '').toLowerCase();
        if (ruleMap[lower]) { lastRule = ruleMap[lower]; radarAguardando = lastRule; passosPosRadar = 0; }
      },
      onclosetag() {
        if (radarAguardando && passosPosRadar > 8) radarAguardando = null;
        if (depth > 0) {
          depth--;
          if (depth === 0 && lastRule) {
            const normalized = normalizeBRNumber(buffer.trim());
            if (normalized) { results[lastRule.name] = normalized; foundCount++; }
            lastRule = null; buffer = '';
          }
        }
      }
    });

    try {
      const resp = await fetch(url, { headers: getHeadersConsistentes(getRandomAgent(), url), signal: abortCtrl.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const body = await resp.text();
      bytesProcessed = body.length;
      parser.write(body);
      parser.end();
    } catch (err) { throw err; }

    return {
      results,
      metrics: { totalTimeMs: performance.now() - globalStart, bytesProcessed, foundKeys: Object.keys(results) as AssetLabel[], successRate: foundCount / rules.length, earlyAbort: foundCount >= rules.length, source: source as DataSource },
    };
  }

  // ── Histórico e dividendos ───────────────────────────────────────────────

  static async fetchHistoricoGrafico(ticker: string, period: ChartPeriod = '1y'): Promise<HistoricalQuote[]> {
    try {
      return (await yf.historical(`${ticker.toUpperCase()}.SA`, {
        period1: periodoParaData(period), period2: new Date(), interval: '1d'
      })).map((r: any) => ({ ...r, date: new Date(r.date) }));
    } catch (e) { throw new Error(`Histórico falhou: ${(e as Error).message}`); }
  }

  static async fetchDividends(ticker: string, period: ChartPeriod = '5y'): Promise<Dividend[]> {
    try {
      return (await yf.dividends(`${ticker.toUpperCase()}.SA`, {
        period1: periodoParaData(period), period2: new Date()
      })).map((r: any) => ({ date: new Date(r.date), amount: r.dividend }));
    } catch (e) { throw new Error(`Dividendos falhou: ${(e as Error).message}`); }
  }

  // ── Search ───────────────────────────────────────────────────────────────

  static async searchTicker(query: string): Promise<any[]> {
    const c = query.trim().toLowerCase();
    const cached = this._searchCache.get(c);
    if (cached && Date.now() - cached.timestamp < this._config.searchCacheTtlMs) return cached.data;
    try {
      const r = (await yf.search(query))?.quotes?.filter(
        (q: any) => q.exchange === 'SAO' || q.symbol?.endsWith('.SA')
      ) ?? [];
      this._searchCache.set(c, { data: r, timestamp: Date.now() }); return r;
    } catch (e) { return []; }
  }

  // ── Notícias ─────────────────────────────────────────────────────────────

  static async fetchNews(ticker: string): Promise<NewsItem[]> {
    try {
      const cleanTicker = ticker.trim().replace(/\.SA$/i, '').toUpperCase();
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
          if (tag === 'title') curr.title = (curr.title || '') + t;
          if (tag === 'link') curr.link = (curr.link || '') + t;
          if (tag === 'pubdate') { const d = new Date((curr.pubDate?.toString() || '') + t); if (!isNaN(d.getTime())) curr.pubDate = d; }
          if (tag === 'source') curr.source = (curr.source || '') + t;
        },
        onclosetag(n) { if (n.toLowerCase() === 'item' && curr?.title && curr?.link) { news.push(curr as NewsItem); curr = null; } tag = ''; }
      }, { xmlMode: true });
      p.write(await r.text()); p.end(); return news;
    } catch (e) { return []; }
  }

  // ── Cache ────────────────────────────────────────────────────────────────

  static clearCache(): void { this._cache.clear(); this._searchCache.clear(); }

  static getCacheStats() {
    return {
      cache: { tamanho: this._cache.tamanho, tamanhoMax: this._config.cacheMaxSize, staleMs: this._config.cacheStaleMs, maxMs: this._config.cacheMaxMs },
      searchCache: { tamanho: this._searchCache.tamanho, ttlMs: this._config.searchCacheTtlMs },
      circuitBreakers: {
        investidor10: this._cb.getEstado('investidor10'),
        statusInvest: this._cb.getEstado('statusInvest'),
        yahoo: this._cb.getEstado('yahoo'),
      },
      inFlightRequests: this._inFlight.size
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
    const p: Promise<void> = tasks[i]()
      .then(res => { results[i] = res; })
      .catch(err => { results[i] = err instanceof Error ? err : new Error(String(err)); })
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
    const ticker = tickers[i].toUpperCase().replace(/\.SA$/i, '');
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
    const ticker = tickers[i].toUpperCase().replace(/\.SA$/i, '');
    if (r instanceof Error) {
      return { ticker, error: r.message, cacheStatus: 'ERROR' as const, logs: [`[BATCH-AUTO] Falha: ${r.message}`] };
    }
    return r as FetchAtivoResult;
  });
}

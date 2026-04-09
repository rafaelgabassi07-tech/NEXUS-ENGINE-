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

function getHeadersConsistentes(userAgent: string, url: string, ticker?: string): Record<string, string> {
  const v = extrairVersaoChrome(userAgent);
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  const isStatusInvest = domain.includes('statusinvest');
  
  const lang = Math.random() > 0.5 ? 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' : 'pt-BR,pt;q=0.8,en-US;q=0.5,en;q=0.3';
  
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': lang,
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'Sec-Ch-Ua': `"Not_A Brand";v="8", "Chromium";v="${v}", "Google Chrome";v="${v}"`,
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': isStatusInvest ? 'same-origin' : 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Priority': 'u=0, i',
  };

  if (isStatusInvest) {
    // StatusInvest is very sensitive to Referer. 
    // Sometimes it expects the home page or a search page.
    headers['Referer'] = ticker ? `https://statusinvest.com.br/acoes/${ticker.toLowerCase()}` : 'https://statusinvest.com.br/';
  } else {
    headers['Referer'] = `https://${domain}/`;
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
    const e = this.entradas.get(chave) ?? { falhas: 0, ultimaFalha: 0, estado: 'FECHADO' };
    e.falhas++;
    e.ultimaFalha = Date.now();
    if (e.falhas >= this.limiar && e.estado !== 'ABERTO') {
      e.estado = 'ABERTO';
    }
    this.entradas.set(chave, e);
  }
  getEstado(chave: string): EstadoCB { return this.entradas.get(chave)?.estado ?? 'FECHADO'; }
}

const yf = resolveYahooFinance(yahooFinance);
try { if (typeof yf?.setGlobalConfig === 'function') yf.setGlobalConfig({ suppressNotices: ['yahooSurvey'] }); } 
catch (e) { console.warn('[NexusEngine] Falha ao configurar YF:', e); }
const NEXUS_PRESETS: Record<ExtendedAssetType, ExtendedAssetPreset> = {
  ACAO: {
    url_base: 'https://investidor10.com.br/acoes',
    statusInvest_base: 'https://statusinvest.com.br/acoes',
    labels: ['P/L', 'Dividend Yield', 'P/VP', 'VPA', 'ROE', 'ROIC', 'Margem Líquida', 'Margem Bruta', 'Margem EBIT', 'EV/EBITDA', 'Dívida Líquida / Patrimônio', 'CAGR Receitas 5 Anos', 'LPA', 'PEG Ratio', 'P/EBIT', 'P/Ativo', 'PSR', 'Giro Ativos', 'Dívida Bruta / Patrimônio', 'Preço Atual', 'Variação (24h)', 'Setor', 'Subsetor', 'Segmento'],
    aliases: { 
      'dy': 'Dividend Yield', 'p/l': 'P/L', 'p/vp': 'P/VP', 'vpa': 'VPA', 'lpa': 'LPA', 'roe': 'ROE', 'roic': 'ROIC', 'psr': 'PSR', 'p/ativo': 'P/Ativo', 
      'cotação': 'Preço Atual', 'cotacao': 'Preço Atual', 'variação': 'Variação (24h)', 'variacao': 'Variação (24h)', 
      'setor de atuação': 'Setor', 'subsetor de atuação': 'Subsetor', 'segmento de atuação': 'Segmento', 'segmento': 'Segmento',
      'div. líquida / patrimônio': 'Dívida Líquida / Patrimônio', 'divida liquida / patrimonio': 'Dívida Líquida / Patrimônio',
      'margem líquida': 'Margem Líquida', 'margem liquida': 'Margem Líquida', 'margem bruta': 'Margem Bruta', 'margem ebit': 'Margem EBIT',
      'ev / ebitda': 'EV/EBITDA', 'ev/ebitda': 'EV/EBITDA', 'cagr receitas 5 anos': 'CAGR Receitas 5 Anos', 'peg ratio': 'PEG Ratio'
    },
    htmlClasses: { investidor10: ['value', 'v-value', '_card-body'], statusInvest: ['value', 'v-align-middle', 'info', 'd-block'], custom: [] }
  },
  FII: {
    url_base: 'https://investidor10.com.br/fiis',
    statusInvest_base: 'https://statusinvest.com.br/fundos-imobiliarios',
    labels: ['Dividend Yield', 'P/VP', 'Valor Patrimonial', 'Liquidez Diária', 'Último Rendimento', 'Vacância Física', 'Vacância Financeira', 'Quantidade Ativos', 'Patrimônio Líquido', 'Valor de Mercado', 'P/Ativo', 'Preço Atual', 'Variação (24h)', 'Segmento'],
    aliases: { 'dy': 'Dividend Yield', 'p/vp': 'P/VP', 'p/ativo': 'P/Ativo', 'último rendimento': 'Último Rendimento', 'cotação': 'Preço Atual', 'cotacao': 'Preço Atual', 'variação': 'Variação (24h)', 'variacao': 'Variação (24h)', 'segmento': 'Segmento' },
    htmlClasses: { investidor10: ['value', 'v-value', '_card-body'], statusInvest: ['value', 'v-align-middle'], custom: [] }
  },
  BDR: {
    url_base: 'https://investidor10.com.br/bdrs',
    statusInvest_base: 'https://statusinvest.com.br/bdrs',
    labels: ['P/L', 'Dividend Yield', 'P/VP', 'VPA', 'ROE', 'ROIC', 'Margem Líquida', 'Margem Bruta', 'EV/EBITDA', 'LPA', 'Preço Atual', 'Variação (24h)', 'Setor', 'Segmento'],
    aliases: { 'dy': 'Dividend Yield', 'p/l': 'P/L', 'p/vp': 'P/VP', 'lpa': 'LPA', 'roe': 'ROE', 'cotação': 'Preço Atual', 'cotacao': 'Preço Atual', 'variação': 'Variação (24h)', 'variacao': 'Variação (24h)' },
    htmlClasses: { investidor10: ['value', 'v-value', '_card-body'], statusInvest: ['value', 'v-align-middle'], custom: [] }
  },
  ETF: {
    url_base: 'https://investidor10.com.br/etfs',
    statusInvest_base: 'https://statusinvest.com.br/etfs',
    labels: ['Dividend Yield', 'P/VP', 'Valor Patrimonial', 'Liquidez Diária', 'Patrimônio Líquido', 'Valor de Mercado', 'Taxa de Administração', 'Preço Atual', 'Variação (24h)'],
    aliases: { 'dy': 'Dividend Yield', 'taxa adm': 'Taxa de Administração', 'taxa de administração': 'Taxa de Administração', 'cotação': 'Preço Atual', 'cotacao': 'Preço Atual', 'variação': 'Variação (24h)', 'variacao': 'Variação (24h)' },
    htmlClasses: { investidor10: ['value', 'v-value', '_card-body'], statusInvest: ['value', 'v-align-middle'], custom: [] }
  },
};
export type { AssetType, FetchAtivoResult };

export class NexusEngineUltra {
  private static _config: Required<NexusEngineConfig> = {
    cacheTtlMs: 5 * 60 * 1_000,
    cacheStaleMs: 3 * 60 * 1_000,
    cacheMaxMs: 24 * 60 * 60 * 1_000,
    cacheMaxSize: 200, searchCacheTtlMs: 60 * 1_000,
    watchdogMs: 4_000, maxRetries: 2, concurrencyLimit: 5, proxy: '',
    circuitBreakerThreshold: 3, circuitBreakerResetMs: 30_000,
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

  static async fetchCustom(url: string, template: CustomTemplate): Promise<FetchSuccess> {
    const logs: string[] = [];
    const log = (m: string) => logs.push(`[Custom] ${m}`);
    const globalStart = performance.now();
    
    const customConfig: CustomTemplate = {
      rules: template.rules,
      aliases: template.aliases || {},
      htmlClasses: template.htmlClasses || []
    };

    return await this._executeFetch(url, customConfig, 'custom', globalStart, log);
  }

  static async fetchAtivo(ticker: string, type: ExtendedAssetType = 'ACAO', isRetry = false, includeNews = false): Promise<FetchAtivoResult> {
    const cleanTicker = ticker.trim().replace(/\.SA$/i, '').toUpperCase();
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

  private static async _hydrateData(data: FetchAtivoResult, includeNews: boolean, ticker: string, status: CacheStatus): Promise<FetchAtivoResult> {
    let finalData = { ...data, cacheStatus: status };
    if (includeNews && finalData.cacheStatus !== 'ERROR' && !('error' in finalData) && !(finalData as any).news) {
      (finalData as any).news = await this.fetchNews(ticker);
    }
    return finalData;
  }
  private static async _doFetchCore(cleanTicker: string, type: ExtendedAssetType, includeNews: boolean, cacheKey: string, isRetry = false): Promise<FetchAtivoResult> {
    const logs: string[] = [];
    const log = (m: string) => logs.push(`[${cleanTicker}] ${m}`);
    const preset = NEXUS_PRESETS[type];
    
    if (!preset) return { ticker: cleanTicker, error: `Tipo inválido.`, cacheStatus: 'ERROR', logs };

    const url = `${preset.url_base}/${cleanTicker.toLowerCase()}/`;
    try {
      const result = await this._executeFetchWithFallback(cleanTicker, url, preset, type, log);
      let news = includeNews ? await this.fetchNews(cleanTicker) : undefined;
      const finalData = { ticker: cleanTicker, ...result, cacheStatus: 'MISS' as const, logs, news };
      this._cache.set(cacheKey, { data: finalData, timestamp: Date.now() });
      return finalData;
    } catch (error) {
      const err = error as Error;
      if (!isRetry && (err.message.includes('404') || err.message.includes('410') || err.message.includes('total'))) {
        const fallbackChain: Record<ExtendedAssetType, ExtendedAssetType[]> = { 'ACAO': ['BDR', 'ETF', 'FII'], 'FII': ['ACAO'], 'BDR': ['ACAO'], 'ETF': ['ACAO'] };
        for (const targetType of (fallbackChain[type] || [])) {
          log(`Tentando fallback de tipo: ${type} → ${targetType}`);
          const fb = await this.fetchAtivo(cleanTicker, targetType, true, includeNews);
          if (!('error' in fb)) return { ...fb, logs: [...logs, ...(fb.logs ?? [])] };
        }
      }
      return { ticker: cleanTicker, error: err.message, cacheStatus: 'ERROR', logs };
    }
  }

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

    if (Object.keys(finalResults).length < preset.labels.length && preset.statusInvest_base) {
      await delay(Math.random() * 1000 + 500); // Delay humano entre fontes
      const cbSI = `statusInvest:${ticker}`;
      if (!this._cb.estaAberto(cbSI)) {
        const urlSI = `${preset.statusInvest_base}/${ticker.toLowerCase()}/`;
        customTemplate.htmlClasses = preset.htmlClasses['statusInvest'];
        try {
          const r15 = await this._executeFetchWithRetry(urlSI, customTemplate, 'statusInvest', 1, startTime, log, ticker);
          bytesTotal += r15.metrics.bytesProcessed;
          let added = 0;
          for (const [k, v] of Object.entries(r15.results)) {
            if (finalResults[k as AssetLabel] === undefined) { finalResults[k as AssetLabel] = v; added++; }
          }
          if (added > 0) { sourcesUsed.add('StatusInvest'); this._cb.registrarSucesso(cbSI); }
        } catch (e) { log(`Fase 1.5 falhou: ${(e as Error).message}`); this._cb.registrarFalha(cbSI); }
      }
    }

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
          fill('P/L', quote.trailingPE); fill('P/VP', quote.priceToBook); fill('VPA', quote.bookValue);
          fill('LPA', quote.epsTrailingTwelveMonths); fill('Preço Atual', quote.regularMarketPrice);
          if (typeof quote.regularMarketChangePercent === 'number') fill('Variação (24h)', quote.regularMarketChangePercent.toFixed(2) + '%');
          if (quote.profitMargins != null) fill('Margem Líquida', (quote.profitMargins * 100).toFixed(2) + '%');
          if (quote.returnOnEquity != null) fill('ROE', (quote.returnOnEquity * 100).toFixed(2) + '%');
          if (quote.revenuePerShare && quote.regularMarketPrice) fill('PSR', (quote.regularMarketPrice / quote.revenuePerShare).toFixed(2));
          if (quote.trailingAnnualDividendYield != null) fill('Dividend Yield', (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%');
        } else {
          fill('P/VP', quote.priceToBook); fill('Valor Patrimonial', quote.bookValue); fill('Preço Atual', quote.regularMarketPrice);
          if (typeof quote.regularMarketChangePercent === 'number') fill('Variação (24h)', quote.regularMarketChangePercent.toFixed(2) + '%');
          if (quote.marketCap != null) fill('Valor de Mercado', quote.marketCap);
          if (quote.trailingAnnualDividendYield != null) fill('Dividend Yield', (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%');
        }
        if (added > 0) { sourcesUsed.add('YahooFinance'); this._cb.registrarSucesso(cbYF); }
      } catch (e) { log(`Fase 2 falhou: ${(e as Error).message}`); this._cb.registrarFalha(cbYF); }
    }

    const validatedResults = validarResultMap(finalResults);
    const foundKeys = Object.keys(validatedResults) as AssetLabel[];
    if (foundKeys.length === 0) throw new Error(`Falha total em todas as fontes.`);

    return {
      results: validatedResults,
      metrics: {
        totalTimeMs: performance.now() - startTime, bytesProcessed: bytesTotal,
        foundKeys, earlyAbort: foundKeys.length >= preset.labels.length,
        successRate: foundKeys.length / preset.labels.length,
        source: Array.from(sourcesUsed).join(' + ') as DataSource,
      },
    };
  }

  private static async _executeFetchWithRetry(
    url: string, template: CustomTemplate, source: ScraperSource, retries: number, globalStart: number, log: (m: string) => void, ticker?: string
  ): Promise<FetchSuccess> {
    for (let i = 0; i < retries; i++) {
      try { return await this._executeFetch(url, template, source, globalStart, log, ticker); } 
      catch (err) {
        const msg = (err as Error).message;
        if (i === retries - 1 || msg.includes('404') || msg.includes('410') || msg.includes('451')) throw err;
        await delay(backoffMs(i));
      }
    }
    throw new Error('Retries esgotados');
  }
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
    let watchdogId: NodeJS.Timeout;
    const resetWatchdog = () => { clearTimeout(watchdogId); watchdogId = setTimeout(() => abortCtrl.abort(), this._config.watchdogMs); };
    resetWatchdog();

    const results: ResultMap = {};
    let foundCount = 0; let bytesProcessed = 0;
    
    let lastRule: LabelRule | null = null;
    let depth = 0; let buffer = '';
    const ignoreTags = new Set(['script', 'style', 'option', 'title', 'meta', 'footer', 'nav', 'header', 'noscript', 'iframe']);
    let ignoreDepth = 0;

    let radarAguardando: LabelRule | null = null;
    let passosPosRadar = 0;

    const pathStack: string[] = [];

    const parser = new Parser({
      onopentag(name, attr) {
        if (ignoreTags.has(name)) { ignoreDepth++; return; }
        if (ignoreDepth > 0) return;
        
        if (radarAguardando) passosPosRadar++;

        const classStr = attr.class ? '.' + attr.class.split(/\s+/).join('.') : '';
        const nodeSignature = `${name}${classStr}`;
        pathStack.push(nodeSignature);
        const currentPath = pathStack.join(' > ');

        for (const rule of rules) {
          if (rule.paths) {
            for (const path of rule.paths) {
              if (currentPath.endsWith(path)) {
                radarAguardando = rule;
                passosPosRadar = 0;
              }
            }
          }
        }

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
        if (ignoreDepth > 0) return;
        
        const txt = t.trim();
        
        if (radarAguardando && txt) {
          let extraido: string | number | null = null;
          const ruleType = radarAguardando.type || 'number';
          
          if (radarAguardando.regex && radarAguardando.regex.test(txt)) {
            extraido = txt;
          } else if (ruleType === 'text' || ruleType === 'any' || ruleType === 'date') {
            extraido = txt;
          } else if (ruleType === 'number' && /^[\d,.-]+[%MkB]?$/.test(txt)) {
            const norm = normalizeBRNumber(txt);
            if (norm && !VALORES_INVALIDOS.has(String(norm))) extraido = norm;
          }

          if (extraido !== null) {
            results[radarAguardando.name] = extraido; foundCount++;
            radarAguardando = null; passosPosRadar = 0;
          }
        }

        if (depth > 0) { if (buffer.length < 512) buffer += t; return; }
        
        if (!txt || txt.length > 60) return;
        const lower = txt.replace(':', '').toLowerCase();
        
        if (ruleMap[lower]) {
          lastRule = ruleMap[lower];
          radarAguardando = lastRule; 
          passosPosRadar = 0;
        }
      },
      onclosetag(name) {
        if (ignoreTags.has(name)) { if (ignoreDepth > 0) ignoreDepth--; return; }
        if (ignoreDepth > 0) return;
        
        pathStack.pop();

        if (radarAguardando && passosPosRadar > 8) radarAguardando = null; 

        if (depth > 0) {
          depth--;
          if (depth === 0) {
            if (lastRule) {
              const trimmed = buffer.trim();
              
              let extraido: string | number | null = null;
              const ruleType = lastRule.type || 'number';

              if (lastRule.regex && lastRule.regex.test(trimmed)) extraido = trimmed;
              else if (ruleType === 'text' || ruleType === 'any' || ruleType === 'date') extraido = trimmed;
              else {
                const normalized = trimmed ? normalizeBRNumber(trimmed) : '';
                if (normalized && !VALORES_INVALIDOS.has(String(normalized))) extraido = normalized;
              }

              if (extraido !== null) {
                results[lastRule.name] = extraido; foundCount++;
                if (foundCount >= rules.length) abortCtrl.abort();
              }
            }
            lastRule = null; buffer = '';
          }
        }
      },
    }, { decodeEntities: true });

    try {
      const response = await fetch(url, { headers: getHeadersConsistentes(getRandomAgent(), url, ticker), signal: abortCtrl.signal });
      if (response.status === 403) throw new Error('HTTP 403 (Acesso Negado/WAF)');
      if (response.status === 410 || response.status === 404) throw new Error(`HTTP ${response.status} (Ativo não encontrado nesta categoria)`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) { resetWatchdog(); bytesProcessed += value.length; parser.write(decoder.decode(value, { stream: true })); }
          }
        } finally { if (abortCtrl.signal.aborted) reader.cancel().catch(()=>{}); reader.releaseLock(); }
      }
      parser.end();
    } catch (err) { if ((err as Error).name !== 'AbortError') throw err; } 
    finally { clearTimeout(watchdogId!); }

    return {
      results,
      metrics: { totalTimeMs: performance.now() - globalStart, bytesProcessed, foundKeys: Object.keys(results) as AssetLabel[], successRate: foundCount / rules.length, earlyAbort: foundCount >= rules.length, source: source as DataSource },
    };
  }
  static async fetchHistoricoGrafico(ticker: string, period: ChartPeriod = '1y'): Promise<HistoricalQuote[]> {
    try { return (await yf.historical(`${ticker.toUpperCase()}.SA`, { period1: periodoParaData(period), period2: new Date(), interval: '1d' })).map((r: any) => ({ ...r, date: new Date(r.date) })); } catch (e) { throw new Error(`Histórico falhou: ${(e as Error).message}`); }
  }
  static async fetchDividends(ticker: string, period: ChartPeriod = '5y'): Promise<Dividend[]> {
    try { return (await yf.dividends(`${ticker.toUpperCase()}.SA`, { period1: periodoParaData(period), period2: new Date() })).map((r: any) => ({ date: new Date(r.date), amount: r.dividend })); } catch (e) { throw new Error(`Dividendos falhou: ${(e as Error).message}`); }
  }
  static async searchTicker(query: string): Promise<any[]> {
    const c = query.trim().toLowerCase(); const cached = this._searchCache.get(c);
    if (cached && Date.now() - cached.timestamp < this._config.searchCacheTtlMs) return cached.data;
    try {
      const r = (await yf.search(query))?.quotes?.filter((q: any) => q.exchange === 'SAO' || q.symbol?.endsWith('.SA')) ?? [];
      this._searchCache.set(c, { data: r, timestamp: Date.now() }); return r;
    } catch (e) { return []; }
  }
  static async fetchNews(ticker: string): Promise<NewsItem[]> {
    try {
      const r = await fetch(`https://news.google.com/rss/search?q=${ticker.trim().replace(/\.SA$/i, '').toUpperCase()}+stock+B3&hl=pt-BR&gl=BR&ceid=BR:pt-419`, { headers: { 'User-Agent': getRandomAgent() } });
      if (!r.ok) return [];
      const news: NewsItem[] = []; let curr: Partial<NewsItem> | null = null; let tag = '';
      const p = new Parser({
        onopentag(n) { const t = n.toLowerCase(); if (t === 'item') curr = {}; tag = t; },
        ontext(t) { if (!curr) return; if (tag === 'title') curr.title = (curr.title || '') + t; if (tag === 'link') curr.link = (curr.link || '') + t; if (tag === 'pubdate') { const d = new Date((curr.pubDate?.toString() || '') + t); if (!isNaN(d.getTime())) curr.pubDate = d; } if (tag === 'source') curr.source = (curr.source || '') + t; },
        onclosetag(n) { if (n.toLowerCase() === 'item' && curr?.title && curr?.link) { news.push(curr as NewsItem); curr = null; } tag = ''; }
      }, { xmlMode: true });
      p.write(await r.text()); p.end(); return news;
    } catch (e) { return []; }
  }

  static clearCache(): void { this._cache.clear(); this._searchCache.clear(); }
  
  static getCacheStats() { 
    return { 
      cache: { tamanho: this._cache.tamanho, tamanhoMax: this._config.cacheMaxSize, staleMs: this._config.cacheStaleMs, maxMs: this._config.cacheMaxMs }, 
      searchCache: { tamanho: this._searchCache.tamanho, ttlMs: this._config.searchCacheTtlMs }, 
      circuitBreakers: { investidor10: this._cb.getEstado('investidor10'), statusInvest: this._cb.getEstado('statusInvest') },
      inFlightRequests: this._inFlight.size 
    }; 
  }
}

export async function runWithLimit<T>(tasks: Task<T>[], limit = 5): Promise<(T | Error)[]> {
  const results: (T | Error)[] = new Array(tasks.length); const executing = new Set<Promise<void>>();
  for (let i = 0; i < tasks.length; i++) {
    const p: Promise<void> = tasks[i]().then(res => { results[i] = res; }).catch(err => { results[i] = err instanceof Error ? err : new Error(String(err)); }).finally(() => { executing.delete(p); });
    executing.add(p); if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing); return results;
}

export async function runNexusBatch(tickers: string[], type: ExtendedAssetType = 'ACAO', limit: number = NexusEngineUltra.defaultConcurrencyLimit, includeNews = false): Promise<FetchAtivoResult[]> {
  return (await runWithLimit(tickers.map(t => () => NexusEngineUltra.fetchAtivo(t, type, false, includeNews)), limit)).map((r, i) => {
    if (r instanceof Error) return { ticker: tickers[i].toUpperCase().replace(/\.SA$/i, ''), error: r.message, cacheStatus: 'ERROR' as const, logs: [`[BATCH] Falha: ${r.message}`] };
    return r as FetchAtivoResult;
  });
}

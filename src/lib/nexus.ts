import { request, Agent, interceptors } from 'undici';
import { Parser } from 'htmlparser2';
import { LRUCache } from 'lru-cache';
import { performance } from 'perf_hooks';
import YahooFinance from 'yahoo-finance2';

// ═══════════════════════════════════════════════════════════
// TIPOS E INTERFACES
// ═══════════════════════════════════════════════════════════

export type AssetType = 'ACAO' | 'FII';
export type CacheStatus = 'HIT' | 'MISS' | 'DEDUPE' | 'ERROR';
export type DataSource = 'Yahoo Finance API' | 'SAX Scraper (HTML)' | 'SAX Scraper + Yahoo Finance';

export type AcaoLabel = 'P/L' | 'Dividend Yield' | 'P/VP' | 'VPA' | 'ROE' | 'ROIC' | 'Margem Líquida' | 'Margem Bruta' | 'Margem EBIT' | 'EV/EBITDA' | 'Dívida Líquida / Patrimônio' | 'CAGR Receitas 5 Anos' | 'LPA' | 'PEG Ratio';
export type FiiLabel = 'Dividend Yield' | 'P/VP' | 'Valor Patrimonial' | 'Liquidez Diária' | 'Último Rendimento' | 'Vacância Física' | 'Vacância Financeira' | 'Quantidade Ativos';
export type AssetLabel = AcaoLabel | FiiLabel;

export type ResultMap = Partial<Record<AssetLabel, string>>;

export type ChartPeriod = '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max';

export interface HistoricalQuote {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FetchMetrics {
  totalTimeMs:    number;
  bytesProcessed: number;
  foundKeys:      AssetLabel[];
  successRate:    number;
  earlyAbort:     boolean;
  source:         DataSource;
}

export interface FetchSuccess {
  results: ResultMap;
  metrics: FetchMetrics;
}

export interface AtivoBuscado extends FetchSuccess {
  ticker:      string;
  cacheStatus: CacheStatus;
}

export interface AtivoErro {
  ticker:      string;
  error:       string;
  cacheStatus: 'ERROR';
}

export type FetchAtivoResult = AtivoBuscado | AtivoErro;

interface AssetPreset {
  url_base: string;
  labels:   AssetLabel[];
}

type Task<T> = () => Promise<T>;

// ═══════════════════════════════════════════════════════════
// INSTÂNCIAS GLOBAIS E CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════════

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const CACHE = new LRUCache<string, FetchSuccess>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutos
});

const PENDING_REQUESTS = new Map<string, Promise<FetchSuccess>>();

const NEXUS_PRESETS: Record<AssetType, AssetPreset> = {
  ACAO: {
    url_base: 'https://investidor10.com.br/acoes/',
    labels:   ['P/L', 'Dividend Yield', 'P/VP', 'VPA', 'ROE', 'ROIC', 'Margem Líquida', 'Margem Bruta', 'Margem EBIT', 'EV/EBITDA', 'Dívida Líquida / Patrimônio', 'CAGR Receitas 5 Anos', 'LPA', 'PEG Ratio'],
  },
  FII: {
    url_base: 'https://investidor10.com.br/fiis/',
    labels:   ['Dividend Yield', 'P/VP', 'Valor Patrimonial', 'Liquidez Diária', 'Último Rendimento', 'Vacância Física', 'Vacância Financeira', 'Quantidade Ativos'],
  },
} as const;

const AGENTS: readonly string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
] as const;

const HTTP_DISPATCHER = new Agent({
  keepAliveTimeout:    10_000,
  keepAliveMaxTimeout: 30_000,
}).compose(interceptors.redirect({ maxRedirections: 5 }));

// ═══════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function normalizeBRNumber(raw: string): string {
  const hasPercent = raw.includes('%');
  const clean = raw.trim().replace(/\s+/g, ' ').replace('%', '').replace(/\./g, '').replace(',', '.');
  return hasPercent ? `${clean}%` : clean;
}

// ═══════════════════════════════════════════════════════════
// CLASSE PRINCIPAL
// ═══════════════════════════════════════════════════════════

export class NexusEngineUltra {

  static async fetchAtivo(
    ticker:    string,
    type:      AssetType = 'ACAO',
    isRetry:   boolean   = false,
  ): Promise<FetchAtivoResult> {

    const preset = NEXUS_PRESETS[type];
    const url    = `${preset.url_base}${ticker.toLowerCase()}/`;

    // 1. Cache HIT
    const cached = CACHE.get(url);
    if (cached) return { ticker, ...cached, cacheStatus: 'HIT' };

    // 2. Deduplicação
    if (PENDING_REQUESTS.has(url)) {
      try {
        const result = await PENDING_REQUESTS.get(url)!;
        return { ticker, ...result, cacheStatus: 'DEDUPE' };
      } catch { /* segue para nova tentativa */ }
    }

    const fetchPromise = this._executeFetchWithFallback(ticker, url, preset.labels, type);
    PENDING_REQUESTS.set(url, fetchPromise);

    try {
      const result = await fetchPromise;
      CACHE.set(url, result);
      return { ticker, ...result, cacheStatus: 'MISS' };
    } catch (error) {
      const err = error as Error;
      if (!isRetry && (err.message.includes('404') || err.message.includes('410'))) {
        const fallbackType: AssetType = type === 'ACAO' ? 'FII' : 'ACAO';
        return this.fetchAtivo(ticker, fallbackType, true);
      }
      return { ticker, error: err.message, cacheStatus: 'ERROR' };
    } finally {
      PENDING_REQUESTS.delete(url);
    }
  }

  /**
   * Executa a coleta com merge inteligente de fontes
   */
  private static async _executeFetchWithFallback(
    ticker:    string,
    url:       string,
    labels:    AssetLabel[],
    type:      AssetType,
  ): Promise<FetchSuccess> {

    const startTime = performance.now();
    let finalResults: ResultMap = {};
    let sourcesUsed: string[] = [];
    let bytesTotal = 0;

    // --- FASE 1: HTML Scraper ---
    try {
      const htmlResult = await this._executeFetchWithRetry(url, labels, 3, startTime);
      finalResults = { ...htmlResult.results };
      bytesTotal = htmlResult.metrics.bytesProcessed;
      
      if (htmlResult.metrics.foundKeys.length > 0) {
        sourcesUsed.push('SAX Scraper (HTML)');
      }

      if (htmlResult.metrics.foundKeys.length >= labels.length) {
        return htmlResult; 
      }
    } catch (e) {
      console.warn(`[NexusEngine] Scraper falhou para ${ticker}:`, (e as Error).message);
    }

    // --- FASE 2: Yahoo Finance (Complemento) ---
    try {
      const yahooSymbol = `${ticker.toUpperCase()}.SA`;
      const quote = await yahooFinance.quote(yahooSymbol);
      let yahooAdded = false;

      const fill = (key: AssetLabel, val: any) => {
        if (!finalResults[key] && val != null) {
          finalResults[key] = typeof val === 'number' ? val.toFixed(2) : val;
          yahooAdded = true;
        }
      };

      if (type === 'ACAO') {
        fill('P/L', quote.trailingPE);
        fill('P/VP', quote.priceToBook);
        fill('VPA', quote.bookValue);
        if (quote.trailingAnnualDividendYield) 
            fill('Dividend Yield', (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%');
      } else {
        fill('P/VP', quote.priceToBook);
        fill('Valor Patrimonial', quote.bookValue);
        if (quote.trailingAnnualDividendYield)
            fill('Dividend Yield', (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%');
      }

      if (yahooAdded) sourcesUsed.push('Yahoo Finance API');
    } catch (e) {
      console.warn(`[NexusEngine] Yahoo falhou para ${ticker}:`, (e as Error).message);
    }

    const foundKeys = Object.keys(finalResults) as AssetLabel[];
    if (foundKeys.length === 0) throw new Error(`Falha total na coleta de ${ticker}`);

    return {
      results: finalResults,
      metrics: {
        totalTimeMs:    performance.now() - startTime,
        bytesProcessed: bytesTotal,
        foundKeys,
        earlyAbort:     foundKeys.length >= labels.length,
        successRate:    foundKeys.length / labels.length,
        source:         sourcesUsed.join(' + ') as DataSource,
      },
    };
  }

  private static async _executeFetchWithRetry(
    url: string, labels: AssetLabel[], retries: number, globalStart: number
  ): Promise<FetchSuccess> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this._executeFetch(url, labels, globalStart);
      } catch (err) {
        const isTerminal = i === retries - 1 || (err as Error).message.includes('404');
        if (isTerminal) throw err;
        await delay(500 * (i + 1));
      }
    }
    throw new Error("Retry exhausted");
  }

  private static async _executeFetch(
    url: string, labels: AssetLabel[], globalStart: number
  ): Promise<FetchSuccess> {
    const labelSet = new Set(labels);
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 8000);

    const results: ResultMap = {};
    let foundCount = 0;
    let bytesProcessed = 0;
    let lastLabel = '';
    let depth = 0;
    let buffer = '';

    const parser = new Parser({
      ontext(t) {
        if (depth > 0) { buffer += t; return; }
        const txt = t.trim();
        if (labelSet.has(txt as AssetLabel)) lastLabel = txt;
      },
      onopentag(_, attr) {
        if (attr.class?.includes('value') || attr.class?.includes('v-value')) {
          if (depth === 0) buffer = '';
          depth++;
        }
      },
      onclosetag() {
        if (depth > 0) {
          depth--;
          if (depth === 0 && lastLabel) {
            results[lastLabel as AssetLabel] = normalizeBRNumber(buffer);
            foundCount++;
            lastLabel = '';
            if (foundCount >= labels.length) abortCtrl.abort();
          }
        }
      }
    });

    try {
      const { statusCode, body } = await request(url, {
        dispatcher: HTTP_DISPATCHER,
        headers: { 'User-Agent': AGENTS[0] },
        signal: abortCtrl.signal,
      });

      if (statusCode !== 200) throw new Error(`HTTP ${statusCode}`);

      for await (const chunk of body) {
        bytesProcessed += (chunk as Buffer).length;
        parser.write((chunk as Buffer).toString('utf-8'));
      }
      parser.end();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    return {
      results,
      metrics: {
        totalTimeMs: performance.now() - globalStart,
        bytesProcessed,
        foundKeys: Object.keys(results) as AssetLabel[],
        successRate: foundCount / labels.length,
        earlyAbort: foundCount >= labels.length,
        source: 'SAX Scraper (HTML)',
      }
    };
  }

  static clearCache() {
    CACHE.clear();
  }

  static async fetchHistoricoGrafico(
    ticker: string,
    period: ChartPeriod = '1y'
  ): Promise<HistoricalQuote[]> {
    try {
      const yahooSymbol = `${ticker.toUpperCase()}.SA`;
      const now = new Date();
      const past = new Date();

      switch (period) {
        case '1mo': past.setMonth(now.getMonth() - 1); break;
        case '3mo': past.setMonth(now.getMonth() - 3); break;
        case '6mo': past.setMonth(now.getMonth() - 6); break;
        case '1y':  past.setFullYear(now.getFullYear() - 1); break;
        case '5y':  past.setFullYear(now.getFullYear() - 5); break;
        case 'max': past.setFullYear(1990); break;
      }

      const result = await yahooFinance.historical(yahooSymbol, {
        period1: past,
        period2: now,
        interval: '1d'
      });

      return result.map(r => ({
        date: r.date,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume
      }));
    } catch (error) {
      console.error(`[NexusEngine] Erro ao buscar histórico para ${ticker}:`, error);
      throw new Error(`Falha ao buscar histórico de cotações para ${ticker}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORTAÇÕES DE CONCORRÊNCIA
// ═══════════════════════════════════════════════════════════

export async function runWithLimit<T>(tasks: Task<T>[], limit: number = 5): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < tasks.length; i++) {
    const p = tasks[i]().then(res => {
      results[i] = res;
      executing.delete(p);
    });
    executing.add(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}

export async function runNexusBatch(tickers: string[], type: AssetType = 'ACAO', limit = 5): Promise<FetchAtivoResult[]> {
  const tasks = tickers.map(t => () => NexusEngineUltra.fetchAtivo(t, type));
  return runWithLimit(tasks, limit);
}

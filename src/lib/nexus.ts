import { request, Agent, interceptors } from 'undici';
import { Parser } from 'htmlparser2';
import { LRUCache } from 'lru-cache';
import { performance } from 'perf_hooks';
import yahooFinance from 'yahoo-finance2';

import { 
  AssetType, 
  AssetLabel, 
  ResultMap, 
  FetchMetrics, 
  FetchSuccess, 
  FetchAtivoResult, 
  AssetPreset, 
  Task,
  ChartPeriod,
  HistoricalQuote,
  Dividend,
  DataSource
} from './nexus/types';

import { 
  delay, 
  normalizeBRNumber, 
  getRandomAgent 
} from './nexus/utils';

// ═══════════════════════════════════════════════════════════
// CONFIGURAÇÕES E CONSTANTES
// ═══════════════════════════════════════════════════════════

(yahooFinance as any).setGlobalConfig({ suppressNotices: ['yahooSurvey'] });

const CACHE = new LRUCache<string, FetchSuccess>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutos
});

const PENDING_REQUESTS = new Map<string, Promise<FetchSuccess>>();

const NEXUS_PRESETS: Record<AssetType, AssetPreset> = {
  ACAO: {
    url_base: 'https://investidor10.com.br/acoes',
    labels: [
      'P/L', 'Dividend Yield', 'P/VP', 'VPA', 'ROE', 'ROIC', 
      'Margem Líquida', 'Margem Bruta', 'Margem EBIT', 'EV/EBITDA', 
      'Dívida Líquida / Patrimônio', 'CAGR Receitas 5 Anos', 'LPA', 'PEG Ratio',
      'P/EBIT', 'P/Ativo', 'PSR', 'Giro Ativos', 'Dívida Bruta / Patrimônio'
    ],
  },
  FII: {
    url_base: 'https://investidor10.com.br/fiis',
    labels: [
      'Dividend Yield', 'P/VP', 'Valor Patrimonial', 'Liquidez Diária', 
      'Último Rendimento', 'Vacância Física', 'Vacância Financeira', 'Quantidade Ativos',
      'Patrimônio Líquido', 'Valor de Mercado', 'P/Ativo'
    ],
  },
} as const;

const HTTP_DISPATCHER = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
}).compose(interceptors.redirect({ maxRedirections: 5 }));

// ═══════════════════════════════════════════════════════════
// ENGINE PRINCIPAL
// ═══════════════════════════════════════════════════════════

export type { AssetType, FetchAtivoResult };

export class NexusEngineUltra {

  static async fetchAtivo(
    ticker: string,
    type: AssetType = 'ACAO',
    isRetry: boolean = false,
  ): Promise<FetchAtivoResult> {
    const cleanTicker = ticker.trim().replace(/\.SA$/i, '').toUpperCase();
    const preset = NEXUS_PRESETS[type];
    const url = `${preset.url_base}/${cleanTicker.toLowerCase()}/`;

    // 1. Cache HIT
    const cached = CACHE.get(url);
    if (cached) return { ticker: cleanTicker, ...cached, cacheStatus: 'HIT' };

    // 2. Deduplicação
    if (PENDING_REQUESTS.has(url)) {
      try {
        const result = await PENDING_REQUESTS.get(url)!;
        return { ticker: cleanTicker, ...result, cacheStatus: 'DEDUPE' };
      } catch { /* erro na pendente, tenta nova */ }
    }

    const fetchPromise = this._executeFetchWithFallback(cleanTicker, url, preset.labels, type);
    PENDING_REQUESTS.set(url, fetchPromise);

    try {
      const result = await fetchPromise;
      CACHE.set(url, result);
      return { ticker: cleanTicker, ...result, cacheStatus: 'MISS' };
    } catch (error) {
      const err = error as Error;
      console.error(`[NexusEngine] Falha em ${cleanTicker} (${type}): ${err.message}`);

      if (!isRetry && (err.message.includes('404') || err.message.includes('410'))) {
        const fallbackType: AssetType = type === 'ACAO' ? 'FII' : 'ACAO';
        return this.fetchAtivo(cleanTicker, fallbackType, true);
      }
      return { ticker: cleanTicker, error: err.message, cacheStatus: 'ERROR' };
    } finally {
      PENDING_REQUESTS.delete(url);
    }
  }

  private static async _executeFetchWithFallback(
    ticker: string,
    url: string,
    labels: AssetLabel[],
    type: AssetType,
  ): Promise<FetchSuccess> {
    const startTime = performance.now();
    let finalResults: ResultMap = {};
    let sourcesUsed: string[] = [];
    let bytesTotal = 0;

    // --- FASE 1: HTML Scraper ---
    try {
      const htmlResult = await this._executeFetchWithRetry(url, labels, 2, startTime);
      finalResults = { ...htmlResult.results };
      bytesTotal = htmlResult.metrics.bytesProcessed;
      
      if (htmlResult.metrics.foundKeys.length > 0) {
        sourcesUsed.push('SAX Scraper (HTML)');
      }

      if (htmlResult.metrics.foundKeys.length >= labels.length) {
        return htmlResult; 
      }
    } catch (e) {
      if ((e as Error).message.includes('404')) throw e;
      console.warn(`[NexusEngine] Scraper falhou para ${ticker}:`, (e as Error).message);
    }

    // --- FASE 2: Yahoo Finance (Complemento) ---
    try {
      const yahooSymbol = `${ticker.toUpperCase()}.SA`;
      const quote: any = await yahooFinance.quote(yahooSymbol);
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
        totalTimeMs: performance.now() - startTime,
        bytesProcessed: bytesTotal,
        foundKeys,
        earlyAbort: foundKeys.length >= labels.length,
        successRate: foundKeys.length / labels.length,
        source: sourcesUsed.join(' + ') as DataSource,
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
        await delay(800 * (i + 1));
      }
    }
    throw new Error("Retry exhausted");
  }

  private static async _executeFetch(
    url: string, labels: AssetLabel[], globalStart: number
  ): Promise<FetchSuccess> {
    const labelMap: Record<string, AssetLabel> = {};
    labels.forEach(l => labelMap[l.toLowerCase()] = l);

    // Aliases comuns
    labelMap['dy'] = 'Dividend Yield';
    labelMap['p/l'] = 'P/L';
    labelMap['p/vp'] = 'P/VP';
    labelMap['vpa'] = 'VPA';
    
    const allLabels = new Set(Object.keys(labelMap));
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 15000);

    const results: ResultMap = {};
    let foundCount = 0;
    let bytesProcessed = 0;
    let lastLabel: AssetLabel | '' = '';
    let depth = 0;
    let buffer = '';

    const ignoreTags = new Set(['script', 'style', 'option', 'title', 'meta', 'footer', 'nav', 'header']);
    let ignoreDepth = 0;

    const parser = new Parser({
      onopentag(name, attr) {
        if (ignoreTags.has(name)) { ignoreDepth++; return; }
        if (ignoreDepth > 0) return;

        const isValueClass = attr.class?.split(/\s+/).some(c => c === 'value' || c === 'v-value' || c === '_card-body');
        if (isValueClass) {
          if (depth === 0) buffer = '';
          depth++;
        } else if (depth > 0) { depth++; }

        if (attr.title && allLabels.has(attr.title.toLowerCase())) {
          lastLabel = labelMap[attr.title.toLowerCase()];
        }
      },
      ontext(t) {
        if (ignoreDepth > 0) return;
        if (depth > 0) { buffer += t; return; }

        const txt = t.trim();
        if (!txt || txt.length > 50) return;
        const lowerTxt = txt.endsWith(':') ? txt.slice(0, -1).toLowerCase() : txt.toLowerCase();
        
        if (allLabels.has(lowerTxt)) {
          lastLabel = labelMap[lowerTxt];
        }
      },
      onclosetag(name) {
        if (ignoreTags.has(name)) { ignoreDepth--; return; }
        if (ignoreDepth > 0) return;

        if (depth > 0) {
          depth--;
          if (depth === 0 && lastLabel) {
            const normalized = normalizeBRNumber(buffer);
            if (normalized) {
              results[lastLabel] = normalized;
              foundCount++;
              lastLabel = '';
              if (foundCount >= labels.length) abortCtrl.abort();
            }
          }
        }
      }
    });

    try {
      const { statusCode, body } = await request(url, {
        dispatcher: HTTP_DISPATCHER,
        headers: { 
          'User-Agent': getRandomAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Referer': 'https://investidor10.com.br/',
          'Origin': 'https://investidor10.com.br',
          'Cache-Control': 'no-cache'
        },
        signal: abortCtrl.signal,
      });

      if (statusCode !== 200) {
        await body.dump();
        throw new Error(`HTTP ${statusCode}`);
      }

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

  static clearCache() { CACHE.clear(); }

  static async fetchHistoricoGrafico(ticker: string, period: ChartPeriod = '1y'): Promise<HistoricalQuote[]> {
    try {
      const yahooSymbol = `${ticker.toUpperCase()}.SA`;
      const result: any = await yahooFinance.historical(yahooSymbol, {
        period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), 
        period2: new Date(),
        interval: '1d'
      });
      return result.map(r => ({ ...r, date: new Date(r.date) }));
    } catch (e) {
      throw new Error(`Yahoo Histórico Falhou: ${ticker}`);
    }
  }

  static async fetchDividends(ticker: string): Promise<Dividend[]> {
    try {
      const yahooSymbol = `${ticker.toUpperCase()}.SA`;
      const result: any = await (yahooFinance as any).dividends(yahooSymbol, {
        period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000 * 5), // 5 anos
        period2: new Date(),
      });
      return result.map(r => ({ date: new Date(r.date), amount: r.dividend }));
    } catch (e) {
      throw new Error(`Yahoo Dividendos Falhou: ${ticker}`);
    }
  }

  static async searchTicker(query: string): Promise<any[]> {
    try {
      const result: any = await yahooFinance.search(query);
      return result.quotes.filter((q: any) => q.exchange === 'SAO' || (q.symbol && q.symbol.endsWith('.SA')));
    } catch (e) {
      console.warn(`[NexusEngine] Busca falhou para ${query}:`, (e as Error).message);
      return [];
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

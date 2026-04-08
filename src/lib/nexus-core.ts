import { Parser } from 'htmlparser2';
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
} from './nexus/types.js';

import { 
  delay, 
  normalizeBRNumber, 
  getRandomAgent 
} from './nexus/utils.js';

// ═══════════════════════════════════════════════════════════
// CONFIGURAÇÕES E CONSTANTES
// ═══════════════════════════════════════════════════════════

// Defensive config for yahooFinance to handle different import behaviors
// yahoo-finance2 exports a default instance, but depending on the module system it might be nested
let yf: any;
if (yahooFinance && (yahooFinance as any).default && typeof (yahooFinance as any).default.quote === 'function') {
  yf = (yahooFinance as any).default;
} else if (yahooFinance && typeof (yahooFinance as any).quote === 'function') {
  yf = yahooFinance;
} else if (yahooFinance && (yahooFinance as any).default && (yahooFinance as any).default.default) {
  yf = (yahooFinance as any).default.default;
} else {
  // Fallback if it's a class that needs instantiation (though v2 usually exports an instance)
  try {
    const YFClass = (yahooFinance as any).default || yahooFinance;
    yf = new YFClass();
  } catch (e) {
    yf = yahooFinance; // Last resort
  }
}

try {
  if (yf && typeof yf.setGlobalConfig === 'function') {
    yf.setGlobalConfig({ suppressNotices: ['yahooSurvey'] });
  }
} catch (e) {
  console.warn('[NexusEngine] Could not set yahooFinance global config:', e);
}

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

// ═══════════════════════════════════════════════════════════
// ENGINE PRINCIPAL
// ═══════════════════════════════════════════════════════════

export type { AssetType, FetchAtivoResult };

export class NexusEngineUltra {

  // --- WARM START CACHE ---
  // In serverless environments, the container might stay alive for a few minutes.
  // This static map acts as a zero-latency cache for repeated requests.
  private static memoryCache = new Map<string, { data: FetchAtivoResult; timestamp: number }>();
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  static async fetchAtivo(
    ticker: string,
    type: AssetType = 'ACAO',
    isRetry: boolean = false,
  ): Promise<FetchAtivoResult> {
    const cleanTicker = ticker.trim().replace(/\.SA$/i, '').toUpperCase();
    const cacheKey = `${cleanTicker}-${type}`;

    // Check Warm Start Cache
    if (!isRetry) {
      const cached = this.memoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return { 
          ...cached.data, 
          cacheStatus: 'HIT', 
          logs: [`[${cleanTicker}] Retornado do cache em memória (Warm Start) em 0ms`] 
        } as FetchAtivoResult;
      }
    }

    const preset = NEXUS_PRESETS[type];
    const url = `${preset.url_base}/${cleanTicker.toLowerCase()}/`;
    const logs: string[] = [];

    const log = (m: string) => logs.push(`[${cleanTicker}] ${m}`);

    log(`Iniciando busca profunda para ${cleanTicker} (${type})`);
    const fetchPromise = this._executeFetchWithFallback(cleanTicker, url, preset.labels, type, log);

    try {
      const result = await fetchPromise;
      const finalData = { ticker: cleanTicker, ...result, cacheStatus: 'MISS' as const, logs };
      
      // Save to Warm Start Cache
      this.memoryCache.set(cacheKey, { data: finalData, timestamp: Date.now() });
      
      return finalData;
    } catch (error) {
      const err = error as Error;
      log(`FALHA CRÍTICA: ${err.message}`);
      console.error(`[NexusEngine] Falha em ${cleanTicker} (${type}): ${err.message}`);

      if (!isRetry && (err.message.includes('404') || err.message.includes('410') || err.message.includes('Falha total'))) {
        log(`Falha primária detectada. Tentando fallback para outro tipo de ativo...`);
        const fallbackType: AssetType = type === 'ACAO' ? 'FII' : 'ACAO';
        const fallbackResult = await this.fetchAtivo(cleanTicker, fallbackType, true);
        if ('logs' in fallbackResult && fallbackResult.logs) {
          logs.push(...fallbackResult.logs);
        }
        return fallbackResult;
      }
      return { ticker: cleanTicker, error: err.message, cacheStatus: 'ERROR', logs };
    }
  }

  private static async _executeFetchWithFallback(
    ticker: string,
    url: string,
    labels: AssetLabel[],
    type: AssetType,
    log: (m: string) => void
  ): Promise<FetchSuccess> {
    const startTime = performance.now();
    let finalResults: ResultMap = {};
    let sourcesUsed: string[] = [];
    let bytesTotal = 0;

    // --- FASE 1: HTML Scraper ---
    log(`Fase 1: Disparando Scraper Zero-AST para ${url}`);
    try {
      const htmlResult = await this._executeFetchWithRetry(url, labels, 2, startTime, log);
      finalResults = { ...htmlResult.results };
      bytesTotal = htmlResult.metrics.bytesProcessed;
      
      if (htmlResult.metrics.foundKeys.length > 0) {
        sourcesUsed.push('SAX Scraper (HTML)');
        log(`Scraper encontrou ${htmlResult.metrics.foundKeys.length} indicadores.`);
      }

      if (htmlResult.metrics.foundKeys.length >= labels.length) {
        log(`Scraper obteve todos os dados necessários. Early Abort acionado.`);
        return htmlResult; 
      }
    } catch (e) {
      if ((e as Error).message.includes('404') || (e as Error).message.includes('410')) {
        log(`Aviso: Investidor10 retornou ${(e as Error).message}. Tentando fallback alternativo...`);
        // We don't throw here so it can proceed to Phase 2 (Yahoo Finance)
      } else {
        log(`Aviso: Scraper falhou ou incompleto: ${(e as Error).message}`);
      }
    }

    // --- FASE 2: Yahoo Finance (Complemento) ---
    log(`Fase 2: Consultando Yahoo Finance API para complementar dados...`);
    try {
      const yahooSymbol = `${ticker.toUpperCase()}.SA`;
      log(`Yahoo: Buscando quote para ${yahooSymbol}`);
      const quote: any = await yf.quote(yahooSymbol);
      let yahooAdded = 0;

      const fill = (key: AssetLabel, val: any) => {
        if (!finalResults[key] && val != null && val !== 0) {
          finalResults[key] = typeof val === 'number' ? val.toFixed(2) : val;
          yahooAdded++;
        }
      };

      if (type === 'ACAO') {
        fill('P/L', quote.trailingPE);
        fill('P/VP', quote.priceToBook);
        fill('VPA', quote.bookValue);
        fill('LPA', quote.epsTrailingTwelveMonths);
        
        // Advanced fallbacks for ACAO
        if (quote.profitMargins) fill('Margem Líquida', (quote.profitMargins * 100).toFixed(2) + '%');
        if (quote.returnOnEquity) fill('ROE', (quote.returnOnEquity * 100).toFixed(2) + '%');
        if (quote.returnOnAssets) fill('ROIC', (quote.returnOnAssets * 100).toFixed(2) + '%'); // ROA as proxy
        if (quote.revenuePerShare && quote.regularMarketPrice) fill('PSR', quote.regularMarketPrice / quote.revenuePerShare);

        if (quote.trailingAnnualDividendYield) 
          fill('Dividend Yield', (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%');
      } else {
        fill('P/VP', quote.priceToBook);
        fill('Valor Patrimonial', quote.bookValue);
        if (quote.trailingAnnualDividendYield)
          fill('Dividend Yield', (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%');
        
        // FII specific fallbacks from Yahoo if Investidor10 failed completely
        if (quote.regularMarketPrice) {
          fill('Valor de Mercado', quote.marketCap);
        }
      }

      if (yahooAdded > 0) {
        sourcesUsed.push('Yahoo Finance API');
        log(`Yahoo Finance complementou ${yahooAdded} indicadores.`);
      } else {
        log(`Yahoo Finance não encontrou novos dados úteis.`);
      }
    } catch (e) {
      log(`Aviso: Falha na API do Yahoo: ${(e as Error).message}`);
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
      }
    };
  }

  private static async _executeFetchWithRetry(
    url: string, labels: AssetLabel[], retries: number, globalStart: number, log: (m: string) => void
  ): Promise<FetchSuccess> {
    for (let i = 0; i < retries; i++) {
      try {
        if (i > 0) log(`Tentativa de re-conexão ${i}...`);
        return await this._executeFetch(url, labels, globalStart, log);
      } catch (err) {
        const isTerminal = i === retries - 1 || (err as Error).message.includes('404');
        if (isTerminal) throw err;
        log(`Erro na tentativa ${i + 1}: ${(err as Error).message}. Aguardando backoff...`);
        await delay(300 * (i + 1)); // Reduced from 800 to 300 to prevent Vercel timeout
      }
    }
    throw new Error("Retry exhausted");
  }

  private static async _executeFetch(
    url: string, labels: AssetLabel[], globalStart: number, log: (m: string) => void
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
    
    // Watchdog Timer: Reduced to 4s to ensure it aborts BEFORE Vercel's 10s hard limit
    let timeoutId: NodeJS.Timeout;
    const resetWatchdog = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => abortCtrl.abort(), 4000); 
    };
    resetWatchdog();

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
        } else if (attr['aria-label'] && allLabels.has(attr['aria-label'].toLowerCase())) {
          lastLabel = labelMap[attr['aria-label'].toLowerCase()];
        } else if (attr['data-title'] && allLabels.has(attr['data-title'].toLowerCase())) {
          lastLabel = labelMap[attr['data-title'].toLowerCase()];
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
              log(`Scraper: Encontrado ${lastLabel} = ${normalized}`);
              lastLabel = '';
              if (foundCount >= labels.length) {
                log(`Scraper: Todos os ${labels.length} indicadores encontrados. Abortando stream.`);
                abortCtrl.abort();
              }
            }
          }
        }
      }
    });

    try {
      const userAgent = getRandomAgent();
      log(`Conectando... UA: ${userAgent.slice(0, 30)}...`);
      const response = await fetch(url, {
        headers: { 
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://investidor10.com.br/',
          'Origin': 'https://investidor10.com.br',
          'Cache-Control': 'max-age=0',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: abortCtrl.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      log(`Stream iniciado. Analisando bytes...`);
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              resetWatchdog(); // Data is flowing, keep connection alive
              bytesProcessed += value.length;
              parser.write(decoder.decode(value, { stream: true }));
            }
          }
        } finally {
          // Clean up the reader to prevent memory leaks in serverless
          if (abortCtrl.signal.aborted) {
            reader.cancel().catch(() => {});
          }
          reader.releaseLock();
        }
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
    this.memoryCache.clear();
  }

  static async fetchHistoricoGrafico(ticker: string, period: ChartPeriod = '1y'): Promise<HistoricalQuote[]> {
    try {
      const yahooSymbol = `${ticker.toUpperCase()}.SA`;
      const result: any = await yf.historical(yahooSymbol, {
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
      const result: any = await yf.dividends(yahooSymbol, {
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
      const result: any = await yf.search(query);
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

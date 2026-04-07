import { request, Agent, interceptors } from 'undici';
import { Parser } from 'htmlparser2';
import { LRUCache } from 'lru-cache';
import { performance } from 'perf_hooks';
import YahooFinance from 'yahoo-finance2';

// ═══════════════════════════════════════════════════════════
// TIPOS E INTERFACES
// ═══════════════════════════════════════════════════════════

/** Tipos de ativo suportados */
export type AssetType = 'ACAO' | 'FII';

/** Status de origem do resultado em relação ao cache */
export type CacheStatus = 'HIT' | 'MISS' | 'DEDUPE' | 'ERROR';

/** Fonte da coleta dos dados */
export type DataSource = 'Yahoo Finance API' | 'SAX Scraper (HTML)';

/** Labels disponíveis para ações */
export type AcaoLabel = 'P/L' | 'Dividend Yield' | 'P/VP' | 'VPA' | 'ROE' | 'ROIC' | 'Margem Líquida' | 'Margem Bruta' | 'Margem EBIT' | 'EV/EBITDA' | 'Dívida Líquida / Patrimônio' | 'CAGR Receitas 5 Anos' | 'LPA' | 'PEG Ratio';

/** Labels disponíveis para FIIs */
export type FiiLabel = 'Dividend Yield' | 'P/VP' | 'Valor Patrimonial' | 'Liquidez Diária' | 'Último Rendimento' | 'Vacância Física' | 'Vacância Financeira' | 'Quantidade Ativos';

/** Union de todos os labels possíveis */
export type AssetLabel = AcaoLabel | FiiLabel;

/** Mapa de resultados dos indicadores coletados */
export type ResultMap = Partial<Record<AssetLabel, string>>;

/** Períodos suportados para o gráfico histórico */
export type ChartPeriod = '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max';

/** Ponto de dado histórico para gráficos */
export interface HistoricalQuote {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Métricas de desempenho da coleta */
export interface FetchMetrics {
  totalTimeMs:    number;
  bytesProcessed: number;
  foundKeys:      AssetLabel[];
  successRate:    number;
  earlyAbort:     boolean;
  source:         DataSource;
}

/** Resultado bem-sucedido de uma coleta */
export interface FetchSuccess {
  results: ResultMap;
  metrics: FetchMetrics;
}

/** Resultado completo retornado ao chamador (inclui ticker e status de cache) */
export interface AtivoBuscado extends FetchSuccess {
  ticker:      string;
  cacheStatus: CacheStatus;
}

/** Resultado quando a coleta falha */
export interface AtivoErro {
  ticker:      string;
  error:       string;
  cacheStatus: 'ERROR';
}

/** Union do retorno de fetchAtivo */
export type FetchAtivoResult = AtivoBuscado | AtivoErro;

/** Configuração de um preset de tipo de ativo */
interface AssetPreset {
  url_base: string;
  labels:   AssetLabel[];
}

/** Task para o concurrency pool */
type Task<T> = () => Promise<T>;

// ═══════════════════════════════════════════════════════════
// INSTÂNCIAS GLOBAIS
// ═══════════════════════════════════════════════════════════

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/** Cache LRU — 1000 entradas, TTL de 5 minutos */
const CACHE = new LRUCache<string, FetchSuccess>({
  max: 1000,
  ttl: 1000 * 60 * 5,
});

/** Deduplicação de requisições simultâneas para a mesma URL */
const PENDING_REQUESTS = new Map<string, Promise<FetchSuccess>>();

// ═══════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════

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
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
] as const;

/** Agent HTTP único — reutiliza connection pool em todo o módulo */
const HTTP_DISPATCHER = new Agent({
  keepAliveTimeout:    10_000,
  keepAliveMaxTimeout: 30_000,
}).compose(interceptors.redirect({ maxRedirections: 5 }));

// ═══════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normaliza número no formato brasileiro para string de float.
 * Ex: "1.234,56" → "1234.56" | "12,5%" → "12.5%"
 */
function normalizeBRNumber(raw: string): string {
  const hasPercent = raw.includes('%');
  const clean = raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace('%', '')
    .replace(/\./g, '')  // remove separadores de milhar
    .replace(',', '.');  // troca vírgula decimal por ponto
  return hasPercent ? `${clean}%` : clean;
}

/** Constrói um Set de labels para lookup O(1) */
function buildLabelSet(labels: AssetLabel[]): Set<string> {
  return new Set<string>(labels);
}

/** Type guard para verificar se um valor é um AssetType válido */
function isAssetType(value: string): value is AssetType {
  return value === 'ACAO' || value === 'FII';
}

// ═══════════════════════════════════════════════════════════
// CLASSE PRINCIPAL
// ═══════════════════════════════════════════════════════════

export class NexusEngineUltra {

  /**
   * Busca os indicadores de um ativo pelo ticker.
   * Fluxo: Cache → Deduplicação → Yahoo Finance → HTML Scraper
   */
  static async fetchAtivo(
    ticker:    string,
    type:      AssetType = 'ACAO',
    isRetry:   boolean   = false,
  ): Promise<FetchAtivoResult> {

    if (!isAssetType(type)) {
      throw new Error(`Tipo de ativo inválido: "${type}". Use "ACAO" ou "FII".`);
    }

    const preset = NEXUS_PRESETS[type];
    const url    = `${preset.url_base}${ticker.toLowerCase()}/`;

    // ── Cache HIT ────────────────────────────────────────────
    const cached = CACHE.get(url);
    if (cached) {
      return { ticker, ...cached, cacheStatus: 'HIT' };
    }

    // ── Deduplicação ─────────────────────────────────────────
    if (PENDING_REQUESTS.has(url)) {
      try {
        const result = await PENDING_REQUESTS.get(url)!;
        return { ticker, ...result, cacheStatus: 'DEDUPE' };
      } catch {
        // Request em andamento falhou — segue para nova tentativa
      }
    }

    const fetchPromise = this._executeFetchWithFallback(ticker, url, preset.labels, type);
    PENDING_REQUESTS.set(url, fetchPromise);

    try {
      const result = await fetchPromise;
      CACHE.set(url, result);
      return { ticker, ...result, cacheStatus: 'MISS' };

    } catch (error) {
      const err = error as Error;

      // Fallback de tipo apenas em 404/410
      if (
        !isRetry &&
        (err.message.includes('HTTP 404') || err.message.includes('HTTP 410'))
      ) {
        const fallbackType: AssetType = type === 'ACAO' ? 'FII' : 'ACAO';
        return this.fetchAtivo(ticker, fallbackType, true);
      }

      return { ticker, error: err.message, cacheStatus: 'ERROR' };

    } finally {
      PENDING_REQUESTS.delete(url);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Camada 1: HTML Scraper → Camada 2: Yahoo Finance (Fallback)
  // ─────────────────────────────────────────────────────────
  private static async _executeFetchWithFallback(
    ticker:    string,
    url:       string,
    labels:    AssetLabel[],
    type:      AssetType,
  ): Promise<FetchSuccess> {

    const startTime = performance.now();

    // ── HTML Scraper com retry ────────────────────────────
    try {
      const htmlResult = await this._executeFetchWithRetry(url, labels, 3, startTime);
      // Se encontrou a maioria dos dados, retorna
      if (htmlResult.metrics.foundKeys.length > 0) {
        return htmlResult;
      }
    } catch (e) {
      console.warn(`[NexusEngine] HTML Scraper falhou para ${ticker}:`, (e as Error).message);
    }

    // ── Yahoo Finance API (Fallback) ──────────────────────
    try {
      const yahooSymbol = `${ticker.toUpperCase()}.SA`;
      const quote       = await yahooFinance.quote(yahooSymbol);
      const results:    ResultMap = {};

      if (type === 'ACAO') {
        if (quote.trailingPE != null)
          results['P/L']           = quote.trailingPE.toFixed(2);
        if (quote.trailingAnnualDividendYield != null)
          results['Dividend Yield'] = (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%';
        if (quote.priceToBook != null)
          results['P/VP']          = quote.priceToBook.toFixed(2);
        if (quote.bookValue != null)
          results['VPA']           = quote.bookValue.toFixed(2);
      } else {
        if (quote.trailingAnnualDividendYield != null)
          results['Dividend Yield']    = (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%';
        if (quote.priceToBook != null)
          results['P/VP']              = quote.priceToBook.toFixed(2);
        if (quote.bookValue != null)
          results['Valor Patrimonial'] = quote.bookValue.toFixed(2);
      }

      const foundKeys = Object.keys(results) as AssetLabel[];

      if (foundKeys.length > 0) {
        return {
          results,
          metrics: {
            totalTimeMs:    performance.now() - startTime,
            bytesProcessed: 0,
            foundKeys,
            earlyAbort:     foundKeys.length >= labels.length,
            successRate:    foundKeys.length / labels.length,
            source:         'Yahoo Finance API',
          },
        };
      }
    } catch (e) {
      console.warn(`[NexusEngine] Yahoo Finance falhou para ${ticker}:`, (e as Error).message);
    }

    throw new Error(`[NexusEngine] Todas as fontes falharam para ${ticker}`);
  }

  // ─────────────────────────────────────────────────────────
  // Retry com backoff linear
  // ─────────────────────────────────────────────────────────
  private static async _executeFetchWithRetry(
    url:             string,
    labels:          AssetLabel[],
    retries:         number,
    globalStartTime: number,
  ): Promise<FetchSuccess> {

    for (let i = 0; i < retries; i++) {
      try {
        return await this._executeFetch(url, labels, globalStartTime);
      } catch (error) {
        const err = error as Error;
        const isTerminal =
          i === retries - 1 ||
          err.name === 'AbortError'         ||
          err.message.includes('404')       ||
          err.message.includes('410');

        if (isTerminal) throw err;

        const waitMs = 500 * (i + 1);
        console.warn(`[NexusEngine] Tentativa ${i + 1} falhou para ${url}. Aguardando ${waitMs}ms...`);
        await delay(waitMs);
      }
    }

    // Nunca alcançado — satisfaz o compilador TS
    throw new Error(`[NexusEngine] Todas as ${retries} tentativas falharam para ${url}`);
  }

  // ─────────────────────────────────────────────────────────
  // Requisição HTTP + Parser SAX
  // ─────────────────────────────────────────────────────────
  private static async _executeFetch(
    url:             string,
    labels:          AssetLabel[],
    globalStartTime: number,
  ): Promise<FetchSuccess> {

    const userAgent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
    const labelSet  = buildLabelSet(labels);
    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 8000);

    const results: ResultMap = {};
    let foundCount    = 0;
    let bytesProcessed = 0;

    // Estado do parser SAX
    let lastSeenLabel = '';
    let valueTagDepth = 0;   // contador de profundidade para tags aninhadas
    let capturedValue = '';

    // ── Parser SAX ────────────────────────────────────────
    const parser = new Parser({
      ontext(text: string): void {
        if (valueTagDepth > 0) {
          capturedValue += text;
          return;
        }
        const t = text.trim();
        if (!t) return;
        if (labelSet.has(t)) {
          lastSeenLabel = t;
        }
      },

      onopentag(_name: string, attribs: Record<string, string>): void {
        if (
          attribs.class &&
          (attribs.class.includes('value') || attribs.class.includes('v-value'))
        ) {
          if (valueTagDepth === 0) capturedValue = '';
          valueTagDepth++;
        }
      },

      onclosetag(_name: string): void {
        if (valueTagDepth > 0) {
          valueTagDepth--;
          if (valueTagDepth === 0 && lastSeenLabel && !results[lastSeenLabel as AssetLabel]) {
            results[lastSeenLabel as AssetLabel] = normalizeBRNumber(capturedValue);
            foundCount++;
            lastSeenLabel = '';
            if (foundCount >= labels.length) abortCtrl.abort();
          }
        }
      },
    });

    // ── Requisição HTTP ───────────────────────────────────
    try {
      const { statusCode, body } = await request(url, {
        dispatcher: HTTP_DISPATCHER,
        headers:    { 'User-Agent': userAgent },
        signal:     abortCtrl.signal,
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
        totalTimeMs:    performance.now() - globalStartTime,
        bytesProcessed,
        foundKeys:      Object.keys(results) as AssetLabel[],
        successRate:    foundCount / labels.length,
        earlyAbort:     foundCount >= labels.length,
        source:         'SAX Scraper (HTML)',
      },
    };
  }

  static clearCache() {
    CACHE.clear();
  }

  // ─────────────────────────────────────────────────────────
  // Histórico de Cotações para Gráficos
  // ─────────────────────────────────────────────────────────
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
// CONTROLE DE CONCORRÊNCIA
// Preserva ordem de entrada e remove corretamente a promise resolvida
// ═══════════════════════════════════════════════════════════

export async function runWithLimit<T>(
  tasks: Task<T>[],
  limit: number = 5,
): Promise<T[]> {
  const results:   T[]        = new Array(tasks.length);
  const executing: Set<Promise<void>> = new Set();

  for (let i = 0; i < tasks.length; i++) {
    const index = i;
    const p: Promise<void> = tasks[index]().then((res: T) => {
      results[index] = res;
      executing.delete(p);
    });

    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// ═══════════════════════════════════════════════════════════
// API PÚBLICA — batch de tickers
// ═══════════════════════════════════════════════════════════

export async function runNexusBatch(
  tickers: string[],
  type:    AssetType = 'ACAO',
  limit:   number    = 5,
): Promise<FetchAtivoResult[]> {
  const tasks = tickers.map((t) => () => NexusEngineUltra.fetchAtivo(t, type));
  return runWithLimit<FetchAtivoResult>(tasks, limit);
}

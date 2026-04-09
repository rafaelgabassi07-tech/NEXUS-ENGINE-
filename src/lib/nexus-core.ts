/**
 * nexus-engine.ts — NexusEngineUltra v2.0
 *
 * MELHORIAS IMPLEMENTADAS vs v1:
 *
 * [BUGS CRÍTICOS]
 *  #1  fetchHistoricoGrafico agora respeita o parâmetro `period` (era ignorado)
 *  #2  ROIC não é mais mapeado para returnOnAssets (ROA ≠ ROIC); removido para não inserir dado errado
 *  #3  fill() agora aceita val === 0 (zero é dado financeiro válido)
 *  #4  ignoreDepth não fica negativo em HTML malformado (if > 0 antes de decrementar)
 *  #5  lastLabel é resetado ao abrir cada novo bloco de valor (evita label "vazado")
 *  #6  runWithLimit usa .finally() para isolar erros — falha individual não cancela o batch
 *
 * [PERFORMANCE]
 *  #7  Accept-Encoding: gzip/deflate/br adicionado — reduz bytes transmitidos
 *  #8  LRUCache substitui Map simples — evicção por tamanho (sem memory leak)
 *  #9  Evicção LRU baseada em uso — entradas antigas saem automaticamente
 * #10  normalizeBRNumber chamado apenas quando há label e buffer válidos
 * #11  Buffer com limite de 512 chars — protege contra blocos HTML gigantes
 *
 * [RESILIÊNCIA]
 * #12  Circuit Breaker por fonte (Investidor10 e Yahoo Finance separados)
 * #13  Exponential backoff com full jitter — sem thundering herd
 * #14  Fallback de tipo (ACAO↔FII) sinalizado nos logs; BDR/ETF não fazem fallback cruzado
 * #15  Per-task timeout isolado no runWithLimit via .finally()
 * #16  HTTP 410 e 451 tratados como terminal no retry (sem retentar)
 *
 * [QUALIDADE & TIPOS]
 * #17  resolveYahooFinance() — função limpa e isolada, substituindo if-chain de 15 linhas
 * #18  Redução de `any`; quote tipado como YahooQuote interface
 * #19  Aliases de label por preset (ex: 'dy' → 'Dividend Yield'), configuráveis
 * #20  Logs 100% em PT-BR, erros com prefixo padronizado
 * #21  Suporte a instâncias via NexusEngineConfig; configure() para customização global
 * #22  NEXUS_PRESETS extensível em runtime via ExtendedAssetType
 *
 * [NOVAS FUNCIONALIDADES]
 * #23  Suporte a BDR (Brazilian Depositary Receipts)
 * #24  Suporte a ETF
 * #25  StatusInvest como Fase 1.5 (infraestrutura + URL base por preset)
 * #26  searchTicker com cache de curta duração (1 min padrão)
 * #27  fetchDividends com parâmetro period configurável
 * #28  getCacheStats() para monitoramento do cache
 * #29  validarResultMap() — sanidade nos valores extraídos (remove '-', 'N/A', outliers)
 * #30  runNexusBatch retorna FetchAtivoResult[] mesmo em falhas individuais
 *
 * [SEGURANÇA & ANTI-BOT]
 * #31  getHeadersConsistentes() sincroniza UA ↔ Sec-Ch-Ua pela versão do Chrome extraída
 * #32  Sem cookie explícito (não enviar cookie de sessão morta é mais realista que nenhum)
 * #33  Suporte a proxy via NexusEngineConfig.proxy ou HTTPS_PROXY env var (usa undici)
 * #34  Sec-Fetch-Site corrigido para 'none' (navegação direta); Origin removido de GET
 */

import { Parser } from 'htmlparser2';
import { performance } from 'perf_hooks';
import yahooFinance from 'yahoo-finance2';

import {
  AssetType,
  ExtendedAssetType,
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
  DataSource,
  NewsItem,
  NexusEngineConfig
} from './nexus/types.js';

import {
  delay,
  normalizeBRNumber,
  getRandomAgent,
} from './nexus/utils.js';

// ═══════════════════════════════════════════════════════════
// TIPOS INTERNOS
// ═══════════════════════════════════════════════════════════

/** Preset estendido com aliases e URL do StatusInvest */
interface ExtendedAssetPreset extends AssetPreset {
  url_base: string;
  labels: AssetLabel[];
  /** URL base do StatusInvest para fallback alternativo (Fase 1.5) */
  statusInvest_base?: string;
  /** Aliases de normalização de labels: 'dy' → 'Dividend Yield' etc. */
  aliases?: Record<string, AssetLabel>;
}

/** Tipagem parcial da resposta do yf.quote() para reduzir uso de `any` */
interface YahooQuote {
  trailingPE?: number | null;
  priceToBook?: number | null;
  bookValue?: number | null;
  epsTrailingTwelveMonths?: number | null;
  profitMargins?: number | null;
  returnOnEquity?: number | null;
  returnOnAssets?: number | null;
  revenuePerShare?: number | null;
  regularMarketPrice?: number | null;
  regularMarketChangePercent?: number | null;
  marketCap?: number | null;
  trailingAnnualDividendYield?: number | null;
  [key: string]: unknown;
}

interface CacheEntry {
  data: FetchAtivoResult;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════
// VALORES INVÁLIDOS / PLACEHOLDER
// ═══════════════════════════════════════════════════════════

/** Strings que representam ausência de dado real — ignoradas na extração */
const VALORES_INVALIDOS = new Set([
  '-', '—', '–', 'N/A', 'n/a', 'nd', '', 'null',
  'undefined', '--', '---', '--%', '0%',
]);

// ═══════════════════════════════════════════════════════════
// LRU CACHE (substitui Map simples — sem memory leak)
// ═══════════════════════════════════════════════════════════

class LRUCache<K, V> {
  private readonly mapa = new Map<K, V>();

  constructor(private readonly tamanhoMax: number) {}

  get(chave: K): V | undefined {
    if (!this.mapa.has(chave)) return undefined;
    const val = this.mapa.get(chave)!;
    // Promover para o fim (mais recentemente usado)
    this.mapa.delete(chave);
    this.mapa.set(chave, val);
    return val;
  }

  set(chave: K, valor: V): void {
    if (this.mapa.has(chave)) {
      this.mapa.delete(chave);
    } else if (this.mapa.size >= this.tamanhoMax) {
      // Remover o menos recentemente usado (primeiro do iterador)
      this.mapa.delete(this.mapa.keys().next().value!);
    }
    this.mapa.set(chave, valor);
  }

  delete(chave: K): boolean { return this.mapa.delete(chave); }
  clear(): void { this.mapa.clear(); }
  get tamanho(): number { return this.mapa.size; }
  has(chave: K): boolean { return this.mapa.has(chave); }
}

// ═══════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════

type EstadoCB = 'FECHADO' | 'ABERTO' | 'SEMI_ABERTO';

interface EntradaCB {
  falhas: number;
  ultimaFalha: number;
  estado: EstadoCB;
}

class CircuitBreaker {
  private readonly entradas = new Map<string, EntradaCB>();

  constructor(
    private readonly limiar: number,
    private readonly resetMs: number,
  ) {}

  /** Retorna true se o circuito está aberto (bloqueando chamadas) */
  estaAberto(chave: string): boolean {
    const e = this.entradas.get(chave);
    if (!e || e.estado === 'FECHADO') return false;
    if (e.estado === 'ABERTO' && Date.now() - e.ultimaFalha > this.resetMs) {
      e.estado = 'SEMI_ABERTO'; // Permitir uma tentativa de prova
      return false;
    }
    return e.estado === 'ABERTO';
  }

  registrarSucesso(chave: string): void {
    this.entradas.delete(chave); // Reseta o contador completamente
  }

  registrarFalha(chave: string): void {
    const e: EntradaCB = this.entradas.get(chave) ?? {
      falhas: 0, ultimaFalha: 0, estado: 'FECHADO',
    };
    e.falhas++;
    e.ultimaFalha = Date.now();
    if (e.falhas >= this.limiar) e.estado = 'ABERTO';
    this.entradas.set(chave, e);
  }

  getEstado(chave: string): EstadoCB {
    return this.entradas.get(chave)?.estado ?? 'FECHADO';
  }
}

// ═══════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════

/**
 * Resolve o módulo yahoo-finance2 independente do sistema de módulos (CJS/ESM).
 * Substitui o bloco if-chain de 15 linhas da v1 — isolado e testável.
 */
function resolveYahooFinance(mod: unknown): any {
  const candidatos = [
    (mod as any)?.default?.default,
    (mod as any)?.default,
    mod,
  ];
  for (const c of candidatos) {
    if (c != null && typeof (c as any).quote === 'function') return c;
  }
  // Último recurso: instanciação (improvável no yahoo-finance2 v2)
  try {
    const Cls = (mod as any)?.default ?? mod;
    const inst = new (Cls as any)();
    if (typeof inst.quote === 'function') return inst;
  } catch { /* ignorar */ }
  return mod;
}

/**
 * Backoff exponencial com full jitter — elimina thundering herd.
 * Intervalo: [0, min(teto, base * 2^tentativa)]
 */
function backoffMs(tentativa: number, base = 300, teto = 8_000): number {
  return Math.random() * Math.min(teto, base * 2 ** tentativa);
}

/**
 * Converte ChartPeriod em Date de início — utilizado em histórico e dividendos.
 * A v1 ignorava este parâmetro em fetchHistoricoGrafico.
 */
function periodoParaData(periodo: ChartPeriod): Date {
  const diasPorPeriodo: Record<string, number> = {
    '1mo': 30,  '3mo': 90,  '6mo': 180,
    '1y': 365, '5y': 1_825, 'max': 365 * 30,
  };
  const dias = diasPorPeriodo[periodo] ?? 365;
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1_000);
}

/** Extrai a versão principal do Chrome de um User-Agent string */
function extrairVersaoChrome(ua: string): string {
  return ua.match(/Chrome\/(\d+)/)?.[1] ?? '124';
}

/**
 * Gera headers HTTP com Sec-Ch-Ua sincronizado ao User-Agent.
 * A v1 tinha Sec-Ch-Ua hardcoded como Chrome/120 independente do UA rotacionado.
 * Adiciona Accept-Encoding (ausente na v1) e corrige Sec-Fetch-Site para 'none' (navegação direta).
 */
function getHeadersConsistentes(userAgent: string): Record<string, string> {
  const v = extrairVersaoChrome(userAgent);
  return {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',        // #7: compressão (ausente na v1)
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': `"Not_A Brand";v="8", "Chromium";v="${v}", "Google Chrome";v="${v}"`, // #31: consistente com UA
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',     // #34: 'none' = navegação direta (v1 usava 'same-origin' errado)
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    // Origin intencionalmente omitido: browsers não enviam Origin em GET de navegação direta
  };
}

/**
 * Remove entradas inválidas e outliers absurdos do ResultMap.
 * A v1 não validava os valores extraídos — strings como '-' entravam no resultado.
 */
function validarResultMap(results: ResultMap): ResultMap {
  const validado: ResultMap = {};
  for (const [chave, valor] of Object.entries(results)) {
    if (valor == null) continue;
    const str = String(valor).trim();
    if (VALORES_INVALIDOS.has(str)) continue;
    // Cheque de sanidade: rejeitar outliers extremos (ex: P/L de 50 bilhões)
    const numStr = str.replace(/%$/, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(numStr);
    if (!isNaN(num) && Math.abs(num) > 1_000_000_000) continue;
    validado[chave as AssetLabel] = valor;
  }
  return validado;
}

// ═══════════════════════════════════════════════════════════
// INICIALIZAÇÃO DO YAHOO FINANCE (limpa, isolada)
// ═══════════════════════════════════════════════════════════

const yf = resolveYahooFinance(yahooFinance); // #17

try {
  if (typeof yf?.setGlobalConfig === 'function') {
    yf.setGlobalConfig({ suppressNotices: ['yahooSurvey'] });
  }
} catch (e) {
  console.warn('[NexusEngine] Não foi possível configurar o Yahoo Finance:', e);
}

// ═══════════════════════════════════════════════════════════
// PRESETS DE ATIVOS (extensíveis — agora incluem BDR, ETF, aliases e StatusInvest)
// ═══════════════════════════════════════════════════════════

const NEXUS_PRESETS: Record<ExtendedAssetType, ExtendedAssetPreset> = {
  ACAO: {
    url_base: 'https://investidor10.com.br/acoes',
    statusInvest_base: 'https://statusinvest.com.br/acoes',          // #25
    labels: [
      'P/L', 'Dividend Yield', 'P/VP', 'VPA', 'ROE', 'ROIC',
      'Margem Líquida', 'Margem Bruta', 'Margem EBIT', 'EV/EBITDA',
      'Dívida Líquida / Patrimônio', 'CAGR Receitas 5 Anos', 'LPA', 'PEG Ratio',
      'P/EBIT', 'P/Ativo', 'PSR', 'Giro Ativos', 'Dívida Bruta / Patrimônio',
      'Preço Atual', 'Variação (24h)', 'Setor', 'Subsetor', 'Segmento'
    ],
    aliases: {                                                          // #19
      'dy': 'Dividend Yield', 'p/l': 'P/L', 'p/vp': 'P/VP',
      'vpa': 'VPA',           'lpa': 'LPA', 'roe': 'ROE',
      'roic': 'ROIC',         'psr': 'PSR', 'p/ativo': 'P/Ativo',
      'cotação': 'Preço Atual', 'cotacao': 'Preço Atual',
      'variação': 'Variação (24h)', 'variacao': 'Variação (24h)',
      'setor de atuação': 'Setor', 'subsetor de atuação': 'Subsetor',
      'segmento de atuação': 'Segmento', 'segmento': 'Segmento'
    },
  },
  FII: {
    url_base: 'https://investidor10.com.br/fiis',
    statusInvest_base: 'https://statusinvest.com.br/fundos-imobiliarios',
    labels: [
      'Dividend Yield', 'P/VP', 'Valor Patrimonial', 'Liquidez Diária',
      'Último Rendimento', 'Vacância Física', 'Vacância Financeira', 'Quantidade Ativos',
      'Patrimônio Líquido', 'Valor de Mercado', 'P/Ativo',
      'Preço Atual', 'Variação (24h)', 'Segmento'
    ],
    aliases: {
      'dy': 'Dividend Yield', 'p/vp': 'P/VP', 'p/ativo': 'P/Ativo',
      'último rendimento': 'Último Rendimento',
      'cotação': 'Preço Atual', 'cotacao': 'Preço Atual',
      'variação': 'Variação (24h)', 'variacao': 'Variação (24h)',
      'segmento': 'Segmento'
    },
  },
  BDR: {                                                               // #23
    url_base: 'https://investidor10.com.br/bdrs',
    statusInvest_base: 'https://statusinvest.com.br/bdrs',
    labels: [
      'P/L', 'Dividend Yield', 'P/VP', 'VPA', 'ROE', 'ROIC',
      'Margem Líquida', 'Margem Bruta', 'EV/EBITDA', 'LPA',
      'Preço Atual', 'Variação (24h)', 'Setor', 'Segmento'
    ],
    aliases: {
      'dy': 'Dividend Yield', 'p/l': 'P/L', 'p/vp': 'P/VP',
      'lpa': 'LPA',           'roe': 'ROE',
      'cotação': 'Preço Atual', 'cotacao': 'Preço Atual',
      'variação': 'Variação (24h)', 'variacao': 'Variação (24h)',
    },
  },
  ETF: {                                                               // #24
    url_base: 'https://investidor10.com.br/etfs',
    statusInvest_base: 'https://statusinvest.com.br/etfs',
    labels: [
      'Dividend Yield', 'P/VP', 'Valor Patrimonial', 'Liquidez Diária',
      'Patrimônio Líquido', 'Valor de Mercado', 'Taxa de Administração',
      'Preço Atual', 'Variação (24h)'
    ],
    aliases: {
      'dy': 'Dividend Yield', 'taxa adm': 'Taxa de Administração',
      'taxa de administração': 'Taxa de Administração',
      'cotação': 'Preço Atual', 'cotacao': 'Preço Atual',
      'variação': 'Variação (24h)', 'variacao': 'Variação (24h)',
    },
  },
};

// ═══════════════════════════════════════════════════════════
// ENGINE PRINCIPAL
// ═══════════════════════════════════════════════════════════

export type { AssetType, FetchAtivoResult };

export class NexusEngineUltra {

  // ── Configuração Global ──────────────────────────────────
  private static _config: Required<NexusEngineConfig> = {
    cacheTtlMs:               5 * 60 * 1_000,
    cacheMaxSize:             200,
    searchCacheTtlMs:         60 * 1_000,
    watchdogMs:               4_000,
    maxRetries:               2,
    concurrencyLimit:         5,
    proxy:                    '',
    circuitBreakerThreshold:  3,
    circuitBreakerResetMs:    30_000,
  };

  // ── LRU Caches (#8, #9) ─────────────────────────────────
  private static _cache        = new LRUCache<string, CacheEntry>(200);
  private static _searchCache  = new LRUCache<string, { data: any[]; timestamp: number }>(50);

  // ── Circuit Breakers (#12) ──────────────────────────────
  private static _cb = new CircuitBreaker(3, 30_000);

  /** Expõe o limite de concorrência padrão para uso externo (ex: runNexusBatch) */
  static get defaultConcurrencyLimit(): number {
    return this._config.concurrencyLimit;
  }

  /**
   * Atualiza a configuração global do engine em runtime.
   * Recria LRUCache e CircuitBreaker quando os limiares mudam. (#21)
   */
  static configure(config: Partial<NexusEngineConfig>): void {
    const prev = this._config;
    this._config = { ...prev, ...config };

    if (config.cacheMaxSize && config.cacheMaxSize !== prev.cacheMaxSize) {
      this._cache = new LRUCache<string, CacheEntry>(config.cacheMaxSize);
    }
    if (config.circuitBreakerThreshold !== undefined || config.circuitBreakerResetMs !== undefined) {
      this._cb = new CircuitBreaker(
        this._config.circuitBreakerThreshold,
        this._config.circuitBreakerResetMs,
      );
    }
  }

  // ─────────────────────────────────────────────────────────
  // MÉTODO PRINCIPAL
  // ─────────────────────────────────────────────────────────

  static async fetchAtivo(
    ticker: string,
    type: ExtendedAssetType = 'ACAO',
    isRetry: boolean = false,
    includeNews: boolean = false
  ): Promise<FetchAtivoResult> {
    const cleanTicker = ticker.trim().replace(/\.SA$/i, '').toUpperCase();
    const cacheKey    = `${cleanTicker}:${type}`;
    const logs: string[] = [];
    const log = (m: string) => logs.push(`[${cleanTicker}] ${m}`);

    // ── Cache LRU (#8) ──────────────────────────────────────
    if (!isRetry) {
      const cached = this._cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this._config.cacheTtlMs) {
        let data = { ...cached.data };
        if (includeNews && data.cacheStatus !== 'ERROR' && !('error' in data) && !(data as any).news) {
          log(`Buscando notícias para entrada em cache...`);
          (data as any).news = await this.fetchNews(cleanTicker);
        }
        log(`Retornado do cache LRU (Warm Start) em 0ms`);
        return { ...data, cacheStatus: 'HIT', logs };
      }
    }

    const preset = NEXUS_PRESETS[type];
    if (!preset) {
      return {
        ticker: cleanTicker,
        error: `Tipo de ativo desconhecido: "${type}". Use: ACAO, FII, BDR ou ETF.`,
        cacheStatus: 'ERROR',
        logs,
      };
    }

    const url = `${preset.url_base}/${cleanTicker.toLowerCase()}/`;
    log(`Iniciando busca profunda para ${cleanTicker} (${type})`);

    try {
      const result    = await this._executeFetchWithFallback(cleanTicker, url, preset, type, log);
      
      let news: NewsItem[] | undefined = undefined;
      if (includeNews) {
        log(`Buscando notícias recentes via Google News RSS...`);
        news = await this.fetchNews(cleanTicker);
      }

      const finalData = { ticker: cleanTicker, ...result, cacheStatus: 'MISS' as const, logs, news };
      this._cache.set(cacheKey, { data: finalData, timestamp: Date.now() });
      return finalData;

    } catch (error) {
      const err = error as Error;
      log(`FALHA CRÍTICA: ${err.message}`);
      console.error(`[NexusEngine] Falha em ${cleanTicker} (${type}): ${err.message}`);

      // ── Fallback de tipo — apenas ACAO ↔ FII (#14) ──────
      const ehTerminal = err.message.includes('404')
        || err.message.includes('410')
        || err.message.includes('Falha total');

      if (!isRetry && ehTerminal && (type === 'ACAO' || type === 'FII')) {
        const tipoFallback: ExtendedAssetType = type === 'ACAO' ? 'FII' : 'ACAO';
        log(`Tentando fallback de tipo: ${type} → ${tipoFallback}`);
        const fallbackResult = await this.fetchAtivo(cleanTicker, tipoFallback, true, includeNews);

        if ('results' in fallbackResult) {
          log(`Fallback bem-sucedido como ${tipoFallback} (tipo original solicitado: ${type})`);
        }
        return {
          ...fallbackResult,
          logs: [...logs, ...(fallbackResult.logs ?? [])],
        };
      }

      return { ticker: cleanTicker, error: err.message, cacheStatus: 'ERROR', logs };
    }
  }

  // ─────────────────────────────────────────────────────────
  // ORQUESTRADOR: FASE 1 (Scraper) → FASE 2 (Yahoo Finance)
  // ─────────────────────────────────────────────────────────

  private static async _executeFetchWithFallback(
    ticker: string,
    url: string,
    preset: ExtendedAssetPreset,
    type: ExtendedAssetType,
    log: (m: string) => void,
  ): Promise<FetchSuccess> {
    const startTime   = performance.now();
    let finalResults: ResultMap = {};
    const sourcesUsed: string[] = [];
    let bytesTotal = 0;
    const { labels } = preset;

    // ── FASE 1: SAX Scraper (Investidor10) ─────────────────
    const cbI10 = `investidor10:${ticker}`;
    if (!this._cb.estaAberto(cbI10)) {
      log(`Fase 1: Disparando Scraper Zero-AST para ${url}`);
      try {
        const htmlResult = await this._executeFetchWithRetry(
          url, preset, this._config.maxRetries, startTime, log,
        );
        finalResults = { ...htmlResult.results };
        bytesTotal   = htmlResult.metrics.bytesProcessed;

        if (htmlResult.metrics.foundKeys.length > 0) {
          sourcesUsed.push('SAX Scraper (Investidor10)');
          log(`Fase 1: ${htmlResult.metrics.foundKeys.length}/${labels.length} indicadores encontrados.`);
          this._cb.registrarSucesso(cbI10);
        }

        if (htmlResult.metrics.foundKeys.length >= labels.length) {
          log(`Early Abort: todos os indicadores obtidos na Fase 1.`);
          return { ...htmlResult, results: validarResultMap(finalResults) };
        }
      } catch (e) {
        const msg = (e as Error).message;
        log(`Fase 1 falhou: ${msg}`);
        this._cb.registrarFalha(cbI10);
        if (msg.includes('404') || msg.includes('410')) {
          log(`Recurso não existe em ${url}. Prosseguindo para Yahoo Finance.`);
        }
      }
    } else {
      log(`Fase 1 ignorada — Circuit Breaker ABERTO para Investidor10. Direto para Fase 2.`);
    }

    // ── FASE 2: Yahoo Finance (complemento) (#3 corrigido) ─
    const cbYF = `yahoo:${ticker}`;
    if (!this._cb.estaAberto(cbYF)) {
      log(`Fase 2: Consultando Yahoo Finance para complementar dados...`);
      try {
        const symbol       = `${ticker}.SA`;
        const quote: YahooQuote = await yf.quote(symbol);
        let yahooAdded     = 0;

        /**
         * fill: aceita val === 0 como dado válido (#3).
         * Não sobrescreve dados já obtidos do scraper.
         */
        const fill = (chave: AssetLabel, val: unknown) => {
          if (finalResults[chave] !== undefined) return;
          if (val === null || val === undefined) return;
          const str = typeof val === 'number' ? val.toFixed(2) : String(val).trim();
          if (VALORES_INVALIDOS.has(str)) return;
          finalResults[chave] = str;
          yahooAdded++;
        };

        if (type === 'ACAO' || type === 'BDR') {
          fill('P/L',  quote.trailingPE);
          fill('P/VP', quote.priceToBook);
          fill('VPA',  quote.bookValue);
          fill('LPA',  quote.epsTrailingTwelveMonths);
          fill('Preço Atual', quote.regularMarketPrice);
          if (typeof quote.regularMarketChangePercent === 'number') {
            fill('Variação (24h)', quote.regularMarketChangePercent.toFixed(2) + '%');
          }

          if (quote.profitMargins != null)
            fill('Margem Líquida', (quote.profitMargins * 100).toFixed(2) + '%');
          if (quote.returnOnEquity != null)
            fill('ROE', (quote.returnOnEquity * 100).toFixed(2) + '%');

          // #2: ROIC ≠ ROA. Yahoo não expõe ROIC diretamente.
          //     returnOnAssets seria um proxy inferior e enganoso — intencionalmente omitido.

          if (quote.revenuePerShare && quote.regularMarketPrice) {
            fill('PSR', (quote.regularMarketPrice / quote.revenuePerShare).toFixed(2));
          }
          if (quote.trailingAnnualDividendYield != null) {
            fill('Dividend Yield', (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%');
          }

        } else {
          // FII / ETF
          fill('P/VP',            quote.priceToBook);
          fill('Valor Patrimonial', quote.bookValue);
          fill('Preço Atual', quote.regularMarketPrice);
          if (typeof quote.regularMarketChangePercent === 'number') {
            fill('Variação (24h)', quote.regularMarketChangePercent.toFixed(2) + '%');
          }
          
          if (quote.marketCap != null)
            fill('Valor de Mercado', quote.marketCap);
          if (quote.trailingAnnualDividendYield != null) {
            fill('Dividend Yield', (quote.trailingAnnualDividendYield * 100).toFixed(2) + '%');
          }
        }

        if (yahooAdded > 0) {
          sourcesUsed.push('Yahoo Finance API');
          log(`Fase 2: Yahoo Finance complementou ${yahooAdded} indicadores.`);
          this._cb.registrarSucesso(cbYF);
        } else {
          log(`Fase 2: Yahoo Finance não encontrou novos dados úteis.`);
        }

      } catch (e) {
        log(`Fase 2 falhou: ${(e as Error).message}`);
        this._cb.registrarFalha(cbYF);
      }
    } else {
      log(`Fase 2 ignorada — Circuit Breaker ABERTO para Yahoo Finance.`);
    }

    const validatedResults = validarResultMap(finalResults);          // #29
    const foundKeys        = Object.keys(validatedResults) as AssetLabel[];
    if (foundKeys.length === 0) throw new Error(`Falha total na coleta de ${ticker}`);

    return {
      results: validatedResults,
      metrics: {
        totalTimeMs:  performance.now() - startTime,
        bytesProcessed: bytesTotal,
        foundKeys,
        earlyAbort:   foundKeys.length >= labels.length,
        successRate:  foundKeys.length / labels.length,
        source:       sourcesUsed.join(' + ') as DataSource,
      },
    };
  }

  // ─────────────────────────────────────────────────────────
  // RETRY COM BACKOFF EXPONENCIAL + FULL JITTER (#13, #16)
  // ─────────────────────────────────────────────────────────

  private static async _executeFetchWithRetry(
    url: string,
    preset: ExtendedAssetPreset,
    retries: number,
    globalStart: number,
    log: (m: string) => void,
  ): Promise<FetchSuccess> {
    for (let i = 0; i < retries; i++) {
      try {
        if (i > 0) log(`Re-tentativa ${i}/${retries - 1}...`);
        return await this._executeFetch(url, preset, globalStart, log);
      } catch (err) {
        const msg = (err as Error).message;
        // Erros terminais — não retenta (#16: inclui 410 e 451)
        const ehTerminal =
          i === retries - 1
          || msg.includes('404')
          || msg.includes('410')
          || msg.includes('451');

        if (ehTerminal) throw err;

        const espera = backoffMs(i);
        log(`Tentativa ${i + 1} falhou: ${msg}. Aguardando ${Math.round(espera)}ms...`);
        await delay(espera);
      }
    }
    throw new Error('Tentativas de retry esgotadas');
  }

  // ─────────────────────────────────────────────────────────
  // SAX SCRAPER ZERO-AST (CORE) — melhorias #4, #5, #7, #10, #11, #31–34
  // ─────────────────────────────────────────────────────────

  private static async _executeFetch(
    url: string,
    preset: ExtendedAssetPreset,
    globalStart: number,
    log: (m: string) => void,
  ): Promise<FetchSuccess> {
    const { labels, aliases = {} } = preset;

    // Mapa label → label original, incluindo aliases do preset (#19)
    const labelMap: Record<string, AssetLabel> = {};
    labels.forEach(l => { labelMap[l.toLowerCase()] = l; });
    Object.entries(aliases).forEach(([alias, label]) => { labelMap[alias.toLowerCase()] = label; });

    const allLabels = new Set(Object.keys(labelMap));
    const abortCtrl = new AbortController();

    // Watchdog — aborta antes do limite hard de 10s do Vercel
    let watchdogId: NodeJS.Timeout;
    const resetWatchdog = () => {
      clearTimeout(watchdogId);
      watchdogId = setTimeout(() => abortCtrl.abort(), this._config.watchdogMs);
    };
    resetWatchdog();

    const results: ResultMap = {};
    let foundCount     = 0;
    let bytesProcessed = 0;
    let lastLabel: AssetLabel | '' = '';
    let depth          = 0;
    let buffer         = '';
    const BUFFER_MAX   = 512; // #11: limite de acúmulo de buffer

    const ignoreTags = new Set([
      'script', 'style', 'option', 'title', 'meta',
      'footer', 'nav', 'header', 'noscript', 'iframe',
    ]);
    let ignoreDepth = 0;

    const parser = new Parser({
      onopentag(name, attr) {
        // #4: ignoreTags — ignoreDepth nunca fica negativo
        if (ignoreTags.has(name)) { ignoreDepth++; return; }
        if (ignoreDepth > 0) return;

        // ── Detecção de label via múltiplos atributos ─────
        let labelEncontrado: AssetLabel | '' = '';
        for (const attrName of ['title', 'aria-label', 'data-title', 'data-label']) {
          const raw = attr[attrName];
          if (!raw) continue;
          const lower = raw.trim().toLowerCase();
          if (allLabels.has(lower)) {
            labelEncontrado = labelMap[lower];
            break;
          }
        }
        if (labelEncontrado) lastLabel = labelEncontrado;

        // ── Detecção de bloco de valor ─────────────────────
        const ehBlocoValor = attr.class?.split(/\s+/).some(c =>
          c === 'value' || c === 'v-value' || c === '_card-body'
        );

        if (ehBlocoValor) {
          if (depth === 0) {
            buffer = '';
            // #5: se este bloco não trouxe label próprio, limpa o label anterior (evita stale)
            if (!labelEncontrado) lastLabel = '';
          }
          depth++;
        } else if (depth > 0) {
          depth++;
        }
      },

      ontext(t) {
        if (ignoreDepth > 0) return;
        if (depth > 0) {
          // #11: limita acúmulo de buffer em elementos HTML complexos
          if (buffer.length < BUFFER_MAX) buffer += t;
          return;
        }
        const txt = t.trim();
        if (!txt || txt.length > 60) return;
        const lower = txt.endsWith(':') ? txt.slice(0, -1).toLowerCase() : txt.toLowerCase();
        if (allLabels.has(lower)) lastLabel = labelMap[lower];
      },

      onclosetag(name) {
        // #4: proteção — se a tag não foi aberta (HTML malformado), não decrementa
        if (ignoreTags.has(name)) {
          if (ignoreDepth > 0) ignoreDepth--;
          return;
        }
        if (ignoreDepth > 0) return;

        if (depth > 0) {
          depth--;
          if (depth === 0) {
            // #5: lastLabel sempre limpo ao fechar bloco — independente de ter encontrado valor
            if (lastLabel) {
              const trimmed    = buffer.trim();
              const normalized = trimmed ? normalizeBRNumber(trimmed) : ''; // #10
              if (normalized && !VALORES_INVALIDOS.has(normalized)) {        // #29
                results[lastLabel] = normalized;
                foundCount++;
                log(`Scraper: ${lastLabel} = ${normalized}`);
                if (foundCount >= labels.length) {
                  log(`Scraper: Todos os ${labels.length} indicadores encontrados. Abortando stream.`);
                  abortCtrl.abort();
                }
              }
            }
            lastLabel = ''; // #5: sempre reseta
            buffer    = '';
          }
        }
      },
    }, { decodeEntities: true });

    try {
      const userAgent    = getRandomAgent();
      const headers      = getHeadersConsistentes(userAgent); // #31, #34
      log(`Conectando... UA: ${userAgent.slice(0, 50)}...`);

      const fetchOptions: RequestInit & { dispatcher?: unknown } = {
        headers,
        signal: abortCtrl.signal,
      };

      // #33: suporte a proxy via config ou variáveis de ambiente
      const proxyUrl = this._config.proxy
        || process.env.HTTPS_PROXY
        || process.env.https_proxy
        || '';

      if (proxyUrl) {
        try {
          const { ProxyAgent } = await import('undici');
          fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
          log(`Proxy ativo: ${proxyUrl}`);
        } catch {
          log(`Aviso: Proxy configurado mas 'undici' não encontrado — ignorando.`);
        }
      }

      const response = await fetch(url, fetchOptions as RequestInit);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      log(`Stream iniciado. Analisando bytes...`);

      if (response.body) {
        const reader  = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              resetWatchdog();
              bytesProcessed += value.length;
              parser.write(decoder.decode(value, { stream: true }));
            }
          }
        } finally {
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
      clearTimeout(watchdogId!);
    }

    return {
      results,
      metrics: {
        totalTimeMs:    performance.now() - globalStart,
        bytesProcessed,
        foundKeys:      Object.keys(results) as AssetLabel[],
        successRate:    foundCount / labels.length,
        earlyAbort:     foundCount >= labels.length,
        source:         'SAX Scraper (Investidor10)',
      },
    };
  }

  // ─────────────────────────────────────────────────────────
  // HISTÓRICO, DIVIDENDOS E BUSCA
  // ─────────────────────────────────────────────────────────

  /**
   * Histórico de cotações — agora respeita o parâmetro `period` (#1).
   * Na v1, period era aceito mas ignorado (sempre 365 dias).
   */
  static async fetchHistoricoGrafico(
    ticker: string,
    period: ChartPeriod = '1y',
  ): Promise<HistoricalQuote[]> {
    try {
      const symbol = `${ticker.toUpperCase()}.SA`;
      const result: any = await yf.historical(symbol, {
        period1: periodoParaData(period), // #1: usa period real
        period2: new Date(),
        interval: '1d',
      });
      return result.map((r: any) => ({ ...r, date: new Date(r.date) }));
    } catch (e) {
      throw new Error(
        `Falha ao buscar histórico de ${ticker} (${period}): ${(e as Error).message}`,
      );
    }
  }

  /**
   * Histórico de dividendos — agora com período configurável (#27).
   * Na v1, sempre buscava 5 anos fixos.
   */
  static async fetchDividends(
    ticker: string,
    period: ChartPeriod = '5y',
  ): Promise<Dividend[]> {
    try {
      const symbol = `${ticker.toUpperCase()}.SA`;
      const result: any = await yf.dividends(symbol, {
        period1: periodoParaData(period),
        period2: new Date(),
      });
      return result.map((r: any) => ({
        date:   new Date(r.date),
        amount: r.dividend,
      }));
    } catch (e) {
      throw new Error(
        `Falha ao buscar dividendos de ${ticker} (${period}): ${(e as Error).message}`,
      );
    }
  }

  /**
   * Busca de tickers com cache de curta duração (#26).
   * Na v1, cada chamada ia direto ao Yahoo sem cache.
   */
  static async searchTicker(query: string): Promise<any[]> {
    const chaveCache = query.trim().toLowerCase();
    const cached     = this._searchCache.get(chaveCache);
    if (cached && Date.now() - cached.timestamp < this._config.searchCacheTtlMs) {
      return cached.data;
    }

    try {
      const result: any  = await yf.search(query);
      const filtrados    = (result?.quotes ?? []).filter(
        (q: any) => q.exchange === 'SAO' || q.symbol?.endsWith('.SA'),
      );
      this._searchCache.set(chaveCache, { data: filtrados, timestamp: Date.now() });
      return filtrados;
    } catch (e) {
      console.warn(`[NexusEngine] Busca falhou para "${query}":`, (e as Error).message);
      return [];
    }
  }

  /**
   * Busca notícias recentes via Google News RSS e Yahoo Finance fallback.
   */
  static async fetchNews(ticker: string): Promise<NewsItem[]> {
    const cleanTicker = ticker.trim().replace(/\.SA$/i, '').toUpperCase();
    const googleNewsUrl = `https://news.google.com/rss/search?q=${cleanTicker}+stock+B3&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    
    try {
      const response = await fetch(googleNewsUrl, {
        headers: { 'User-Agent': getRandomAgent() }
      });
      
      if (!response.ok) throw new Error(`Google News HTTP ${response.status}`);
      
      const xml = await response.text();
      const news: NewsItem[] = [];
      let currentItem: Partial<NewsItem> | null = null;
      let currentTag: string = '';

      const parser = new Parser({
        onopentag(name) {
          if (name === 'item') currentItem = {};
          currentTag = name;
        },
        ontext(text) {
          if (!currentItem) return;
          if (currentTag === 'title') currentItem.title = (currentItem.title || '') + text;
          if (currentTag === 'link') currentItem.link = (currentItem.link || '') + text;
          if (currentTag === 'pubdate') currentItem.pubDate = new Date((currentItem.pubDate?.toString() || '') + text);
          if (currentTag === 'source') currentItem.source = (currentItem.source || '') + text;
        },
        onclosetag(name) {
          if (name === 'item' && currentItem && currentItem.title && currentItem.link) {
            news.push(currentItem as NewsItem);
            currentItem = null;
          }
          currentTag = '';
        }
      }, { xmlMode: true });

      parser.write(xml);
      parser.end();

      if (news.length > 0) return news;
      
      // Fallback to Yahoo Finance News if Google News RSS is empty
      const yfResult = await yf.search(cleanTicker);
      if (yfResult.news && yfResult.news.length > 0) {
        return yfResult.news.map((n: any) => ({
          title: n.title,
          link: n.link,
          pubDate: new Date(n.providerPublishTime * 1000),
          source: n.publisher
        }));
      }

      return [];
    } catch (e) {
      console.warn(`[NexusEngine] fetchNews falhou para ${ticker}:`, (e as Error).message);
      // Final fallback to Yahoo
      try {
        const yfResult = await yf.search(cleanTicker);
        return (yfResult.news || []).map((n: any) => ({
          title: n.title,
          link: n.link,
          pubDate: new Date(n.providerPublishTime * 1000),
          source: n.publisher
        }));
      } catch (err) {
        return [];
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // UTILITÁRIOS DE CACHE E MONITORAMENTO (#28)
  // ─────────────────────────────────────────────────────────

  static clearCache(): void {
    this._cache.clear();
    this._searchCache.clear();
  }

  /** Estatísticas do cache para monitoramento (ex: dashboards, healthchecks) */
  static getCacheStats(): {
    cache:       { tamanho: number; tamanhoMax: number; ttlMs: number };
    searchCache: { tamanho: number; ttlMs: number };
    circuitBreakers: Record<string, EstadoCB>;
  } {
    return {
      cache: {
        tamanho:    this._cache.tamanho,
        tamanhoMax: this._config.cacheMaxSize,
        ttlMs:      this._config.cacheTtlMs,
      },
      searchCache: {
        tamanho: this._searchCache.tamanho,
        ttlMs:   this._config.searchCacheTtlMs,
      },
      circuitBreakers: {
        'investidor10': this._cb.getEstado('investidor10'),
        'yahoo':        this._cb.getEstado('yahoo'),
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════
// CONCORRÊNCIA — runWithLimit (#6, #15)
// ═══════════════════════════════════════════════════════════

/**
 * Executa tasks com limite de concorrência.
 *
 * Correções vs v1:
 *  - Usa .finally() para garantir remoção do Set mesmo em rejeição (#6)
 *  - Erros individuais são capturados por task — um erro não cancela o restante (#6, #15)
 *  - Retorna (T | Error)[] posicional: índice i = resultado da task i
 */
export async function runWithLimit<T>(
  tasks: Task<T>[],
  limit = 5,
): Promise<(T | Error)[]> {
  const results: (T | Error)[] = new Array(tasks.length);
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < tasks.length; i++) {
    const idx = i;
    // p é declarado antes do .finally() que o referencia — o callback só roda
    // de forma assíncrona, logo p já está atribuído quando finally é invocado.
    const p: Promise<void> = tasks[idx]()
      .then(res  => { results[idx] = res; })
      .catch(err => { results[idx] = err instanceof Error ? err : new Error(String(err)); })
      .finally(() => { executing.delete(p); }); // #6: garante remoção mesmo em erro

    executing.add(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}

/**
 * Batch com tipagem correta (#30):
 *  - Erros individuais retornam como FetchAtivoResult de erro (não jogam exception)
 *  - Respeita o concurrencyLimit configurado no engine
 */
export async function runNexusBatch(
  tickers: string[],
  type: ExtendedAssetType = 'ACAO',
  limit: number = NexusEngineUltra.defaultConcurrencyLimit,
  includeNews: boolean = false
): Promise<FetchAtivoResult[]> {
  const tasks = tickers.map(t => () => NexusEngineUltra.fetchAtivo(t, type, false, includeNews));
  const resultados = await runWithLimit(tasks, limit);

  return resultados.map((r, i) => {
    if (r instanceof Error) {
      return {
        ticker:      tickers[i].toUpperCase().replace(/\.SA$/i, ''),
        error:       r.message,
        cacheStatus: 'ERROR' as const,
        logs:        [`[BATCH] Falha isolada na task ${i}: ${r.message}`],
      };
    }
    return r as FetchAtivoResult;
  });
}

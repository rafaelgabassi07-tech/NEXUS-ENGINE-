export type AssetType = 'ACAO' | 'FII';
export type ExtendedAssetType = AssetType | 'BDR' | 'ETF';
export type CacheStatus = 'HIT' | 'MISS' | 'DEDUPE' | 'ERROR';
export type DataSource = string;

export interface NewsItem {
  title: string;
  link: string;
  pubDate: Date;
  source: string;
}

export type AcaoLabel = 'P/L' | 'Dividend Yield' | 'P/VP' | 'VPA' | 'ROE' | 'ROIC' | 'Margem Líquida' | 'Margem Bruta' | 'Margem EBIT' | 'EV/EBITDA' | 'Dívida Líquida / Patrimônio' | 'Dívida Líquida / EBITDA' | 'CAGR Receitas 5 Anos' | 'LPA' | 'PEG Ratio' | 'P/EBIT' | 'P/Ativo' | 'PSR' | 'Giro Ativos' | 'Dívida Bruta / Patrimônio' | 'Preço Atual' | 'Variação (24h)' | 'Setor' | 'Subsetor' | 'Segmento';
export type FiiLabel = 'Dividend Yield' | 'P/VP' | 'Valor Patrimonial' | 'Liquidez Diária' | 'Último Rendimento' | 'Vacância Física' | 'Vacância Financeira' | 'Quantidade Ativos' | 'Patrimônio Líquido' | 'Valor de Mercado' | 'P/Ativo' | 'Preço Atual' | 'Variação (24h)' | 'Segmento';
export type EtfLabel = 'Taxa de Administração';
export type AssetLabel = AcaoLabel | FiiLabel | EtfLabel;

export type ResultMap = Partial<Record<AssetLabel, string | number>>;

export interface NexusEngineConfig {
  /** TTL do cache principal em ms (padrão: 5 min) */
  cacheTtlMs?: number;
  /** Máximo de entradas no cache LRU (padrão: 200) */
  cacheMaxSize?: number;
  /** TTL do cache de busca de tickers em ms (padrão: 60s) */
  searchCacheTtlMs?: number;
  /** Timeout do watchdog do scraper em ms (padrão: 4s) */
  watchdogMs?: number;
  /** Máximo de tentativas de retry no scraper (padrão: 2) */
  maxRetries?: number;
  /** Limite padrão de concorrência em batch (padrão: 5) */
  concurrencyLimit?: number;
  /** URL do proxy HTTP/HTTPS (ex: 'http://proxy.host:8080') */
  proxy?: string;
  /** Falhas consecutivas para abrir o circuit breaker (padrão: 3) */
  circuitBreakerThreshold?: number;
  /** Tempo de reset do circuit breaker em ms (padrão: 30s) */
  circuitBreakerResetMs?: number;
}

export type ChartPeriod = '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max';

export interface HistoricalQuote {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Dividend {
  date: Date;
  amount: number;
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
  logs?: string[];
}

export interface AtivoBuscado extends FetchSuccess {
  ticker:      string;
  cacheStatus: CacheStatus;
  news?:       NewsItem[];
}

export interface AtivoErro {
  ticker:      string;
  error:       string;
  cacheStatus: CacheStatus;
  logs?:       string[];
}

export type FetchAtivoResult = AtivoBuscado | AtivoErro;

export interface AssetPreset {
  url_base: string;
  labels:   AssetLabel[];
}

export type Task<T> = () => Promise<T>;

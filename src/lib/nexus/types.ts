export type AssetType = 'ACAO' | 'FII';
export type CacheStatus = 'HIT' | 'MISS' | 'DEDUPE' | 'ERROR';
export type DataSource = 'Yahoo Finance API' | 'SAX Scraper (HTML)' | 'SAX Scraper (HTML) + Yahoo Finance API';

export type AcaoLabel = 'P/L' | 'Dividend Yield' | 'P/VP' | 'VPA' | 'ROE' | 'ROIC' | 'Margem Líquida' | 'Margem Bruta' | 'Margem EBIT' | 'EV/EBITDA' | 'Dívida Líquida / Patrimônio' | 'CAGR Receitas 5 Anos' | 'LPA' | 'PEG Ratio' | 'P/EBIT' | 'P/Ativo' | 'PSR' | 'Giro Ativos' | 'Dívida Bruta / Patrimônio';
export type FiiLabel = 'Dividend Yield' | 'P/VP' | 'Valor Patrimonial' | 'Liquidez Diária' | 'Último Rendimento' | 'Vacância Física' | 'Vacância Financeira' | 'Quantidade Ativos' | 'Patrimônio Líquido' | 'Valor de Mercado' | 'P/Ativo';
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
}

export interface AtivoErro {
  ticker:      string;
  error:       string;
  cacheStatus: 'ERROR';
  logs?:       string[];
}

export type FetchAtivoResult = AtivoBuscado | AtivoErro;

export interface AssetPreset {
  url_base: string;
  labels:   AssetLabel[];
}

export type Task<T> = () => Promise<T>;

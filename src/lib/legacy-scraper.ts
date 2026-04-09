import * as cheerio from 'cheerio';
import { performance } from 'perf_hooks';
import { FetchAtivoResult, ResultMap, AssetLabel } from './nexus/types.js';

const LABELS = [
  'P/L', 'Dividend Yield', 'P/VP', 'VPA', 'ROE', 'ROIC',
  'Margem Líquida', 'Margem Bruta', 'Margem EBIT', 'EV/EBITDA',
  'Dívida Líquida / Patrimônio', 'CAGR Receitas 5 Anos', 'LPA',
  'PEG Ratio', 'P/EBIT', 'P/Ativo', 'PSR', 'Giro Ativos',
  'Dívida Bruta / Patrimônio', 'Preço Atual', 'Variação (24h)'
];

function normalize(raw: string): number | string {
  if (!raw) return '';
  let limpo = raw.replace(/[R$\s]/g, '').toUpperCase().trim();
  if (/%/.test(limpo)) return limpo;
  let mult = 1;
  if (limpo.endsWith('K')) { mult = 1000; limpo = limpo.slice(0, -1); }
  else if (limpo.endsWith('M')) { mult = 1000000; limpo = limpo.slice(0, -1); }
  else if (limpo.endsWith('B')) { mult = 1000000000; limpo = limpo.slice(0, -1); }
  limpo = limpo.replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? raw.trim() : num * mult;
}

export async function runLegacyScraper(tickers: string[]): Promise<FetchAtivoResult[]> {
  const results: FetchAtivoResult[] = [];

  for (const ticker of tickers) {
    const startTime = performance.now();
    const cleanTicker = ticker.trim().toUpperCase();
    let bytesProcessed = 0;
    const resultMap: ResultMap = {};
    const logs: string[] = [];

    try {
      // 1. Investidor10 (Sequential)
      logs.push(`[Legacy] Fetching Investidor10 for ${cleanTicker}...`);
      const urlI10 = `https://investidor10.com.br/acoes/${cleanTicker.toLowerCase()}/`;
      const resI10 = await fetch(urlI10, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      
      if (!resI10.ok) throw new Error(`I10 HTTP ${resI10.status}`);
      
      const htmlI10 = await resI10.text();
      bytesProcessed += htmlI10.length;
      
      const $i10 = cheerio.load(htmlI10);
      
      // Traditional DOM parsing
      $i10('.value, .v-value, ._card-body').each((_, el) => {
        const parent = $i10(el).parent();
        const title = parent.find('.title, .name').text().trim() || parent.attr('title') || '';
        
        const matchedLabel = LABELS.find(l => title.toLowerCase().includes(l.toLowerCase()));
        if (matchedLabel && !resultMap[matchedLabel as AssetLabel]) {
          const val = normalize($i10(el).text());
          if (val) resultMap[matchedLabel as AssetLabel] = val;
        }
      });

      // 2. StatusInvest (Sequential, only if missing data)
      if (Object.keys(resultMap).length < LABELS.length) {
        logs.push(`[Legacy] Fetching StatusInvest for ${cleanTicker}...`);
        const urlSI = `https://statusinvest.com.br/acoes/${cleanTicker.toLowerCase()}/`;
        const resSI = await fetch(urlSI, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        
        if (!resSI.ok) throw new Error(`SI HTTP ${resSI.status}`);
        
        const htmlSI = await resSI.text();
        bytesProcessed += htmlSI.length;
        
        const $si = cheerio.load(htmlSI);
        $si('.value').each((_, el) => {
          const parent = $si(el).closest('div');
          const title = parent.find('.title').text().trim();
          
          const matchedLabel = LABELS.find(l => title.toLowerCase().includes(l.toLowerCase()));
          if (matchedLabel && !resultMap[matchedLabel as AssetLabel]) {
            const val = normalize($si(el).text());
            if (val) resultMap[matchedLabel as AssetLabel] = val;
          }
        });
      }

      results.push({
        ticker: cleanTicker,
        results: resultMap,
        cacheStatus: 'MISS',
        logs,
        metrics: {
          totalTimeMs: performance.now() - startTime,
          bytesProcessed,
          foundKeys: Object.keys(resultMap) as AssetLabel[],
          earlyAbort: false,
          successRate: Object.keys(resultMap).length / LABELS.length,
          source: 'Investidor10 + StatusInvest (Legacy)'
        }
      });

    } catch (error: any) {
      results.push({
        ticker: cleanTicker,
        error: error.message,
        cacheStatus: 'ERROR',
        logs: [...logs, `[Legacy] Error: ${error.message}`]
      });
    }
  }

  return results;
}

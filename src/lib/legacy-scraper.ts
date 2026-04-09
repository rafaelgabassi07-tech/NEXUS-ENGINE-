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

const AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];
const getRandomAgent = () => AGENTS[Math.floor(Math.random() * AGENTS.length)];

export async function runLegacyScraper(tickers: string[]): Promise<FetchAtivoResult[]> {
  const limit = 4; // Increased concurrency for better speed as requested
  const results: FetchAtivoResult[] = [];
  
  for (let i = 0; i < tickers.length; i += limit) {
    const chunk = tickers.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map(async (ticker) => {
      const startTime = performance.now();
      const startCpu = process.cpuUsage();
      const cleanTicker = ticker.trim().toUpperCase();
      let bytesProcessed = 0;
      const resultMap: ResultMap = {};
      const logs: string[] = [];

      try {
        // 1. Investidor10 (Sequential)
        logs.push(`[Legacy] Iniciando busca no Investidor10 para ${cleanTicker}...`);
        const urlI10 = `https://investidor10.com.br/acoes/${cleanTicker.toLowerCase()}/`;
        
        let attempts = 0;
        let success = false;
        
        while (attempts < 2 && !success) {
          attempts++;
          try {
            // Reduced delay for better performance
            await new Promise(r => setTimeout(r, 500 * attempts + Math.random() * 1000));

            const resI10 = await fetch(urlI10, {
              headers: { 
                'User-Agent': getRandomAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://www.google.com/',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
              },
              signal: AbortSignal.timeout(30000)
            });
            
            if (!resI10.ok) {
              logs.push(`[Legacy] Tentativa ${attempts}: Erro HTTP ${resI10.status}`);
              if (resI10.status === 403) continue;
              throw new Error(`I10 HTTP ${resI10.status}`);
            }
            
            const htmlI10 = await resI10.text();
            bytesProcessed += htmlI10.length;
            
            if (htmlI10.includes('challenge-running') || htmlI10.includes('Cloudflare')) {
              logs.push(`[Legacy] Tentativa ${attempts}: Cloudflare detectado.`);
              continue;
            }

            logs.push(`[Legacy] HTML recebido do Investidor10 (${Math.round(htmlI10.length / 1024)}KB).`);
            
            const $i10 = cheerio.load(htmlI10);
            
            // Improved selectors for Investidor10
            $i10('.indicator-value, .value, .v-value, ._card-body, .indicator-value > span').each((_, el) => {
              const $el = $i10(el);
              const parent = $el.parent();
              const title = $el.closest('.item').find('.title, .name').text().trim() || 
                            parent.find('.title, .name').text().trim() || 
                            $el.closest('.card-body').find('.title').text().trim() ||
                            parent.attr('title') || '';
              
              const matchedLabel = LABELS.find(l => title.toLowerCase().includes(l.toLowerCase()));
              if (matchedLabel && !resultMap[matchedLabel as AssetLabel]) {
                const val = normalize($el.text());
                if (val !== '') {
                  resultMap[matchedLabel as AssetLabel] = val;
                  logs.push(`[Legacy] Encontrado: ${matchedLabel} = ${val}`);
                }
              }
            });
            
            if (Object.keys(resultMap).length > 0) success = true;
          } catch (e: any) {
            logs.push(`[Legacy] Tentativa ${attempts} falhou: ${e.message}`);
          }
        }

        // 2. StatusInvest (Sequential, only if missing data)
        if (Object.keys(resultMap).length < LABELS.length) {
          logs.push(`[Legacy] Dados incompletos. Buscando no StatusInvest para ${cleanTicker}...`);
          const urlSI = `https://statusinvest.com.br/acoes/${cleanTicker.toLowerCase()}/`;
          
          let siAttempts = 0;
          let siSuccess = false;
          
          while (siAttempts < 2 && !siSuccess) {
            siAttempts++;
            try {
              // Reduced delay for better performance
              await new Promise(r => setTimeout(r, 800 * siAttempts + Math.random() * 1000));

              const resSI = await fetch(urlSI, {
                headers: { 
                  'User-Agent': getRandomAgent(),
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                  'Referer': 'https://statusinvest.com.br/'
                },
                signal: AbortSignal.timeout(30000)
              });
              
              if (!resSI.ok) {
                logs.push(`[Legacy] SI Tentativa ${siAttempts}: Erro HTTP ${resSI.status}`);
                continue;
              }
              
              const htmlSI = await resSI.text();
              bytesProcessed += htmlSI.length;
              
              if (htmlSI.includes('challenge-running')) {
                logs.push(`[Legacy] SI Tentativa ${siAttempts}: Cloudflare detectado.`);
                continue;
              }

              logs.push(`[Legacy] HTML recebido do StatusInvest (${Math.round(htmlSI.length / 1024)}KB).`);
              
              const $si = cheerio.load(htmlSI);
              $si('.value, .indicator-value, .indicator-value > span').each((_, el) => {
                const $el = $si(el);
                const parent = $el.closest('div');
                const title = parent.find('.title, .name').text().trim() || 
                              $el.parent().find('.title').text().trim();
                
                const matchedLabel = LABELS.find(l => title.toLowerCase().includes(l.toLowerCase()));
                if (matchedLabel && !resultMap[matchedLabel as AssetLabel]) {
                  const val = normalize($el.text());
                  if (val !== '') {
                    resultMap[matchedLabel as AssetLabel] = val;
                    logs.push(`[Legacy] Encontrado (SI): ${matchedLabel} = ${val}`);
                  }
                }
              });
              siSuccess = true;
            } catch (e: any) {
              logs.push(`[Legacy] SI Tentativa ${siAttempts} falhou: ${e.message}`);
            }
          }
        }

        const endCpu = process.cpuUsage(startCpu);
        const totalTimeMs = performance.now() - startTime;

        return {
          ticker: cleanTicker,
          results: resultMap,
          cacheStatus: 'MISS',
          logs,
          metrics: {
            totalTimeMs,
            bytesProcessed,
            foundKeys: Object.keys(resultMap) as AssetLabel[],
            earlyAbort: false,
            successRate: Object.keys(resultMap).length / LABELS.length,
            source: 'Investidor10 + StatusInvest (Legacy)',
            estimatedMemoryMb: (bytesProcessed * 12) / (1024 * 1024), // Cheerio DOM overhead estimate
            cpuUsageMs: (endCpu.user + endCpu.system) / 1000
          }
        };

      } catch (error: any) {
        const totalTimeMs = performance.now() - startTime;
        return {
          ticker: cleanTicker,
          error: error.message,
          cacheStatus: 'ERROR',
          logs: [...logs, `[Legacy] Erro Crítico: ${error.message}`],
          metrics: {
            totalTimeMs,
            bytesProcessed,
            foundKeys: [],
            earlyAbort: false,
            successRate: 0,
            source: 'Legacy (Failed)',
            estimatedMemoryMb: 0,
            cpuUsageMs: 0
          }
        } as any;
      }
    }));
    results.push(...chunkResults);
  }
  return results;
}

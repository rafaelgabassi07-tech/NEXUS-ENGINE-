import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runNexusBatch } from '../src/lib/nexus-core';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  console.log(`[API] Scrape request received: ${JSON.stringify(req.body)}`);
  
  try {
    const { tickers, type } = req.body;
    
    if (!tickers || !Array.isArray(tickers) || !type) {
      console.warn(`[API] Invalid request body: ${JSON.stringify(req.body)}`);
      return res.status(400).json({ error: "Invalid request body" });
    }
    
    const results = await runNexusBatch(tickers, type);
    console.log(`[API] Scrape completed for ${tickers.length} tickers`);
    
    res.status(200).json({ results });
  } catch (error: any) {
    console.error(`[API] Scrape error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

import express from "express";
import { runNexusBatch, NexusEngineUltra } from "../src/lib/nexus-core.js";
import { runLegacyScraper } from "../src/lib/legacy-scraper.js";
import fs from "fs";

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `[REQUEST] ${new Date().toISOString()} ${req.method} ${req.url} ${res.statusCode} ${duration}ms\n`;
    console.log(log.trim());
    // In serverless environments, writing to disk might not persist or might fail, 
    // but we'll keep it as a best effort or for local dev.
    try {
      fs.appendFileSync('requests.log', log);
    } catch (e) {
      // Ignore errors in serverless
    }
  });
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/scrape", async (req, res) => {
  console.log(`[API] Scrape request received: ${JSON.stringify(req.body)}`);
  try {
    const { tickers, type, includeNews } = req.body;
    if (!tickers || !Array.isArray(tickers) || !type) {
      console.warn(`[API] Invalid request body: ${JSON.stringify(req.body)}`);
      return res.status(400).json({ error: "Invalid request body" });
    }
    const results = await runNexusBatch(tickers, type, undefined, !!includeNews);
    console.log(`[API] Scrape completed for ${tickers.length} tickers (news: ${!!includeNews})`);
    res.json({ results });
  } catch (error: any) {
    console.error(`[API] Scrape error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/scrape-v2", async (req, res) => {
  console.log(`[API V2] Scrape request received: ${JSON.stringify(req.body)}`);
  try {
    const { tickers, type, includeNews } = req.body;
    if (!tickers || !Array.isArray(tickers) || !type) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    
    const start = performance.now();
    const results = await runNexusBatch(tickers, type, undefined, !!includeNews);
    const duration = performance.now() - start;

    const analysis = {
      durationMs: duration,
      successRate: (results.filter(r => !('error' in r)).length / tickers.length) * 100,
      totalBytes: results.reduce((acc, r) => acc + (('metrics' in r) ? r.metrics.bytesProcessed : 0), 0),
      avgTimePerTicker: duration / tickers.length,
      engineVersion: '9.0-Ultra',
      report: NexusEngineUltra.getDetailedReport()
    };

    res.json({ results, analysis });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/clear-cache", (req, res) => {
  NexusEngineUltra.clearCache();
  res.json({ success: true });
});

app.get("/api/stats", (req, res) => {
  res.json(NexusEngineUltra.getCacheStats());
});

app.post("/api/benchmark-compare", async (req, res) => {
  console.log(`[API] Benchmark Race request received: ${JSON.stringify(req.body)}`);
  try {
    const { tickers, customEndpoint } = req.body;
    if (!tickers || !Array.isArray(tickers)) {
      return res.status(400).json({ error: "Invalid tickers" });
    }

    NexusEngineUltra.clearCache();

    console.log(`[API] Running Legacy Scraper for ${tickers.length} tickers...`);
    const legacyStart = performance.now();
    const legacyResults = await runLegacyScraper(tickers);
    const legacyTime = performance.now() - legacyStart;

    let customEndpointData = null;
    if (customEndpoint) {
      console.log(`[API] Running Custom Endpoint: ${customEndpoint}`);
      const customStart = performance.now();
      const customResults = await Promise.all(tickers.map(async (ticker) => {
        const tStart = performance.now();
        try {
          const url = customEndpoint.replace('{{ticker}}', ticker.toLowerCase());
          const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
          const data = await response.text();
          return {
            ticker,
            time: performance.now() - tStart,
            success: response.ok,
            size: data.length
          };
        } catch (e: any) {
          return { ticker, time: performance.now() - tStart, success: false, error: e.message };
        }
      }));
      customEndpointData = {
        time: performance.now() - customStart,
        results: customResults
      };
    }

    NexusEngineUltra.clearCache();

    console.log(`[API] Running Nexus Engine for ${tickers.length} tickers...`);
    const nexusStart = performance.now();
    const nexusResults = await runNexusBatch(tickers, 'ACAO', undefined, false);
    const nexusTime = performance.now() - nexusStart;

    console.log(`[API] Benchmark Race completed. Nexus: ${nexusTime.toFixed(2)}ms, Legacy: ${legacyTime.toFixed(2)}ms`);
    res.json({
      legacy: { time: legacyTime, results: legacyResults },
      nexus: { time: nexusTime, results: nexusResults },
      customEndpoint: customEndpointData
    });
  } catch (error: any) {
    console.error(`[API] Benchmark Race error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/benchmark-compare", (req, res) => {
  res.status(405).json({ error: "Method Not Allowed. This endpoint requires a POST request with tickers." });
});

app.use("/api/*", (req, res) => {
  console.warn(`[API 404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "API Route not found", 
    method: req.method, 
    url: req.originalUrl,
    availableRoutes: ["GET /api/health", "POST /api/scrape", "POST /api/clear-cache", "GET /api/stats", "POST /api/benchmark-compare"]
  });
});

export default app;

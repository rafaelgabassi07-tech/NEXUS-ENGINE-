import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { runNexusBatch, NexusEngineUltra } from "./src/lib/nexus-core.js";
import { runLegacyScraper } from "./src/lib/legacy-scraper.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.use((req, res, next) => {
    const log = `[REQUEST] ${new Date().toISOString()} ${req.method} ${req.url}\n`;
    console.log(log.trim());
    import('fs').then(fs => {
      fs.appendFileSync('requests.log', log);
    }).catch(console.error);
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
      // runNexusBatch(tickers, type, limit, includeNews)
      const results = await runNexusBatch(tickers, type, undefined, !!includeNews);
      console.log(`[API] Scrape completed for ${tickers.length} tickers (news: ${!!includeNews})`);
      res.json({ results });
    } catch (error: any) {
      console.error(`[API] Scrape error: ${error.message}`);
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
    try {
      const { tickers } = req.body;
      if (!tickers || !Array.isArray(tickers)) {
        return res.status(400).json({ error: "Invalid tickers" });
      }

      // Clear cache to ensure fair race
      NexusEngineUltra.clearCache();

      // Run Legacy
      const legacyStart = performance.now();
      const legacyResults = await runLegacyScraper(tickers);
      const legacyTime = performance.now() - legacyStart;

      // Clear cache again
      NexusEngineUltra.clearCache();

      // Run Nexus
      const nexusStart = performance.now();
      const nexusResults = await runNexusBatch(tickers, 'ACAO', undefined, false);
      const nexusTime = performance.now() - nexusStart;

      res.json({
        legacy: { time: legacyTime, results: legacyResults },
        nexus: { time: nexusTime, results: nexusResults }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

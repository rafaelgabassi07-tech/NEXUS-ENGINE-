import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { runNexusBatch, NexusEngineUltra } from "./src/lib/nexus";

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
      const { tickers, type } = req.body;
      if (!tickers || !Array.isArray(tickers) || !type) {
        console.warn(`[API] Invalid request body: ${JSON.stringify(req.body)}`);
        return res.status(400).json({ error: "Invalid request body" });
      }
      const results = await runNexusBatch(tickers, type);
      console.log(`[API] Scrape completed for ${tickers.length} tickers`);
      res.json({ results });
    } catch (error: any) {
      console.error(`[API] Scrape error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  app.use("/api/*", (req, res) => {
    console.warn(`[API 404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      error: "API Route not found", 
      method: req.method, 
      url: req.originalUrl,
      availableRoutes: ["GET /api/health", "POST /api/scrape", "POST /api/clear-cache"]
    });
  });

  app.post("/api/clear-cache", (req, res) => {
    NexusEngineUltra.clearCache();
    res.json({ success: true });
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

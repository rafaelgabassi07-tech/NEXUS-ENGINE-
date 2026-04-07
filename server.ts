import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { runNexusBatch, NexusEngineUltra } from "./src/lib/nexus";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/scrape", async (req, res) => {
    try {
      const { tickers, type } = req.body;
      if (!tickers || !Array.isArray(tickers) || !type) {
        return res.status(400).json({ error: "Invalid request body" });
      }
      const results = await runNexusBatch(tickers, type);
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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

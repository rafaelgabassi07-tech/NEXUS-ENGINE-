import express from "express";
import cors from "cors";
import { runNexusBatch, NexusEngineUltra } from "../src/lib/nexus-core.js";
import fs from "fs";

const app = express();

app.use(cors());
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

app.use("/api/*", (req, res) => {
  console.warn(`[API 404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: "API Route not found", 
    method: req.method, 
    url: req.originalUrl,
    availableRoutes: ["GET /api/health", "POST /api/scrape"]
  });
});

export default app;

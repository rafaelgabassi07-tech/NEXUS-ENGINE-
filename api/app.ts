import express from "express";
import cors from "cors";
import { runNexusBatch, NexusEngineUltra } from "../src/lib/nexus-core.js";
import fs from "fs";
import path from "path";

const app = express();

const HISTORY_FILE = path.join(process.cwd(), "data", "history-db.json");

// Garante que o diretório de dados exista
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

interface HistoryEntry {
  timestamp: string;
  ticker: string;
  type: string;
  preco?: number;
  dy?: number;
  pl?: number;
  pvp?: number;
}

function saveToHistory(results: any[], type: string) {
  try {
    let history: HistoryEntry[] = [];
    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
    }
    const now = new Date().toISOString();
    results.forEach((item: any) => {
      if (item && item.results && !item.error) {
        const precoval = item.results.precoAtual || item.results.preco || 0;
        const preco = typeof precoval === 'number' ? precoval : (parseFloat(String(precoval).replace("R$", "").replace(".", "").replace(",", ".").trim()) || 0);
        
        const dyval = item.results.dividendYield || item.results.dy12m || "0";
        const dy = typeof dyval === 'number' ? dyval : (parseFloat(String(dyval).replace("%", "").replace(".", "").replace(",", ".").trim()) || 0);
        
        const plval = item.results.pl || "0";
        const pl = typeof plval === 'number' ? plval : (parseFloat(String(plval).replace(".", "").replace(",", ".").trim()) || 0);
        
        const pvpval = item.results.pvp || "0";
        const pvp = typeof pvpval === 'number' ? pvpval : (parseFloat(String(pvpval).replace(".", "").replace(",", ".").trim()) || 0);

        history.push({
          timestamp: now,
          ticker: item.ticker,
          type,
          preco,
          dy,
          pl,
          pvp,
        });
      }
    });

    if (history.length > 200) {
      history = history.slice(history.length - 200);
    }

    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
  } catch (error: any) {
    console.error(`[API] Erro ao salvar histórico: ${error.message}`);
  }
}

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

app.get("/api/readme", (req, res) => {
  try {
    const readmePath = path.join(process.cwd(), "README.md");
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, "utf-8");
      res.json({ content });
    } else {
      res.status(404).json({ error: "README.md not found" });
    }
  } catch (error: any) {
    console.error(`[API] Readme error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/logs", (req, res) => {
  try {
    const logPath = path.join(process.cwd(), "requests.log");
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, "utf-8");
      res.json({ logs: content });
    } else {
      res.json({ logs: "" });
    }
  } catch (error: any) {
    console.error(`[API] Logs error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/history", (req, res) => {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const content = fs.readFileSync(HISTORY_FILE, "utf-8");
      res.json({ history: JSON.parse(content) });
    } else {
      res.json({ history: [] });
    }
  } catch (error: any) {
    console.error(`[API] History error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
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
    
    // Salva resultados válidos no banco de dados de histórico
    saveToHistory(results, type);

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
    availableRoutes: ["GET /api/health", "POST /api/scrape", "GET /api/readme", "GET /api/history", "GET /api/logs"]
  });
});

export default app;

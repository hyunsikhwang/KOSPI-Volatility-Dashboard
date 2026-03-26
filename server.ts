import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();
console.log("YahooFinance instance initialized");

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('!!! Uncaught Exception !!!', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('!!! Unhandled Rejection !!! at:', promise, 'reason:', reason);
});

console.log("Server script starting...");

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log(`Initializing Express on port ${PORT}`);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API routes
  app.get("/api/kospi", async (req, res) => {
    console.log("API: GET /api/kospi called");
    try {
      const query = '^KS11';
      // Use a Date object for period1
      const period1 = new Date('2007-01-01');
      
      console.log(`Fetching KOSPI data for ${query} since ${period1.toISOString()}...`);
      
      // Use chart() as the primary method as it's more reliable for indices in v3
      const chartData = await yahooFinance.chart(query, {
        period1: period1,
        interval: '1d',
      }) as any;
      
      if (!chartData || !chartData.quotes || chartData.quotes.length === 0) {
        throw new Error("Yahoo Finance returned no data for KOSPI (^KS11)");
      }

      const result = chartData.quotes.map((q: any) => ({
        date: q.date,
        close: q.close,
        open: q.open,
        high: q.high,
        low: q.low,
        volume: q.volume,
        adjClose: q.adjclose
      })).filter((r: any) => r.close !== null && r.close !== undefined);

      console.log(`Success: Fetched ${result.length} rows of REAL KOSPI data`);
      res.json(result);
    } catch (error: any) {
      console.error("Yahoo Finance Error:", error.message);
      
      // Detailed error logging for validation issues
      if (error.errors || error.subErrors) {
        console.error("Validation Errors:", JSON.stringify(error.errors || error.subErrors, null, 2));
      }
      
      res.status(500).json({ 
        error: "실제 KOSPI 데이터를 가져오는 데 실패했습니다.", 
        details: error.message,
        validationErrors: error.errors || error.subErrors
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite middleware...");
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
    console.log(`Server is LIVE at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});

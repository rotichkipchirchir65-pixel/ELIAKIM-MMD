import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { startBot } from "./src/index.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON for API
  app.use(express.json());

  // API Status Endpoint
  app.get("/api/status", (req, res) => {
    res.json({ status: "online", bot: "ELIAKIM MD" });
  });

  // Vite middleware for development
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

  // Start the WhatsApp Bot
  try {
    await startBot();
    console.log("WhatsApp Bot Initialized");
  } catch (err) {
    console.error("Failed to start WhatsApp Bot:", err);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

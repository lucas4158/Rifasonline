import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Initialize Server App
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load Firebase Config dynamically
let db: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log("🔥 [Firebase] Server initialized successfully on DB:", firebaseConfig.firestoreDatabaseId);
  } else {
    console.error("❌ [Firebase] No config file found at:", configPath);
  }
} catch (err) {
  console.error("❌ [Firebase] Setup error during startup:", err);
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", db: !!db });
});

// -------------------------------------------------------------
// VITE OR STATIC SERVING MIDDLEWARE
// -------------------------------------------------------------
if (process.env.NODE_ENV !== "production") {
  console.log("⚙️  [Vite] Initializing development middleware mode...");
  const startVite = async () => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`💻 [Vite Dev Server] Standing by on URL: http://localhost:${PORT}`);
    });
  };
  startVite();
} else {
  console.log("🚀 [Production] Serving static distribution files...");
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 [Production App Server] Online on port ${PORT}`);
  });
}

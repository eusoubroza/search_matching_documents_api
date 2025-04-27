import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { authenticateApiKey } from "./auth.js";
import * as dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { Worker } from "worker_threads";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting middleware: 10 requests per minute per IP
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 10, 
  message: { error: "Too many requests. Please try again later." },
});
app.use(limiter);

// POST /batch-search endpoint
app.post("/batch-search", authenticateApiKey, async (req, res) => {
  const { texts } = req.body;

  if (!Array.isArray(texts) || texts.length === 0) {
    return res.status(400).json({ error: "Texts array is required" });
  }

  try {
    const results = await Promise.all(
      texts.map(text => runWorkerTask({ text }))
    );

    res.json({ results });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Batch Processing Failed", details: err.message });
  }
});

// Worker task runner
function runWorkerTask(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./worker.js", { workerData });

    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

// GET /download/:id endpoint
app.get("/download/:id", authenticateApiKey, async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('teste2')
      .select('id, content, metadata')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Serve content as a text file
    res.setHeader('Content-Disposition', `attachment; filename=document-${id}.txt`);
    res.setHeader('Content-Type', 'text/plain');
    return res.send(data.content);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 API running on http://localhost:${port}`);
});

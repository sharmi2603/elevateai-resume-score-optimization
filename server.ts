import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import * as pdf from "pdf-parse";
import mammoth from "mammoth";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Multer config for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only DOCX files are allowed"));
    }
  }
});

app.use(cors());
app.use(express.json());

// Helper to extract text
async function extractText(file: Express.Multer.File): Promise<string> {
  console.log(`Extracting text from ${file.originalname} (${file.mimetype})`);
  if (file.mimetype === "application/pdf") {
    try {
      // pdf-parse often requires this specific call pattern in ESM
      const parse = (pdf as any).default || pdf;
      const data = await parse(file.buffer);
      return data.text;
    } catch (err) {
      console.error("PDF extraction error:", err);
      throw new Error("Failed to parse PDF file");
    }
  } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    try {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value;
    } catch (err) {
      console.error("DOCX extraction error:", err);
      throw new Error("Failed to parse DOCX file");
    }
  }
  throw new Error("Unsupported file type");
}

// API Routes
app.post("/api/extract-text", upload.single("resume"), async (req, res) => {
  console.log("POST /api/extract-text received");
  try {
    if (!req.file) {
      console.error("No file in request");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const text = await extractText(req.file);
    console.log(`Successfully extracted ${text.length} characters`);
    res.json({ text });
  } catch (error: any) {
    console.error("Extraction error:", error);
    res.status(500).json({ error: error.message || "Failed to extract text from resume" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

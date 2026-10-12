
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "./system-prompt.js";

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const MODEL = "gemini-3.1-flash-lite";

app.disable("x-powered-by");

// مناسب للاستضافة خلف وسيط مثل Render
app.set("trust proxy", 1);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // السماح بالطلبات التي لا تأتي من متصفح، مثل فحوصات الصحة
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    }
  })
);

app.use(express.json({ limit: "20kb" }));

app.use(
  "/api/",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/", (_req, res) => {
  res.json({
    name: "M.R251 AI",
    status: "online"
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "الخادم يحتاج إلى استكمال الإعداد."
    });
  }

  const message =
    typeof req.body?.message === "string"
      ? req.body.message.trim()
      : "";

  if (!message || message.length > 4000) {
    return res.status(400).json({
      error: "أرسل رسالة من 1 إلى 4000 حرف."
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: message,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        thinkingConfig: {
          thinkingLevel: "low"
        }
      }
    });

    const reply = response.text?.trim();

    if (!reply) {
      console.error("Gemini returned an empty response.");

      return res.status(502).json({
        error: "لم يصل رد صالح من النموذج. حاول مرة أخرى."
      });
    }

    return res.json({ reply });
  } catch (error) {
    console.error("Gemini request failed:", {
      status: error?.status,
      message: error?.message || "Unknown error"
    });

    return res.status(502).json({
      error: "تعذر الحصول على رد الآن. حاول مرة أخرى."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`M.R251 AI listening on port ${PORT}`);
});

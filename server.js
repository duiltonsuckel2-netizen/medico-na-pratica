import "dotenv/config";
import express from "express";
import cors from "cors";

// ══ PROVEDORES DE IA (fallback automático) ══
const providers = [];

// Groq keys
[process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2].forEach((key, i) => {
  if (key && !key.startsWith("COLE_")) {
    providers.push({
      name: `Groq #${i + 1}`,
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.3-70b-versatile",
      key,
      format: "openai",
    });
  }
});

// Gemini keys
[process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2].forEach((key, i) => {
  if (key && !key.startsWith("COLE_")) {
    providers.push({
      name: `Gemini #${i + 1}`,
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      model: "gemini-2.0-flash",
      key,
      format: "gemini",
    });
  }
});

// Estado dos tokens por provedor
const tokenStatus = {};

async function callProvider(provider, messages, max_tokens) {
  if (provider.format === "openai") {
    const response = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + provider.key,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: max_tokens || 2500,
        temperature: 0.9,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }
    // Captura tokens restantes dos headers do Groq
    const remaining = response.headers.get("x-ratelimit-remaining-tokens");
    const limit = response.headers.get("x-ratelimit-limit-tokens");
    const reset = response.headers.get("x-ratelimit-reset-tokens");
    tokenStatus[provider.name] = {
      remaining: remaining ? parseInt(remaining) : null,
      limit: limit ? parseInt(limit) : null,
      reset: reset || null,
      updated: new Date().toISOString(),
    };
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  if (provider.format === "gemini") {
    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const response = await fetch(provider.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: max_tokens || 2500,
          temperature: 0.9,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }
    tokenStatus[provider.name] = {
      remaining: null,
      limit: null,
      reset: null,
      updated: new Date().toISOString(),
      status: "ok",
    };
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  throw new Error("Formato desconhecido: " + provider.format);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
});

app.post("/api/ai", async (req, res) => {
  if (!providers.length) {
    return res.status(500).json({ error: "Nenhuma API key configurada. Edite o arquivo .env" });
  }

  const errors = [];
  for (const provider of providers) {
    try {
      console.log(`Tentando ${provider.name}...`);
      const text = await callProvider(provider, req.body.messages, req.body.max_tokens);
      console.log(`${provider.name} OK (${text.length} chars)`);
      return res.json({ content: [{ text }] });
    } catch (err) {
      const msg = err.message || String(err);
      console.warn(`${provider.name} falhou: ${msg.slice(0, 120)}`);
      errors.push(`${provider.name}: ${msg.slice(0, 200)}`);
      tokenStatus[provider.name] = {
        remaining: 0,
        limit: tokenStatus[provider.name]?.limit || null,
        reset: null,
        updated: new Date().toISOString(),
        status: "rate_limited",
      };
    }
  }

  console.error("Todas as APIs falharam.");
  res.status(500).json({ error: "Todas as APIs falharam:\n" + errors.join("\n") });
});

app.get("/api/tokens", (req, res) => {
  const status = providers.map(p => ({
    name: p.name,
    model: p.model,
    ...(tokenStatus[p.name] || { remaining: null, limit: null, status: "não usado ainda" }),
  }));
  res.json(status);
});

const PORT = 3001;
const server = app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`APIs configuradas: ${providers.map(p => p.name).join(", ") || "NENHUMA"}`);
  if (!providers.length) console.warn("⚠️  Nenhuma API key encontrada! Edite o .env");
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 130000;

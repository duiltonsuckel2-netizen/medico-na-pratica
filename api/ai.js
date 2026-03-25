export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const providers = [];

  [process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2].forEach((key, i) => {
    if (key) providers.push({ name: `Groq #${i+1}`, url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", key, format: "openai" });
  });

  [process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2].forEach((key, i) => {
    if (key) providers.push({ name: `Gemini #${i+1}`, url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, model: "gemini-2.0-flash", key, format: "gemini" });
  });

  if (!providers.length) return res.status(500).json({ error: "Nenhuma API key configurada" });

  const errors = [];
  for (const provider of providers) {
    try {
      let text = "";
      if (provider.format === "openai") {
        const response = await fetch(provider.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + provider.key },
          body: JSON.stringify({ model: provider.model, messages: req.body.messages, max_tokens: req.body.max_tokens || 2500, temperature: 0.9 }),
        });
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        text = data.choices?.[0]?.message?.content || "";
      } else if (provider.format === "gemini") {
        const contents = req.body.messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
        const response = await fetch(provider.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: req.body.max_tokens || 2500, temperature: 0.9, responseMimeType: "application/json" } }),
        });
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
      return res.json({ content: [{ text }] });
    } catch (err) {
      errors.push(`${provider.name}: ${(err.message || "").slice(0, 200)}`);
    }
  }
  res.status(500).json({ error: "Todas as APIs falharam:\n" + errors.join("\n") });
}

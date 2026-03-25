// Na Vercel, materiais ficam no localStorage do navegador (frontend)
// Este endpoint existe pra manter compatibilidade mas retorna vazio online
export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.json([]);
  }
  if (req.method === "POST") {
    return res.json({ ok: true });
  }
  if (req.method === "DELETE") {
    return res.json({ ok: true });
  }
  res.status(405).json({ error: "Method not allowed" });
}

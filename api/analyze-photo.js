export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY manquant" });

  const { imageBase64, mediaType, piecesAttendues } = req.body;
  if (!imageBase64 || !piecesAttendues) return res.status(400).json({ error: "Paramètres manquants" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 50,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 }
            },
            {
              type: "text",
              text: `Quelle pièce est visible sur cette photo ? Réponds uniquement avec un de ces mots exacts : ${piecesAttendues.join(", ")}. Si aucune ne correspond, réponds "autre".`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: "Erreur Anthropic", details: data });

    const piece = data.content[0].text.trim().toLowerCase();
    return res.status(200).json({ piece });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

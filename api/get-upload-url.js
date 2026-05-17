export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) return res.status(500).json({ error: "NOTION_TOKEN manquant" });

  const { filename } = req.body;

  try {
    const createRes = await fetch("https://api.notion.com/v1/file_uploads", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename: filename || "photo.jpg", content_type: "image/jpeg" }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      return res.status(500).json({ error: "Erreur Notion", details: err });
    }

    const data = await createRes.json();
    return res.status(200).json({ uploadId: data.id, uploadUrl: data.upload_url });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

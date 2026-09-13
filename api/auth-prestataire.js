const PRESTATAIRES_DB = "3d7d50ab-a52f-8012-a15d-e9d59a968f8f";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username et mot de passe requis" });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${PRESTATAIRES_DB}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: "Username", rich_text: { equals: username } }
      }),
    });

    const data = await r.json();
    const page = (data.results || [])[0];
    if (!page) return res.status(401).json({ error: "Identifiants incorrects" });

    const props = page.properties || {};
    const storedPassword = (props["Mot de passe"]?.rich_text || []).map(t => t.plain_text).join("");
    const nom = (props["Nom"]?.title || []).map(t => t.plain_text).join("");
    const nom = (nomProp?.title || []).map(t => t.plain_text).join("");
    const email = props["Email"]?.email || "";

    if (storedPassword !== password) return res.status(401).json({ error: "Identifiants incorrects" });

    return res.status(200).json({
      success: true,
      prestataire: { id: page.id, nom, email, username }
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

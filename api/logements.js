// api/logements.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // liste des logements réservée à l'admin
  if (!process.env.ADMIN_PASSWORD || (req.headers["x-admin-password"] || "") !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Accès réservé à l'admin" });
  }
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const LOGEMENTS_DB = process.env.NOTION_LOGEMENTS_DB || "365d50aba52f801fb5fdf740a0aa78c1";

  const notionRes = await fetch("https://api.notion.com/v1/databases/" + LOGEMENTS_DB + "/query", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + NOTION_TOKEN,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_size: 100 }),
  });

  const data = await notionRes.json();
  const logements = (data.results || []).map(function(page) {
    const props = page.properties || {};
    const nom = (props["Nom"]?.title || []).map(t => t.plain_text).join("");
    return {
      nom,
      slug: nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      adresse: (props["Adresse"]?.rich_text || []).map(t => t.plain_text).join(""),
    };
  }).filter(l => l.nom);

  return res.status(200).json({ logements });
}

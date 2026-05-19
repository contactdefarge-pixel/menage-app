const DEFAULT_LOGEMENTS_DB = "365d50aba52f801fb5fdf740a0aa78c1";

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function plainText(prop) {
  if (!prop) return "";
  if (prop.type === "title") return prop.title.map((t) => t.plain_text || "").join("");
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text || "").join("");
  if (prop.type === "number") return prop.number == null ? "" : String(prop.number);
  return "";
}

function mapPage(page) {
  const props = page.properties || {};
  const nom = plainText(props["Nom"]);
    const photosReference = (props["Photos fin de ménage"]?.files || []).map(f => ({
    url: f.type === "external" ? f.external.url : f.file?.url,
    nom: f.name || "",
  })).filter(f => f.url);
  console.log("PROPS KEYS:", Object.keys(props));
  return {
    id: page.id,
    slug: slugify(nom),
    nom,
    adresse: plainText(props["Adresse"]),
    wifi: plainText(props["WiFi"]),
    voyageurs: plainText(props["Nombre de voyageurs"]),
    chambres: plainText(props["Nombre de chambres"]),
    lits: plainText(props["Types de lits"]),
    acces: plainText(props["Accès logement"]),
    boiteCle: plainText(props["Boite à clé"]),
    poubelles: plainText(props["Poubelles"]),
    consommables: plainText(props["Consommables"]),
    consommablesALaisser: plainText(props["Consommables à laisser"]),
    photosReference, // ← MANQUANT, ajouter cette ligne
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const LOGEMENTS_DB = process.env.NOTION_LOGEMENTS_DB || DEFAULT_LOGEMENTS_DB;
  const requestedSlug = slugify(req.query.slug || req.query.logement || "le-nossa");

  if (!NOTION_TOKEN) {
    return res.status(500).json({ error: "NOTION_TOKEN manquant" });
  }

  try {
    const notionRes = await fetch("https://api.notion.com/v1/databases/" + LOGEMENTS_DB + "/query", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100 }),
    });

    if (!notionRes.ok) {
      const err = await notionRes.json();
      console.error("Notion logements error:", err);
      return res.status(500).json({ error: "Erreur Notion logements", details: err });
    }

    const data = await notionRes.json();
    const logements = (data.results || []).map(mapPage).filter((l) => l.nom);
    const logement = logements.find((l) => l.slug === requestedSlug);

    if (!logement) {
      return res.status(404).json({
        error: "Logement introuvable",
        slug: requestedSlug,
        available: logements.map((l) => ({ nom: l.nom, slug: l.slug })),
      });
    }

    return res.status(200).json({ success: true, logement });
  } catch (e) {
    console.error("Erreur logement:", e);
    return res.status(500).json({ error: e.message });
  }
}

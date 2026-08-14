const DEFAULT_LOGEMENTS_DB = "365d50aba52f801fb5fdf740a0aa78c1";

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* Texte brut simple (pour champs sans mise en forme) */
function plainText(prop) {
  if (!prop) return "";
  if (prop.type === "title")     return prop.title.map((t) => t.plain_text || "").join("");
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text || "").join("");
  if (prop.type === "number")    return prop.number == null ? "" : String(prop.number);
  return "";
}

/* Rich text avec mise en forme Notion → tableau de segments */
function richText(prop) {
  if (!prop) return [];
  var tokens = [];
  if (prop.type === "title")     tokens = prop.title     || [];
  if (prop.type === "rich_text") tokens = prop.rich_text || [];
  return tokens.map(function(t) {
    return {
      text:   t.plain_text || "",
      bold:   !!(t.annotations && t.annotations.bold),
      italic: !!(t.annotations && t.annotations.italic),
      underline: !!(t.annotations && t.annotations.underline),
      strikethrough: !!(t.annotations && t.annotations.strikethrough),
      code:   !!(t.annotations && t.annotations.code),
      color:  (t.annotations && t.annotations.color !== "default") ? t.annotations.color : null,
      href:   t.href || null,
    };
  });
}

function mapPage(page) {
  const props = page.properties || {};
  const nom = plainText(props["Nom"]);

  const photosReference = (props["Photos fin de ménage"]?.files || []).map(f => ({
    url: f.type === "external" ? f.external.url : f.file?.url,
    nom: f.name || "",
  })).filter(f => f.url);

  return {
    id:    page.id,
    slug:  slugify(nom),
    nom,
    adresse:              plainText(props["Adresse"]),
    wifi:                 richText(props["WiFi"]),
    voyageurs:            plainText(props["Nombre de voyageurs"]),
    chambres:             plainText(props["Nombre de chambres"]),
    lits:                 richText(props["Types de lits"]),
    acces:                richText(props["Accès logement"]),
    boiteCle:             plainText(props["Boite à clé"]),
    poubelles:            richText(props["Poubelles"]),
    consommables:         richText(props["Consommables"]),
    consommablesALaisser: richText(props["Consommables à laisser"]),
    photosReference,
    pointsAttention:      richText(props["Points d'attention"]),
    proprietaire:         plainText(props["Propriétaire"]),
    forfaitMenage:        props["Forfait ménage"]?.number != null ? props["Forfait ménage"].number + " €" : "",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const NOTION_TOKEN  = process.env.NOTION_TOKEN;
  const LOGEMENTS_DB  = process.env.NOTION_LOGEMENTS_DB || DEFAULT_LOGEMENTS_DB;
  const requestedSlug = slugify(req.query.slug || req.query.logement || "le-nossa");

  if (!NOTION_TOKEN) return res.status(500).json({ error: "NOTION_TOKEN manquant" });

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
      return res.status(500).json({ error: "Erreur Notion logements", details: err });
    }

    const data = await notionRes.json();
    const logements = (data.results || []).map(mapPage).filter((l) => l.nom);
    const logement  = logements.find((l) => l.slug === requestedSlug);

    if (!logement) {
      return res.status(404).json({
        error: "Logement introuvable",
        slug: requestedSlug,
        available: logements.map((l) => ({ nom: l.nom, slug: l.slug })),
      });
    }

    return res.status(200).json({ success: true, logement });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

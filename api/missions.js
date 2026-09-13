const MISSIONS_DB    = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const LOGEMENTS_DB   = "365d50ab-a52f-801f-b5fd-f740a0aa78c1";

function plainText(prop) {
  if (!prop) return "";
  if (prop.type === "title")     return (prop.title     || []).map(t => t.plain_text).join("");
  if (prop.type === "rich_text") return (prop.rich_text || []).map(t => t.plain_text).join("");
  return "";
}

function slugify(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function getLogementSlug(notion_token, logementId) {
  try {
    const r = await fetch(`https://api.notion.com/v1/pages/${logementId}`, {
      headers: {
        "Authorization": `Bearer ${notion_token}`,
        "Notion-Version": "2022-06-28",
      }
    });
    const data = await r.json();
    const nom = plainText(data.properties?.["Nom"]);
    return slugify(nom);
  } catch (e) {
    return "";
  }
}

function mapMission(page) {
  const props = page.properties || {};
  const nom         = plainText(props["Nom"]);
  const date        = props["Date"]?.date?.start || "";
  const etat        = props["État"]?.status?.name || "";
  const prestataire = (props["Prestataire"]?.relation || [])[0]?.id || null;
  const logement    = (props["Logement"]?.relation    || [])[0]?.id || null;
  const logementNom = plainText(props["Logement nom"]);
  const refus       = (props["Refus"]?.multi_select || []).map(r => r.name);

  return { id: page.id, nom, date, etat, prestataire, logement, logementNom, refus };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")    return res.status(405).json({ error: "Method not allowed" });

  const NOTION_TOKEN   = process.env.NOTION_TOKEN;
  const prestataireId  = req.query.prestataireId || "";
  const prestataireNom = req.query.prestataireNom || "";

  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${MISSIONS_DB}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sorts: [{ property: "Date", direction: "ascending" }],
        page_size: 100,
      }),
    });

    const data = await r.json();
    const all  = (data.results || []).map(mapMission);

    // Missions disponibles (pas encore acceptées, pas refusées par ce prestataire)
    const disponibles = all.filter(m =>
      m.etat === "Disponible" &&
      !m.prestataire &&
      !m.refus.includes(prestataireNom) &&
      !m.refus.includes(prestataireId)
    );

    // Missions de ce prestataire
    const mesMissions = all.filter(m => m.prestataire === prestataireId);

    // Enrichir avec le slug logement
    const enrichir = async (missions) => {
      return Promise.all(missions.map(async (m) => {
        const slug = m.logement ? await getLogementSlug(NOTION_TOKEN, m.logement) : "";
        return { ...m, slug };
      }));
    };

    const [dispEnriched, mesEnriched] = await Promise.all([
      enrichir(disponibles),
      enrichir(mesMissions),
    ]);

    return res.status(200).json({
      success: true,
      disponibles: dispEnriched,
      mesMissions: mesEnriched,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

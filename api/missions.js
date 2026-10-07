import { getMissionDetails, buildIcs } from "../lib/mail.js";

const MISSIONS_DB  = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";

/* ── Réglages de l'avant-première ──────────────────────────────────────
   Délai (en heures) avant qu'une mission devienne visible, selon le niveau
   de la prestataire [niveau 1, niveau 2, niveau 3]. Plus la mission est
   proche, plus les paliers sont courts.                                    */
const PALIERS = [
  { jours: 14, heures: [0, 24, 48] },
  { jours: 7,  heures: [0, 12, 24] },
  { jours: 3,  heures: [0, 4, 8]   },
  { jours: 0,  heures: [0, 0, 0]   },
];

// Les missions ne sont proposées qu'à partir de J-30
const HORIZON_JOURS = 30;

const H = (t) => ({ "Authorization": `Bearer ${t}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });

function plainText(prop) {
  if (!prop) return "";
  if (prop.type === "title")     return (prop.title     || []).map(t => t.plain_text).join("");
  if (prop.type === "rich_text") return (prop.rich_text || []).map(t => t.plain_text).join("");
  return "";
}
function slugify(v) {
  return String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
// "1 - Prioritaire" -> 1 ; vide -> def
function niveauNum(name, def) {
  const m = String(name || "").match(/^\s*(\d)/);
  return m ? parseInt(m[1], 10) : def;
}

async function getLogementInfo(token, logementId) {
  const vide = { slug: "", logementNom: "", illustration: "", adresse: "", forfaitMenage: "", dureeEstimee: "", niveauRequis: 3, attribution: "postuler" };
  try {
    const r = await fetch(`https://api.notion.com/v1/pages/${logementId}`, { headers: H(token) });
    const data = await r.json();
    const props = data.properties || {};
    const nom = plainText(props["Nom"]);
    return {
      slug: slugify(nom),
      logementNom: nom,
      illustration: props["Illustration"]?.select?.name || "",
      adresse: plainText(props["Adresse"]),
      forfaitMenage: props["Forfait ménage"]?.number != null ? props["Forfait ménage"].number + " €" : "",
      dureeEstimee: plainText(props["Durée estimée"]),
      niveauRequis: niveauNum(props["Niveau requis"]?.select?.name, 3),
      attribution: /direct/i.test(props["Attribution"]?.select?.name || "") ? "direct" : "postuler",
    };
  } catch (e) { return vide; }
}

async function getPrestataireNiveau(token, id) {
  try {
    const r = await fetch(`https://api.notion.com/v1/pages/${id}`, { headers: H(token) });
    const data = await r.json();
    const n = data.properties?.["Niveau"]?.select?.name;
    return n ? niveauNum(n, null) : null;   // null = niveau non renseigné
  } catch (e) { return null; }
}

function mapMission(page) {
  const props = page.properties || {};
  return {
    id:          page.id,
    nom:         plainText(props["Nom"]),
    date:        props["Date"]?.date?.start || "",
    etat:        props["État"]?.status?.name || "",
    prestataire: (props["Prestataire"]?.relation || [])[0]?.id || null,
    logement:    (props["Logement"]?.relation    || [])[0]?.id || null,
    candidats:   (props["Candidats"]?.relation   || []).map(r => r.id),
    refus:       (props["Refus"]?.multi_select   || []).map(r => r.name),
    cree:        page.created_time,
  };
}

function delaiHeures(dateStr, niveau, now) {
  if (!niveau || !dateStr) return 0;
  const jours = (new Date(dateStr) - now) / 86400000;
  const p = PALIERS.find(x => jours >= x.jours) || PALIERS[PALIERS.length - 1];
  return p.heures[Math.min(niveau, 3) - 1] || 0;
}

async function queryAll(token) {
  let results = [], cursor;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`https://api.notion.com/v1/databases/${MISSIONS_DB}/query`, {
      method: "POST", headers: H(token),
      body: JSON.stringify({ sorts: [{ property: "Date", direction: "ascending" }], page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    const data = await r.json();
    results = results.concat(data.results || []);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return results;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")    return res.status(405).json({ error: "Method not allowed" });

  const NOTION_TOKEN   = process.env.NOTION_TOKEN;

  // ?ics=<id mission> : fichier calendrier (bouton « Apple Agenda » des e-mails)
  if (req.query.ics) {
    try {
      const mis = await getMissionDetails(NOTION_TOKEN, String(req.query.ics));
      if (!mis.date) return res.status(404).send("Mission introuvable");
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", 'inline; filename="mission-izinest.ics"');
      return res.status(200).send(buildIcs(mis));
    } catch (e) { return res.status(500).send("Erreur"); }
  }

  const prestataireId  = req.query.prestataireId  || "";
  const prestataireNom = req.query.prestataireNom || "";
  const now = new Date();

  try {
    const [pages, niveau] = await Promise.all([queryAll(NOTION_TOKEN), prestataireId ? getPrestataireNiveau(NOTION_TOKEN, prestataireId) : null]);
    const all = pages.map(mapMission);

    const aTraiter = all.filter(m =>
      (m.etat === "Disponible" && !m.prestataire && !m.refus.includes(prestataireNom) && !m.refus.includes(prestataireId)) ||
      m.prestataire === prestataireId
    );

    // infos logement (une seule fois par logement)
    const cache = {};
    const ids = [...new Set(aTraiter.map(m => m.logement).filter(Boolean))];
    await Promise.all(ids.map(async id => { cache[id] = await getLogementInfo(NOTION_TOKEN, id); }));
    const vide = { slug: "", logementNom: "", illustration: "", adresse: "", forfaitMenage: "", dureeEstimee: "", niveauRequis: 3, attribution: "postuler" };
    const enrichir = m => ({ ...m, ...(m.logement ? cache[m.logement] : vide) });

    const disponibles = aTraiter
      .filter(m => m.etat === "Disponible" && !m.prestataire)
      .map(enrichir)
      .filter(m => {
        // 0) on ne propose que les missions des 30 prochains jours
        if (m.date && (new Date(m.date) - now) / 86400000 > HORIZON_JOURS) return false;
        // 1) logement réservé à certains niveaux
        if (niveau && niveau > m.niveauRequis) return false;
        // 2) avant-première : la mission devient visible après un délai selon le niveau
        const visibleA = new Date(m.cree).getTime() + delaiHeures(m.date, niveau, now) * 3600000;
        return now.getTime() >= visibleA;
      })
      .map(m => ({ ...m, candidature: m.candidats.includes(prestataireId) }));

    const mesMissions = aTraiter.filter(m => m.prestataire === prestataireId).map(enrichir);

    return res.status(200).json({ success: true, niveau, disponibles, mesMissions });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

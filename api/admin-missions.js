import { getMissionDetails, getPrestataire, emailConfirmation, notifierAnnulation, sendEmail } from "../lib/mail.js";

const MISSIONS_DB     = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const PRESTATAIRES_DB = "3d7d50ab-a52f-8012-a15d-e9d59a968f8f";
const LOGEMENTS_DB    = "365d50ab-a52f-801f-b5fd-f740a0aa78c1";
const H = (t) => ({ "Authorization": `Bearer ${t}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });

function plain(prop) {
  if (!prop) return "";
  const a = prop.title || prop.rich_text || [];
  return a.map(t => t.plain_text).join("");
}
function niveauNum(name) { const m = String(name || "").match(/^\s*(\d)/); return m ? parseInt(m[1], 10) : null; }

async function getPage(token, id) {
  const r = await fetch(`https://api.notion.com/v1/pages/${id}`, { headers: H(token) });
  return r.json();
}


/* Création unique des colonnes Notion (regroupé ici : le plan Hobby de Vercel limite à 12 fonctions) :
   https://agents.izinest.fr/api/admin-missions?setup=1&secret=<CRON_SECRET>   */
async function setupColonnes(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.query.secret !== secret) return res.status(401).json({ error: "Unauthorized" });
  const T = process.env.NOTION_TOKEN;
  const sel = names => ({ select: { options: names.map(name => ({ name })) } });
  const jobs = [
    ["Prestataires", PRESTATAIRES_DB, { "Niveau": sel(["1 - Prioritaire", "2 - Confirmée", "3 - Standard"]) }],
    ["Logements", LOGEMENTS_DB, {
      "Niveau requis": sel(["1 - Prioritaires uniquement", "2 - Prioritaires et confirmées", "3 - Toutes"]),
      "Attribution": sel(["Direct", "Postuler"]),
    }],
    ["Missions", MISSIONS_DB, { "Candidats": { relation: { database_id: PRESTATAIRES_DB, single_property: {} } } }],
  ];
  const out = {};
  for (const [nom, id, properties] of jobs) {
    const r = await fetch(`https://api.notion.com/v1/databases/${id}`, { method: "PATCH", headers: H(T), body: JSON.stringify({ properties }) });
    out[nom] = r.ok ? "ok" : (await r.text()).slice(0, 300);
  }
  return res.status(200).json(out);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.query.setup) return setupColonnes(req, res);

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(503).json({ error: "ADMIN_PASSWORD n'est pas configuré dans Vercel" });
  if ((req.headers["x-admin-password"] || "") !== expected) return res.status(401).json({ error: "Mot de passe incorrect" });

  const T = process.env.NOTION_TOKEN;
  try {
    if (req.method === "GET") {
      const r = await fetch(`https://api.notion.com/v1/databases/${MISSIONS_DB}/query`, {
        method: "POST", headers: H(T),
        body: JSON.stringify({ sorts: [{ property: "Date", direction: "ascending" }], page_size: 100,
          filter: { and: [{ property: "État", status: { equals: "Disponible" } }, { property: "Date", date: { on_or_after: new Date().toISOString().slice(0, 10) } }] } }),
      });
      const data = await r.json();
      const missions = (data.results || []).filter(p => !(p.properties["Prestataire"]?.relation || []).length);
      const cache = {};
      const get = async id => (cache[id] ||= getPage(T, id));
      const out = await Promise.all(missions.map(async p => {
        const pr = p.properties;
        const logId = (pr["Logement"]?.relation || [])[0]?.id;
        const log = logId ? await get(logId) : null;
        const cands = await Promise.all((pr["Candidats"]?.relation || []).map(async c => {
          const pg = await get(c.id); const pp = pg.properties || {};
          return { id: c.id, nom: plain(pp["Prénom/Nom"] || pp["Nom"]), niveau: niveauNum(pp["Niveau"]?.select?.name), email: pp["Email"]?.email || "" };
        }));
        return { id: p.id, nom: plain(pr["Nom"]), date: pr["Date"]?.date?.start || "",
          logementNom: log ? plain(log.properties?.["Nom"]) : "", attribution: /direct/i.test(log?.properties?.["Attribution"]?.select?.name || "") ? "direct" : "postuler",
          candidats: cands };
      }));
      // missions déjà attribuées (à venir) : possibilité de les annuler
      const r2 = await fetch(`https://api.notion.com/v1/databases/${MISSIONS_DB}/query`, {
        method: "POST", headers: H(T),
        body: JSON.stringify({ sorts: [{ property: "Date", direction: "ascending" }], page_size: 100,
          filter: { and: [{ property: "État", status: { equals: "Acceptée" } }, { property: "Date", date: { on_or_after: new Date().toISOString().slice(0, 10) } }] } }),
      });
      const d2 = await r2.json();
      const attribuees = await Promise.all((d2.results || []).map(async p => {
        const pr = p.properties;
        const logId = (pr["Logement"]?.relation || [])[0]?.id;
        const presId = (pr["Prestataire"]?.relation || [])[0]?.id;
        const log = logId ? await get(logId) : null;
        const pres = presId ? await get(presId) : null;
        const pp = pres?.properties || {};
        return { id: p.id, nom: plain(pr["Nom"]), date: pr["Date"]?.date?.start || "",
          logementNom: log ? plain(log.properties?.["Nom"]) : "", prestataire: plain(pp["Prénom/Nom"] || pp["Nom"]) };
      }));
      return res.status(200).json({ success: true, missions: out, attribuees });
    }

    if (req.method === "POST") {
      const { missionId, prestataireId, action } = req.body || {};
      if (!missionId) return res.status(400).json({ error: "Paramètres manquants" });

      if (action === "annuler") {
        // prévenir la prestataire, puis archiver la mission
        const mail = await notifierAnnulation(T, missionId, "elle a été annulée par izinest");
        const ar = await fetch(`https://api.notion.com/v1/pages/${missionId}`, { method: "PATCH", headers: H(T), body: JSON.stringify({ archived: true }) });
        if (!ar.ok) return res.status(500).json({ error: "Notion : " + (await ar.text()).slice(0, 300) });
        return res.status(200).json({ success: true, emailEnvoye: mail.ok, emailErreur: mail.ok ? undefined : mail.error });
      }

      if (!prestataireId) return res.status(400).json({ error: "Paramètres manquants" });
      const up = await fetch(`https://api.notion.com/v1/pages/${missionId}`, { method: "PATCH", headers: H(T),
        body: JSON.stringify({ properties: { "État": { status: { name: "Acceptée" } }, "Prestataire": { relation: [{ id: prestataireId }] } } }) });
      if (!up.ok) return res.status(500).json({ error: "Notion : " + (await up.text()).slice(0, 300) });
      const [mis, pres] = await Promise.all([getMissionDetails(T, missionId), getPrestataire(T, prestataireId)]);
      const mail = await sendEmail({ to: pres.email, ...emailConfirmation(mis, pres) });
      return res.status(200).json({ success: true, emailEnvoye: mail.ok, emailErreur: mail.ok ? undefined : mail.error });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

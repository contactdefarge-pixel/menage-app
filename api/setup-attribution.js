/* À appeler une seule fois pour créer les colonnes Notion nécessaires :
   https://menage-app-nine.vercel.app/api/setup-attribution?secret=<CRON_SECRET>   */
const MISSIONS_DB     = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const PRESTATAIRES_DB = "3d7d50ab-a52f-8012-a15d-e9d59a968f8f";
const LOGEMENTS_DB    = "365d50ab-a52f-801f-b5fd-f740a0aa78c1";
const H = (t) => ({ "Authorization": `Bearer ${t}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const ok = secret && (req.headers.authorization === `Bearer ${secret}` || req.query.secret === secret);
  if (!ok) return res.status(401).json({ error: "Unauthorized" });
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

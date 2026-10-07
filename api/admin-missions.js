const MISSIONS_DB = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const RESEND_KEY  = process.env.RESEND_API_KEY;
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

async function sendEmail({ to, subject, html }) {
  if (!to) return;
  try {
    await fetch("https://api.resend.com/emails", { method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "izinest <onboarding@resend.dev>", to, subject, html }) });
  } catch (e) { /* best effort */ }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
  if (req.method === "OPTIONS") return res.status(200).end();

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
          logementNom: log ? plain(log.properties?.["Nom"]) : "", attribution: /postul/i.test(log?.properties?.["Attribution"]?.select?.name || "") ? "postuler" : "direct",
          candidats: cands };
      }));
      return res.status(200).json({ success: true, missions: out });
    }

    if (req.method === "POST") {
      const { missionId, prestataireId, missionNom, date } = req.body || {};
      if (!missionId || !prestataireId) return res.status(400).json({ error: "Paramètres manquants" });
      const up = await fetch(`https://api.notion.com/v1/pages/${missionId}`, { method: "PATCH", headers: H(T),
        body: JSON.stringify({ properties: { "État": { status: { name: "Acceptée" } }, "Prestataire": { relation: [{ id: prestataireId }] } } }) });
      if (!up.ok) return res.status(500).json({ error: "Notion : " + (await up.text()).slice(0, 300) });
      const pg = await getPage(T, prestataireId);
      await sendEmail({ to: pg.properties?.["Email"]?.email, subject: `✅ Mission confirmée — ${missionNom || ""}`,
        html: `<p>Bonjour,</p><p>Votre candidature pour <strong>${missionNom || "la mission"}</strong>${date ? " du " + date : ""} est confirmée. Retrouvez-la dans votre agenda sur l'application izinest.</p>` });
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

const MISSIONS_DB     = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const ADMIN_EMAIL     = "contact.defarge@gmail.com";
const RESEND_KEY      = process.env.RESEND_API_KEY;

const H = (t) => ({ "Authorization": `Bearer ${t}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });

async function sendEmail({ to, subject, html }) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "izinest <onboarding@resend.dev>", to, subject, html }),
  });
}

async function getPage(token, id) {
  const r = await fetch(`https://api.notion.com/v1/pages/${id}`, { headers: H(token) });
  return r.json();
}

async function getNomPrestataire(token, id) {
  try {
    const data = await getPage(token, id);
    const titre = data.properties?.["Prénom/Nom"] || data.properties?.["Nom"];
    return titre ? (titre.title || []).map(t => t.plain_text).join("") : "";
  } catch (e) { return ""; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { missionId, action, prestataireId, missionNom } = req.body || {};
  if (!missionId || !action || !prestataireId) return res.status(400).json({ error: "Paramètres manquants" });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  try {
    const nomAffiche = (await getNomPrestataire(NOTION_TOKEN, prestataireId)) || prestataireId;
    const mission = await getPage(NOTION_TOKEN, missionId);
    const props = mission.properties || {};
    let properties = {};

    if (action === "accepter") {
      // par défaut, une mission se postule ; l'acceptation directe n'existe que si le logement est en « Direct »
      const logId = (props["Logement"]?.relation || [])[0]?.id;
      const log = logId ? await getPage(NOTION_TOKEN, logId) : null;
      if (!/direct/i.test(log?.properties?.["Attribution"]?.select?.name || ""))
        return res.status(400).json({ error: "Cette mission fonctionne par candidature" });
      properties = { "État": { status: { name: "Acceptée" } }, "Prestataire": { relation: [{ id: prestataireId }] } };
      await sendEmail({ to: ADMIN_EMAIL, subject: `✅ Mission acceptée — ${missionNom}`,
        html: `<p><strong>${nomAffiche}</strong> a accepté la mission <strong>${missionNom}</strong>.</p><p>Connectez-vous à Notion pour voir les détails.</p>` });

    } else if (action === "postuler" || action === "retirer") {
      const ids = (props["Candidats"]?.relation || []).map(r => r.id);
      const next = action === "postuler" ? [...new Set([...ids, prestataireId])] : ids.filter(i => i !== prestataireId);
      properties = { "Candidats": { relation: next.map(id => ({ id })) } };
      if (action === "postuler") {
        await sendEmail({ to: ADMIN_EMAIL, subject: `🙋 Candidature — ${missionNom}`,
          html: `<p><strong>${nomAffiche}</strong> a postulé à la mission <strong>${missionNom}</strong> (${next.length} candidate${next.length > 1 ? "s" : ""}).</p><p>Validez la prestataire depuis la page admin de l'application.</p>` });
      }

    } else if (action === "refuser") {
      const refusExistants = (props["Refus"]?.multi_select || []).map(r => r.name);
      properties = { "Refus": { multi_select: [...new Set([...refusExistants, nomAffiche])].map(n => ({ name: n })) } };
      // une candidature éventuelle est retirée
      const ids = (props["Candidats"]?.relation || []).map(r => r.id);
      if (ids.includes(prestataireId)) properties["Candidats"] = { relation: ids.filter(i => i !== prestataireId).map(id => ({ id })) };
      await sendEmail({ to: ADMIN_EMAIL, subject: `❌ Mission refusée — ${missionNom}`,
        html: `<p><strong>${nomAffiche}</strong> a refusé la mission <strong>${missionNom}</strong>.</p><p>La mission reste disponible pour les autres prestataires.</p>` });
    } else {
      return res.status(400).json({ error: "Action invalide" });
    }

    const up = await fetch(`https://api.notion.com/v1/pages/${missionId}`, { method: "PATCH", headers: H(NOTION_TOKEN), body: JSON.stringify({ properties }) });
    if (!up.ok) return res.status(500).json({ error: "Notion : " + (await up.text()).slice(0, 300) });
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

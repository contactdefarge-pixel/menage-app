const MISSIONS_DB     = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const PRESTATAIRES_DB = "3d7d50ab-a52f-8012-a15d-e9d59a968f8f";
const RESEND_KEY      = process.env.RESEND_API_KEY;

function plainText(prop) {
  if (!prop) return "";
  if (prop.type === "title")     return (prop.title     || []).map(t => t.plain_text).join("");
  if (prop.type === "rich_text") return (prop.rich_text || []).map(t => t.plain_text).join("");
  return "";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default async function handler(req, res) {
  // Sécurité : vérifier le token cron
  const authHeader = req.headers["authorization"] || "";
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  try {
    // 1. Récupérer les missions disponibles
    const missionsRes = await fetch(`https://api.notion.com/v1/databases/${MISSIONS_DB}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: "État", status: { equals: "Disponible" } },
        sorts: [{ property: "Date", direction: "ascending" }],
      }),
    });
    const missionsData = await missionsRes.json();
    const missions = (missionsData.results || []).map(page => {
      const props = page.properties || {};
      return {
        id: page.id,
        nom: plainText(props["Nom"]),
        date: props["Date"]?.date?.start || "",
        refus: (props["Refus"]?.multi_select || []).map(r => r.name),
      };
    });

    if (missions.length === 0) {
      return res.status(200).json({ success: true, message: "Aucune mission disponible" });
    }

    // 2. Récupérer tous les prestataires
    const prestRes = await fetch(`https://api.notion.com/v1/databases/${PRESTATAIRES_DB}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100 }),
    });
    const prestData = await prestRes.json();
    const prestataires = (prestData.results || []).map(page => {
      const props = page.properties || {};
      return {
        id: page.id,
        nom: plainText(props["Nom"]),
        email: props["Email"]?.email || "",
      };
    }).filter(p => p.email);

    // 3. Envoyer un email à chaque prestataire avec les missions qui ne lui sont pas refusées
    let sent = 0;
    for (const presta of prestataires) {
      const missionsPourPresta = missions.filter(m => !m.refus.includes(presta.id));
      if (missionsPourPresta.length === 0) continue;

      const lignesMissions = missionsPourPresta.map(m =>
        `<tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e2ecee;font-family:sans-serif;font-size:14px;color:#085157;">${m.nom}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e2ecee;font-family:sans-serif;font-size:14px;color:#085157;">${formatDate(m.date)}</td>
        </tr>`
      ).join("");

      const html = `
        <div style="max-width:500px;margin:0 auto;font-family:sans-serif;">
          <div style="background:#085157;padding:24px;border-radius:12px 12px 0 0;">
            <p style="color:rgba(255,255,255,0.6);font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.1em;">izinest</p>
            <h1 style="color:#fff;font-size:20px;margin:0;">Nouvelles missions disponibles</h1>
          </div>
          <div style="background:#f0fafa;padding:24px;border-radius:0 0 12px 12px;border:1px solid #99e0dd;border-top:none;">
            <p style="color:#085157;font-size:15px;">Bonjour ${presta.nom},</p>
            <p style="color:#5b8f93;font-size:14px;">Les missions suivantes sont disponibles. Connectez-vous pour les accepter ou les refuser :</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #99e0dd;">
              <thead>
                <tr style="background:#00bab3;">
                  <th style="padding:10px 16px;text-align:left;color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Mission</th>
                  <th style="padding:10px 16px;text-align:left;color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Date</th>
                </tr>
              </thead>
              <tbody>${lignesMissions}</tbody>
            </table>
            <a href="https://menage-app-nine.vercel.app/prestataire"
               style="display:block;background:#085157;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-top:20px;">
              Voir mes missions →
            </a>
            <p style="color:#94b8bb;font-size:12px;text-align:center;margin-top:16px;">izinest · Conciergerie Pyrénées</p>
          </div>
        </div>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "izinest <onboarding@resend.dev>",
          to: presta.email,
          subject: `🏠 ${missionsPourPresta.length} mission${missionsPourPresta.length > 1 ? "s" : ""} disponible${missionsPourPresta.length > 1 ? "s" : ""} — izinest`,
          html,
        }),
      });
      sent++;
    }

    return res.status(200).json({ success: true, emailsSent: sent });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

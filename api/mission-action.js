const MISSIONS_DB  = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const ADMIN_EMAIL  = "contact.defarge@gmail.com";
const RESEND_KEY   = process.env.RESEND_API_KEY;

async function sendEmail({ to, subject, html }) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "izinest <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { missionId, action, prestataireId, prestataireNom, missionNom } = req.body || {};
  if (!missionId || !action || !prestataireId) {
    return res.status(400).json({ error: "Paramètres manquants" });
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  try {
    let properties = {};

    if (action === "accepter") {
      properties = {
        "État": { status: { name: "Acceptée" } },
        "Prestataire": { relation: [{ id: prestataireId }] },
      };

      // Notifier l'admin
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `✅ Mission acceptée — ${missionNom}`,
        html: `<p><strong>${prestataireNom}</strong> a accepté la mission <strong>${missionNom}</strong>.</p>
               <p>Connectez-vous à Notion pour voir les détails.</p>`,
      });

    } else if (action === "refuser") {
      // Récupérer les refus existants
      const pageRes = await fetch(`https://api.notion.com/v1/pages/${missionId}`, {
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
        }
      });
      const pageData = await pageRes.json();
      const refusExistants = (pageData.properties?.["Refus"]?.multi_select || []).map(r => r.name);
      const nouveauxRefus  = [...new Set([...refusExistants, prestataireId])].map(id => ({ name: id }));

      properties = {
        "Refus": { multi_select: nouveauxRefus },
      };

      // Notifier l'admin
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `❌ Mission refusée — ${missionNom}`,
        html: `<p><strong>${prestataireNom}</strong> a refusé la mission <strong>${missionNom}</strong>.</p>
               <p>La mission reste disponible pour les autres prestataires.</p>`,
      });
    } else {
      return res.status(400).json({ error: "Action invalide" });
    }

    // Mettre à jour Notion
    await fetch(`https://api.notion.com/v1/pages/${missionId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

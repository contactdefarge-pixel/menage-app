const MISSIONS_DB     = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const PRESTATAIRES_DB = "3d7d50ab-a52f-8012-a15d-e9d59a968f8f";
const ADMIN_EMAIL     = "contact.defarge@gmail.com";
const RESEND_KEY      = process.env.RESEND_API_KEY;

async function sendEmail({ to, subject, html }) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "izinest <onboarding@resend.dev>",
      to, subject, html,
    }),
  });
}

async function getNomPrestataire(notionToken, prestataireId) {
  try {
    const r = await fetch(`https://api.notion.com/v1/pages/${prestataireId}`, {
      headers: {
        "Authorization": `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
      }
    });
    const data = await r.json();
    const props = data.properties || {};
    // Essaie Prénom/Nom en premier, puis Nom
    const titre = props["Prénom/Nom"] || props["Nom"];
    if (!titre) return "";
    return (titre.title || []).map(t => t.plain_text).join("");
  } catch (e) {
    return "";
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { missionId, action, prestataireId, missionNom } = req.body || {};
  if (!missionId || !action || !prestataireId) {
    return res.status(400).json({ error: "Paramètres manquants" });
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  try {
    // Récupérer le vrai nom depuis Notion (source de vérité)
    const nomPrestataire = await getNomPrestataire(NOTION_TOKEN, prestataireId);
    const nomAffiche = nomPrestataire || prestataireId;

    let properties = {};

    if (action === "accepter") {
      properties = {
        "État": { status: { name: "Acceptée" } },
        "Prestataire": { relation: [{ id: prestataireId }] },
      };

      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `✅ Mission acceptée — ${missionNom}`,
        html: `<p><strong>${nomAffiche}</strong> a accepté la mission <strong>${missionNom}</strong>.</p>
               <p>Connectez-vous à Notion pour voir les détails.</p>`,
      });

    } else if (action === "refuser") {
      // Récupérer les refus existants (noms lisibles)
      const pageRes = await fetch(`https://api.notion.com/v1/pages/${missionId}`, {
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
        }
      });
      const pageData = await pageRes.json();
      const refusExistants = (pageData.properties?.["Refus"]?.multi_select || []).map(r => r.name);

      // Stocker le nom lisible plutôt que l'ID
      const nouveauxRefus = [...new Set([...refusExistants, nomAffiche])].map(n => ({ name: n }));

      properties = {
        "Refus": { multi_select: nouveauxRefus },
      };

      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `❌ Mission refusée — ${missionNom}`,
        html: `<p><strong>${nomAffiche}</strong> a refusé la mission <strong>${missionNom}</strong>.</p>
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

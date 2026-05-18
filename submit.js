export const config = {
  api: { bodyParser: { sizeLimit: "50mb" } },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_DB = process.env.NOTION_DB;

  if (!NOTION_TOKEN || !NOTION_DB) {
    return res.status(500).json({ error: "Variables d'environnement manquantes" });
  }

  try {
    const body = req.body;
    const { arrivee, etatLieux, consommables, photosArrivee, photos } = body;

    // ── Calcul durée ──────────────────────────────────────────────────────────
    function calcDuree(debut, fin) {
      if (!debut || !fin) return "";
      const [dh, dm] = debut.split(":").map(Number);
      const [fh, fm] = fin.split(":").map(Number);
      const total = (fh * 60 + fm) - (dh * 60 + dm);
      if (total <= 0) return "";
      return Math.floor(total / 60) + "h" + String(total % 60).padStart(2, "0") + "m";
    }

    // ── Formule automatique ───────────────────────────────────────────────────
    function calcFormule(obs, conso, remarques) {
      if (conso && conso.trim() && remarques && remarques.trim()) return "Consommables à prévoir + Problème";
      if (conso && conso.trim()) return "Consommables à prévoir";
      if (remarques && remarques.trim() && remarques.trim().toUpperCase() !== "RAS") return "Problème";
      return "OK";
    }

    const duree = calcDuree(arrivee.heureDebut, consommables.heureFin);
    const formule = calcFormule(etatLieux.observations, consommables.consommablesAPrevoir, consommables.remarques);

    // ── Upload photos vers Notion ─────────────────────────────────────────────
    // Les photos arrivent en base64. On les uploade via l'API Notion file upload.
    async function uploadPhoto(base64, filename) {
      try {
        // Étape 1 : créer le upload
        const createRes = await fetch("https://api.notion.com/v1/file-uploads", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + NOTION_TOKEN,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: filename }),
        });
        if (!createRes.ok) return null;
        const createData = await createRes.json();
        const uploadId = createData.id;
        const uploadUrl = createData.upload_url;

        // Étape 2 : envoyer le fichier
        const buffer = Buffer.from(base64.split(",")[1] || base64, "base64");
        const sendRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg" },
          body: buffer,
        });
        if (!sendRes.ok) return null;

        return { type: "file_upload", file_upload: { id: uploadId } };
      } catch (e) {
        console.error("Upload photo erreur:", e);
        return null;
      }
    }

    // Upload toutes les photos d'arrivée
    const photosArriveeUploaded = [];
    if (photosArrivee && photosArrivee.length > 0) {
      for (const photo of photosArrivee) {
        const result = await uploadPhoto(photo.base64, photo.name);
        if (result) photosArriveeUploaded.push(result);
      }
    }

    // Upload toutes les photos de fin de ménage
    const photosUploaded = [];
    if (photos && photos.length > 0) {
      for (const photo of photos) {
        const result = await uploadPhoto(photo.base64, photo.name);
        if (result) photosUploaded.push(result);
      }
    }

    // ── Création page Notion ──────────────────────────────────────────────────
    const properties = {
      "Adresse": {
        title: [{ text: { content: arrivee.bien || "Sans nom" } }],
      },
      "Date": {
        date: { start: arrivee.date || new Date().toISOString().split("T")[0] },
      },
      "Prénom, Nom": {
        rich_text: [{ text: { content: arrivee.nom || "" } }],
      },
      "Heure de début": {
        rich_text: [{ text: { content: arrivee.heureDebut || "" } }],
      },
      "Heure de fin": {
        rich_text: [{ text: { content: consommables.heureFin || "" } }],
      },
      "Durée": {
        rich_text: [{ text: { content: duree } }],
      },
      "Formule": {
        rich_text: [{ text: { content: formule } }],
      },
      "Observations à l'arrivée": {
        rich_text: [{ text: { content: etatLieux.observations || "" } }],
      },
      "Consommables à prévoir": {
        rich_text: [{ text: { content: consommables.consommablesAPrevoir || "" } }],
      },
      "Remarques sur le logement": {
        rich_text: [{ text: { content: consommables.remarques || "" } }],
      },
      "Note": {
        number: etatLieux.note || 0,
      },

    };

    // Ajouter les photos si uploadées
    if (photosArriveeUploaded.length > 0) {
      properties["Photos à l'arrivée"] = { files: photosArriveeUploaded };
    }

    if (photosUploaded.length > 0) {
      properties["Photos de fin de ménage"] = { files: photosUploaded };
    }

    const notionRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DB },
        properties,
      }),
    });

    if (!notionRes.ok) {
      const err = await notionRes.json();
      console.error("Notion error:", err);
      return res.status(500).json({ error: "Erreur Notion", details: err });
    }

    const page = await notionRes.json();
    return res.status(200).json({ success: true, pageId: page.id });

  } catch (e) {
    console.error("Erreur générale:", e);
    return res.status(500).json({ error: e.message });
  }
}

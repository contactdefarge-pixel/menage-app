import { IncomingForm } from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) return res.status(500).json({ error: "NOTION_TOKEN manquant" });

  try {
    // Parser le multipart
    const form = new IncomingForm({ maxFileSize: 20 * 1024 * 1024 });
    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: "Aucun fichier reçu" });

    const filename = file.originalFilename || "photo.jpg";

    // Étape 1 : créer l'objet file_upload sur Notion
    const createRes = await fetch("https://api.notion.com/v1/file_uploads", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename, content_type: "image/jpeg" }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      console.error("Création upload erreur:", err);
      return res.status(500).json({ error: "Erreur création upload Notion", details: err });
    }

    const { id: uploadId, upload_url: uploadUrl } = await createRes.json();

    // Étape 2 : lire le fichier et l'envoyer à Notion en multipart
    const fileBuffer = fs.readFileSync(file.filepath);
    const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
    const header = Buffer.from(
      "--" + boundary + "\r\n" +
      "Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n" +
      "Content-Type: image/jpeg\r\n\r\n"
    );
    const footer = Buffer.from("\r\n--" + boundary + "--\r\n");
    const body = Buffer.concat([header, fileBuffer, footer]);

    const sendRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + NOTION_TOKEN,
        "Notion-Version": "2022-06-28",
        "Content-Type": "multipart/form-data; boundary=" + boundary,
      },
      body,
    });

    if (!sendRes.ok) {
      const err = await sendRes.json();
      console.error("Envoi upload erreur:", err);
      return res.status(500).json({ error: "Erreur envoi fichier Notion", details: err });
    }

    // Nettoyer le fichier temporaire
    fs.unlinkSync(file.filepath);

    return res.status(200).json({ success: true, uploadId });

  } catch (e) {
    console.error("Erreur upload-photo:", e);
    return res.status(500).json({ error: e.message });
  }
}

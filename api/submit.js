import { sendEmail, APP_URL } from "../lib/mail.js";
import { ADMIN_EMAIL } from "../lib/urgent.js";
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
    const { arrivee, etatLieux, consommables, photosArrivee, photos, photosAttendues } = body;

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

    // Les photos sont déjà uploadées directement vers Notion depuis le navigateur
    // On reçoit juste les uploadIds
    const photosArriveeUploaded = [];
    if (photosArrivee && photosArrivee.length > 0) {
      for (const photo of photosArrivee) {
        if (photo.uploadId) {
          photosArriveeUploaded.push({ type: "file_upload", file_upload: { id: photo.uploadId } });
        }
      }
    }

    const photosUploaded = [];
    if (photos && photos.length > 0) {
      for (const photo of photos) {
        if (photo.uploadId) {
          photosUploaded.push({ type: "file_upload", file_upload: { id: photo.uploadId } });
        }
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

    // ── Alerte admin : problème signalé ou photos manquantes ──────────────────
    try { await alerteRapport({ page, arrivee, etatLieux, consommables, photos, photosArrivee, photosAttendues }); }
    catch (e) { console.error("alerte rapport:", e.message); }

    return res.status(200).json({ success: true, pageId: page.id });

  } catch (e) {
    console.error("Erreur générale:", e);
    return res.status(500).json({ error: e.message });
  }
}

/* Rien à signaler ? (RAS, R.A.S., rien, aucun, néant, ok…) */
function signale(texte) {
  const t = String(texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return false;
  return !/^(r a s|ras|rien|rien a signaler|aucun|aucune|aucun probleme|neant|non|ok|nickel|tout est ok|r a s merci|ras merci)$/.test(t);
}
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function alerteRapport({ page, arrivee, etatLieux, consommables, photos, photosArrivee, photosAttendues }) {
  const points = [];
  if (signale(consommables?.remarques)) points.push(["Problème signalé sur le logement", consommables.remarques]);
  if (signale(etatLieux?.observations)) points.push(["Observations à l'arrivée", etatLieux.observations]);
  const nbPhotos = (photos || []).length, attendu = Number(photosAttendues) || 0;
  if (attendu > 0 && nbPhotos < attendu) points.push(["Photos de fin de ménage incomplètes", `${nbPhotos} photo${nbPhotos > 1 ? "s" : ""} sur ${attendu} attendue${attendu > 1 ? "s" : ""}`]);
  if (!points.length) return;
  const bien = arrivee?.bien || "Logement";
  const date = arrivee?.date ? new Date(arrivee.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "";
  const lignes = points.map(([t, v]) => `<div style="margin:0 0 12px;padding:12px 14px;background:#fff;border:1px solid #fcd34d;border-radius:10px">
      <div style="font-size:12px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${esc(t)}</div>
      <div style="font-size:14px;color:#0f2e31;white-space:pre-line">${esc(v)}</div></div>`).join("");
  const html = `
  <div style="max-width:520px;margin:0 auto;font-family:sans-serif;">
    <div style="background:#92400e;padding:22px 24px;border-radius:12px 12px 0 0;">
      <p style="color:rgba(255,255,255,.75);font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.1em;">izinest · rapport de ménage</p>
      <h1 style="color:#fff;font-size:19px;margin:0;">${esc(bien)}</h1>
    </div>
    <div style="background:#fffbeb;padding:20px 24px;border-radius:0 0 12px 12px;border:1px solid #fcd34d;border-top:none;">
      <p style="margin:0 0 14px;color:#78350f;font-size:14px">${esc(date)}${arrivee?.nom ? " · " + esc(arrivee.nom) : ""}${(photosArrivee || []).length ? ` · ${(photosArrivee || []).length} photo(s) à l'arrivée` : ""}</p>
      ${lignes}
      <a href="${page.url}" style="display:block;background:#92400e;color:#fff;text-align:center;padding:13px;border-radius:10px;text-decoration:none;font-weight:700;">Voir le rapport dans Notion →</a>
    </div>
  </div>`;
  const motifs = points.map(p => p[0].startsWith("Photos") ? "photos manquantes" : "problème signalé");
  await sendEmail({ to: ADMIN_EMAIL, subject: `⚠️ Rapport ${bien} — ${[...new Set(motifs)].join(" + ")}`, html });
}

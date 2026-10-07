/* E-mail quotidien : prévient chaque prestataire des missions qui viennent de s'ouvrir À SON NIVEAU.
   - une mission « niveau 1 » n'est pas annoncée à un niveau 3 tant qu'elle ne lui est pas ouverte
     (avant-première : voir lib/attribution.js) ;
   - elle lui est annoncée le jour où elle s'ouvre à lui (mission non pourvue qui « descend » au niveau suivant) ;
   - une mission n'est annoncée qu'une fois par prestataire (fenêtre = les 24 dernières heures).
   Appel manuel : /api/cron-notify?secret=<CRON_SECRET>&dry=1  (dry = aperçu sans envoi, window=<heures> pour élargir). */
import { sendEmail, APP_URL, dateCourte } from "../lib/mail.js";
import { niveauNum, visibleDepuis, estUrgente } from "../lib/attribution.js";
import { emailUrgence } from "../lib/urgent.js";

const MISSIONS_DB     = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const PRESTATAIRES_DB = "3d7d50ab-a52f-8012-a15d-e9d59a968f8f";
const H = (t) => ({ "Authorization": `Bearer ${t}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function plainText(prop) {
  if (!prop) return "";
  if (prop.type === "title")     return (prop.title     || []).map(t => t.plain_text).join("");
  if (prop.type === "rich_text") return (prop.rich_text || []).map(t => t.plain_text).join("");
  return "";
}

async function queryAll(token, db, body) {
  let results = [], cursor;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`https://api.notion.com/v1/databases/${db}/query`, {
      method: "POST", headers: H(token),
      body: JSON.stringify({ page_size: 100, ...body, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    const data = await r.json();
    results = results.concat(data.results || []);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return results;
}

async function getLogement(token, id) {
  try {
    const p = await (await fetch(`https://api.notion.com/v1/pages/${id}`, { headers: H(token) })).json();
    const pr = p.properties || {};
    return {
      nom: plainText(pr["Nom"]),
      niveauRequis: niveauNum(pr["Niveau requis"]?.select?.name, 3),
      forfait: pr["Forfait ménage"]?.number != null ? pr["Forfait ménage"].number + " €" : "",
    };
  } catch (e) { return { nom: "", niveauRequis: 3, forfait: "" }; }
}

function emailMissions(presta, missions) {
  const n = missions.length;
  const lignes = missions.map(m => `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid #e2ecee;font-family:sans-serif;font-size:14px;color:#085157;">
        <strong>${esc(m.titre)}</strong><br>
        <span style="color:#5b8f93;font-size:13px;">${esc(dateCourte(m.date))}${m.forfait ? " · " + esc(m.forfait) : ""}</span>
      </td>
    </tr>`).join("");
  return `
  <div style="max-width:500px;margin:0 auto;font-family:sans-serif;">
    <div style="background:#085157;padding:24px;border-radius:12px 12px 0 0;">
      <p style="color:rgba(255,255,255,0.6);font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.1em;">izinest</p>
      <h1 style="color:#fff;font-size:20px;margin:0;">${n > 1 ? n + " nouvelles missions" : "Nouvelle mission"} pour vous</h1>
    </div>
    <div style="background:#f0fafa;padding:24px;border-radius:0 0 12px 12px;border:1px solid #99e0dd;border-top:none;">
      <p style="color:#085157;font-size:15px;">Bonjour ${esc(presta.nom)},</p>
      <p style="color:#5b8f93;font-size:14px;">${n > 1 ? "Ces missions viennent" : "Cette mission vient"} d'être ouverte${n > 1 ? "s" : ""} aux candidatures. Connectez-vous pour postuler :</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #99e0dd;"><tbody>${lignes}</tbody></table>
      <a href="${APP_URL}/prestataire" style="display:block;background:#085157;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-top:20px;">Voir les missions →</a>
      <p style="color:#94b8bb;font-size:12px;text-align:center;margin-top:16px;">izinest · Conciergerie Pyrénées</p>
    </div>
  </div>`;
}

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const okSecret = process.env.CRON_SECRET && (auth === `Bearer ${process.env.CRON_SECRET}` || req.query.secret === process.env.CRON_SECRET);
  if (!okSecret) return res.status(401).json({ error: "Unauthorized" });

  const token = process.env.NOTION_TOKEN;
  const dry = !!req.query.dry;
  const fenetreH = Math.max(1, Number(req.query.window) || 24);
  const now = new Date();
  const debut = now.getTime() - fenetreH * 3600000;

  try {
    // 1. missions à pourvoir
    const pages = await queryAll(token, MISSIONS_DB, {
      filter: { property: "État", status: { equals: "Disponible" } },
      sorts: [{ property: "Date", direction: "ascending" }],
    });
    const missions = pages.map(p => {
      const pr = p.properties || {};
      return {
        id: p.id,
        titre: plainText(pr["Nom"]),
        date: pr["Date"]?.date?.start || "",
        prestataire: (pr["Prestataire"]?.relation || [])[0]?.id || null,
        logement: (pr["Logement"]?.relation || [])[0]?.id || null,
        refus: (pr["Refus"]?.multi_select || []).map(r => r.name),
        cree: p.created_time,
      };
    }).filter(m => !m.prestataire);

    if (missions.length === 0) return res.status(200).json({ success: true, message: "Aucune mission disponible" });

    const logements = {};
    await Promise.all([...new Set(missions.map(m => m.logement).filter(Boolean))].map(async id => { logements[id] = await getLogement(token, id); }));

    // 2. prestataires
    const prestPages = await queryAll(token, PRESTATAIRES_DB, {});
    const prestataires = prestPages.map(p => {
      const pr = p.properties || {};
      return { id: p.id, nom: plainText(pr["Nom"]), email: pr["Email"]?.email || "",
               niveau: pr["Niveau"]?.select?.name ? niveauNum(pr["Niveau"].select.name, null) : null };
    }).filter(p => p.email);

    // 3. pour chacun : missions qui se sont ouvertes à son niveau depuis la dernière fenêtre
    const envoyes = [], ignores = [];
    for (const presta of prestataires) {
      const aAnnoncer = [];
      const relances = [];
      for (const m of missions) {
        if (m.refus.includes(presta.id) || m.refus.includes(presta.nom)) continue;
        const lg = m.logement ? logements[m.logement] : { nom: "", niveauRequis: 3, forfait: "" };
        if (estUrgente(m.date, now)) {
          // dernière minute : déjà annoncée par e-mail immédiat à sa création ; sinon relance quotidienne tant qu'elle n'est pas pourvue
          if (new Date(m.cree).getTime() < debut) relances.push({ ...m, forfait: lg.forfait });
          continue;
        }
        const v = visibleDepuis(m, presta.niveau, lg.niveauRequis, now);
        if (v === null || v > now.getTime()) continue;     // pas (encore) ouverte à ce niveau
        if (v < debut) continue;                            // déjà annoncée lors d'un envoi précédent
        aAnnoncer.push({ ...m, forfait: lg.forfait });
      }
      if (relances.length) {
        if (dry) envoyes.push({ prestataire: presta.nom, urgentes: relances.map(m => m.titre) });
        else { const { subject, html } = emailUrgence(presta, relances, now); const r = await sendEmail({ to: presta.email, subject: "🔁 " + subject, html }); envoyes.push({ prestataire: presta.nom, urgentes: relances.length, ok: r.ok }); }
      }
      if (aAnnoncer.length === 0) { if (!relances.length) ignores.push(presta.nom); continue; }
      if (dry) { envoyes.push({ prestataire: presta.nom, niveau: presta.niveau, missions: aAnnoncer.map(m => m.titre) }); continue; }
      const r = await sendEmail({
        to: presta.email,
        subject: `🏠 ${aAnnoncer.length} nouvelle${aAnnoncer.length > 1 ? "s" : ""} mission${aAnnoncer.length > 1 ? "s" : ""} — izinest`,
        html: emailMissions(presta, aAnnoncer),
      });
      envoyes.push({ prestataire: presta.nom, niveau: presta.niveau, missions: aAnnoncer.length, ok: r.ok, ...(r.ok ? {} : { erreur: r.error }) });
    }

    return res.status(200).json({ success: true, dry, fenetreHeures: fenetreH, emailsSent: envoyes.filter(e => dry || e.ok).length, envoyes, sansNouveaute: ignores });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

/* Réservations de dernière minute : e-mail immédiat à toutes les prestataires (tous niveaux). */
import { sendEmail, APP_URL, dateLongue } from "./mail.js";
import { joursRestants } from "./attribution.js";

const PRESTATAIRES_DB = "3d7d50ab-a52f-8012-a15d-e9d59a968f8f";
const H = (t) => ({ "Authorization": `Bearer ${t}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plain = (prop) => (prop?.title || prop?.rich_text || []).map(t => t.plain_text).join("");

export async function getLogementInfoUrgent(token, logementId) {
  if (!logementId) return { nom: "", forfait: "" };
  try {
    const p = await (await fetch(`https://api.notion.com/v1/pages/${logementId}`, { headers: H(token) })).json();
    const pr = p.properties || {};
    return { nom: plain(pr["Nom"]), forfait: pr["Forfait ménage"]?.number != null ? pr["Forfait ménage"].number + " €" : "" };
  } catch (e) { return { nom: "", forfait: "" }; }
}

export async function listPrestatairesAvecEmail(token) {
  let results = [], cursor;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://api.notion.com/v1/databases/${PRESTATAIRES_DB}/query`, {
      method: "POST", headers: H(token), body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }) });
    const d = await r.json();
    results = results.concat(d.results || []);
    if (!d.has_more) break;
    cursor = d.next_cursor;
  }
  return results.map(p => ({ id: p.id, nom: plain(p.properties?.["Prénom/Nom"] || p.properties?.["Nom"]), email: p.properties?.["Email"]?.email || "" })).filter(p => p.email).filter(testOnly);
}

export async function diagPrestataires(token) {
  const r = await fetch(`https://api.notion.com/v1/databases/${PRESTATAIRES_DB}/query`, { method: "POST", headers: H(token), body: JSON.stringify({ page_size: 100 }) });
  const d = await r.json();
  const all = (d.results || []).map(p => ({ nom: plain(p.properties?.["Prénom/Nom"] || p.properties?.["Nom"]), email: p.properties?.["Email"]?.email || "", props: Object.keys(p.properties || {}) }));
  return { total: all.length, avecEmail: all.filter(p => p.email).length, apresFiltre: all.filter(p => p.email).filter(testOnly).length,
           filtre: process.env.MAIL_TEST_ONLY ?? "Simon Defarge", nomsVides: all.filter(p => !p.nom).length, colonnes: all[0]?.props || [], erreurNotion: d.message };
}

/* MODE TEST : tant que MAIL_TEST_ONLY est défini (par défaut « Simon Defarge »), les e-mails automatiques
   ne partent qu'à cette prestataire. Mettre MAIL_TEST_ONLY=* (ou « tous ») sur Vercel pour ouvrir à tout le monde. */
export function testOnly(p) {
  const t = (process.env.MAIL_TEST_ONLY ?? "Simon Defarge").trim().toLowerCase();
  if (!t || t === "*" || t === "tous") return true;
  return String(p.nom || "").toLowerCase().includes(t);
}

function quand(date, now) {
  const j = joursRestants(date, now);
  return j <= 0 ? "aujourd'hui" : j === 1 ? "demain" : `dans ${j} jours`;
}

export function emailUrgence(presta, missions, now = new Date()) {
  const n = missions.length;
  const lignes = missions.map(m => `
    <tr><td style="padding:12px 14px;border-bottom:1px solid #fde68a;font-family:sans-serif;font-size:14px;color:#78350f;">
      <strong>${esc(m.titre)}</strong><br>
      <span style="font-size:13px;">${esc(dateLongue(m.date))} — <strong>${quand(m.date, now)}</strong>${m.forfait ? " · " + esc(m.forfait) : ""}</span>
    </td></tr>`).join("");
  return {
    subject: n > 1 ? `🚨 ${n} missions urgentes — izinest` : `🚨 Mission urgente — ${missions[0].titre} · ${quand(missions[0].date, now)}`,
    html: `
  <div style="max-width:500px;margin:0 auto;font-family:sans-serif;">
    <div style="background:#92400e;padding:24px;border-radius:12px 12px 0 0;">
      <p style="color:rgba(255,255,255,0.7);font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.1em;">izinest · dernière minute</p>
      <h1 style="color:#fff;font-size:20px;margin:0;">${n > 1 ? "Missions urgentes" : "Mission urgente"}</h1>
    </div>
    <div style="background:#fffbeb;padding:24px;border-radius:0 0 12px 12px;border:1px solid #fcd34d;border-top:none;">
      <p style="color:#78350f;font-size:15px;">Bonjour ${esc(presta.nom)},</p>
      <p style="color:#92400e;font-size:14px;">Une réservation de dernière minute a besoin d'une prestataire. Les premières à postuler sont prioritaires :</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #fcd34d;"><tbody>${lignes}</tbody></table>
      <a href="${APP_URL}/prestataire" style="display:block;background:#92400e;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-top:20px;">Postuler maintenant →</a>
      <p style="color:#b45309;font-size:12px;text-align:center;margin-top:16px;">izinest · Conciergerie Pyrénées</p>
    </div>
  </div>` };
}

/* missions : [{ titre, date, forfait }] — envoie un seul e-mail par prestataire */
export async function notifierUrgence(token, missions) {
  if (!missions.length) return { envoyes: 0 };
  const prestataires = await listPrestatairesAvecEmail(token);
  let envoyes = 0; const erreurs = [];
  for (const p of prestataires) {
    const { subject, html } = emailUrgence(p, missions);
    const r = await sendEmail({ to: p.email, subject, html });
    if (r.ok) envoyes++; else erreurs.push(`${p.nom}: ${r.error}`);
  }
  return { envoyes, erreurs };
}

/* ── Traitement des urgences ─────────────────────────────────────────────
   Toute mission « Disponible », sans prestataire, prévue dans 0 à 3 jours et pas encore signalée
   (case Notion « Urgence notifiée » décochée) déclenche l'e-mail urgent, puis la case est cochée.
   Fonctionne quelle que soit l'origine de la mission (synchro Beds24 ou création manuelle dans Notion). */
const MISSIONS_DB = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
export const PROP_URGENCE = "Urgence notifiée";

export async function assurerColonneUrgence(token) {
  try {
    await fetch(`https://api.notion.com/v1/databases/${MISSIONS_DB}`, {
      method: "PATCH", headers: H(token), body: JSON.stringify({ properties: { [PROP_URGENCE]: { checkbox: {} } } }) });
  } catch (e) {}
}

export async function traiterUrgences(token, { dry = false } = {}) {
  const now = new Date();
  const auj = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const fin = new Date(Date.parse(auj + "T12:00:00Z") + 3 * 86400000).toISOString().slice(0, 10);
  await assurerColonneUrgence(token);
  const r = await fetch(`https://api.notion.com/v1/databases/${MISSIONS_DB}/query`, {
    method: "POST", headers: H(token),
    body: JSON.stringify({ page_size: 100, filter: { and: [
      { property: "État", status: { equals: "Disponible" } },
      { property: "Date", date: { on_or_after: auj } },
      { property: "Date", date: { on_or_before: fin } },
      { property: PROP_URGENCE, checkbox: { equals: false } },
    ] } }),
  });
  const data = await r.json();
  if (!r.ok) return { erreur: data.message || "requête Notion impossible", missions: [] };
  const pages = (data.results || []).filter(p => !(p.properties?.["Prestataire"]?.relation || []).length);
  const missions = [];
  for (const p of pages) {
    const pr = p.properties || {};
    const logementId = (pr["Logement"]?.relation || [])[0]?.id;
    const lg = await getLogementInfoUrgent(token, logementId);
    missions.push({ id: p.id, titre: plain(pr["Nom"]) || lg.nom || "Mission", date: pr["Date"]?.date?.start || "", forfait: lg.forfait });
  }
  if (!missions.length || dry) return { missions: missions.map(m => m.titre), dry };
  const res = await notifierUrgence(token, missions);
  if (res.envoyes > 0) {
    await Promise.all(missions.map(m => fetch(`https://api.notion.com/v1/pages/${m.id}`, {
      method: "PATCH", headers: H(token), body: JSON.stringify({ properties: { [PROP_URGENCE]: { checkbox: true } } }) })));
  }
  return { missions: missions.map(m => m.titre), ids: missions.map(m => m.id), ...res };
}

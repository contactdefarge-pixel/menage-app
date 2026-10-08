/* Réservations de dernière minute : e-mail immédiat à toutes les prestataires (tous niveaux). */
import { sendEmail, APP_URL, dateLongue } from "./mail.js";
import { joursRestants, lireDispo, estDisponible } from "./attribution.js";

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
  return results.map(p => ({ id: p.id, nom: plain(p.properties?.["Prénom/Nom"] || p.properties?.["Nom"]), email: p.properties?.["Email"]?.email || "", mail: mailAutorise(p), dispo: lireDispo(p.properties) })).filter(p => p.email && p.mail);
}

export async function diagPrestataires(token) {
  const r = await fetch(`https://api.notion.com/v1/databases/${PRESTATAIRES_DB}/query`, { method: "POST", headers: H(token), body: JSON.stringify({ page_size: 100 }) });
  const d = await r.json();
  const all = (d.results || []).map(p => ({ nom: plain(p.properties?.["Prénom/Nom"] || p.properties?.["Nom"]), email: p.properties?.["Email"]?.email || "", mail: mailAutorise(p), props: Object.keys(p.properties || {}) }));
  const dispo = (d.results || []).map(p => p.properties?.["Disponibilités"]).filter(Boolean);
  const valeur = (v) => v.multi_select ? v.multi_select.map(o => o.name) : v.select ? v.select?.name : v.rich_text ? v.rich_text.map(t => t.plain_text).join("") : v.date ? v.date : v.checkbox ?? v.status?.name ?? null;
  return { dispoType: dispo[0]?.type, dispoValeurs: dispo.map(valeur), total: all.length, avecEmail: all.filter(p => p.email).length, caseMailCochee: all.filter(p => p.email && p.mail).length, nomsVides: all.filter(p => !p.nom).length, colonnes: all[0]?.props || [], erreurNotion: d.message };
}

/* Case Notion « Mail » (base Prestataires) : cochée = on peut lui envoyer des e-mails, sinon rien ne part. */
export function mailAutorise(page) { return page?.properties?.["Mail"]?.checkbox === true; }

function quand(date, now) {
  const j = joursRestants(date, now);
  return j <= 0 ? "aujourd'hui" : j === 1 ? "demain" : `dans ${j} jours`;
}

export function emailUrgence(presta, missions, now = new Date()) {
  const n = missions.length;
  const lignes = missions.map(m => `
    <tr><td style="padding:12px 14px;border-bottom:1px solid #fde68a;font-family:sans-serif;font-size:14px;color:#78350f;">
      <strong>${esc(m.titre)}</strong><br>
      <span style="font-size:13px;">${esc(dateLongue(m.date))} — <strong>${quand(m.date, now)}</strong>${m.forfait ? " · " + esc(m.forfait) : ""}${m.prime ? ` · <strong style="color:#b45309">+ ${esc(m.prime)} € de prime</strong>` : ""}</span>
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
      <a href="${APP_URL}/" style="display:block;background:#92400e;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-top:20px;">Postuler maintenant →</a>
      <p style="color:#b45309;font-size:12px;text-align:center;margin-top:16px;">izinest · Conciergerie Pyrénées</p>
    </div>
  </div>` };
}

/* missions : [{ titre, date, forfait }] — envoie un seul e-mail par prestataire */
/* une mission urgente = un e-mail par prestataire autorisée ; renvoie le nombre d'envois réussis par mission */
export async function notifierUrgence(token, missions) {
  if (!missions.length) return { envoyes: 0, parMission: {} };
  const prestataires = await listPrestatairesAvecEmail(token);
  let envoyes = 0; const erreurs = []; const parMission = {};
  for (const m of missions) {
    parMission[m.id || m.titre] = 0;
    for (const p of prestataires) {
      if (!estDisponible(p.dispo, m.date)) continue;   // jour indisponible ou congés
      const { subject, html } = emailUrgence(p, [m]);
      const r = await sendEmail({ to: p.email, subject, html });
      if (r.ok) { envoyes++; parMission[m.id || m.titre]++; } else erreurs.push(`${p.nom}: ${r.error}`);
    }
  }
  return { envoyes, erreurs, parMission, destinataires: prestataires.length };
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
      method: "PATCH", headers: H(token), body: JSON.stringify({ properties: {
        [PROP_URGENCE]: { checkbox: {} }, "Urgence envoyée le": { date: {} }, "Alerte admin": { checkbox: {} }, "Prime": { number: { format: "euro" } },
      } }) });
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
    missions.push({ id: p.id, titre: plain(pr["Nom"]) || lg.nom || "Mission", date: pr["Date"]?.date?.start || "", forfait: lg.forfait, prime: pr["Prime"]?.number || 0 });
  }
  if (!missions.length || dry) return { missions: missions.map(m => m.titre), dry };
  const res = await notifierUrgence(token, missions);
  // case cochée seulement pour les missions effectivement annoncées (si personne n'a la case « Mail », on réessaiera plus tard)
  await Promise.all(missions.filter(m => (res.parMission[m.id] || 0) > 0).map(m => fetch(`https://api.notion.com/v1/pages/${m.id}`, {
    method: "PATCH", headers: H(token), body: JSON.stringify({ properties: { [PROP_URGENCE]: { checkbox: true }, "Urgence envoyée le": { date: { start: new Date().toISOString() } } } }) })));
  return { missions: missions.map(m => m.titre), ids: missions.map(m => m.id), ...res };
}

/* ── Mission non pourvue : alerte à l'admin ──────────────────────────────
   Mission disponible, sans prestataire ni candidat, et soit à J-2 ou moins, soit 4 h après l'alerte urgente.
   Une seule alerte par mission (case « Alerte admin »). */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "contact.defarge@gmail.com";
const DELAI_APRES_URGENCE_H = 4;

async function prestatairesPourDate(token, date) {
  let results = [], cursor;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://api.notion.com/v1/databases/${PRESTATAIRES_DB}/query`, {
      method: "POST", headers: H(token), body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }) });
    const d = await r.json(); results = results.concat(d.results || []);
    if (!d.has_more) break; cursor = d.next_cursor;
  }
  return results.map(p => ({
    id: p.id, nom: plain(p.properties?.["Prénom/Nom"] || p.properties?.["Nom"]),
    tel: plain(p.properties?.["Téléphone"]) || p.properties?.["Téléphone"]?.phone_number || "",
    email: p.properties?.["Email"]?.email || "", mail: mailAutorise(p), dispo: lireDispo(p.properties),
  })).filter(p => p.nom && estDisponible(p.dispo, date));
}

export async function traiterNonPourvues(token, { dry = false } = {}) {
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
      { property: "Alerte admin", checkbox: { equals: false } },
    ] } }),
  });
  const data = await r.json();
  if (!r.ok) return { erreur: data.message || "requête Notion impossible", alertes: [] };
  const alertes = [];
  for (const p of data.results || []) {
    const pr = p.properties || {};
    if ((pr["Prestataire"]?.relation || []).length || (pr["Candidats"]?.relation || []).length) continue;
    const date = (pr["Date"]?.date?.start || "").slice(0, 10);
    const j = joursRestants(date, now);
    const envoi = pr["Urgence envoyée le"]?.date?.start;
    const apresUrgence = envoi && (now - new Date(envoi)) >= DELAI_APRES_URGENCE_H * 3600000;
    if (!(j <= 2 || apresUrgence)) continue;
    const logementId = (pr["Logement"]?.relation || [])[0]?.id;
    const lg = await getLogementInfoUrgent(token, logementId);
    alertes.push({ id: p.id, titre: plain(pr["Nom"]) || lg.nom || "Mission", date, forfait: lg.forfait, prime: pr["Prime"]?.number || 0, url: p.url, raison: j <= 2 ? `J-${Math.max(j, 0)}` : `${DELAI_APRES_URGENCE_H} h après l'alerte urgente` });
  }
  if (!alertes.length || dry) return { alertes: alertes.map(a => a.titre), dry };
  for (const a of alertes) {
    const dispo = await prestatairesPourDate(token, a.date);
    const lignes = dispo.map(p => `<li style="margin:4px 0">${esc(p.nom)}${p.tel ? ` — <a href="tel:${esc(p.tel.replace(/\s/g, ""))}" style="color:#085157;font-weight:700">${esc(p.tel)}</a>` : ""}${p.mail ? "" : " <span style=\"color:#94a3b8\">(e-mails coupés)</span>"}</li>`).join("");
    const html = `
  <div style="max-width:520px;margin:0 auto;font-family:sans-serif;">
    <div style="background:#085157;padding:22px 24px;border-radius:12px 12px 0 0;">
      <p style="color:#99e0dd;font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.1em;">izinest · alerte</p>
      <h1 style="color:#fff;font-size:19px;margin:0;">Mission sans candidat</h1>
    </div>
    <div style="background:#f0fafa;padding:22px 24px;border-radius:0 0 12px 12px;border:1px solid #99e0dd;border-top:none;color:#085157;font-size:14px;">
      <p style="margin:0 0 6px"><strong>${esc(a.titre)}</strong></p>
      <p style="margin:0 0 14px;color:#5b8f93">${esc(dateLongue(a.date))} — ${quand(a.date, now)} · ${esc(a.raison)}${a.forfait ? " · " + esc(a.forfait) : ""}${a.prime ? " + " + a.prime + " € de prime" : ""}</p>
      <p style="margin:0 0 6px"><strong>Prestataires disponibles ce jour-là :</strong></p>
      <ul style="margin:0 0 16px;padding-left:18px">${lignes || "<li>Aucune (jours indisponibles ou congés)</li>"}</ul>
      <a href="${APP_URL}/admin" style="display:block;background:#085157;color:#fff;text-align:center;padding:13px;border-radius:10px;text-decoration:none;font-weight:700;">Relancer depuis l'admin →</a>
    </div>
  </div>`;
    const res = await sendEmail({ to: ADMIN_EMAIL, subject: `⚠️ Sans candidat — ${a.titre} · ${quand(a.date, now)}`, html });
    a.ok = res.ok;
    if (res.ok) await fetch(`https://api.notion.com/v1/pages/${a.id}`, { method: "PATCH", headers: H(token), body: JSON.stringify({ properties: { "Alerte admin": { checkbox: true } } }) });
  }
  return { alertes: alertes.map(a => a.titre + (a.ok ? "" : " (échec envoi)")) };
}

/* Relance manuelle depuis l'admin : renvoie l'e-mail de la mission (avec la prime) aux prestataires disponibles */
export async function relancerMission(token, missionId) {
  const p = await (await fetch(`https://api.notion.com/v1/pages/${missionId}`, { headers: H(token) })).json();
  const pr = p.properties || {};
  const logementId = (pr["Logement"]?.relation || [])[0]?.id;
  const lg = await getLogementInfoUrgent(token, logementId);
  const m = { id: p.id, titre: plain(pr["Nom"]) || lg.nom || "Mission", date: (pr["Date"]?.date?.start || "").slice(0, 10), forfait: lg.forfait, prime: pr["Prime"]?.number || 0 };
  const refus = (pr["Refus"]?.multi_select || []).map(o => o.name);
  const prestas = (await listPrestatairesAvecEmail(token)).filter(x => !refus.includes(x.id) && !refus.includes(x.nom));
  let envoyes = 0;
  for (const x of prestas) {
    if (!estDisponible(x.dispo, m.date)) continue;
    const { subject, html } = emailUrgence(x, [m]);
    const r = await sendEmail({ to: x.email, subject: "🔁 " + subject.replace("Mission urgente", "Toujours disponible"), html });
    if (r.ok) envoyes++;
  }
  return { ok: true, envoyes };
}

/* Remarques par mission (colonne Notion « Remarques » de la base Missions) :
   départ tardif, arrivée anticipée, tâche spécifique…
   - affichées dans le compte rendu, sur les cartes mission et dans les e-mails ;
   - si la remarque est ajoutée ou modifiée alors qu'une prestataire est déjà positionnée,
     elle reçoit un e-mail (colonne technique « Remarque envoyée » = dernier texte envoyé). */
import { sendEmail, getMissionDetails, getPrestataire, emailRemarque } from "./mail.js";

const MISSIONS_DB = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const H = (t) => ({ "Authorization": `Bearer ${t}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });
export const PROP_REMARQUE = "Remarques";
export const PROP_REMARQUE_ENVOYEE = "Remarque envoyée";

const texte = (prop) => (prop?.rich_text || prop?.title || []).map(t => t.plain_text).join("").trim();
export const lireRemarque = (props) => texte((props || {})[PROP_REMARQUE]);
const rt = (s) => [{ type: "text", text: { content: String(s || "").slice(0, 1990) } }];

let colonnesOk = false;
export async function assurerColonnesRemarque(token) {
  if (colonnesOk) return;
  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${MISSIONS_DB}`, {
      method: "PATCH", headers: H(token),
      body: JSON.stringify({ properties: { [PROP_REMARQUE]: { rich_text: {} }, [PROP_REMARQUE_ENVOYEE]: { rich_text: {} } } }),
    });
    if (r.ok) colonnesOk = true;
  } catch (e) {}
}

export async function marquerRemarqueEnvoyee(token, missionId, remarque) {
  try {
    await fetch(`https://api.notion.com/v1/pages/${missionId}`, {
      method: "PATCH", headers: H(token),
      body: JSON.stringify({ properties: { [PROP_REMARQUE_ENVOYEE]: { rich_text: remarque ? rt(remarque) : [] } } }),
    });
  } catch (e) {}
}

const jourParis = (decalage = 0) => {
  const auj = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  return new Date(Date.parse(auj + "T12:00:00Z") + decalage * 86400000).toISOString().slice(0, 10);
};

/* Consigne de la mission de ce logement prévue aujourd'hui (sinon hier ou demain, la plus proche) */
export async function consigneDuJour(token, logementId) {
  if (!logementId) return null;
  const r = await fetch(`https://api.notion.com/v1/databases/${MISSIONS_DB}/query`, {
    method: "POST", headers: H(token),
    body: JSON.stringify({ page_size: 10, filter: { and: [
      { property: "Logement", relation: { contains: logementId } },
      { property: "Date", date: { on_or_after: jourParis(-1) } },
      { property: "Date", date: { on_or_before: jourParis(1) } },
    ] } }),
  });
  if (!r.ok) return null;
  const auj = Date.parse(jourParis(0) + "T12:00:00Z");
  const ecart = (p) => Math.abs(Date.parse((p.properties?.Date?.date?.start || "").slice(0, 10) + "T12:00:00Z") - auj);
  const m = ((await r.json()).results || [])
    .filter(p => lireRemarque(p.properties))
    .sort((a, b) => ecart(a) - ecart(b))[0];
  return m ? { texte: lireRemarque(m.properties), date: (m.properties?.Date?.date?.start || "").slice(0, 10) } : null;
}

/* Remarque nouvelle ou modifiée sur une mission déjà attribuée → e-mail à la prestataire */
export async function traiterRemarques(token, { dry = false } = {}) {
  await assurerColonnesRemarque(token);
  const r = await fetch(`https://api.notion.com/v1/databases/${MISSIONS_DB}/query`, {
    method: "POST", headers: H(token),
    body: JSON.stringify({ page_size: 100, filter: { and: [
      { property: "Prestataire", relation: { is_not_empty: true } },
      { property: "Date", date: { on_or_after: jourParis(0) } },
      { property: PROP_REMARQUE, rich_text: { is_not_empty: true } },
    ] } }),
  });
  const data = await r.json();
  if (!r.ok) return { erreur: data.message || "requête Notion impossible" };
  const aEnvoyer = (data.results || []).filter(p => lireRemarque(p.properties) !== texte(p.properties?.[PROP_REMARQUE_ENVOYEE]));
  if (dry) return { aEnvoyer: aEnvoyer.map(p => texte(p.properties?.Nom)) };
  let envoyes = 0; const erreurs = [];
  for (const p of aEnvoyer) {
    const remarque = lireRemarque(p.properties);
    try {
      const m = await getMissionDetails(token, p.id);
      const presta = m.prestataireId ? await getPrestataire(token, m.prestataireId) : null;
      if (presta && presta.email) {
        const res = await sendEmail({ to: presta.email, ...emailRemarque(m, presta) });
        if (!res.ok) { erreurs.push(`${presta.nom}: ${res.error}`); continue; }
        envoyes++;
      }
      await marquerRemarqueEnvoyee(token, p.id, remarque);
    } catch (e) { erreurs.push(e.message); }
  }
  return { envoyes, erreurs };
}

/* ── Lien unique par mission (/<slug>?mission=<id>) ── */

/* Consigne d'une mission précise, si elle appartient bien à ce logement */
export async function consigneMission(token, missionId, logementId) {
  const r = await fetch(`https://api.notion.com/v1/pages/${missionId}`, { headers: H(token) });
  if (!r.ok) return { valide: false };
  const p = await r.json();
  const log = (p.properties?.Logement?.relation || [])[0]?.id;
  if (p.archived || (logementId && log && log.replace(/-/g, "") !== String(logementId).replace(/-/g, ""))) return { valide: false };
  const texteR = lireRemarque(p.properties);
  return { valide: true, date: (p.properties?.Date?.date?.start || "").slice(0, 10), consigne: texteR ? { texte: texteR, date: (p.properties?.Date?.date?.start || "").slice(0, 10) } : null };
}

/* Rattache un rapport à sa mission (colonne relation « Mission » créée au besoin dans la base Rapports) */
export async function lierRapportMission(token, rapportsDb, rapportId, missionId) {
  if (!missionId || !rapportsDb) return false;
  try {
    const db = await (await fetch(`https://api.notion.com/v1/databases/${rapportsDb}`, { headers: H(token) })).json();
    const prop = db.properties?.Mission;
    if (prop && prop.type !== "relation") return false;          // colonne « Mission » d'un autre type : on n'y touche pas
    if (!prop) {
      const c = await fetch(`https://api.notion.com/v1/databases/${rapportsDb}`, { method: "PATCH", headers: H(token),
        body: JSON.stringify({ properties: { Mission: { relation: { database_id: MISSIONS_DB, single_property: {} } } } }) });
      if (!c.ok) return false;
    }
    const u = await fetch(`https://api.notion.com/v1/pages/${rapportId}`, { method: "PATCH", headers: H(token),
      body: JSON.stringify({ properties: { Mission: { relation: [{ id: missionId }] } } }) });
    return u.ok;
  } catch (e) { return false; }
}

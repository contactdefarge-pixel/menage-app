/* Règles d'attribution partagées (page prestataire + e-mail quotidien). */

/* Délai (en heures) avant qu'une mission devienne visible, selon le niveau
   de la prestataire [niveau 1, niveau 2, niveau 3]. Plus la mission est
   proche, plus les paliers sont courts. */
export const PALIERS = [
  { jours: 14, heures: [0, 24, 48] },
  { jours: 7,  heures: [0, 12, 24] },
  { jours: 3,  heures: [0, 4, 8]   },
  { jours: 0,  heures: [0, 0, 0]   },
];

// Les missions ne sont proposées qu'à partir de J-30
export const HORIZON_JOURS = 30;

// "1 - Prioritaire" -> 1 ; vide -> def
export function niveauNum(name, def) {
  const m = String(name || "").match(/^\s*(\d)/);
  return m ? parseInt(m[1], 10) : def;
}

export function delaiHeures(dateStr, niveau, now) {
  if (!niveau || !dateStr) return 0;
  const jours = (new Date(dateStr) - now) / 86400000;
  const p = PALIERS.find(x => jours >= x.jours) || PALIERS[PALIERS.length - 1];
  return p.heures[Math.min(niveau, 3) - 1] || 0;
}

// Réservation de dernière minute : ménage dans 0 à 3 jours
export const URGENT_JOURS = 3;

// Nombre de jours (calendaires, heure de Paris) entre aujourd'hui et la date du ménage
export function joursRestants(dateStr, now) {
  if (!dateStr) return Infinity;
  const auj = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const d = String(dateStr).slice(0, 10);
  return Math.round((Date.UTC(...d.split("-").map((v, i) => i === 1 ? v - 1 : +v)) - Date.UTC(...auj.split("-").map((v, i) => i === 1 ? v - 1 : +v))) / 86400000);
}
export function estUrgente(dateStr, now) {
  const j = joursRestants(dateStr, now);
  return j >= 0 && j <= URGENT_JOURS;
}

/* Instant (ms) à partir duquel la mission est visible pour ce niveau, ou null si elle ne l'est jamais
   (hors horizon, ou logement réservé à un niveau supérieur). */
export function visibleDepuis(mission, niveau, niveauRequis, now) {
  if (mission.date && joursRestants(mission.date, now) > HORIZON_JOURS) return null;   // J+30 inclus (ex. le 8/10 -> jusqu'au 8/11)
  // dernière minute : ouvert à tous les niveaux, sans délai
  if (estUrgente(mission.date, now)) return new Date(mission.cree).getTime();
  if (niveau && niveau > niveauRequis) return null;
  return new Date(mission.cree).getTime() + delaiHeures(mission.date, niveau, now) * 3600000;
}

/* ── Disponibilités des prestataires (base Prestataires) ──────────────────
   « Indispo toutes les semaines », « Indispo semaines paires », « Indispo semaines impaires » : jours (Lundi…Dimanche)
   « Congés » : date ou période. Semaine paire/impaire = numéro de semaine ISO (celui des agendas). */
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const norm = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function lireDispo(props) {
  const ms = (k) => (props?.[k]?.multi_select || []).map(o => norm(o.name));
  const c = props?.["Congés"]?.date;
  return {
    toutes: ms("Indispo toutes les semaines"),
    paires: ms("Indispo semaines paires"),
    impaires: ms("Indispo semaines impaires"),
    conges: c && c.start ? { debut: c.start.slice(0, 10), fin: (c.end || c.start).slice(0, 10) } : null,
  };
}

export function semaineIso(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const jour = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - jour);
  const debutAnnee = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - debutAnnee) / 86400000 + 1) / 7);
}

/* true si la prestataire peut faire un ménage à cette date */
export function estDisponible(dispo, dateStr) {
  if (!dispo || !dateStr) return true;
  const jourIso = String(dateStr).slice(0, 10);
  if (dispo.conges && jourIso >= dispo.conges.debut && jourIso <= dispo.conges.fin) return false;
  const [y, m, d] = jourIso.split("-").map(Number);
  const nomJour = norm(JOURS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]);
  if (dispo.toutes.includes(nomJour)) return false;
  const paire = semaineIso(jourIso) % 2 === 0;
  if (paire && dispo.paires.includes(nomJour)) return false;
  if (!paire && dispo.impaires.includes(nomJour)) return false;
  return true;
}

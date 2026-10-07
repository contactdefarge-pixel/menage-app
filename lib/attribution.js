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

/* Instant (ms) à partir duquel la mission est visible pour ce niveau, ou null si elle ne l'est jamais
   (hors horizon, ou logement réservé à un niveau supérieur). */
export function visibleDepuis(mission, niveau, niveauRequis, now) {
  if (mission.date && (new Date(mission.date) - now) / 86400000 > HORIZON_JOURS) return null;
  if (niveau && niveau > niveauRequis) return null;
  return new Date(mission.cree).getTime() + delaiHeures(mission.date, niveau, now) * 3600000;
}

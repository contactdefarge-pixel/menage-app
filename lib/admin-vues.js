/* Vues de la page admin : planning, liste de courses, pressing, logements.
   (regroupé dans /api/admin-missions : le plan Hobby de Vercel limite à 12 fonctions) */
import { niveauNum } from "./attribution.js";

const MISSIONS_DB  = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const LOGEMENTS_DB = "365d50ab-a52f-801f-b5fd-f740a0aa78c1";
const H = (t) => ({ "Authorization": `Bearer ${t}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });
const plain = (p) => (p?.title || p?.rich_text || []).map(t => t.plain_text).join("");
const nv = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function notion(t, path, method = "GET", body) {
  const r = await fetch(`https://api.notion.com/v1/${path}`, { method, headers: H(t), body: body ? JSON.stringify(body) : undefined });
  const d = await r.json();
  if (!r.ok) throw new Error(`Notion ${path} : ${d.message || r.status}`);
  return d;
}
async function queryAll(t, db, body = {}) {
  let out = [], cursor;
  for (let i = 0; i < 10; i++) {
    const d = await notion(t, `databases/${db}/query`, "POST", { page_size: 100, ...body, ...(cursor ? { start_cursor: cursor } : {}) });
    out = out.concat(d.results || []);
    if (!d.has_more) break; cursor = d.next_cursor;
  }
  return out;
}

/* ── Planning : missions d'une semaine, avec la prestataire ── */
export async function vuePlanning(t, debut) {
  const d0 = /^\d{4}-\d{2}-\d{2}$/.test(debut || "") ? debut : new Date().toISOString().slice(0, 10);
  const fin = new Date(Date.parse(d0 + "T12:00:00Z") + 6 * 86400000).toISOString().slice(0, 10);
  const pages = await queryAll(t, MISSIONS_DB, {
    sorts: [{ property: "Date", direction: "ascending" }],
    filter: { and: [{ property: "Date", date: { on_or_after: d0 } }, { property: "Date", date: { on_or_before: fin } }] },
  });
  const cache = {};
  const get = (id) => (cache[id] ||= notion(t, `pages/${id}`).catch(() => null));
  const missions = await Promise.all(pages.map(async p => {
    const pr = p.properties || {};
    const logId = (pr["Logement"]?.relation || [])[0]?.id;
    const presId = (pr["Prestataire"]?.relation || [])[0]?.id;
    const [log, pres] = await Promise.all([logId ? get(logId) : null, presId ? get(presId) : null]);
    return {
      id: p.id, nom: plain(pr["Nom"]), date: (pr["Date"]?.date?.start || "").slice(0, 10),
      etat: pr["État"]?.status?.name || "",
      logementNom: log ? plain(log.properties?.["Nom"]) : "",
      prestataire: pres ? plain(pres.properties?.["Prénom/Nom"] || pres.properties?.["Nom"]) : "",
      candidats: (pr["Candidats"]?.relation || []).length,
      url: p.url,
    };
  }));
  return { debut: d0, fin, missions };
}

/* ── Liste de courses : « Consommables à prévoir » des rapports non encore réapprovisionnés ── */
const PROP_REAPPRO = "Réapprovisionné";
import { COURSES_DEPUIS } from "./consommables.js";
export async function vueCourses(t) {
  const db = process.env.NOTION_DB;
  if (!db) throw new Error("NOTION_DB (base des rapports) n'est pas configurée");
  await notion(t, `databases/${db}`, "PATCH", { properties: { [PROP_REAPPRO]: { checkbox: {} } } }).catch(() => {});
  const pages = await queryAll(t, db, {
    sorts: [{ property: "Date", direction: "descending" }],
    filter: { and: [
      { property: "Consommables à prévoir", rich_text: { is_not_empty: true } },
      { property: PROP_REAPPRO, checkbox: { equals: false } },
      { timestamp: "created_time", created_time: { on_or_after: COURSES_DEPUIS } },
    ] },
  });
  // prochain ménage de chaque logement (pour savoir quand déposer ou préparer le sac)
  const prochains = {};
  try {
    const auj = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
    const ms = await queryAll(t, MISSIONS_DB, { sorts: [{ property: "Date", direction: "ascending" }], filter: { property: "Date", date: { on_or_after: auj } } });
    const cache = {};
    for (const m of ms) {
      const logId = (m.properties?.["Logement"]?.relation || [])[0]?.id; if (!logId) continue;
      cache[logId] ||= notion(t, `pages/${logId}`).catch(() => null);
      const lg = await cache[logId]; const nom = lg ? plain(lg.properties?.["Nom"]) : "";
      if (nom && !prochains[nom]) prochains[nom] = (m.properties?.["Date"]?.date?.start || "").slice(0, 10);
    }
  } catch (e) {}
  return { prochains, rapports: pages.map(p => {
    const pr = p.properties || {};
    return { id: p.id, logement: plain(pr["Adresse"]) || "Sans nom", date: pr["Date"]?.date?.start || "",
      prestataire: plain(pr["Prénom, Nom"]), texte: plain(pr["Consommables à prévoir"]), url: p.url };
  }) };
}
export async function coursesFaites(t, ids) {
  await Promise.all((ids || []).map(id => notion(t, `pages/${id}`, "PATCH", { properties: { [PROP_REAPPRO]: { checkbox: true } } })));
  return { ok: true, n: (ids || []).length };
}

/* ── Pressing : base Notion « Pressing izinest » créée automatiquement à côté de la base Missions ── */
const PRESSING_TITRE = "Pressing izinest";
export const STATUTS = ["À déposer", "Au pressing", "Prêt à récupérer", "Récupéré"];
let PRESSING_ID = process.env.PRESSING_DB || "";
/* page Notion où créer la base Pressing : variable PRESSING_PARENT (id de page), sinon la page qui contient
   l'une des bases connues, sinon la première page partagée avec l'intégration */
async function pageParente(t) {
  const viaEnv = (process.env.PRESSING_PARENT || "").replace(/-/g, "").match(/[0-9a-f]{32}/i)?.[0];
  if (viaEnv) return { type: "page_id", page_id: viaEnv };
  const bases = [MISSIONS_DB, LOGEMENTS_DB, "3d7d50ab-a52f-8012-a15d-e9d59a968f8f", process.env.NOTION_DB].filter(Boolean);
  for (const id of bases) {
    try {
      const db = await notion(t, `databases/${id}`);
      if (db.parent?.type === "page_id") return { type: "page_id", page_id: db.parent.page_id };
      if (db.parent?.type === "block_id") {
        const bl = await notion(t, `blocks/${db.parent.block_id}`).catch(() => null);
        if (bl?.parent?.type === "page_id") return { type: "page_id", page_id: bl.parent.page_id };
      }
    } catch (e) {}
  }
  const s = await notion(t, "search", "POST", { filter: { property: "object", value: "page" }, page_size: 50 });
  const p = (s.results || []).find(x => x.parent?.type === "workspace" || x.parent?.type === "page_id");
  if (p) return { type: "page_id", page_id: p.id };
  throw new Error("Aucune page Notion disponible pour créer la base Pressing : partagez une page (ex. « izinest ») avec l'intégration");
}

async function pressingDb(t) {
  if (PRESSING_ID) return PRESSING_ID;
  const s = await notion(t, "search", "POST", { query: PRESSING_TITRE, filter: { property: "object", value: "database" } });
  const found = (s.results || []).find(d => (d.title || []).map(x => x.plain_text).join("") === PRESSING_TITRE && !d.archived);
  if (found) return (PRESSING_ID = found.id);
  const parent = await pageParente(t);
  const db = await notion(t, "databases", "POST", {
    parent, title: [{ type: "text", text: { content: PRESSING_TITRE } }],
    properties: {
      "Lot": { title: {} }, "Logement": { rich_text: {} }, "Articles": { rich_text: {} },
      "Statut": { select: { options: STATUTS.map(name => ({ name })) } },
      "Déposé le": { date: {} }, "Récupéré le": { date: {} }, "Notes": { rich_text: {} },
    },
  });
  return (PRESSING_ID = db.id);
}
const txt = (s) => [{ text: { content: String(s || "").slice(0, 1990) } }];
export async function vuePressing(t) {
  const db = await pressingDb(t);
  const pages = await queryAll(t, db, { sorts: [{ timestamp: "created_time", direction: "descending" }] });
  return { lots: pages.map(p => {
    const pr = p.properties || {};
    return { id: p.id, lot: plain(pr["Lot"]), logement: plain(pr["Logement"]), articles: plain(pr["Articles"]),
      statut: pr["Statut"]?.select?.name || "À déposer", depose: pr["Déposé le"]?.date?.start || "",
      recupere: pr["Récupéré le"]?.date?.start || "", notes: plain(pr["Notes"]), cree: p.created_time, url: p.url };
  }) };
}
export async function pressingCreer(t, { logement, articles, notes }) {
  const db = await pressingDb(t);
  const jour = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
  const p = await notion(t, "pages", "POST", { parent: { database_id: db }, properties: {
    "Lot": { title: txt(`${logement || "Lot"} — ${jour}`) }, "Logement": { rich_text: txt(logement) },
    "Articles": { rich_text: txt(articles) }, "Notes": { rich_text: txt(notes) }, "Statut": { select: { name: STATUTS[0] } },
  } });
  return { ok: true, id: p.id };
}
export async function pressingStatut(t, { id, statut }) {
  if (!STATUTS.includes(statut)) throw new Error("Statut inconnu");
  const auj = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const props = { "Statut": { select: { name: statut } } };
  if (statut === "Au pressing") props["Déposé le"] = { date: { start: auj } };
  if (statut === "Récupéré") props["Récupéré le"] = { date: { start: auj } };
  await notion(t, `pages/${id}`, "PATCH", { properties: props });
  return { ok: true };
}
export async function pressingSupprimer(t, { id }) { await notion(t, `pages/${id}`, "PATCH", { archived: true }); return { ok: true }; }

/* ── Logements : fiche résumée pour l'admin ── */
function sel(p) { return p?.select?.name || p?.status?.name || (p?.multi_select || []).map(o => o.name).join(", ") || plain(p) || ""; }
export async function vueLogements(t) {
  const pages = await queryAll(t, LOGEMENTS_DB, { sorts: [{ property: "Nom", direction: "ascending" }] });
  return { logements: pages.map(p => {
    const pr = p.properties || {};
    const nom = plain(pr["Nom"]);
    const hero = pr["Hero"]?.files?.length || pr["Hero"]?.url;
    const stock = sel(pr["Stock consommables"]);
    return {
      id: p.id, nom, url: p.url,
      slug: nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      adresse: plain(pr["Adresse"]), type: sel(pr["Type"]),
      voyageurs: plain(pr["Nombre de voyageurs"]) || (pr["Nombre de voyageurs"]?.number ?? ""),
      forfait: pr["Forfait ménage"]?.number != null ? pr["Forfait ménage"].number + " €" : "",
      niveauRequis: niveauNum(pr["Niveau requis"]?.select?.name, 3),
      attribution: /direct/i.test(pr["Attribution"]?.select?.name || "") ? "Direct" : "Postuler",
      stockARecuperer: /^\s*[aà]\s*r[ée]cup/i.test(stock),
      lingeLie: (pr["Linge"]?.relation || []).length,
      hero: hero ? `/api/missions?hero=${p.id}&v=${encodeURIComponent(p.last_edited_time || "")}` : "",
      proprietaire: plain(pr["Propriétaire"]),
    };
  }).filter(l => l.nom) };
}

/* ── Prime sur une mission ── */
export async function definirPrime(t, { id, prime }) {
  const n = Number(prime);
  await notion(t, `databases/${MISSIONS_DB}`, "PATCH", { properties: { "Prime": { number: { format: "euro" } } } }).catch(() => {});
  await notion(t, `pages/${id}`, "PATCH", { properties: { "Prime": { number: Number.isFinite(n) && n > 0 ? n : null } } });
  return { ok: true };
}

/* ── Relevé mensuel : missions attribuées du mois, par prestataire (forfait du logement + prime) ── */
export async function vueReleve(t, mois) {
  const m = /^\d{4}-\d{2}$/.test(mois || "") ? mois : new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }).slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const debut = `${m}-01`;
  const fin = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
  const pages = await queryAll(t, MISSIONS_DB, {
    sorts: [{ property: "Date", direction: "ascending" }],
    filter: { and: [
      { property: "Date", date: { on_or_after: debut } }, { property: "Date", date: { on_or_before: fin } },
      { property: "Prestataire", relation: { is_not_empty: true } },
    ] },
  });
  const cache = {};
  const get = (id) => (cache[id] ||= notion(t, `pages/${id}`).catch(() => null));
  const auj = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const lignes = await Promise.all(pages.map(async p => {
    const pr = p.properties || {};
    const logId = (pr["Logement"]?.relation || [])[0]?.id;
    const presId = (pr["Prestataire"]?.relation || [])[0]?.id;
    const [log, pres] = await Promise.all([logId ? get(logId) : null, presId ? get(presId) : null]);
    const date = (pr["Date"]?.date?.start || "").slice(0, 10);
    return {
      id: p.id, date, url: p.url, aVenir: date > auj,
      logement: log ? plain(log.properties?.["Nom"]) : (plain(pr["Nom"]).split(" — ")[0] || "—"),
      prestataireId: presId || "", prestataire: pres ? plain(pres.properties?.["Prénom/Nom"] || pres.properties?.["Nom"]) : "—",
      forfait: log?.properties?.["Forfait ménage"]?.number ?? 0,
      prime: pr["Prime"]?.number || 0,
    };
  }));
  return { mois: m, debut, fin, lignes };
}

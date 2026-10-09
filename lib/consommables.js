/* Consommables à apporter : pour les logements sans stock sur place (« Stock consommables » = « A récupérer… »),
   les « Consommables à prévoir » des derniers rapports non encore traités sont à prendre au stock izinest
   par la prochaine prestataire. Traité = case « Réapprovisionné » du rapport (cochée par l'admin dans
   l'onglet Courses, ou automatiquement quand la prestataire suivante confirme les avoir apportés). */
const H = (t) => ({ "Authorization": `Bearer ${t}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });
const plain = (p) => (p?.title || p?.rich_text || []).map(t => t.plain_text).join("");
export const PROP_REAPPRO = "Réapprovisionné";
export const COURSES_DEPUIS = process.env.COURSES_DEPUIS || "2026-10-08T20:00:00Z";

export function stockARecuperer(props) {
  const p = props?.["Stock consommables"];
  if (!p) return false;
  const t = p.select?.name || p.status?.name || (p.multi_select || []).map(o => o.name).join(" ") || plain(p);
  return /^\s*[aà]\s*r[ée]cup/i.test(t || "");
}

export function articles(textes) {
  const vus = {}, out = [];
  const maj = (x) => { x = x.trim(); return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; };
  for (const t of textes) for (const a of String(t || "").split(/[,\n;]+/).map(maj).filter(Boolean)) {
    const k = a.toLowerCase(); if (!vus[k]) { vus[k] = 1; out.push(a); }
  }
  return out;
}

/* { items: ["Liquide vaisselle", …], rapports: [{ id, date, prestataire }] } */
let colonneOk = false;
export async function aApporter(token, logementNom) {
  const db = process.env.NOTION_DB;
  if (!db || !logementNom) return { items: [], rapports: [] };
  try {
    if (!colonneOk) {
      await fetch(`https://api.notion.com/v1/databases/${db}`, { method: "PATCH", headers: H(token), body: JSON.stringify({ properties: { [PROP_REAPPRO]: { checkbox: {} } } }) }).catch(() => {});
      colonneOk = true;
    }
    const r = await fetch(`https://api.notion.com/v1/databases/${db}/query`, {
      method: "POST", headers: H(token),
      body: JSON.stringify({ page_size: 20, sorts: [{ property: "Date", direction: "descending" }], filter: { and: [
        { property: "Adresse", title: { equals: logementNom } },
        { property: "Consommables à prévoir", rich_text: { is_not_empty: true } },
        { property: PROP_REAPPRO, checkbox: { equals: false } },
        { timestamp: "created_time", created_time: { on_or_after: COURSES_DEPUIS } },
      ] } }),
    });
    const d = await r.json();
    if (!r.ok) return { items: [], rapports: [] };
    const pages = d.results || [];
    return {
      items: articles(pages.map(p => plain(p.properties?.["Consommables à prévoir"]))),
      rapports: pages.map(p => ({ id: p.id, date: p.properties?.["Date"]?.date?.start || "", prestataire: plain(p.properties?.["Prénom, Nom"]) })),
    };
  } catch (e) { return { items: [], rapports: [] }; }
}

export async function marquerTraites(token, ids) {
  await Promise.all((ids || []).filter(Boolean).map(id => fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: "PATCH", headers: H(token), body: JSON.stringify({ properties: { [PROP_REAPPRO]: { checkbox: true } } }) })));
}

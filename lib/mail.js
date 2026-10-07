/* E-mails izinest + liens calendrier (Google / Apple) — partagé par plusieurs fonctions.
   Expéditeur : variable Vercel MAIL_FROM (ex. « izinest <missions@izinest.fr> »).
   Tant que le domaine n'est pas vérifié dans Resend, l'envoi n'est possible qu'à l'adresse du compte Resend. */

export const APP_URL = "https://menage-app-nine.vercel.app";
const NOTION_H = (t) => ({ "Authorization": `Bearer ${t}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });

function plain(prop) {
  if (!prop) return "";
  return (prop.title || prop.rich_text || []).map(t => t.plain_text).join("");
}
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── Envoi ── */
export async function sendEmail({ to, subject, html, cc }) {
  if (!to) return { ok: false, error: "pas d'adresse e-mail" };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY manquante" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "izinest <onboarding@resend.dev>", to, subject, html, ...(cc ? { cc } : {}) }),
    });
    if (!r.ok) { const t = (await r.text()).slice(0, 300); console.error("Resend:", t); return { ok: false, error: t }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

/* ── Lecture Notion ── */
export async function getMissionDetails(token, missionId) {
  const r = await fetch(`https://api.notion.com/v1/pages/${missionId}`, { headers: NOTION_H(token) });
  const p = await r.json();
  const pr = p.properties || {};
  const logId = (pr["Logement"]?.relation || [])[0]?.id;
  let logementNom = "", adresse = "";
  if (logId) {
    const l = await (await fetch(`https://api.notion.com/v1/pages/${logId}`, { headers: NOTION_H(token) })).json();
    logementNom = plain(l.properties?.["Nom"]);
    adresse = plain(l.properties?.["Adresse"]);
  }
  const nom = plain(pr["Nom"]);
  return {
    id: missionId,
    nom,
    titre: logementNom || nom.split(" — ")[0] || "Mission",
    date: pr["Date"]?.date?.start || "",
    logementNom, adresse,
    prestataireId: (pr["Prestataire"]?.relation || [])[0]?.id || null,
  };
}

export async function getPrestataire(token, id) {
  const r = await fetch(`https://api.notion.com/v1/pages/${id}`, { headers: NOTION_H(token) });
  const p = await r.json();
  const pr = p.properties || {};
  return { id, nom: plain(pr["Prénom/Nom"] || pr["Nom"]), email: pr["Email"]?.email || "" };
}

/* ── Dates & calendriers ── */
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const stamp = (d) => `${ymd(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export function dateLongue(date) {
  if (!date) return "";
  const d = date.length > 10 ? new Date(date) : new Date(date + "T12:00:00Z");
  const s = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function dateCourte(date) {
  if (!date) return "";
  const d = date.length > 10 ? new Date(date) : new Date(date + "T12:00:00Z");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
}

// début / fin : journée entière si la date n'a pas d'heure, sinon créneau de 2 h
function plage(date) {
  if (date.length <= 10) {
    const s = new Date(date + "T00:00:00Z"); const e = new Date(s.getTime() + 86400000);
    return { allDay: true, start: ymd(s), end: ymd(e) };
  }
  const s = new Date(date); const e = new Date(s.getTime() + 2 * 3600000);
  return { allDay: false, start: stamp(s), end: stamp(e) };
}

export function googleCalendarUrl(m) {
  const { start, end } = plage(m.date);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `Ménage — ${m.titre}`,
    dates: `${start}/${end}`,
    details: `Mission izinest : ${m.titre}\nFormulaire et détails : ${APP_URL}/prestataire`,
    location: m.adresse || "",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function icsUrl(missionId) { return `${APP_URL}/api/missions?ics=${encodeURIComponent(missionId)}`; }

const icsEsc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
export function buildIcs(m) {
  const { allDay, start, end } = plage(m.date);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//izinest//missions//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${m.id}@izinest`,
    `DTSTAMP:${stamp(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
    `SUMMARY:${icsEsc("Ménage — " + m.titre)}`,
    `LOCATION:${icsEsc(m.adresse)}`,
    `DESCRIPTION:${icsEsc("Mission izinest : " + m.titre + "\nDétails : " + APP_URL + "/prestataire")}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/* ── Gabarits ── */
const btn = (href, label, primary) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 10px 0;padding:12px 18px;border-radius:10px;font:600 14px Helvetica,Arial,sans-serif;text-decoration:none;${primary ? "background:#00bab3;color:#ffffff;" : "background:#ffffff;color:#085157;border:1.5px solid #085157;"}">${esc(label)}</a>`;

function layout(titre, corps) {
  return `<div style="background:#f0fafa;padding:24px 12px;font-family:Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
    <div style="background:#085157;color:#ffffff;padding:18px 24px"><div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#99e0dd">izinest</div><div style="font-size:20px;font-weight:700;margin-top:2px">${esc(titre)}</div></div>
    <div style="padding:24px;color:#0f2e31;font-size:15px;line-height:1.5">${corps}</div>
    <div style="padding:14px 24px;background:#f7fcfc;color:#5b7b7e;font-size:12px">izinest · conciergerie, Pyrénées</div>
  </div></div>`;
}

function carte(m) {
  const maps = m.adresse ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.adresse)}` : "";
  return `<div style="border:1px solid #d3ecec;border-radius:12px;padding:16px;margin:16px 0">
    <div style="font-size:18px;font-weight:700;color:#085157">${esc(m.titre)}</div>
    <div style="margin-top:6px">📅 ${esc(dateLongue(m.date))}</div>
    ${m.adresse ? `<div style="margin-top:4px">📍 <a href="${esc(maps)}" style="color:#085157">${esc(m.adresse)}</a></div>` : ""}
  </div>`;
}

export function emailConfirmation(m, prestataire) {
  return {
    subject: `✅ Mission confirmée — ${m.titre} · ${dateCourte(m.date)}`,
    html: layout("Mission confirmée", `
      <p>Bonjour ${esc(prestataire.nom)},</p>
      <p>Bonne nouvelle : votre candidature est retenue. La mission est à vous.</p>
      ${carte(m)}
      <p style="margin:18px 0 8px;font-weight:600">Ajouter à mon calendrier</p>
      <div>${btn(googleCalendarUrl(m), "Google Agenda", true)}${btn(icsUrl(m.id), "Apple Agenda", false)}</div>
      <p style="margin-top:14px">Retrouvez la mission et son formulaire dans <a href="${APP_URL}/prestataire" style="color:#085157">votre espace izinest</a>.</p>`),
  };
}

export function emailAnnulation(m, prestataire, motif) {
  return {
    subject: `❌ Mission annulée — ${m.titre} · ${dateCourte(m.date)}`,
    html: layout("Mission annulée", `
      <p>Bonjour ${esc(prestataire.nom)},</p>
      <p>La mission ci-dessous est <strong>annulée</strong>${motif ? " : " + esc(motif) : ""}. Vous n'avez plus à intervenir.</p>
      ${carte(m)}
      <p>Pensez à retirer l'événement de votre calendrier. Toutes nos excuses pour la gêne occasionnée.</p>
      <p>D'autres missions sont disponibles dans <a href="${APP_URL}/prestataire" style="color:#085157">votre espace izinest</a>.</p>`),
  };
}

/* Prévient la prestataire assignée qu'une mission est annulée (meilleur effort, ne bloque jamais). */
export async function notifierAnnulation(token, missionId, motif) {
  try {
    const m = await getMissionDetails(token, missionId);
    if (!m.prestataireId) return { ok: false, error: "aucune prestataire assignée" };
    const p = await getPrestataire(token, m.prestataireId);
    const mail = emailAnnulation(m, p, motif);
    return await sendEmail({ to: p.email, ...mail });
  } catch (e) { console.error("notifierAnnulation:", e.message); return { ok: false, error: e.message }; }
}

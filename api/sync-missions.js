import { notifierAnnulation } from "../lib/mail.js";
import { estUrgente } from "../lib/attribution.js";
import { notifierUrgence, getLogementInfoUrgent } from "../lib/urgent.js";

const MISSIONS_DB  = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const LOGEMENTS_DB = "365d50ab-a52f-801f-b5fd-f740a0aa78c1";
const WINDOW_DAYS  = 90;

function plainText(prop) {
  if (!prop) return "";
  if (prop.type === "title")     return (prop.title     || []).map(t => t.plain_text).join("");
  if (prop.type === "rich_text") return (prop.rich_text || []).map(t => t.plain_text).join("");
  return "";
}

/* ── Notion (helper commun, lève une erreur si Notion refuse) ── */
async function notion(path, method, body) {
  const r = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Notion ${method} ${path} -> ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

/* ── Beds24 ── */
async function getBeds24Token() {
  const refreshToken = (process.env.BEDS24_REFRESH_TOKEN || "").trim();
  const r = await fetch("https://beds24.com/api/v2/authentication/token", {
    method: "GET",
    headers: { "refreshToken": refreshToken },
  });
  const data = await r.json();
  if (!data.token) throw new Error("Beds24 auth failed: " + JSON.stringify(data));
  return data.token;
}

async function beds24Get(token, path) {
  const r = await fetch(`https://beds24.com/api/v2/${path}`, { headers: { token } });
  const data = await r.json();
  if (data.success === false) throw new Error(`Beds24 ${path} failed: ` + JSON.stringify(data));
  return data;
}

/* roomId -> { roomName, propertyName } */
async function getRoomMap(token) {
  const data = await beds24Get(token, "properties?includeAllRooms=true");
  const map = {};
  for (const p of data.data || []) {
    for (const room of p.roomTypes || []) {
      map[room.id] = { roomName: room.name || "", propertyName: p.name || "" };
    }
  }
  return map;
}

async function getBeds24Bookings(token, from, to) {
  const roomMap = await getRoomMap(token);
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const data = await beds24Get(
      token,
      `bookings?departureFrom=${from}&departureTo=${to}&status=confirmed&status=new&page=${page}`
    );
    for (const b of data.data || []) {
      const room = roomMap[b.roomId] || {};
      all.push({
        bookId:       String(b.id),
        checkOut:     b.departure,
        roomName:     room.roomName || "",
        propertyName: room.propertyName || "",
        label:        `${b.firstName || ""} ${b.lastName || ""}`.trim(),
      });
    }
    if (!data.pages || !data.pages.nextPageExists) break;
  }
  // Les demandes iCal « INQUIRE » ne sont pas des réservations confirmées
  return all.filter(b => b.checkOut && !/INQUIRE/i.test(b.label));
}

/* ── Notion Logements ── */
async function getLogements() {
  const data = await notion(`databases/${LOGEMENTS_DB}/query`, "POST", { page_size: 100 });
  return (data.results || []).map(p => ({
    id: p.id,
    nom: plainText((p.properties || {})["Nom"]).trim().toLowerCase(),
  }));
}

// Le logement Notion correspond au Room Name Beds24 (une propriété peut contenir plusieurs logements)
function findLogement(logements, booking) {
  const key = (booking.roomName || "").trim().toLowerCase();
  const hit = key && logements.find(l => l.nom === key);
  return hit ? hit.id : null;
}

/* ── Notion Missions ── */
async function getMissionsNotion() {
  const missions = [];
  let cursor;
  do {
    const data = await notion(`databases/${MISSIONS_DB}/query`, "POST",
      cursor ? { page_size: 100, start_cursor: cursor } : { page_size: 100 });
    for (const page of data.results || []) {
      const props = page.properties || {};
      missions.push({
        id:       page.id,
        nom:      plainText(props["Nom"]),
        beds24Id: plainText(props["Beds24 ID"]).trim(),
        date:     props["Date"]?.date?.start?.slice(0, 10) || "",
        hasLogement: (props["Logement"]?.relation || []).length > 0,
        assignee: (props["Prestataire"]?.relation || []).length > 0,
      });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return missions;
}

function missionTitle(booking) {
  return `${booking.roomName || booking.propertyName || "Logement"} — ${booking.checkOut}`;
}

async function repairMission(mission, booking, logementId) {
  const props = { "Nom": { title: [{ text: { content: missionTitle(booking) } }] } };
  if (!mission.hasLogement && logementId) props["Logement"] = { relation: [{ id: logementId }] };
  await notion(`pages/${mission.id}`, "PATCH", { properties: props });
}

async function createMission(booking, logementId) {
  const props = {
    "Nom":       { title: [{ text: { content: missionTitle(booking) } }] },
    "Date":      { date: { start: booking.checkOut } },
    "État":      { status: { name: "Disponible" } },
    "Beds24 ID": { rich_text: [{ text: { content: booking.bookId } }] },
  };
  if (logementId) props["Logement"] = { relation: [{ id: logementId }] };
  const page = await notion("pages", "POST", { parent: { database_id: MISSIONS_DB }, properties: props });
  return page?.id;
}

async function archiveMission(pageId) {
  await notion(`pages/${pageId}`, "PATCH", { archived: true });
}

/* ── Handler ── */
// Un reset enchaîne ~50 appels Notion : on laisse 60 s à la fonction
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  const okSecret = process.env.CRON_SECRET && (auth === `Bearer ${process.env.CRON_SECRET}` || req.query?.secret === process.env.CRON_SECRET);
  if (!okSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ?dry=1 : simule sans rien créer ni supprimer
  const dry = req.query?.dry === "1";
  const reset = req.query?.reset === "1";

  try {
    // ?testRoom=Nom du logement&testDate=2026-10-08 : crée une mission de test (sans Beds24)
    if (req.query?.testRoom) {
      const logements = await getLogements();
      const booking = {
        bookId:       `TEST-${Date.now()}`,
        checkOut:     req.query.testDate || new Date().toISOString().slice(0, 10),
        roomName:     req.query.testRoom,
        propertyName: "",
      };
      const logementId = findLogement(logements, booking);
      if (!dry) await createMission(booking, logementId);
      return res.status(200).json({
        success: true,
        test: true,
        dry,
        mission: missionTitle(booking),
        logementTrouve: !!logementId,
        logementsDisponibles: logements.map(l => l.nom),
      });
    }

    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + WINDOW_DAYS);
    const from = today.toISOString().slice(0, 10);
    const to   = future.toISOString().slice(0, 10);

    const beds24Token = await getBeds24Token();
    const bookings    = await getBeds24Bookings(beds24Token, from, to);
    const activeIds   = new Set(bookings.map(b => b.bookId));

    const missions  = await getMissionsNotion();
    const logements = await getLogements();

    // Archiver les missions dont la réservation a disparu / été annulée.
    // Seules les missions DANS la fenêtre [aujourd'hui ; +90 jours] sont concernées :
    // les missions passées sont conservées.
    // ?reset=1 : archive TOUTES les missions à venir (avec ou sans Beds24 ID) puis les recrée depuis Beds24
    const toDelete = reset
      ? missions.filter(m => m.date >= from)
      : missions.filter(m =>
          m.beds24Id && !m.beds24Id.startsWith("TEST-") &&
          m.date >= from && m.date <= to && !activeIds.has(m.beds24Id)
        );

    // Créer les missions manquantes
    const knownIds = new Set(reset ? [] : missions.map(m => m.beds24Id).filter(Boolean));
    const toCreate = bookings.filter(b => !knownIds.has(b.bookId));

    // Réparer les missions créées avec un titre de type « 725859 — 2026-10-12 » (roomId au lieu du nom)
    const byId = new Map(bookings.map(b => [b.bookId, b]));
    const toRepair = reset ? [] : missions.filter(m =>
      /^\d+\s+—/.test(m.nom) && byId.has(m.beds24Id) && byId.get(m.beds24Id).roomName
    );

    const unmatched = [];
    let created = 0;
    let deleted = 0;
    let repaired = 0;
    let prevenues = 0;

    if (!dry) {
      for (const m of toDelete) {
        // la prestataire assignée est prévenue par e-mail (pas lors d'un reset technique)
        if (m.assignee && !reset) { const r = await notifierAnnulation(process.env.NOTION_TOKEN, m.id, "la réservation a été annulée"); if (r.ok) prevenues++; }
        await archiveMission(m.id); deleted++;
      }
      for (const m of toRepair) {
        const b = byId.get(m.beds24Id);
        await repairMission(m, b, findLogement(logements, b));
        repaired++;
      }
    }
    const urgentes = [];
    for (const b of toCreate) {
      const logementId = findLogement(logements, b);
      if (!logementId) unmatched.push(b.roomName || `(sans nom, propriété ${b.propertyName})`);
      if (!dry) {
        await createMission(b, logementId); created++;
        if (!reset && estUrgente(b.checkOut, today)) urgentes.push({ titre: missionTitle(b), date: b.checkOut, logementId });
      } else if (estUrgente(b.checkOut, today)) urgentes.push({ titre: missionTitle(b), date: b.checkOut, logementId });
    }
    // réservation de dernière minute : e-mail immédiat à toutes les prestataires
    let urgence = null;
    if (urgentes.length && !dry) {
      for (const u of urgentes) u.forfait = (await getLogementInfoUrgent(process.env.NOTION_TOKEN, u.logementId)).forfait;
      urgence = await notifierUrgence(process.env.NOTION_TOKEN, urgentes);
    }

    return res.status(200).json({
      success: true,
      dry,
      reset,
      window: { from, to },
      bookings: bookings.length,
      created: dry ? 0 : created,
      deleted: dry ? 0 : deleted,
      repaired: dry ? 0 : repaired,
      prestatairesPrevenues: dry ? 0 : prevenues,
      wouldRepair: dry ? toRepair.map(m => `${m.nom} -> ${missionTitle(byId.get(m.beds24Id))}`) : undefined,
      wouldCreate: dry ? toCreate.map(b => `${missionTitle(b)} (#${b.bookId})`) : undefined,
      wouldDelete: dry ? toDelete.map(m => `${m.nom} (#${m.beds24Id})`) : undefined,
      urgentes: urgentes.map(u => u.titre),
      urgence,
      unmatchedLogements: [...new Set(unmatched)],
    });
  } catch (e) {
    console.error("sync-missions error:", e);
    return res.status(500).json({ error: e.message });
  }
}

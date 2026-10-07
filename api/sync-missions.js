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

function findLogement(logements, booking) {
  for (const candidate of [booking.propertyName, booking.roomName]) {
    const key = (candidate || "").trim().toLowerCase();
    const hit = key && logements.find(l => l.nom === key);
    if (hit) return hit.id;
  }
  return null;
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
      });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return missions;
}

async function createMission(booking, logementId) {
  const titre = booking.propertyName || booking.roomName || "Logement";
  const props = {
    "Nom":       { title: [{ text: { content: `${titre} — ${booking.checkOut}` } }] },
    "Date":      { date: { start: booking.checkOut } },
    "État":      { status: { name: "Disponible" } },
    "Beds24 ID": { rich_text: [{ text: { content: booking.bookId } }] },
  };
  if (logementId) props["Logement"] = { relation: [{ id: logementId }] };
  await notion("pages", "POST", { parent: { database_id: MISSIONS_DB }, properties: props });
}

async function archiveMission(pageId) {
  await notion(`pages/${pageId}`, "PATCH", { archived: true });
}

/* ── Handler ── */
export default async function handler(req, res) {
  const auth = req.headers["authorization"] || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ?dry=1 : simule sans rien créer ni supprimer
  const dry = req.query?.dry === "1";

  try {
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
    const toDelete = missions.filter(m =>
      m.beds24Id && m.date >= from && m.date <= to && !activeIds.has(m.beds24Id)
    );

    // Créer les missions manquantes
    const knownIds = new Set(missions.map(m => m.beds24Id).filter(Boolean));
    const toCreate = bookings.filter(b => !knownIds.has(b.bookId));

    const unmatched = [];
    let created = 0;
    let deleted = 0;

    if (!dry) {
      for (const m of toDelete) { await archiveMission(m.id); deleted++; }
    }
    for (const b of toCreate) {
      const logementId = findLogement(logements, b);
      if (!logementId) unmatched.push(`${b.propertyName} / ${b.roomName}`);
      if (!dry) { await createMission(b, logementId); created++; }
    }

    return res.status(200).json({
      success: true,
      dry,
      window: { from, to },
      bookings: bookings.length,
      created: dry ? 0 : created,
      deleted: dry ? 0 : deleted,
      wouldCreate: dry ? toCreate.map(b => `${b.propertyName || b.roomName} — ${b.checkOut} (#${b.bookId})`) : undefined,
      wouldDelete: dry ? toDelete.map(m => `${m.nom} (#${m.beds24Id})`) : undefined,
      unmatchedLogements: [...new Set(unmatched)],
    });
  } catch (e) {
    console.error("sync-missions error:", e);
    return res.status(500).json({ error: e.message });
  }
}

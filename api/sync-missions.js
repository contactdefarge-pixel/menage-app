const MISSIONS_DB  = "3d7d50ab-a52f-8063-8153-cf398b2ee7a5";
const LOGEMENTS_DB = "365d50ab-a52f-801f-b5fd-f740a0aa78c1";

function slugify(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function plainText(prop) {
  if (!prop) return "";
  if (prop.type === "title")     return (prop.title     || []).map(t => t.plain_text).join("");
  if (prop.type === "rich_text") return (prop.rich_text || []).map(t => t.plain_text).join("");
  return "";
}

/* ── Beds24 ── */
async function getBeds24Token() {
  const refreshToken = process.env.BEDS24_REFRESH_TOKEN;
  const r = await fetch("https://beds24.com/api/v2/authentication/token", {
    method: "GET",
    headers: { "refreshToken": (refreshToken || "").trim() },
  });
  const data = await r.json();
  if (!data.token) throw new Error("Beds24 auth failed: " + JSON.stringify(data));
  return data.token;
}

async function getBeds24Bookings(token) {
  // Récupère les réservations actives des 90 prochains jours
  var today = new Date();
  var future = new Date();
  future.setDate(today.getDate() + 90);
  var from = today.toISOString().slice(0, 10);
  var to   = future.toISOString().slice(0, 10);

  const r = await fetch(
    `https://beds24.com/api/v2/bookings?departureFrom=${from}&departureTo=${to}&status=confirmed&status=new`,
    { headers: { "token": token } }
  );
  const data = await r.json();
  if (!data.success && data.code !== 200) throw new Error("Beds24 bookings failed: " + JSON.stringify(data));
  return (data.data || []).map(b => ({
    bookId:   b.id ?? b.bookId,
    checkOut: b.departure ?? b.checkOut,
    roomName: b.roomName || b.propertyName || String(b.roomId || ""),
    status:   b.status,
  }));
}

/* ── Notion Logements ── */
async function getLogementId(notionToken, roomName) {
  const r = await fetch(`https://api.notion.com/v1/databases/${LOGEMENTS_DB}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${notionToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: { property: "Nom", title: { equals: roomName } }
    }),
  });
  const data = await r.json();
  return (data.results || [])[0]?.id || null;
}

/* ── Notion Missions ── */
async function getMissionsNotion(notionToken) {
  const r = await fetch(`https://api.notion.com/v1/databases/${MISSIONS_DB}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${notionToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_size: 100 }),
  });
  const data = await r.json();
  return (data.results || []).map(page => {
    const props = page.properties || {};
    return {
      id:          page.id,
      nom:         plainText(props["Nom"]),
      beds24Id:    plainText(props["Beds24 ID"]),
      etat:        props["État"]?.status?.name || "",
    };
  });
}

async function createMission(notionToken, booking, logementId) {
  const nom = `${booking.roomName} — ${booking.checkOut}`;
  const props = {
    "Nom":       { title: [{ text: { content: nom } }] },
    "Date":      { date: { start: booking.checkOut } },
    "État":      { status: { name: "Disponible" } },
    "Beds24 ID": { rich_text: [{ text: { content: String(booking.bookId) } }] },
  };
  if (logementId) {
    props["Logement"] = { relation: [{ id: logementId }] };
  }
  await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${notionToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: MISSIONS_DB }, properties: props }),
  });
}

async function deleteMission(notionToken, pageId) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${notionToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ archived: true }),
  });
}

/* ── Handler ── */
export default async function handler(req, res) {
  // Sécurité cron
  const auth = req.headers["authorization"] || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;

  try {
    // 1. Récupérer les réservations actives Beds24
    const beds24Token = await getBeds24Token();
    const bookings    = await getBeds24Bookings(beds24Token);

    // Index des réservations actives par bookId
    const activeBookIds = new Set(bookings.map(b => String(b.bookId)));

    // 2. Récupérer les missions Notion
    const missions = await getMissionsNotion(NOTION_TOKEN);

    // 3. Supprimer les missions dont la réservation n'existe plus ou est annulée
    let deleted = 0;
    for (const mission of missions) {
      if (mission.beds24Id && !activeBookIds.has(mission.beds24Id)) {
        await deleteMission(NOTION_TOKEN, mission.id);
        deleted++;
      }
    }

    // 4. Créer les missions manquantes
    const existingBeds24Ids = new Set(missions.map(m => m.beds24Id).filter(Boolean));
    let created = 0;
    for (const booking of bookings) {
      if (existingBeds24Ids.has(String(booking.bookId))) continue;
      // Ignorer les réservations sans check-out ou sans chambre
      if (!booking.checkOut || !booking.roomName) continue;
      const logementId = await getLogementId(NOTION_TOKEN, booking.roomName);
      await createMission(NOTION_TOKEN, booking, logementId);
      created++;
    }

    return res.status(200).json({
      success: true,
      created,
      deleted,
      total: bookings.length,
    });
  } catch (e) {
    console.error("sync-missions error:", e);
    return res.status(500).json({ error: e.message });
  }
}

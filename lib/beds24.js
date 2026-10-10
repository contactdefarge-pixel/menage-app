/* Beds24 : helpers partagés (lib/ ne compte pas dans les fonctions Vercel) */

let tokenCache = { token: null, exp: 0 };
export async function getBeds24Token() {
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const refreshToken = (process.env.BEDS24_REFRESH_TOKEN || "").trim();
  const r = await fetch("https://beds24.com/api/v2/authentication/token", {
    method: "GET",
    headers: { "refreshToken": refreshToken },
  });
  const data = await r.json();
  if (!data.token) throw new Error("Beds24 auth failed: " + JSON.stringify(data));
  tokenCache = { token: data.token, exp: Date.now() + 20 * 60 * 1000 };
  return data.token;
}

export async function beds24Get(token, path) {
  const r = await fetch(`https://beds24.com/api/v2/${path}`, { headers: { token } });
  const data = await r.json();
  if (data.success === false) throw new Error(`Beds24 ${path} failed: ` + JSON.stringify(data));
  return data;
}

/* roomId -> { roomName, propertyName } */
export async function getRoomMap(token) {
  const data = await beds24Get(token, "properties?includeAllRooms=true");
  const map = {};
  for (const p of data.data || []) {
    for (const room of p.roomTypes || []) {
      map[room.id] = { roomName: room.name || "", propertyName: p.name || "" };
    }
  }
  return map;
}

const ymd = (d) => d.toISOString().slice(0, 10);
const cacheResa = new Map(); // nom logement -> { at, val }

/* Prochaine réservation (arrivée >= aujourd'hui, heure de Paris) du logement dont le Room Name = nom */
export async function prochaineReservation(nomLogement) {
  const cle = String(nomLogement || "").trim().toLowerCase();
  if (!cle || !process.env.BEDS24_REFRESH_TOKEN) return null;
  const c = cacheResa.get(cle);
  if (c && Date.now() - c.at < 5 * 60 * 1000) return c.val;

  const token = await getBeds24Token();
  const rooms = await getRoomMap(token);
  const roomIds = Object.keys(rooms).filter(id => (rooms[id].roomName || "").trim().toLowerCase() === cle);
  if (!roomIds.length) { cacheResa.set(cle, { at: Date.now(), val: null }); return null; }

  const auj = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const fin = ymd(new Date(Date.now() + 120 * 86400000));
  const q = roomIds.map(id => `roomId=${id}`).join("&");
  const data = await beds24Get(token, `bookings?${q}&arrivalFrom=${auj}&arrivalTo=${fin}&status=confirmed&status=new`);
  const resas = (data.data || [])
    .filter(b => b.arrival && !/INQUIRE/i.test(`${b.firstName || ""} ${b.lastName || ""}`))
    .sort((a, b) => String(a.arrival).localeCompare(String(b.arrival)));
  const b = resas[0];
  const val = b ? {
    arrivee: b.arrival,
    depart: b.departure || "",
    adultes: Number(b.numAdult) || 0,
    enfants: Number(b.numChild) || 0,
    prenom: (b.firstName || "").trim(),
    nom: (b.lastName || "").trim(),
    heureArrivee: (b.arrivalTime || "").trim(),
    canal: (b.referer || b.channel || "").trim(),
  } : null;
  cacheResa.set(cle, { at: Date.now(), val });
  return val;
}

import React, { useState, useRef, useCallback, useEffect } from "react";

const PIECES = [
  { id: "cuisine", label: "Cuisine", exemples: "Vue générale, évier, plaques/micro-ondes" },
  { id: "sdb", label: "Salle de bain", exemples: "Douche, lavabo/miroir, bondes et sol" },
  { id: "wc", label: "Toilettes", exemples: "WC général, VMC allumée" },
  { id: "chambre", label: "Chambre", exemples: "Lit fait, canapé-lit rangé, vue générale" },
  { id: "entree", label: "Entrée et Salon", exemples: "Couloir, salon général" },
];

const CONSOMMABLES_LAISSER = [
  { id: "cafe", label: "Dosettes café", qt: "x4" },
  { id: "the", label: "Thé (2 de chaque variété)", qt: "x4" },
  { id: "sucre", label: "Buchettes de sucre", qt: "x6" },
  { id: "papier", label: "Papier toilette", qt: "x2" },
  { id: "essuie", label: "Essuie-tout", qt: "x1" },
  { id: "eponge", label: "Éponge (à changer)", qt: "x1" },
];

const CONSOMMABLES_VERIFIER = [
  "Liquide vaisselle", "Gel WC", "Savon main", "Gel douche", "Huile", "Sel", "Poivre",
  "Sacs poubelles", "Sacs poubelles SdB", "Décap' Four", "Cif", "Fongicide",
];

const STORAGE_KEY = "menage_draft";

const DEFAULT_LOGEMENT = {
  nom: "",
  slug: "",
  adresse: "",
  wifi: "",
  voyageurs: "",
  lits: "",
  acces: "",
  boiteCle: "",
  poubelles: "",
  consommables: "",
  consommablesALaisser: "",
  proprietaire: "",
};

function padTwo(n) { return String(n).padStart(2, "0"); }

function getStamp() {
  var d = new Date();
  var date = padTwo(d.getDate()) + "/" + padTwo(d.getMonth() + 1) + "/" + d.getFullYear();
  var time = padTwo(d.getHours()) + "h" + padTwo(d.getMinutes());
  return date + "  " + time;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanNotionText(value) {
  return String(value || "").replace(/<br\s*\/?>/gi, "\n").trim();
}

function normalizeLogement(raw) {
  raw = raw || {};
  return {
    id: raw.id || "",
    slug: raw.slug || slugify(raw.nom),
    nom: raw.nom || "",
    adresse: raw.adresse || "",
    wifi: raw.wifi || "",
    voyageurs: raw.voyageurs || "",
    chambres: raw.chambres || "",
    lits: raw.lits || "",
    acces: raw.acces || "",
    boiteCle: raw.boiteCle || "",
    poubelles: raw.poubelles || "",
    consommables: raw.consommables || "",
    consommablesALaisser: raw.consommablesALaisser || "",
    photosReference: raw.photosReference || [],
    pointsAttention: raw.pointsAttention || "",
    proprietaire: raw.proprietaire || "",
  };
}

function parseConsommablesALaisser(text) {
  if (!text) return [];
  return text.split("\n").map(function(line) {
    line = line.trim();
    if (!line) return null;
    var qtMatch = line.match(/x(\d+)/i);
    var qt = qtMatch ? "x" + qtMatch[1] : "";
    var commentMatch = line.match(/\(([^)]+)\)/);
    var comment = commentMatch ? commentMatch[1] : "";
    var nom = line
      .replace(/x\d+/i, "")
      .replace(/\([^)]+\)/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!nom) return null;
    return { label: nom, qt: qt, comment: comment };
  }).filter(Boolean);
}
/*
var POINTS_EMOJI_MAP = [
  { keys: ["fenêtre", "fenetre", "aération", "aérer", "aeration", "humidité", "humidite", "ventil"], emoji: "🪟" },
  { keys: ["douche", "bonde", "bondes", "cheveux", "siphon", "évacuation", "evacuation"], emoji: "🚿" },
  { keys: ["vmc", "ventilation", "toilette", "wc", "extraction"], emoji: "💨" },
  { keys: ["poubelle", "déchet", "dechet", "tri", "sac"], emoji: "🗑️" },
  { keys: ["lit", "parure", "drap", "coussin", "oreiller", "couette"], emoji: "🛏️" },
  { keys: ["porte", "clé", "cle", "code", "boite", "boîte", "accès", "acces", "fermer", "fermer"], emoji: "🔑" },
  { keys: ["cuisine", "four", "plaque", "micro", "frigo", "réfrigérateur", "refrigerateur", "vaisselle"], emoji: "🍳" },
  { keys: ["lumière", "lumiere", "lampe", "éclairage", "eclairage", "électricité", "electricite"], emoji: "💡" },
  { keys: ["chauffage", "thermostat", "température", "temperature", "climatisation"], emoji: "🌡️" },
  { keys: ["wifi", "internet", "box", "routeur"], emoji: "📶" },
  { keys: ["photo", "image", "appareil"], emoji: "📷" },
  { keys: ["canapé", "canape", "salon", "meuble", "coussin"], emoji: "🛋️" },
  { keys: ["bain", "baignoire", "lavabo", "robinet"], emoji: "🛁" },
  { keys: ["sécurité", "securite", "alarme", "digicode"], emoji: "🔒" },
  { keys: ["araignées", "araigné"], emoji: "🕸️" },
];
*/
function getEmojiForPoint(text) {
  var lower = text.toLowerCase();
  for (var i = 0; i < length; i++) {
    var entry = [i];
    for (var j = 0; j < entry.keys.length; j++) {
      if (lower.includes(entry.keys[j])) return entry.emoji;
    }
  }
  return <IconCircleCheck />;
}

function parsePointsAttention(text) {
  if (!text) return [];
  return text.split("\n")
    .map(function(line) { return line.trim().replace(/^[•\-\*]\s*/, ""); })
    .filter(Boolean)
    .map(function(line) {
      return { text: line, emoji: getEmojiForPoint(line) };
    });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function processPhoto(file) {
  return new Promise(function(resolve) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function() {
      var maxW = 2400;
      var scale = img.width > maxW ? maxW / img.width : 1;
      var w = Math.round(img.width * scale);
      var h = Math.round(img.height * scale);
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      var stamp = getStamp();
      var fontSize = Math.max(18, Math.round(w * 0.025));
      ctx.font = "bold " + fontSize + "px monospace";
      var tw = ctx.measureText(stamp).width;
      var pad = fontSize * 0.6;
      var bh = fontSize + pad * 2;
      var bw = tw + pad * 2;
      var margin = fontSize * 0.8;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      roundRect(ctx, margin, h - bh - margin, bw, bh, 6);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(stamp, margin + pad, h - margin - pad);
      canvas.toBlob(function(blob) {
        URL.revokeObjectURL(url);
        resolve(new File([blob], file.name, { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    };
    img.src = url;
  });
}

function useScreenWakeLock(active) {
  var [status, setStatus] = useState("idle");
  var wakeLockRef = useRef(null);

  useEffect(function() {
    var cancelled = false;

    function releaseWakeLock() {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(function() {});
        wakeLockRef.current = null;
      }
    }

    function requestWakeLock() {
      if (!active) { releaseWakeLock(); setStatus("idle"); return; }
      if (!("wakeLock" in navigator)) { setStatus("unsupported"); return; }
      if (document.visibilityState !== "visible") { setStatus("waiting"); return; }
      navigator.wakeLock.request("screen")
        .then(function(lock) {
          if (cancelled) { lock.release().catch(function() {}); return; }
          wakeLockRef.current = lock;
          setStatus("active");
          lock.addEventListener("release", function() {
            if (!cancelled && active) setStatus("waiting");
          });
        })
        .catch(function() { if (!cancelled) setStatus("blocked"); });
    }

    function handleVisibilityChange() {
      if (active && document.visibilityState === "visible" && !wakeLockRef.current) requestWakeLock();
    }

    requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return function() {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, [active]);

  return status;
}

function IconWifi() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#085157" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="#085157"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#085157" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#085157" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#085157" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}
function IconKey() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#085157" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="56" height="56" rx="18" fill="#dcfce7"/>
      <rect x="8" y="8" width="56" height="56" rx="18" stroke="#86efac" strokeWidth="2"/>
      <path d="M24 36.5L32.2 44L49 28" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconCheckSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.5 10.4L8.1 14L15.8 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconReceipt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#085157" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/>
      <line x1="8" y1="8" x2="16" y2="8"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
      <line x1="8" y1="16" x2="12" y2="16"/>
    </svg>
  );
}

function IconCircleCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2CA7A9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 12.5l3 3 5-5.5"/>
    </svg>
  );
}

function ProgressBar({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
      {Array.from({ length: total }).map(function(_, i) {
        return (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i < current ? "#2CA7A9" : i === current ? "#99dedd" : "#cfe4e9",
            transition: "background 0.3s",
          }} />
        );
      })}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontFamily: "var(--font-heading)",
      fontSize: 22, fontWeight: 700, color: "var(--color-primary-dark)",
      margin: "0 0 6px 0", letterSpacing: "-0.01em",
    }}>
      {children}
    </h2>
  );
}

function Subtitle({ children }) {
  return (
    <p style={{
      fontFamily: "var(--font-body)",
      color: "var(--color-text-muted)", fontSize: 14,
      margin: "0 0 24px 0", lineHeight: 1.55,
    }}>
      {children}
    </p>
  );
}


function InfoCard({ icon, children }) {
  return (
    <div style={{
      background: "#D8EDF2", border: "1px solid #99dedd",
      borderRadius: 12, padding: "13px 15px", marginBottom: 14,
      fontSize: 14, color: "#085157", lineHeight: 1.6,
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      {icon ? <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div> : null}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#085157", marginBottom: 6 }}>
        {label}{required ? <span style={{ color: "#ef4444" }}> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function KeepAwakeWarning({ title, children, wakeLockStatus }) {
  var statusText = "";
  if (wakeLockStatus === "active") statusText = "Écran maintenu éveillé pendant cette opération.";
  else if (wakeLockStatus === "unsupported") statusText = "Votre navigateur ne permet pas de bloquer automatiquement la veille.";
  else if (wakeLockStatus === "blocked" || wakeLockStatus === "waiting") statusText = "Maintien de l'écran éveillé indisponible pour le moment.";

  return (
    <div style={{
      background: "#fff7ed", border: "2px solid #fb923c", borderRadius: 14,
      padding: "14px 16px", marginBottom: 16, color: "#9a3412",
      boxShadow: "0 8px 20px rgba(251,146,60,0.12)",
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ fontSize: 22, lineHeight: 1 }}>!</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.4px" }}>{title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>{children}</div>
          {statusText ? <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 8, color: "#c2410c" }}>{statusText}</div> : null}
        </div>
      </div>
    </div>
  );
}

var baseInput = {
  width: "100%", padding: "12px 14px", border: "2px solid #cfe4e9",
  borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box",
  fontFamily: "inherit", background: "#fff",
};

function Input({ value, onChange, placeholder, type }) {
  type = type || "text";
  return (
    <input type={type} value={value} placeholder={placeholder || ""}
      onChange={function(e) { onChange(e.target.value); }}
      style={baseInput}
      onFocus={function(e) { e.target.style.borderColor = "#2CA7A9"; }}
      onBlur={function(e) { e.target.style.borderColor = "#cfe4e9"; }}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows }) {
  rows = rows || 4;
  return (
    <textarea value={value} placeholder={placeholder || ""} rows={rows}
      onChange={function(e) { onChange(e.target.value); }}
      style={Object.assign({}, baseInput, { resize: "vertical" })}
      onFocus={function(e) { e.target.style.borderColor = "#2CA7A9"; }}
      onBlur={function(e) { e.target.style.borderColor = "#cfe4e9"; }}
    />
  );
}

function Btn({ onClick, disabled, children, secondary }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: "13px 24px", borderRadius: 12, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "#cfe4e9" : secondary ? "#eaf4f6" : "linear-gradient(135deg,#2CA7A9,#085157)",
        color: disabled ? "#94a3b8" : secondary ? "#5b7f84" : "#fff",
        fontWeight: 700, fontSize: 15,
        boxShadow: "none",
      }}
    >{children}</button>
  );
}

function StarRating({ value, onChange }) {
  var [hov, setHov] = useState(0);
  return (
    <div style={{ display: "flex", gap: 8, margin: "6px 0" }}>
      {[1,2,3,4,5].map(function(s) {
        var active = s <= (hov || value);
        return (
          <button key={s}
            onClick={function() { onChange(s); }}
            onMouseEnter={function() { setHov(s); }}
            onMouseLeave={function() { setHov(0); }}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: 36, lineHeight: 1,
              color: active ? "#f59e0b" : "#cfe4e9",
              transform: active ? "scale(1.15)" : "scale(1)",
              transition: "color 0.15s, transform 0.1s",
              filter: active ? "drop-shadow(0 1px 2px rgba(245,158,11,0.4))" : "none",
            }}
          >&#9733;</button>
        );
      })}
    </div>
  );
}

function CopyRow({ label, value }) {
  var [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(function() {
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 2000);
    });
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
      <span><strong>{label} :</strong> {value}</span>
      <button onClick={copy} style={{
        background: copied ? "#dcfce7" : "#D8EDF2", border: "none", borderRadius: 8,
        cursor: "pointer", padding: "4px 10px", fontSize: 13, marginLeft: 10,
        color: copied ? "#16a34a" : "#085157", fontWeight: 600, flexShrink: 0,
      }}>{copied ? "Copié !" : "Copier"}</button>
    </div>
  );
}

function CopyAdresse({ adresse }) {
  var [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(adresse).then(function() {
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 2000);
    });
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <span style={{ color: "#5b7f84", fontSize: 14 }}>{adresse}</span>
      <button onClick={copy} style={{
        background: copied ? "#dcfce7" : "#D8EDF2", border: "none", borderRadius: 8,
        cursor: "pointer", padding: "4px 10px", fontSize: 13, marginLeft: 10,
        color: copied ? "#16a34a" : "#085157", fontWeight: 600, flexShrink: 0,
      }}>{copied ? "Copié !" : "Copier"}</button>
    </div>
  );
}

function MapsLink({ url }) {
  return React.createElement("a", {
    href: url,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      color: "#2CA7A9",
      fontWeight: 700,
      textDecoration: "none",
      borderBottom: "1px solid #99dedd",
    }
  }, "Voir sur Maps");
}

function FormattedText({ children }) {
  var lines = cleanNotionText(children).split("\n").filter(function(line) { return line.trim(); });
  var mapsRegex = /https?:\/\/(maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl|www\.google\.[a-z.]+\/maps)[^\s]*/i;

  function renderSegments(line) {
    var parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map(function(part, j) {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return <span key={j}>{part}</span>;
    });
  }

  return (
    <span>
      {lines.map(function(line, i) {
        var mapsMatch = line.match(mapsRegex);
        if (mapsMatch) {
          var url = mapsMatch[0];
          var before = line.slice(0, mapsMatch.index).trim();
          return (
            <span key={i}>
              {before ? before + " " : null}
              <MapsLink url={url} />
              {i < lines.length - 1 ? <br /> : null}
            </span>
          );
        }
        return (
          <span key={i}>
            {renderSegments(line)}
            {i < lines.length - 1 ? <br /> : null}
          </span>
        );
      })}
    </span>
  );
}

function InfoCardWithCopy({ icon, title, text }) {
  if (!cleanNotionText(text)) return null;
  return (
    <InfoCard icon={icon}>
      <strong>{title}</strong><br />
      <FormattedText>{text}</FormattedText>
    </InfoCard>
  );
}

function LogementLoading({ error }) {
  return (
    <div style={{ background: "#F6FBFC", border: "1px solid #cfe4e9", borderRadius: 14, padding: 16, marginBottom: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#085157", marginBottom: 4 }}>
        {error ? "Logement chargé en mode secours" : "Chargement du logement"}
      </div>
      <div style={{ fontSize: 13, color: error ? "#b45309" : "#5b7f84", lineHeight: 1.5 }}>
        {error || "Récupération des informations depuis Notion..."}
      </div>
    </div>
  );
}

function ResumeModal({ saved, onResume, onRestart }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: 28,
        maxWidth: 360, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{ fontSize: 36, marginBottom: 12, textAlign: "center" }}>&#128221;</div>
        <h3 style={{ fontWeight: 800, fontSize: 18, color: "#085157", textAlign: "center", margin: "0 0 8px 0" }}>
          Formulaire en cours
        </h3>
        <p style={{ fontSize: 14, color: "#5b7f84", textAlign: "center", margin: "0 0 24px 0", lineHeight: 1.5 }}>
          Un formulaire non terminé a été trouvé pour <strong>{saved.arrivee && saved.arrivee.bien ? saved.arrivee.bien : "ce logement"}</strong>. Voulez-vous reprendre où vous en étiez ?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn onClick={onResume}>Reprendre le formulaire</Btn>
          <Btn secondary onClick={onRestart}>Recommencer à zéro</Btn>
        </div>
      </div>
    </div>
  );
}

function Step1Infos({ logement, loading, error, onNext }) {
  var voyageurs = logement.voyageurs ? logement.voyageurs + " max" : "";
  var voyageursText = [voyageurs, cleanNotionText(logement.lits)].filter(Boolean).join("\n");
  var accesText = cleanNotionText(logement.acces);
  if (logement.boiteCle) accesText += (accesText ? "\n" : "") + "**Code boîte à clé : " + logement.boiteCle + "**";

  return (
    <div>
      {loading || error ? <LogementLoading error={error} /> : null}
      <SectionTitle>{logement.nom}</SectionTitle>
      <CopyAdresse adresse={logement.adresse} />
      <InfoCardWithCopy icon={<IconReceipt />} title="Facturation à adresser à" text={logement.proprietaire} />
      <InfoCardWithCopy icon={<IconWifi />} title="WiFi" text={logement.wifi} />
      <InfoCardWithCopy icon={<IconUsers />} title="Voyageurs" text={voyageursText} />
      <InfoCardWithCopy icon={<IconTrash />} title="Poubelles" text={logement.poubelles} />
      <InfoCardWithCopy icon={<IconBox />} title="Consommables" text={logement.consommables} />
      <InfoCardWithCopy icon={<IconKey />} title="Accès logement" text={accesText} />
      <Btn onClick={onNext}>Suivant</Btn>
    </div>
  );
}

function Step2Arrivee({ data, setData, onNext, onPrev }) {
  var ok = data.date && data.heureDebut && data.nom && data.bien;
  return (
    <div>
      <SectionTitle>Arrivée sur les lieux</SectionTitle>
      <Subtitle>Renseignez les informations de début d'intervention.</Subtitle>
      <Field label="Date" required>
        <Input type="date" value={data.date} onChange={function(v) { setData(Object.assign({}, data, { date: v })); }} />
      </Field>
      <Field label="Heure de début" required>
        <Input type="time" value={data.heureDebut} onChange={function(v) { setData(Object.assign({}, data, { heureDebut: v })); }} />
      </Field>
      <Field label="Prénom, Nom" required>
        <Input value={data.nom} onChange={function(v) { setData(Object.assign({}, data, { nom: v })); }} placeholder="Marie Dupont" />
      </Field>
      <Field label="Nom du bien" required>
        <Input value={data.bien} onChange={function(v) { setData(Object.assign({}, data, { bien: v })); }} />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev}>Retour</Btn>
        <Btn onClick={onNext} disabled={!ok}>Suivant</Btn>
      </div>
    </div>
  );
}

function Step3Attention({ data, setData, logement, onNext, onPrev }) {
  var points = parsePointsAttention(logement && logement.pointsAttention);
  if (points.length === 0) {
    points = [
      { emoji: "", text: "" },
      { emoji: "", text: "" },
      { emoji: "", text: "" },
    ];
  }
  return (
    <div>
      <SectionTitle>Points d'attention</SectionTitle>
      <Subtitle>Merci de prendre connaissance de ces consignes avant de commencer.</Subtitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {points.map(function(pt, i) {
          return (
            <div key={i} style={{
              display: "flex", gap: 14, padding: "14px 16px",
              background: "#fff", borderRadius: 14,
              fontSize: 14, color: "#085157", lineHeight: 1.5,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px #cfe4e9",
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{pt.emoji}</span>
              <span>{pt.text}</span>
            </div>
          );
        })}
      </div>
      <div
        onClick={function() { setData(Object.assign({}, data, { lu: !data.lu })); }}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 18px", borderRadius: "var(--radius-md)", cursor: "pointer",
          background: data.lu ? "var(--color-primary-soft)" : "var(--color-surface)",
          border: "2px solid " + (data.lu ? "var(--color-primary)" : "var(--color-border)"),
          marginBottom: 24, transition: "all 0.2s",
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, filter: data.lu ? "none" : "grayscale(1) opacity(0.5)" }}>
          ✅
        </span>
        <span style={{ fontSize: 14, color: "var(--color-primary-dark)", fontWeight: 600, fontFamily: "var(--font-body)" }}>
          J'ai pris connaissance des points d'attention
        </span>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev}>Retour</Btn>
        <Btn onClick={onNext} disabled={!data.lu}>Suivant</Btn>
      </div>
    </div>
  );
}

function Step4EtatLieux({ data, setData, photosArrivee, setPhotosArrivee, onNext, onPrev }) {
  var [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  var ok = data.note > 0 && data.observations;
  return (
    <div>
      <SectionTitle>État des lieux</SectionTitle>
      <Subtitle>
        Vérifiez l'appartement à votre arrivée. À la moindre anomalie, prenez des photos — c'est crucial pour les réclamations.
      </Subtitle>
      <Field label="Notez les voyageurs" required>
        <StarRating value={data.note} onChange={function(v) { setData(Object.assign({}, data, { note: v })); }} />
      </Field>
      <Field label="Observations à l'arrivée" required>
        <Textarea
          value={data.observations}
          onChange={function(v) { setData(Object.assign({}, data, { observations: v })); }}
          placeholder="Problèmes constatés. Sinon écrire RAS."
        />
      </Field>
      <PhotoModule
        photos={photosArrivee}
        setPhotos={setPhotosArrivee}
        title="Photos à l'arrivée"
        subtitle="Ajoutez des photos si le logement a été laissé sale ou dégradé."
        infoTitle="Photos utiles"
        infoItems={[
          { id: "salete", label: "Saleté", exemples: "Sol, évier, sanitaires, linge ou déchets laissés" },
          { id: "degradation", label: "Dégradations", exemples: "Objets cassés, murs, mobilier, traces ou dommages visibles" },
        ]}
        emptyLabel="Ajouter des photos d'arrivée"
        addLabel="Ajouter d'autres photos d'arrivée"
        required={false}
        onProcessingChange={setIsProcessingPhotos}
      />
      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev} disabled={isProcessingPhotos}>Retour</Btn>
        <Btn onClick={onNext} disabled={!ok || isProcessingPhotos}>Suivant</Btn>
      </div>
    </div>
  );
}

function Step5Consommables({ data, setData, logement, onNext, onPrev }) {
  var ok = data.consommablesAPrevoir !== undefined && data.remarques !== undefined && data.heureFin;
  var selected = data.consommablesSelectionnes || [];

  function toggleConso(c) {
    var next = selected.includes(c)
      ? selected.filter(function(x) { return x !== c; })
      : selected.concat([c]);
    setData(Object.assign({}, data, {
      consommablesSelectionnes: next,
      consommablesAPrevoir: next.join(", "),
    }));
  }

  var itemsALaisser = parseConsommablesALaisser(logement && logement.consommablesALaisser);
  if (itemsALaisser.length === 0) itemsALaisser = CONSOMMABLES_LAISSER;

  return (
    <div>
      <SectionTitle>Consommables</SectionTitle>
      {logement.consommables ? <Subtitle><FormattedText>{logement.consommables}</FormattedText></Subtitle> : null}

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#085157", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          À laisser (compléter pour atteindre la quantité)
        </div>
        {itemsALaisser.map(function(c, i) {
          return (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 13px", background: "#F6FBFC", borderRadius: 8,
              fontSize: 14, marginBottom: 6,
            }}>
              <span style={{ flex: 1 }}>
                {c.label}
                {c.comment ? <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: 6 }}>({c.comment})</span> : null}
              </span>
              {c.qt ? <span style={{ background: "#D8EDF2", color: "#085157", fontWeight: 700, borderRadius: 6, padding: "2px 10px", fontSize: 13, flexShrink: 0 }}>{c.qt}</span> : null}
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#085157", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          À vérifier
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
          Appuyez sur un article s'il faut le réapprovisionner pour la prochaine fois.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CONSOMMABLES_VERIFIER.map(function(c) {
            var isSelected = selected.includes(c);
            return (
              <button key={c}
                onClick={function() { toggleConso(c); }}
                style={{
                  padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s", border: "none",
                  background: isSelected ? "#2CA7A9" : "#eaf4f6",
                  color: isSelected ? "#fff" : "#5b7f84",
                  boxShadow: isSelected ? "0 2px 8px rgba(14,165,233,0.35)" : "none",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >{isSelected ? <IconCheckSmall /> : null}<span>{c}</span></button>
            );
          })}
        </div>
        {selected.length > 0 ? (
          <div style={{ marginTop: 10, fontSize: 13, color: "#2CA7A9", fontWeight: 600 }}>
            {selected.length} article(s) à prévoir sélectionné(s)
          </div>
        ) : null}
      </div>

      <Field label="Consommables à prévoir" required>
        <Textarea
          value={data.consommablesAPrevoir || ""}
          onChange={function(v) { setData(Object.assign({}, data, { consommablesAPrevoir: v })); }}
          placeholder="Notez les consommables manquants à réapprovisionner."
          rows={3}
        />
      </Field>
      <Field label="Remarques sur le logement" required>
        <Textarea
          value={data.remarques || ""}
          onChange={function(v) { setData(Object.assign({}, data, { remarques: v })); }}
          placeholder="Interventions à prévoir, anomalies constatées..."
          rows={3}
        />
      </Field>
      <Field label="Heure de fin d'intervention" required>
        <Input type="time" value={data.heureFin || ""} onChange={function(v) { setData(Object.assign({}, data, { heureFin: v })); }} />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev}>Retour</Btn>
        <Btn onClick={onNext} disabled={!ok}>Suivant</Btn>
      </div>
    </div>
  );
}

function PhotoModule({ photos, setPhotos, title, subtitle, infoTitle, infoItems, emptyLabel, addLabel, required, onProcessingChange }) {
  var inputRef = useRef();
  var [progress, setProgress] = useState({ current: 0, total: 0 });
  var isProcessing = progress.total > 0;
  var wakeLockStatus = useScreenWakeLock(isProcessing);

  useEffect(function() {
    if (onProcessingChange) onProcessingChange(isProcessing);
  }, [isProcessing, onProcessingChange]);

  var handleFiles = useCallback(function(files) {
    var arr = Array.from(files).filter(function(f) { return f.type.startsWith("image/"); });
    if (arr.length === 0) return;
    setProgress({ current: 0, total: arr.length });
    var results = [];
    var index = 0;
    function processNext() {
      if (index >= arr.length) {
        setPhotos(function(prev) { return prev.concat(results); });
        setProgress({ current: 0, total: 0 });
        return;
      }
      var current = index;
      setTimeout(function() {
        processPhoto(arr[current]).then(function(stamped) {
          results.push({
            id: Math.random().toString(36).slice(2),
            file: stamped,
            preview: URL.createObjectURL(stamped),
            name: arr[current].name,
          });
          index++;
          setProgress({ current: index, total: arr.length });
          processNext();
        });
      }, 50);
    }
    processNext();
  }, [setPhotos]);

  function remove(id) {
    setPhotos(function(prev) { return prev.filter(function(p) { return p.id !== id; }); });
  }

  var pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  var btnLabel = photos.length === 0 ? emptyLabel : addLabel;

  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <Subtitle>{subtitle}</Subtitle>

      <div style={{ background: "#D8EDF2", border: "1px solid #99dedd", borderRadius: 12, padding: "12px 15px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#085157", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>{infoTitle}</div>
        {infoItems.map(function(p) {
          return (
            <div key={p.id} style={{ fontSize: 13, color: "#085157", marginBottom: 3 }}>
              <strong>{p.label}</strong> — {p.exemples}
            </div>
          );
        })}
      </div>

      {isProcessing ? (
        <div>
          <KeepAwakeWarning title="Traitement en cours" wakeLockStatus={wakeLockStatus}>
            Gardez cette page ouverte et le téléphone déverrouillé jusqu'à la fin de l'horodatage et de la compression.
          </KeepAwakeWarning>
          <div style={{ background: "#D8EDF2", border: "1px solid #99dedd", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#085157", marginBottom: 8 }}>
              Traitement {progress.current} / {progress.total} ({pct}%)
            </div>
            <div style={{ background: "#D8EDF2", borderRadius: 8, height: 10, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ background: "#2CA7A9", height: "100%", width: pct + "%", transition: "width 0.2s", borderRadius: 8 }} />
            </div>
            <div style={{ fontSize: 12, color: "#5b7f84", fontWeight: 700 }}>Ne quittez pas cette page. Ne verrouillez pas l'écran.</div>
          </div>
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5b7f84", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {photos.length} photo(s) prête(s)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {photos.map(function(p) {
              return (
                <div key={p.id} style={{ position: "relative" }}>
                  <img src={p.preview} alt={p.name} style={{
                    width: "100%", aspectRatio: "1", objectFit: "cover",
                    borderRadius: 10, border: "2px solid #2CA7A9", display: "block",
                  }} />
                  <button onClick={function() { remove(p.id); }} style={{
                    position: "absolute", top: 4, right: 4,
                    background: "rgba(0,0,0,0.6)", color: "#fff",
                    border: "none", borderRadius: "50%",
                    width: 22, height: 22, cursor: "pointer",
                    fontSize: 12, lineHeight: "22px", textAlign: "center", padding: 0,
                  }}>x</button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div
        onClick={function() { if (!isProcessing && inputRef.current) inputRef.current.click(); }}
        style={{
          border: "2px dashed " + (isProcessing ? "#cfe4e9" : "#99dedd"),
          borderRadius: 14, padding: "28px 20px", textAlign: "center",
          cursor: isProcessing ? "not-allowed" : "pointer",
          background: "#F6FBFC", marginBottom: 24, opacity: isProcessing ? 0.5 : 1,
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#085157", marginBottom: 4 }}>{btnLabel}</div>
        <div style={{ fontSize: 13, color: "#5b7f84" }}>Appuyez pour choisir depuis votre galerie</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
          Sélection multiple · Horodatage automatique · Compression incluse
        </div>
        {!required && photos.length === 0 ? (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Optionnel</div>
        ) : null}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={function(e) { handleFiles(e.target.files); }} />
    </div>
  );
}

function PhotoWarningModal({ expected, actual, onConfirm, onCancel }) {
  var missing = expected - actual;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: 28,
        maxWidth: 360, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{ fontSize: 44, textAlign: "center", marginBottom: 12 }}>✋</div>
        <h3 style={{ fontWeight: 800, fontSize: 18, color: "#085157", textAlign: "center", margin: "0 0 12px 0" }}>
          Photos manquantes
        </h3>
        <p style={{ fontSize: 14, color: "#5b7f84", textAlign: "center", margin: "0 0 8px 0", lineHeight: 1.5 }}>
          Vous avez uploadé <strong>{actual} photo{actual > 1 ? "s" : ""}</strong> sur <strong>{expected} attendue{expected > 1 ? "s" : ""}</strong>.
        </p>
        <p style={{ fontSize: 14, color: "#5b7f84", textAlign: "center", margin: "0 0 24px 0", lineHeight: 1.5 }}>
          Il manque <strong style={{ color: "#dc2626" }}>{missing} photo{missing > 1 ? "s" : ""}</strong>. Voulez-vous continuer quand même ?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn secondary onClick={onConfirm}>Continuer quand même</Btn>
          <Btn onClick={onCancel}>Ajouter les photos manquantes</Btn>
        </div>
      </div>
    </div>
  );
}

function Step6Photos({ photos, setPhotos, logement, onNext, onPrev }) {
  var [isProcessing, setIsProcessing] = useState(false);
  var [showWarning, setShowWarning] = useState(false);

  var expectedCount = logement && logement.photosReference
    ? logement.photosReference.length
    : 0;

  function handleNext() {
    if (expectedCount > 0 && photos.length < expectedCount) {
      setShowWarning(true);
    } else {
      onNext();
    }
  }

  var suivantLabel = "Suivant (" + photos.length + " photo" + (photos.length > 1 ? "s" : "") + ")";

  var PIECES_ALIASES = {
    "cuisine": ["cuisine"],
    "salle de bain": ["salle de bain", "sdb", "salle_de_bain", "bathroom"],
    "wc": ["wc", "toilette", "toilettes"],
    "chambre": ["chambre", "bedroom"],
    "entree": ["entree", "entrée", "couloir", "hall"],
    "salon": ["salon", "living", "séjour", "sejour"],
  };

  var PIECES_LABELS = {
    "cuisine": "Cuisine",
    "salle de bain": "Salle de bain",
    "wc": "WC",
    "chambre": "Chambre",
    "entree": "Entree",
    "salon": "Salon",
  };

  function grouperParPiece(photosRef) {
    var groupes = {};
    (photosRef || []).forEach(function(p) {
      var nomLower = p.nom.toLowerCase().replace(/_/g, " ").replace(/\.[^.]+$/, "");
      var pieceKey = Object.keys(PIECES_ALIASES).find(function(key) {
        return PIECES_ALIASES[key].some(function(alias) {
          return nomLower.startsWith(alias.toLowerCase());
        });
      }) || "autre";
      if (!groupes[pieceKey]) groupes[pieceKey] = [];
      groupes[pieceKey].push(p);
    });
    return groupes;
  }

  var groupes = grouperParPiece(logement && logement.photosReference);

  return (
    <div>
      {showWarning ? (
        <PhotoWarningModal
          expected={expectedCount}
          actual={photos.length}
          onConfirm={function() { setShowWarning(false); onNext(); }}
          onCancel={function() { setShowWarning(false); }}
        />
      ) : null}

      {Object.keys(groupes).length > 0 ? (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#085157", marginBottom: 4 }}>
            Photos de reference
          </div>
          <div style={{ fontSize: 13, color: "#5b7f84", marginBottom: 16 }}>
            Reproduisez ces photos pour chaque piece.
          </div>
          {Object.entries(groupes).map(function(entry) {
            var pieceKey = entry[0];
            var photosGroupe = entry[1];
            return (
              <div key={pieceKey} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#085157", marginBottom: 8 }}>
                  {PIECES_LABELS[pieceKey] || pieceKey}
                </div>
                <div style={{ columns: 2, gap: 8 }}>
                  {photosGroupe.map(function(p, i) {
                    return (
                      <img key={i} src={p.url} alt={p.nom} loading="lazy" style={{
                        width: "100%", marginBottom: 8, borderRadius: 10,
                        border: "2px solid #99dedd", display: "block", breakInside: "avoid",
                      }} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <PhotoModule
        photos={photos}
        setPhotos={setPhotos}
        title="Photos de fin de menage"
        subtitle="Selectionnez toutes vos photos en une seule fois."
        infoTitle="Photos attendues"
        infoItems={PIECES}
        emptyLabel="Selectionner les photos"
        addLabel="Ajouter d'autres photos"
        required={true}
        onProcessingChange={setIsProcessing}
      />

      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev} disabled={isProcessing}>Retour</Btn>
        <Btn onClick={handleNext} disabled={photos.length === 0 || isProcessing}>{suivantLabel}</Btn>
      </div>
    </div>
  );
}

function Step7Recap({ arrivee, etatLieux, consommables, photosArrivee, photos, onPrev, onSubmit, sending, sendError, sendProgress }) {
  var etoiles = "";
  for (var i = 0; i < etatLieux.note; i++) etoiles += "★";
  for (var j = etatLieux.note; j < 5; j++) etoiles += "☆";
  var duree = arrivee.heureDebut + (consommables.heureFin ? " - " + consommables.heureFin : "");
  var selected = consommables.consommablesSelectionnes || [];
  var wakeLockStatus = useScreenWakeLock(sending);

  return (
    <div>
      <SectionTitle>Récapitulatif</SectionTitle>
      <Subtitle>Vérifiez les informations avant d'envoyer le rapport.</Subtitle>

      <div style={{ background: "#F6FBFC", borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#5b7f84", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Intervention</div>
        <div style={{ fontSize: 14, color: "#085157", lineHeight: 1.9 }}>
          <div>{arrivee.nom}</div>
          <div>{arrivee.date} — {duree}</div>
          <div>{arrivee.bien}</div>
        </div>
      </div>

      <div style={{ background: "#F6FBFC", borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#5b7f84", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>État des lieux</div>
        <div style={{ fontSize: 14, color: "#085157", lineHeight: 1.9 }}>
          <div style={{ color: "#f59e0b", fontSize: 18 }}>{etoiles}</div>
          <div>{etatLieux.observations}</div>
        </div>
      </div>

      {selected.length > 0 ? (
        <div style={{ background: "#F6FBFC", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#5b7f84", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Consommables à réapprovisionner</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {selected.map(function(c) {
              return <span key={c} style={{ background: "#D8EDF2", color: "#085157", borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 600 }}>{c}</span>;
            })}
          </div>
        </div>
      ) : null}

      {consommables.consommablesAPrevoir ? (
        <div style={{ background: "#F6FBFC", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#5b7f84", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Consommables à prévoir</div>
          <div style={{ fontSize: 14, color: "#085157" }}>{consommables.consommablesAPrevoir}</div>
        </div>
      ) : null}

      {consommables.remarques ? (
        <div style={{ background: "#F6FBFC", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#5b7f84", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Remarques</div>
          <div style={{ fontSize: 14, color: "#085157" }}>{consommables.remarques}</div>
        </div>
      ) : null}

      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 14, padding: 16, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#15803d", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Photos</div>
        <div style={{ fontSize: 14, color: "#166534", marginBottom: 4 }}>{photosArrivee.length} photo(s) d'arrivée prête(s) à l'envoi</div>
        <div style={{ fontSize: 14, color: "#166534" }}>{photos.length} photo(s) horodatée(s) prêtes à l'envoi</div>
      </div>

      {sending ? (
        <div style={{ marginBottom: 16 }}>
          <KeepAwakeWarning title="Envoi en cours" wakeLockStatus={wakeLockStatus}>
            Gardez cette page ouverte et le téléphone déverrouillé jusqu'au message de confirmation.
          </KeepAwakeWarning>
          <div style={{ fontSize: 13, color: "#085157", fontWeight: 600, marginBottom: 8 }}>
            Upload des photos : {sendProgress}%
          </div>
          <div style={{ background: "#D8EDF2", borderRadius: 8, height: 8, overflow: "hidden" }}>
            <div style={{ background: "#2CA7A9", height: "100%", width: sendProgress + "%", transition: "width 0.3s", borderRadius: 8 }} />
          </div>
        </div>
      ) : null}

      {sendError ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: "#dc2626" }}>
          {sendError}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev} disabled={sending}>Retour</Btn>
        <Btn onClick={onSubmit} disabled={sending}>{sending ? "Envoi en cours..." : "Envoyer le rapport"}</Btn>
      </div>
    </div>
  );
}

function StepSuccess({ nom, bien }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <IconCheck />
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#085157", marginBottom: 10 }}>Rapport envoyé !</h2>
      <p style={{ color: "#5b7f84", fontSize: 15, lineHeight: 1.6 }}>
        Merci <strong>{nom}</strong>, votre rapport pour <strong>{bien}</strong> a bien été transmis.
      </p>
      <div style={{ marginTop: 32, padding: "16px 20px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 14, fontSize: 14, color: "#166534" }}>
        Vous pouvez fermer cette fenêtre.
      </div>
    </div>
  );
}

var TOTAL = 7;
var INIT_ARRIVEE = { date: "", heureDebut: "", nom: "", bien: "Le Nossa" };
var INIT_ATTENTION = { lu: false };
var INIT_ETAT = { note: 0, observations: "" };
var INIT_CONSO = { consommablesAPrevoir: "", remarques: "", heureFin: "", consommablesSelectionnes: [] };

function PageAccueil() {
  var [logements, setLogements] = useState([]);
  var [loading, setLoading] = useState(true);

  useEffect(function() {
    fetch("/api/logements")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        setLogements(data.logements || []);
        setLoading(false);
      })
      .catch(function() { setLoading(false); });
  }, []);

  var pageStyle = {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at -10% -20%, var(--color-primary-soft) 0%, transparent 60%)," +
      "radial-gradient(900px 500px at 110% 10%, rgba(44,167,169,0.18) 0%, transparent 55%)," +
      "var(--color-bg)",
    padding: "32px 20px 64px",
  };

  var containerStyle = { maxWidth: 560, margin: "0 auto" };

  var heroStyle = {
    background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
    color: "#fff",
    borderRadius: "var(--radius-lg)",
    padding: "28px 24px",
    boxShadow: "var(--shadow-lg)",
    marginBottom: 28,
    position: "relative",
    overflow: "hidden",
  };

  var heroEyebrow = {
    fontFamily: "var(--font-body)",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    opacity: 0.85,
    marginBottom: 10,
  };

  var heroTitle = {
    fontFamily: "var(--font-heading)",
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.15,
    color: "#fff",
    margin: 0,
  };

  var heroSubtitle = {
    fontFamily: "var(--font-body)",
    fontSize: 14,
    marginTop: 10,
    opacity: 0.92,
    lineHeight: 1.5,
  };

  var sectionLabel = {
    fontFamily: "var(--font-heading)",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--color-primary-dark)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 12,
    paddingLeft: 4,
  };

  var cardStyle = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "18px 20px",
    marginBottom: 12,
    cursor: "pointer",
    boxShadow: "var(--shadow-sm)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
    display: "flex",
    alignItems: "center",
    gap: 16,
  };

  var iconBubble = {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 12,
    background: "var(--color-primary-soft)",
    color: "var(--color-primary-dark)",
    display: "grid",
    placeItems: "center",
    fontSize: 20,
  };

  var cardTitle = {
    fontFamily: "var(--font-heading)",
    fontWeight: 600,
    fontSize: 16,
    color: "var(--color-primary-dark)",
    lineHeight: 1.3,
  };

  var cardSubtitle = {
    fontFamily: "var(--font-body)",
    fontSize: 13,
    color: "var(--color-text-muted)",
    marginTop: 4,
    lineHeight: 1.4,
  };

  var chevron = {
    marginLeft: "auto",
    color: "var(--color-primary)",
    fontSize: 20,
    flexShrink: 0,
  };

  function onCardEnter(e) {
    e.currentTarget.style.transform = "translateY(-2px)";
    e.currentTarget.style.boxShadow = "var(--shadow-md)";
    e.currentTarget.style.borderColor = "var(--color-primary)";
  }
  function onCardLeave(e) {
    e.currentTarget.style.transform = "";
    e.currentTarget.style.boxShadow = "var(--shadow-sm)";
    e.currentTarget.style.borderColor = "var(--color-border)";
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={{
            fontFamily: "var(--font-body)",
            color: "var(--color-text-muted)",
            textAlign: "center",
            padding: 48,
          }}>
            Chargement…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <section style={heroStyle}>
          <div style={heroEyebrow}>Rapport de ménage</div>
          <h1 style={heroTitle}>Bonjour 👋</h1>
          <p style={heroSubtitle}>
            Sélectionnez le logement sur lequel vous intervenez aujourd'hui pour commencer votre rapport.
          </p>
        </section>

        <div style={sectionLabel}>Mes logements</div>

        {logements.length === 0 ? (
          <div style={{
            background: "var(--color-surface)",
            border: "1px dashed var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: 28,
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-body)",
            fontSize: 14,
          }}>
            Aucun logement disponible pour le moment.
          </div>
        ) : (
          logements.map(function(l) {
            return (
              <a key={l.slug} href={"/" + l.slug} style={{ textDecoration: "none" }}>
                <div
                  style={cardStyle}
                  onMouseEnter={onCardEnter}
                  onMouseLeave={onCardLeave}
                >
                  <div style={iconBubble}>🏠</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={cardTitle}>{l.nom}</div>
                    {l.adresse ? <div style={cardSubtitle}>{l.adresse}</div> : null}
                  </div>
                  <div style={chevron}>›</div>
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function App() {
  var [step, setStep] = useState(0);
  var [arrivee, setArrivee] = useState(INIT_ARRIVEE);
  var [attention, setAttention] = useState(INIT_ATTENTION);
  var [etatLieux, setEtatLieux] = useState(INIT_ETAT);
  var [consommables, setConsommables] = useState(INIT_CONSO);
  var [photosArrivee, setPhotosArrivee] = useState([]);
  var [photos, setPhotos] = useState([]);
  var [done, setDone] = useState(false);
  var [sending, setSending] = useState(false);
  var [sendError, setSendError] = useState("");
  var [sendProgress, setSendProgress] = useState(0);
  var [showResume, setShowResume] = useState(false);
  var [savedDraft, setSavedDraft] = useState(null);
  var [logement, setLogement] = useState(DEFAULT_LOGEMENT);
  var [logementLoading, setLogementLoading] = useState(true);
  var [logementError, setLogementError] = useState("");

  useEffect(function() {
var pathSlug = window.location.pathname.split("/").filter(Boolean).pop();
var slug = slugify(pathSlug || DEFAULT_LOGEMENT.slug);

    var cancelled = false;
    setLogementLoading(true);
    setLogementError("");
    fetch("/api/logement?slug=" + encodeURIComponent(slug))
      .then(function(res) {
        return res.json().then(function(data) {
          if (!res.ok) throw new Error(data.error || "Logement introuvable");
          return data;
        });
      })
      .then(function(data) {
        if (cancelled || !data.logement) return;
        var nextLogement = normalizeLogement(data.logement);
        setLogement(nextLogement);
        setArrivee(function(prev) {
          if (prev.bien && prev.bien !== INIT_ARRIVEE.bien) return prev;
          return Object.assign({}, prev, { bien: nextLogement.nom || INIT_ARRIVEE.bien });
        });
      })
      .catch(function(e) {
        if (!cancelled) setLogementError(e.message || "Impossible de charger le logement depuis Notion.");
      })
      .finally(function() {
        if (!cancelled) setLogementLoading(false);
      });
    return function() { cancelled = true; };
  }, []);

  useEffect(function() {
  if (logement && logement.photosReference) {
    logement.photosReference.forEach(function(p) {
      var img = new Image();
      img.src = p.url;
    });
  }
}, [logement]);

  useEffect(function() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var draft = JSON.parse(raw);
        if (draft && draft.step > 0) {
          setSavedDraft(draft);
          setShowResume(true);
        }
      }
    } catch(e) {}
  }, []);

  useEffect(function() {
    if (done) { localStorage.removeItem(STORAGE_KEY); return; }
    if (step === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        step: step, arrivee: arrivee, attention: attention,
        etatLieux: etatLieux, consommables: consommables,
      }));
    } catch(e) {}
  }, [step, arrivee, attention, etatLieux, consommables, done]);

  useEffect(function() {
    function handleBeforeUnload(e) {
      if (!sending) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return function() { window.removeEventListener("beforeunload", handleBeforeUnload); };
  }, [sending]);

  function handleResume() {
    setStep(savedDraft.step);
    setArrivee(savedDraft.arrivee || INIT_ARRIVEE);
    setAttention(savedDraft.attention || INIT_ATTENTION);
    setEtatLieux(savedDraft.etatLieux || INIT_ETAT);
    setConsommables(savedDraft.consommables || INIT_CONSO);
    setShowResume(false);
  }

  function handleRestart() {
    localStorage.removeItem(STORAGE_KEY);
    setShowResume(false);
  }

  function next() { setStep(function(s) { return Math.min(s + 1, TOTAL - 1); }); }
  function prev() { setStep(function(s) { return Math.max(s - 1, 0); }); }

  function handleSubmit() {
    setSending(true);
    setSendError("");
    setSendProgress(0);

    function uploadOne(p) {
      var formData = new FormData();
      formData.append("file", p.file, p.name);
      return fetch("/api/upload-photo", { method: "POST", body: formData })
        .then(function(r) { return r.json(); })
        .then(function(data) { return data.uploadId ? { uploadId: data.uploadId, name: p.name } : null; })
        .catch(function() { return null; });
    }

    var allPhotos = photosArrivee.concat(photos);
    var resultsArrivee = new Array(photosArrivee.length).fill(null);
    var resultsFin = new Array(photos.length).fill(null);
    var completed = 0;
    var BATCH = 5;

    function runBatch(startIndex) {
      if (startIndex >= allPhotos.length) {
        var validPhotosArrivee = resultsArrivee.filter(function(r) { return r !== null; });
        var validPhotosFin = resultsFin.filter(function(r) { return r !== null; });
        fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            arrivee: arrivee, etatLieux: etatLieux, consommables: consommables,
            photosArrivee: validPhotosArrivee, photos: validPhotosFin,
          }),
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          setSending(false);
          if (data.success) { localStorage.removeItem(STORAGE_KEY); setDone(true); }
          else setSendError("Erreur lors de l envoi. Réessayez.");
        })
        .catch(function() { setSending(false); setSendError("Erreur réseau. Vérifiez votre connexion."); });
        return;
      }
      var batch = allPhotos.slice(startIndex, startIndex + BATCH);
      Promise.all(batch.map(function(p, i) {
        return uploadOne(p).then(function(result) {
          var globalIndex = startIndex + i;
          if (globalIndex < photosArrivee.length) resultsArrivee[globalIndex] = result;
          else resultsFin[globalIndex - photosArrivee.length] = result;
          completed++;
          setSendProgress(allPhotos.length > 0 ? Math.round((completed / allPhotos.length) * 100) : 0);
        });
      })).then(function() { runBatch(startIndex + BATCH); });
    }

    runBatch(0);
  }

  if (done) {
    return <div style={wrap}><StepSuccess nom={arrivee.nom} bien={arrivee.bien} /></div>;
  }

    var pathSlug = window.location.pathname.split("/").filter(Boolean).pop();
  if (!pathSlug) return <PageAccueil />;
  
  return (
    <div style={wrap}>
      {showResume ? <ResumeModal saved={savedDraft} onResume={handleResume} onRestart={handleRestart} /> : null}

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#085157" }}>Rapport de ménage</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Étape {step + 1} sur {TOTAL}</div>
          </div>
        </div>
        <ProgressBar current={step} total={TOTAL} />
      </div>

      {step === 0 && <Step1Infos logement={logement} loading={logementLoading} error={logementError} onNext={next} />}
      {step === 1 && <Step2Arrivee data={arrivee} setData={setArrivee} onNext={next} onPrev={prev} />}
      {step === 2 && <Step3Attention data={attention} setData={setAttention} logement={logement} onNext={next} onPrev={prev} />}
      {step === 3 && <Step4EtatLieux data={etatLieux} setData={setEtatLieux} photosArrivee={photosArrivee} setPhotosArrivee={setPhotosArrivee} onNext={next} onPrev={prev} />}
      {step === 4 && <Step5Consommables data={consommables} setData={setConsommables} logement={logement} onNext={next} onPrev={prev} />}
      {step === 5 && <Step6Photos photos={photos} setPhotos={setPhotos} logement={logement} onNext={next} onPrev={prev} />}
      {step === 6 && (
        <Step7Recap
          arrivee={arrivee}
          etatLieux={etatLieux}
          consommables={consommables}
          photosArrivee={photosArrivee}
          photos={photos}
          onPrev={prev}
          onSubmit={handleSubmit}
          sending={sending}
          sendError={sendError}
          sendProgress={sendProgress}
        />
      )}
    </div>
  );
}

var wrap = {
  maxWidth: 480,
  margin: "0 auto",
  padding: "24px 20px 60px",
  fontFamily: "'Wix Madefor Text', 'Wix Madefor Display', system-ui, -apple-system, sans-serif",
  minHeight: "100vh",
  background: "#fff",
};

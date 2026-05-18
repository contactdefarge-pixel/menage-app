import { useState, useRef, useCallback, useEffect } from "react";

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
];

const STORAGE_KEY = "menage_draft_izinest_v4";

function padTwo(n) { return String(n).padStart(2, "0"); }

function getStamp() {
  var d = new Date();
  var date = padTwo(d.getDate()) + "/" + padTwo(d.getMonth() + 1) + "/" + d.getFullYear();
  var time = padTwo(d.getHours()) + "h" + padTwo(d.getMinutes());
  return date + "  " + time;
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
      var maxW = 1600; 
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
      ctx.fillStyle = "rgba(8, 81, 87, 0.85)"; 
      roundRect(ctx, margin, h - bh - margin, bw, bh, 6);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(stamp, margin + pad, h - margin - pad);
      canvas.toBlob(function(blob) {
        URL.revokeObjectURL(url);
        resolve(new File([blob], file.name, { type: "image/jpeg" }));
      }, "image/jpeg", 0.85);
    };
    img.src = url;
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function base64ToFile(base64String, filename) {
  var arr = base64String.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
}

// ── Icônes SVG ──────────────────────────────────────────────────────────────

function IconWifi() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00bab3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="#00bab3"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00bab3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00bab3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00bab3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}
function IconKey() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00bab3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}
function IconCheckIzinest() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill="#00bab3" fillOpacity="0.1"/>
      <circle cx="32" cy="32" r="24" fill="#085157"/>
      <path d="M23 32.5L29 38.5L41 25.5" stroke="#00bab3" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Composants de structure ──────────────────────────────────────────────────

function ProgressBar({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 5, marginBottom: 24 }}>
      {Array.from({ length: total }).map(function(_, i) {
        return (
          <div key={i} style={{
            flex: 1, height: 5, borderRadius: 3,
            background: i <= current ? "#00bab3" : "#e5e7eb",
            transition: "background 0.3s",
          }} />
        );
      })}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#085157", margin: "0 0 6px 0", letterSpacing: "-0.5px" }}>
      {children}
    </h2>
  );
}

function Subtitle({ children }) {
  return (
    <p style={{ color: "#4b5563", fontSize: 14, margin: "0 0 20px 0", lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

function InfoCard({ icon, children }) {
  return (
    <div style={{
      background: "#f9fafb", border: "1px solid #e5e7eb", borderLeft: "4px solid #085157",
      borderRadius: "0 12px 12px 0", padding: "14px 16px", marginBottom: 12,
      fontSize: 14, color: "#085157", lineHeight: 1.6,
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      {icon ? <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div> : null}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function AlertCard({ title, children }) {
  return (
    <div style={{
      background: "#fff5f5", border: "2px solid #feb2b2", borderRadius: 14,
      padding: "16px 18px", marginBottom: 20, boxShadow: "0 4px 12px rgba(229,62,62,0.05)"
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <span style={{ fontWeight: 800, color: "#c53030", fontSize: 14, textTransform: "uppercase", letterSpacing: "0.3px" }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, color: "#9b2c2c", lineHeight: 1.5, fontWeight: "500" }}>{children}</div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#085157", marginBottom: 6 }}>
        {label}{required ? <span style={{ color: "#dc2626" }}> *</span> : null}
      </label>
      {children}
    </div>
  );
}

var baseInput = {
  width: "100%", padding: "12px 14px", border: "2px solid #e5e7eb",
  borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box",
  fontFamily: "inherit", background: "#fff", transition: "all 0.2s"
};

function Input({ value, onChange, placeholder, type }) {
  type = type || "text";
  return (
    <input type={type} value={value} placeholder={placeholder || ""}
      onChange={function(e) { onChange(e.target.value); }}
      style={baseInput}
      onFocus={function(e) { e.target.style.borderColor = "#00bab3"; }}
      onBlur={function(e) { e.target.style.borderColor = "#e5e7eb"; }}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows }) {
  rows = rows || 3;
  return (
    <textarea value={value} placeholder={placeholder || ""} rows={rows}
      onChange={function(e) { onChange(e.target.value); }}
      style={Object.assign({}, baseInput, { resize: "vertical" })}
      onFocus={function(e) { e.target.style.borderColor = "#00bab3"; }}
      onBlur={function(e) { e.target.style.borderColor = "#e5e7eb"; }}
    />
  );
}

function Btn({ onClick, disabled, children, secondary }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: "13px 24px", borderRadius: 12, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "#f3f4f6" : secondary ? "#f3f4f6" : "#00bab3",
        color: disabled ? "#9ca3af" : secondary ? "#085157" : "#ffffff",
        fontWeight: 700, fontSize: 15, transition: "all 0.2s",
        border: secondary ? "1px solid #e5e7eb" : "none",
        boxShadow: (!secondary && !disabled) ? "0 4px 12px rgba(0,186,179,0.15)" : "none",
      }}
    >{children}</button>
  );
}

function StarRating({ value, onChange }) {
  var [hov, setHov] = useState(0);
  return (
    <div style={{ display: "flex", gap: 8, margin: "4px 0" }}>
      {[1,2,3,4,5].map(function(s) {
        var active = s <= (hov || value);
        return (
          <button key={s} type="button"
            onClick={function() { onChange(s); }}
            onMouseEnter={function() { setHov(s); }}
            onMouseLeave={function() { setHov(0); }}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: 34, lineHeight: 1, color: active ? "#00bab3" : "#e5e7eb",
              transition: "color 0.1s"
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
        background: copied ? "#e6fdfc" : "#f3f4f6", border: "none", borderRadius: 8,
        cursor: "pointer", padding: "4px 10px", fontSize: 12, marginLeft: 10,
        color: copied ? "#00bab3" : "#085157", fontWeight: 600, flexShrink: 0,
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <span style={{ color: "#4b5563", fontSize: 14 }}>{adresse}</span>
      <button onClick={copy} style={{
        background: copied ? "#e6fdfc" : "#f3f4f6", border: "none", borderRadius: 8,
        cursor: "pointer", padding: "4px 10px", fontSize: 12, marginLeft: 10,
        color: copied ? "#00bab3" : "#085157", fontWeight: 600, flexShrink: 0,
      }}>{copied ? "Copié !" : "Copier"}</button>
    </div>
  );
}

// ── Module de Gestion des Photos avec Horodatage et retour visuel ───────────

function PhotoModule({ photos, onAddPhotos, onRemovePhoto, title, subtitle, onProcessingChange }) {
  const inputRef = useRef();
  const [localProcessing, setLocalProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);

  const handleFiles = useCallback((files) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    
    setLocalProcessing(true);
    setProcessProgress(0);
    if (onProcessingChange) onProcessingChange(true);

    let processedArray = [];
    let counter = 0;

    function processNext() {
      if (counter >= arr.length) {
        onAddPhotos(processedArray);
        setLocalProcessing(false);
        if (onProcessingChange) onProcessingChange(false);
        return;
      }
      
      processPhoto(arr[counter]).then((stamped) => {
        processedArray.push({
          id: Math.random().toString(36).slice(2),
          file: stamped,
          preview: URL.createObjectURL(stamped),
          name: arr[counter].name,
        });
        counter++;
        setProcessProgress(Math.round((counter / arr.length) * 100));
        processNext();
      });
    }
    processNext();
  }, [onAddPhotos, onProcessingChange]);

  return (
    <div style={{ marginBottom: 20 }}>
      {title && <div style={{ fontWeight: 600, fontSize: 14, color: "#085157", marginBottom: 4 }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>{subtitle}</div>}

      {/* Bandeau d'avertissement restauré et épuré */}
      {localProcessing && (
        <AlertCard title="Traitement des photos en cours">
          Ajout de l'horodatage et compression de l'image...<br />
          <strong>Ne fermez pas l'application et ne verrouillez pas votre écran.</strong>
          <div style={{ background: "#e5e7eb", borderRadius: 6, height: 6, overflow: "hidden", marginTop: 8 }}>
            <div style={{ background: "#00bab3", height: "100%", width: processProgress + "%", transition: "width 0.2s" }} />
          </div>
        </AlertCard>
      )}

      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              <img src={p.preview} alt={p.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, border: "2px solid #00bab3" }} />
              <button type="button" onClick={() => onRemovePhoto(p.id)} style={{
                position: "absolute", top: 4, right: 4, background: "rgba(8, 81, 87, 0.9)", color: "#fff",
                border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: 11, padding: 0
              }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div onClick={() => !localProcessing && inputRef.current.click()} style={{
        border: "2px dashed #00bab3", borderRadius: 12, padding: "20px 14px", textAlign: "center",
        cursor: localProcessing ? "not-allowed" : "pointer", background: "#f9fafb", opacity: localProcessing ? 0.6 : 1
      }}>
        <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#085157" }}>
          {localProcessing ? `Traitement (${processProgress}%)` : "Prendre / Ajouter des photos"}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}

// ── Modale de continuité ─────────────────────────────────────────────────────

function ResumeModal({ saved, onResume, onRestart }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(8, 81, 87, 0.6)",
      backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24,
    }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 360, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 36, marginBottom: 12, textAlign: "center" }}>⚡</div>
        <h3 style={{ fontWeight: 800, fontSize: 18, color: "#085157", textAlign: "center", margin: "0 0 8px 0" }}>Reprise d'activité</h3>
        <p style={{ fontSize: 14, color: "#4b5563", textAlign: "center", margin: "0 0 24px 0", lineHeight: 1.5 }}>
          Un rapport pour <strong>{saved.arrivee?.bien || "Le Nossa"}</strong> a été détecté. Souhaitez-vous reprendre là où vous vous étiez arrêté ?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn onClick={onResume}>Reprendre le travail</Btn>
          <Btn secondary onClick={onRestart}>Recommencer</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Étapes de l'application ───────────────────────────────────────────────────

function Step1Infos({ onNext }) {
  return (
    <div>
      <SectionTitle>Le Nossa</SectionTitle>
      <CopyAdresse adresse="33 Bis rue des Pyrénées, 65100 Lourdes" />
      <InfoCard icon={<IconWifi />}>
        <strong>WiFi</strong>
        <CopyRow label="Réseau" value="SFR_FE68" />
        <CopyRow label="Mot de passe" value="7grh55pvtr7brf27fury" />
      </InfoCard>
      <InfoCard icon={<IconUsers />}>
        <strong>Voyageurs</strong><br />
        3 max — 1 lit double 160x190 (parure marron ou grise) + 1 canapé lit
      </InfoCard>
      <InfoCard icon={<IconTrash />}>
        <strong>Poubelles</strong><br />
        Local poubelle : Place Pyrénées. Badge sur les clés.
      </InfoCard>
      <InfoCard icon={<IconBox />}>
        <strong>Consommables</strong><br />
        Placard à droite du lit. Clé cachée dans le meuble TV, porte gauche.
      </InfoCard>
      <InfoCard icon={<IconKey />}>
        <strong>Accès logement</strong><br />
        Boîte à clé au rez-de-chaussée, après les boîtes aux lettres.<br />
        Code : <strong>0359</strong> — Appartement au 1er étage.
      </InfoCard>
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

function Step3Attention({ data, setData, onNext, onPrev }) {
  var points = [
    { emoji: "🪟", text: "Ouvrir les fenêtres en grand pour éviter l'humidité." },
    { emoji: "🚿", text: "Retirer systématiquement les cheveux dans les deux bondes de douche." },
    { emoji: "💨", text: "Une fois le ménage terminé, veiller à laisser la VMC dans les toilettes allumée." },
  ];
  return (
    <div>
      <SectionTitle>Points d'attention</SectionTitle>
      <Subtitle>Merci de prendre connaissance de ces consignes avant de commencer.</Subtitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {points.map(function(pt, i) {
          return (
            <div key={i} style={{
              display: "flex", gap: 14, padding: "14px 16px", background: "#fff", borderRadius: 12,
              fontSize: 14, color: "#374151", lineHeight: 1.5, border: "1px solid #e5e7eb"
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{pt.emoji}</span>
              <span style={{ fontWeight: 500 }}>{pt.text}</span>
            </div>
          );
        })}
      </div>
      <div
        onClick={function() { setData(Object.assign({}, data, { lu: !data.lu })); }}
        style={{
          display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 12, cursor: "pointer",
          background: data.lu ? "#e6fdfc" : "#fafafa", border: "2px solid " + (data.lu ? "#00bab3" : "#e5e7eb"),
          marginBottom: 24, transition: "all 0.2s"
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          border: "2px solid " + (data.lu ? "#00bab3" : "#d1d5db"),
          background: data.lu ? "#00bab3" : "#fff", display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {data.lu ? <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span> : null}
        </div>
        <span style={{ fontSize: 14, color: "#085157", fontWeight: 700 }}>J'ai pris connaissance de ces consignes</span>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev}>Retour</Btn>
        <Btn onClick={onNext} disabled={!data.lu}>Suivant</Btn>
      </div>
    </div>
  );
}

function Step4EtatLieux({ data, setData, onNext, onPrev, onProcessingChange }) {
  var ok = data.note > 0 && data.observations;
  return (
    <div>
      <SectionTitle>État des lieux</SectionTitle>
      <Subtitle>Vérifiez l'état de propreté initial. Si le logement est sale ou dégradé, insérez vos photos ci-dessous.</Subtitle>
      
      <Field label="Notez l'état laissé par les voyageurs" required>
        <StarRating value={data.note} onChange={function(v) { setData(Object.assign({}, data, { note: v })); }} />
      </Field>
      
      <Field label="Observations à l'arrivée" required>
        <Textarea value={data.observations} onChange={function(v) { setData(Object.assign({}, data, { observations: v })); }} placeholder="Détaillez les anomalies constatées ou écrivez RAS." />
      </Field>

      {/* Suppression complète du sous-titre explicatif ici */}
      <PhotoModule 
        photos={data.photosArrivee || []}
        title="Photos à l'arrivée (Optionnel)"
        onProcessingChange={onProcessingChange}
        onAddPhotos={(newPhotos) => {
          const current = data.photosArrivee || [];
          setData(Object.assign({}, data, { photosArrivee: current.concat(newPhotos) }));
        }}
        onRemovePhoto={(id) => {
          const current = data.photosArrivee || [];
          setData(Object.assign({}, data, { photosArrivee: current.filter(p => p.id !== id) }));
        }}
      />

      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev}>Retour</Btn>
        <Btn onClick={onNext} disabled={!ok}>Suivant</Btn>
      </div>
    </div>
  );
}

function Step5Consommables({ data, setData, onNext, onPrev }) {
  var ok = data.consommablesAPrevoir !== undefined && data.remarques !== undefined && data.heureFin;
  var selected = data.consommablesSelectionnes || [];

  function toggleConso(c) {
    var next = selected.includes(c) ? selected.filter(function(x) { return x !== c; }) : selected.concat([c]);
    var texteAuto = next.length > 0 ? "Besoin de réapprovisionner : " + next.join(", ") : "";
    setData(Object.assign({}, data, { consommablesSelectionnes: next, consommablesAPrevoir: texteAuto }));
  }

  return (
    <div>
      <SectionTitle>Consommables</SectionTitle>
      <Subtitle>Remplir selon les stocks disponibles dans le placard.</Subtitle>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>À laisser obligatoirement</div>
          {/* Restauration du sous-texte informatif d'origine */}
          <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>Compléter les existants (qtés totales exprimées)</div>
        </div>
        
        {CONSOMMABLES_LAISSER.map(function(c) {
          return (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f9fafb", borderRadius: 8, fontSize: 14, marginBottom: 6, border: "1px solid #f3f4f6" }}>
              <span style={{ fontWeight: 500, color: "#085157" }}>{c.label}</span>
              <span style={{ background: "#085157", color: "#fff", fontWeight: 700, borderRadius: 6, padding: "2px 8px", fontSize: 12 }}>{c.qt}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 20, background: "#fbfbfd", border: "1px solid #e5e7eb", padding: 14, borderRadius: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 11, color: "#00bab3", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>À vérifier & commander</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>Sélectionnez les articles bientôt épuisés :</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CONSOMMABLES_VERIFIER.map(function(c) {
            var isSelected = selected.includes(c);
            return (
              <button key={c} type="button" onClick={function() { toggleConso(c); }} style={{
                padding: "8px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.1s",
                border: isSelected ? "2px solid #00bab3" : "2px solid #e5e7eb",
                background: isSelected ? "#00bab3" : "#fff", color: isSelected ? "#fff" : "#4b5563"
              }}>{isSelected ? "✓ " : "+ "}{c}</button>
            );
          })}
        </div>
      </div>

      <Field label="Consommables à prévoir pour la prochaine fois" required>
        <Textarea value={data.consommablesAPrevoir || ""} onChange={function(v) { setData(Object.assign({}, data, { consommablesAPrevoir: v })); }} rows={2} />
      </Field>
      <Field label="Remarques sur le logement" required>
        <Textarea value={data.remarques || ""} onChange={function(v) { setData(Object.assign({}, data, { remarques: v })); }} placeholder="RAS, ampoule grillée, maintenance..." rows={2} />
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

function Step6Photos({ photos, setPhotos, onNext, onPrev, onProcessingChange }) {
  var suivantLabel = "Suivant (" + photos.length + " photo" + (photos.length > 1 ? "s" : "") + ")";

  return (
    <div>
      <SectionTitle>Photos de fin de ménage</SectionTitle>
      <Subtitle>Téléversez les clichés requis de fin de prestation (gravage automatique).</Subtitle>

      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#085157", marginBottom: 6, textTransform: "uppercase" }}>Photos obligatoires</div>
        {PIECES.map(p => <div key={p.id} style={{ fontSize: 13, color: "#4b5563", marginBottom: 3 }}><strong>{p.label}</strong> — {p.exemples}</div>)}
      </div>

      <PhotoModule 
        photos={photos}
        onProcessingChange={onProcessingChange}
        onAddPhotos={(newPhotos) => setPhotos(prev => prev.concat(newPhotos))}
        onRemovePhoto={(id) => setPhotos(prev => prev.filter(p => p.id !== id))}
      />

      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev}>Retour</Btn>
        <Btn onClick={onNext} disabled={photos.length === 0}>{suivantLabel}</Btn>
      </div>
    </div>
  );
}

function Step7Recap({ arrivee, etatLieux, consommables, photos, onPrev, onSubmit, sending, sendError, sendProgress }) {
  var etoiles = "";
  for (var i = 0; i < etatLieux.note; i++) etoiles += "★";
  for (var j = etatLieux.note; j < 5; j++) etoiles += "☆";
  var selected = consommables.consommablesSelectionnes || [];

  return (
    <div>
      <SectionTitle>Récapitulatif</SectionTitle>
      <Subtitle>Vérification finale des données avant transmission.</Subtitle>

      <div style={{ background: "#f9fafb", borderRadius: 12, padding: 14, marginBottom: 10, border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 14, color: "#085157", lineHeight: 1.7 }}>
          <strong>{arrivee.bien}</strong> — Par {arrivee.nom}<br/>
          Prestation du {arrivee.date} ({arrivee.heureDebut} - {consommables.heureFin})
        </div>
      </div>

      <div style={{ background: "#f9fafb", borderRadius: 12, padding: 14, marginBottom: 10, border: "1px solid #e5e7eb" }}>
        <div style={{ fontWeight: 700, fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>État des lieux</div>
        <div style={{ color: "#00bab3", fontSize: 16, marginBottom: 4 }}>{etoiles}</div>
        <div style={{ fontSize: 13, color: "#085157" }}>{interieurTexte(etatLieux.observations)}</div>
        {etatLieux.photosArrivee?.length > 0 && <div style={{ fontSize: 13, color: "#00bab3", marginTop: 4, fontWeight: 700 }}>📸 {etatLieux.photosArrivee.length} photo(s) d'arrivée prête(s)</div>}
      </div>

      <div style={{ background: "#f9fafb", borderRadius: 12, padding: 14, marginBottom: 16, border: "1px solid #e5e7eb" }}>
        <div style={{ fontWeight: 700, fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>Logistique & Matériel</div>
        <div style={{ fontSize: 13, color: "#085157", lineHeight: 1.5 }}>
          <div><strong>Stocks manquants :</strong> {selected.length > 0 ? selected.join(", ") : "Aucun"}</div>
          <div style={{ marginTop: 4 }}><strong>Remarques :</strong> {interieurTexte(consommables.remarques)}</div>
        </div>
      </div>

      <div style={{ background: "#e6fdfc", border: "1px solid #a5f3f0", borderRadius: 12, padding: 14, marginBottom: 20, fontSize: 13, color: "#085157", fontWeight: 700 }}>
        📸 {photos.length} photo(s) de fin validée(s).
      </div>

      {sending && (
        <div style={{ background: "#fff5f5", border: "2px solid #feb2b2", borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ fontWeight: 800, color: "#c53030", fontSize: 14, marginBottom: 6 }}>⚙️ TRANSMISSION NOTION EN COURS</div>
          <p style={{ fontSize: 13, color: "#9b2c2c", margin: 0 }}>
            Sauvegarde continue active. Ne fermez pas votre écran et attendez le succès.<br/>
            <strong>Progression des transferts : {sendProgress}%</strong>
          </p>
          <div style={{ background: "#e5e7eb", borderRadius: 6, height: 6, overflow: "hidden", marginTop: 8 }}>
            <div style={{ background: "#00bab3", height: "100%", width: sendProgress + "%", transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {sendError && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>{sendError}</div>}

      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev} disabled={sending}>Retour</Btn>
        <Btn onClick={onSubmit} disabled={sending}>{sending ? "Envoi..." : "Transmettre le rapport"}</Btn>
      </div>
    </div>
  );
}

function interieurTexte(t) { return (t && t.trim()) ? t : "RAS"; }

function StepSuccess({ nom, bien }) {
  return (
    <div style={{ textAlign: "center", padding: "30px 0" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}><IconCheckIzinest /></div>
      <h2 style={{ fontSize: 23, fontWeight: 800, color: "#085157", marginBottom: 10, letterSpacing: "-0.5px" }}>Rapport synchronisé</h2>
      <p style={{ color: "#4b5563", fontSize: 15, lineHeight: 1.6, margin: "0 0 28px 0" }}>
        Merci <strong>{nom}</strong>, votre bilan pour le logement <strong>{bien}</strong> a été synchronisé avec succès.
      </p>
      <div style={{ padding: "14px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 13, color: "#00bab3", fontWeight: 700 }}>
        ✨ Mission accomplie ! Vous pouvez fermer cette application.
      </div>
    </div>
  );
}

// ── App Principale ───────────────────────────────────────────────────────────

var TOTAL = 7;
var INIT_ARRIVEE = { date: "", heureDebut: "", nom: "", bien: "Le Nossa" };
var INIT_ATTENTION = { lu: false };
var INIT_ETAT = { note: 0, observations: "", photosArrivee: [] };
var INIT_CONSO = { consommablesAPrevoir: "", remarques: "", heureFin: "", consommablesSelectionnes: [] };

export default function App() {
  var [step, setStep] = useState(0);
  var [arrivee, setArrivee] = useState(INIT_ARRIVEE);
  var [attention, setAttention] = useState(INIT_ATTENTION);
  var [etatLieux, setEtatLieux] = useState(INIT_ETAT);
  var [consommables, setConsommables] = useState(INIT_CONSO);
  var [photos, setPhotos] = useState([]);
  
  var [done, setDone] = useState(false);
  var [sending, setSending] = useState(false);
  var [localProcessingActive, setLocalProcessingActive] = useState(false); // Suivi de l'horodatage en cours
  var [sendError, setSendError] = useState("");
  var [sendProgress, setSendProgress] = useState(0);
  var [showResume, setShowResume] = useState(false);
  var [savedDraft, setSavedDraft] = useState(null);
  
  var wakeLockRef = useRef(null);

  useEffect(function() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var draft = JSON.parse(raw);
        if (draft && (draft.step > 0 || draft.arrivee?.nom !== "")) {
          setSavedDraft(draft);
          setShowResume(true);
        }
      }
    } catch(e) {}
  }, []);

  useEffect(function() {
    if (done) { localStorage.removeItem(STORAGE_KEY); return; }
    if (step === 0 && arrivee.nom === "") return;

    async function saveCurrentDraft() {
      try {
        let base64PhotosArrivee = [];
        if (etatLieux.photosArrivee && etatLieux.photosArrivee.length > 0) {
          for (let p of etatLieux.photosArrivee) {
            try {
              let b64 = await fileToBase64(p.file);
              base64PhotosArrivee.push({ id: p.id, name: p.name, base64: b64 });
            } catch(e){}
          }
        }

        let base64PhotosFin = [];
        if (photos && photos.length > 0) {
          for (let p of photos) {
            try {
              let b64 = await fileToBase64(p.file);
              base64PhotosFin.push({ id: p.id, name: p.name, base64: b64 });
            } catch(e){}
          }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          step: step,
          arrivee: arrivee,
          attention: attention,
          etatLieux: Object.assign({}, etatLieux, { photosArrivee: [] }),
          base64PhotosArrivee: base64PhotosArrivee,
          consommables: consommables,
          base64PhotosFin: base64PhotosFin
        }));
      } catch(e) {}
    }
    saveCurrentDraft();
  }, [step, arrivee, attention, etatLieux, consommables, photos, done]);

  // Fiabilisation globale du WakeLock (anti-verrouillage écran actif lors de l'horodatage local ou de l'envoi Notion)
  useEffect(function() {
    var checkWakeLock = (sending || localProcessingActive);
    if (checkWakeLock && "wakeLock" in navigator) {
      navigator.wakeLock.request("screen")
        .then(function(lock) { wakeLockRef.current = lock; })
        .catch(function(){});
    } else if (!checkWakeLock && wakeLockRef.current) {
      wakeLockRef.current.release().then(function() { wakeLockRef.current = null; });
    }
    return function() { if (wakeLockRef.current) wakeLockRef.current.release(); };
  }, [sending, localProcessingActive]);

  function handleResume() {
    setStep(savedDraft.step || 0);
    setArrivee(savedDraft.arrivee || INIT_ARRIVEE);
    setAttention(savedDraft.attention || INIT_ATTENTION);
    setConsommables(savedDraft.consommables || INIT_CONSO);

    var restEtat = savedDraft.etatLieux || INIT_ETAT;
    if (savedDraft.base64PhotosArrivee && savedDraft.base64PhotosArrivee.length > 0) {
      restEtat.photosArrivee = savedDraft.base64PhotosArrivee.map(function(item) {
        var f = base64ToFile(item.base64, item.name);
        return { id: item.id, file: f, preview: URL.createObjectURL(f), name: item.name };
      });
    } else {
      restEtat.photosArrivee = [];
    }
    setEtatLieux(restEtat);

    if (savedDraft.base64PhotosFin && savedDraft.base64PhotosFin.length > 0) {
      var restPhotosFin = savedDraft.base64PhotosFin.map(function(item) {
        var f = base64ToFile(item.base64, item.name);
        return { id: item.id, file: f, preview: URL.createObjectURL(f), name: item.name };
      });
      setPhotos(restPhotosFin);
    }
    setShowResume(false);
  }

  function handleRestart() {
    localStorage.removeItem(STORAGE_KEY);
    setStep(0);
    setArrivee(INIT_ARRIVEE);
    setAttention(INIT_ATTENTION);
    setEtatLieux(INIT_ETAT);
    setConsommables(INIT_CONSO);
    setPhotos([]);
    setShowResume(false);
  }

  function next() { setStep(function(s) { return Math.min(s + 1, TOTAL - 1); }); }
  function prev() { setStep(function(s) { return Math.max(s - 1, 0); }); }

  function handleSubmit() {
    setSending(true);
    setSendError("");
    setSendProgress(2);

    function uploadFileRequest(fileObj) {
      var formData = new FormData();
      formData.append("file", fileObj.file, fileObj.name);
      return fetch("/api/upload-photo", { method: "POST", body: formData })
        .then(r => r.json())
        .then(data => data.uploadId ? { uploadId: data.uploadId } : null)
        .catch(() => null);
    }

    var arrArrivee = etatLieux.photosArrivee || [];
    var totalFiles = arrArrivee.length + photos.length;
    
    var uploadResultsArrivee = new Array(arrArrivee.length).fill(null);
    var uploadResultsFin = new Array(photos.length).fill(null);
    
    var completedCount = 0;
    var BATCH_SIZE = 2;

    function executeUploads(allTasks, globalCallback) {
      if (allTasks.length === 0) {
        globalCallback();
        return;
      }
      function runIndex(idx) {
        if (idx >= allTasks.length) {
          globalCallback();
          return;
        }
        var currentBatch = allTasks.slice(idx, idx + BATCH_SIZE);
        Promise.all(currentBatch.map(function(task) {
          return uploadFileRequest(task.obj).then(function(res) {
            if (task.type === "arrivee") uploadResultsArrivee[task.pos] = res;
            if (task.type === "fin") uploadResultsFin[task.pos] = res;
            completedCount++;
            setSendProgress(Math.min(97, Math.round((completedCount / totalFiles) * 100)));
          });
        })).then(function() { runIndex(idx + BATCH_SIZE); });
      }
      runIndex(0);
    }

    var tasks = [];
    arrArrivee.forEach((o, i) => tasks.push({ type: "arrivee", pos: i, obj: o }));
    photos.forEach((o, i) => tasks.push({ type: "fin", pos: i, obj: o }));

    executeUploads(tasks, function() {
      // Extraction stricte et propre des IDs d'upload Notion valides
      var finalPhotosArrivee = uploadResultsArrivee.filter(r => r !== null);
      var finalPhotosFin = uploadResultsFin.filter(r => r !== null);

      fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arrivee: arrivee,
          // Correction majeure : Injection explicite de la liste des IDs d'upload pour l'arrivée
          etatLieux: Object.assign({}, etatLieux, { photosIds: finalPhotosArrivee }),
          consommables: consommables,
          photos: finalPhotosFin
        }),
      })
      .then(res => res.json())
      .then(data => {
        setSending(false);
        if (data.success) {
          localStorage.removeItem(STORAGE_KEY);
          setDone(true);
        } else {
          setSendError("Une erreur est survenue durant l'enregistrement Notion.");
        }
      })
      .catch(() => {
        setSending(false);
        setSendError("Erreur réseau. Vos données restent en sécurité localement.");
      });
    });
  }

  if (done) {
    return (
      <div style={wrap}>
        <StepSuccess nom={arrivee.nom} bien={arrivee.bien} />
      </div>
    );
  }

  return (
    <div style={wrap}>
      {showResume ? <ResumeModal saved={savedDraft} onResume={handleResume} onRestart={handleRestart} /> : null}

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 17, color: "#085157", textTransform: "uppercase", letterSpacing: "0.5px" }}>Izinest</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>Bilan terrain · Étape {step + 1} / {TOTAL}</div>
        </div>
        <ProgressBar current={step} total={TOTAL} />
      </div>

      {step === 0 && <Step1Infos onNext={next} />}
      {step === 1 && <Step2Arrivee data={arrivee} setData={setArrivee} onNext={next} onPrev={prev} />}
      {step === 2 && <Step3Attention data={attention} setData={setAttention} onNext={next} onPrev={prev} />}
      {step === 3 && <Step4EtatLieux data={etatLieux} setData={setEtatLieux} onNext={next} onPrev={prev} onProcessingChange={setLocalProcessingActive} />}
      {step === 4 && <Step5Consommables data={consommables} setData={setConsommables} onNext={next} onPrev={prev} />}
      {step === 5 && <Step6Photos photos={photos} setPhotos={setPhotos} onNext={next} onPrev={prev} onProcessingChange={setLocalProcessingActive} />}
      {step === 6 && (
        <Step7Recap
          arrivee={arrivee}
          etatLieux={etatLieux}
          consommables={consommables}
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
  maxWidth: 460,
  margin: "0 auto",
  padding: "20px 16px 50px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  minHeight: "100vh",
  background: "#ffffff",
  WebkitFontSmoothing: "antialiased"
};

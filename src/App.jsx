import { useState, useRef, useCallback, useEffect } from "react";

// ⚠️ MODIFIEZ CES DEUX VALEURS AVEC VOS BLEUS EXACTS :
const BLEU_PRINCIPAL = "#0ea5e9";  // Remplacez par votre bleu principal
const BLEU_SECONDAIRE = "#0284c7"; // Remplacez par votre bleu secondaire
const BLEU_CLAIR = "#7dd3fc";      // Remplacez par votre bleu clair (pour la progress bar)
const BLEU_FOND = "#f0f9ff";       // Remplacez par votre fond bleu léger

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

const STORAGE_KEY = "menage_draft";

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
      var maxW = 1920; // Réduit à 1920 pour une meilleure stabilité sur mobile
      var scale = img.width > maxW ? maxW / img.width : 1;
      var w = Math.round(img.width * scale);
      var h = Math.round(img.height * scale);
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      var stamp = getStamp();
      var fontSize = Math.max(16, Math.round(w * 0.025));
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
      }, "image/jpeg", 0.85); // Compression à 0.85 pour éviter les saturations mémoire
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      resolve(file); // En cas d'erreur, on retourne le fichier d'origine pour ne pas bloquer l'app
    };
    img.src = url;
  });
}

// ── Icônes SVG inline ────────────────────────────────────────────────────────

function IconWifi() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLEU_SECONDAIRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill={BLEU_SECONDAIRE}/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLEU_SECONDAIRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLEU_SECONDAIRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLEU_SECONDAIRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}
function IconKey() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLEU_SECONDAIRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}

// ── Composants UI ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
      {Array.from({ length: total }).map(function(_, i) {
        return (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i < current ? BLEU_PRINCIPAL : i === current ? BLEU_CLAIR : "#e2e8f0",
            transition: "background 0.3s",
          }} />
        );
      })}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 6px 0", letterSpacing: "-0.5px" }}>
      {children}
    </h2>
  );
}

function Subtitle({ children }) {
  return (
    <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px 0", lineHeight: 1.55 }}>
      {children}
    </p>
  );
}

function InfoCard({ icon, children }) {
  return (
    <div style={{
      background: BLEU_FOND, border: "1px solid " + BLEU_CLAIR,
      borderRadius: 12, padding: "13px 15px", marginBottom: 14,
      fontSize: 14, color: BLEU_SECONDAIRE, lineHeight: 1.6,
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
      <label style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#1e293b", marginBottom: 6 }}>
        {label}{required ? <span style={{ color: "#ef4444" }}> *</span> : null}
      </label>
      {children}
    </div>
  );
}

var baseInput = {
  width: "100%", padding: "12px 14px", border: "2px solid #e2e8f0",
  borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box",
  fontFamily: "inherit", background: "#fff",
};

function Input({ value, onChange, placeholder, type }) {
  type = type || "text";
  return (
    <input type={type} value={value} placeholder={placeholder || ""}
      onChange={function(e) { onChange(e.target.value); }}
      style={baseInput}
      onFocus={function(e) { e.target.style.borderColor = BLEU_PRINCIPAL; }}
      onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows }) {
  rows = rows || 4;
  return (
    <textarea value={value} placeholder={placeholder || ""} rows={rows}
      onChange={function(e) { onChange(e.target.value); }}
      style={Object.assign({}, baseInput, { resize: "vertical" })}
      onFocus={function(e) { e.target.style.borderColor = BLEU_PRINCIPAL; }}
      onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }}
    />
  );
}

function Btn({ onClick, disabled, children, secondary }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        padding: "13px 24px", borderRadius: 12, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "#e2e8f0" : secondary ? "#f1f5f9" : "linear-gradient(135deg," + BLEU_PRINCIPAL + "," + BLEU_SECONDAIRE + ")",
        color: disabled ? "#94a3b8" : secondary ? "#475569" : "#fff",
        fontWeight: 700, fontSize: 15,
        boxShadow: (!secondary && !disabled) ? "0 4px 14px rgba(14,165,233,0.3)" : "none",
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
              color: active ? "#f59e0b" : "#e2e8f0",
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
        background: copied ? "#dcfce7" : BLEU_FOND, border: "none", borderRadius: 8,
        cursor: "pointer", padding: "4px 10px", fontSize: 13, marginLeft: 10,
        color: copied ? "#16a34a" : BLEU_SECONDAIRE, fontWeight: 600, flexShrink: 0,
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
      <span style={{ color: "#64748b", fontSize: 14 }}>{adresse}</span>
      <button onClick={copy} style={{
        background: copied ? "#dcfce7" : BLEU_FOND, border: "none", borderRadius: 8,
        cursor: "pointer", padding: "4px 10px", fontSize: 13, marginLeft: 10,
        color: copied ? "#16a34a" : BLEU_SECONDAIRE, fontWeight: 600, flexShrink: 0,
      }}>{copied ? "Copié !" : "Copier"}</button>
    </div>
  );
}

// ── Popup reprise ─────────────────────────────────────────────────────────────

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
        <h3 style={{ fontWeight: 800, fontSize: 18, color: "#0f172a", textAlign: "center", margin: "0 0 8px 0" }}>
          Formulaire en cours
        </h3>
        <p style={{ fontSize: 14, color: "#64748b", textAlign: "center", margin: "0 0 24px 0", lineHeight: 1.5 }}>
          Un formulaire non terminé a été trouvé pour <strong>{saved.arrivee && saved.arrivee.bien ? saved.arrivee.bien : "ce logement"}</strong>.
          Voulez-vous reprendre où vous en étiez ?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn onClick={onResume}>Reprendre le formulaire</Btn>
          <Btn secondary onClick={onRestart}>Recommencer à zéro</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Étapes ────────────────────────────────────────────────────────────────────

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
              display: "flex", gap: 14, padding: "14px 16px",
              background: "#fff", borderRadius: 14,
              fontSize: 14, color: "#334155", lineHeight: 1.5,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px #e2e8f0",
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
          padding: "16px 18px", borderRadius: 14, cursor: "pointer",
          background: data.lu ? "#f0fdf4" : "#f8fafc",
          border: "2px solid " + (data.lu ? "#22c55e" : "#e2e8f0"),
          marginBottom: 24, transition: "all 0.2s",
          boxShadow: data.lu ? "0 0 0 3px rgba(134,239,172,0.2)" : "none",
        }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
          border: "2px solid " + (data.lu ? "#22c55e" : "#cbd5e1"),
          background: data.lu ? "#22c55e" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
        }}>
          {data.lu ? <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>✓</span> : null}
        </div>
        <span style={{ fontSize: 14, color: "#334155", fontWeight: 600 }}>
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

function Step4EtatLieux({ data, setData, onNext, onPrev }) {
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
    var next = selected.includes(c)
      ? selected.filter(function(x) { return x !== c; })
      : selected.concat([c]);
    setData(Object.assign({}, data, { consommablesSelectionnes: next }));
  }

  return (
    <div>
      <SectionTitle>Consommables</SectionTitle>
      <Subtitle>Consommables dans le placard à droite du lit. Clé dans le meuble TV, porte gauche.</Subtitle>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: BLEU_SECONDAIRE, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          À laisser (compléter pour atteindre la quantité)
        </div>
        {CONSOMMABLES_LAISSER.map(function(c) {
          return (
            <div key={c.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 13px", background: "#f8fafc", borderRadius: 8,
              fontSize: 14, marginBottom: 6,
            }}>
              <span>{c.label}</span>
              <span style={{ background: "#dbeafe", color: "#1d4ed8", fontWeight: 700, borderRadius: 6, padding: "2px 10px", fontSize: 13 }}>{c.qt}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: BLEU_SECONDAIRE, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                  background: isSelected ? BLEU_PRINCIPAL : "#f1f5f9",
                  color: isSelected ? "#fff" : "#475569",
                  boxShadow: isSelected ? "0 2px 8px rgba(14,165,233,0.35)" : "none",
                }}
              >{isSelected ? "✓ " : ""}{c}</button>
            );
          })}
        </div>
        {selected.length > 0 ? (
          <div style={{ marginTop: 10, fontSize: 13, color: BLEU_PRINCIPAL, fontWeight: 600 }}>
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

function Step6Photos({ photos, setPhotos, onNext, onPrev }) {
  var inputRef = useRef();
  var [progress, setProgress] = useState({ current: 0, total: 0 });

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
      var currentFile = arr[index];
      processPhoto(currentFile).then(function(stamped) {
        results.push({
          id: Math.random().toString(36).slice(2),
          file: stamped,
          preview: URL.createObjectURL(stamped),
          name: currentFile.name,
        });
        index++;
        setProgress({ current: index, total: arr.length });
        // Utilisation de requestAnimationFrame pour un enchaînement plus fluide sur mobile
        requestAnimationFrame(processNext);
      });
    }
    processNext();
  }, [setPhotos]);

  function remove(id) {
    setPhotos(function(prev) { return prev.filter(function(p) { return p.id !== id; }); });
  }

  var isProcessing = progress.total > 0;
  var pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  var btnLabel = photos.length === 0 ? "Sélectionner les photos" : "Ajouter d'autres photos";
  var suivantLabel = "Suivant (" + photos.length + " photo" + (photos.length > 1 ? "s" : "") + ")";

  return (
    <div>
      <SectionTitle>Photos de fin de ménage</SectionTitle>
      <Subtitle>Sélectionnez toutes vos photos en une seule fois. L'horodatage est gravé automatiquement.</Subtitle>

      <div style={{ background: BLEU_FOND, border: "1px solid " + BLEU_CLAIR, borderRadius: 12, padding: "12px 15px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: BLEU_SECONDAIRE, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Photos attendues</div>
        {PIECES.map(function(p) {
          return (
            <div key={p.id} style={{ fontSize: 13, color: BLEU_SECONDAIRE, marginBottom: 3 }}>
              <strong>{p.label}</strong> — {p.exemples}
            </div>
          );
        })}
      </div>

      {isProcessing ? (
        <div style={{ background: BLEU_FOND, border: "1px solid " + BLEU_CLAIR, borderRadius: 12, padding: "16px", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: BLEU_SECONDAIRE, marginBottom: 8 }}>
            Traitement {progress.current} / {progress.total} ({pct}%)
          </div>
          <div style={{ background: "#e0f2fe", borderRadius: 8, height: 10, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ background: BLEU_PRINCIPAL, height: "100%", width: pct + "%", transition: "width 0.2s", borderRadius: 8 }} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Ne quittez pas cette page...</div>
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {photos.length} photo(s) prête(s)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {photos.map(function(p) {
              return (
                <div key={p.id} style={{ position: "relative" }}>
                  <img src={p.preview} alt={p.name} style={{
                    width: "100%", aspectRatio: "1", objectFit: "cover",
                    borderRadius: 10, border: "2px solid " + BLEU_PRINCIPAL, display: "block",
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

      {/* Upload box avec tailles de textes corrigées et réduites */}
      <div
        onClick={function() { if (!isProcessing && inputRef.current) inputRef.current.click(); }}
        style={{
          border: "2px dashed " + (isProcessing ? "#e2e8f0" : BLEU_CLAIR),
          borderRadius: 14, padding: "24px 16px", textAlign: "center",
          cursor: isProcessing ? "not-allowed" : "pointer",
          background: "#f8fafc", marginBottom: 24, opacity: isProcessing ? 0.5 : 1,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 6 }}>📷</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{btnLabel}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>Appuyez pour choisir depuis votre galerie</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          Sélection multiple · Horodatage automatique · Compression incluse
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={function(e) { handleFiles(e.target.files); }} />

      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev} disabled={isProcessing}>Retour</Btn>
        <Btn onClick={onNext} disabled={photos.length === 0 || isProcessing}>{suivantLabel}</Btn>
      </div>
    </div>
  );
}

function Step7Recap({ arrivee, etatLieux, consommables, photos, onPrev, onSubmit, sending, sendError, sendProgress }) {
  var etoiles = "";
  for (var i = 0; i < etatLieux.note; i++) etoiles += "★";
  for (var j = etatLieux.note; j < 5; j++) etoiles += "☆";
  var duree = arrivee.heureDebut + (consommables.heureFin ? " - " + consommables.heureFin : "");
  var selected = consommables.consommablesSelectionnes || [];

  return (
    <div>
      <SectionTitle>Récapitulatif</SectionTitle>
      <Subtitle>Vérifiez les informations avant d'envoyer le rapport.</Subtitle>

      <div style={{ background: "#f8fafc", borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Intervention</div>
        <div style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.9 }}>
          <div>{arrivee.nom}</div>
          <div>{arrivee.date} — {duree}</div>
          <div>{arrivee.bien}</div>
        </div>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>État des lieux</div>
        <div style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.9 }}>
          <div style={{ color: "#f59e0b", fontSize: 18 }}>{etoiles}</div>
          <div>{etatLieux.observations}</div>
        </div>
      </div>

      {selected.length > 0 ? (
        <div style={{ background: "#f8fafc", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Consommables à réapprovisionner</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {selected.map(function(c) {
              return <span key={c} style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 600 }}>{c}</span>;
            })}
          </div>
        </div>
      ) : null}

      {consommables.consommablesAPrevoir ? (
        <div style={{ background: "#f8fafc", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Consommables à prévoir</div>
          <div style={{ fontSize: 14, color: "#1e293b" }}>{consommables.consommablesAPrevoir}</div>
        </div>
      ) : null}

      {consommables.remarques ? (
        <div style={{ background: "#f8fafc", borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Remarques</div>
          <div style={{ fontSize: 14, color: "#1e293b" }}>{consommables.remarques}</div>
        </div>
      ) : null}

      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 14, padding: 16, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#15803d", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Photos</div>
        <div style={{ fontSize: 14, color: "#166534" }}>{photos.length} photo(s) horodatée(s) prêtes à l'envoi</div>
      </div>

      {sending ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: BLEU_SECONDAIRE, fontWeight: 600, marginBottom: 8 }}>
            Upload des photos : {sendProgress}%
          </div>
          <div style={{ background: "#e0f2fe", borderRadius: 8, height: 8, overflow: "hidden" }}>
            <div style={{ background: BLEU_PRINCIPAL, height: "100%", width: sendProgress + "%", transition: "width 0.3s", borderRadius: 8 }} />
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
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Rapport envoyé !</h2>
      <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6 }}>
        Merci <strong>{nom}</strong>, votre rapport pour <strong>{bien}</strong> a bien été transmis.
      </p>
      <div style={{ marginTop: 32, padding: "16px 20px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 14, fontSize: 14, color: "#166534" }}>
        Vous pouvez fermer cette fenêtre.
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

var TOTAL = 7;
var INIT_ARRIVEE = { date: "", heureDebut: "", nom: "", bien: "Le Nossa" };
var INIT_ATTENTION = { lu: false };
var INIT_ETAT = { note: 0, observations: "" };
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
  var [sendError, setSendError] = useState("");
  var [sendProgress, setSendProgress] = useState(0);
  var [showResume, setShowResume] = useState(false);
  var [savedDraft, setSavedDraft] = useState(null);

  // Vérifier s'il y a un brouillon au chargement
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

  // Sauvegarder à chaque changement d'étape
  useEffect(function() {
    if (done) { localStorage.removeItem(STORAGE_KEY); return; }
    if (step === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        step: step,
        arrivee: arrivee,
        attention: attention,
        etatLieux: etatLieux,
        consommables: consommables,
      }));
    } catch(e) {}
  }, [step, arrivee, attention, etatLieux, consommables, done]);

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

    var results = new Array(photos.length).fill(null);
    var completed = 0;
    var BATCH = 5;

    function runBatch(startIndex) {
      if (startIndex >= photos.length) {
        var validPhotos = results.filter(function(r) { return r !== null; });
        fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arrivee: arrivee, etatLieux: etatLieux, consommables: consommables, photos: validPhotos }),
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          setSending(false);
          if (data.success) {
            localStorage.removeItem(STORAGE_KEY);
            setDone(true);
          } else {
            setSendError("Erreur lors de l'envoi. Réessayez.");
          }
        })
        .catch(function() { setSending(false); setSendError("Erreur réseau. Vérifiez votre connexion."); });
        return;
      }
      var batch = photos.slice(startIndex, startIndex + BATCH);
      Promise.all(batch.map(function(p, i) {
        return uploadOne(p).then(function(result) {
          results[startIndex + i] = result;
          completed++;
          setSendProgress(Math.round((completed / photos.length) * 100));
        });
      })).then(function() { runBatch(startIndex + BATCH); });
    }

    runBatch(0);
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

      <div style={{ marginBottom: 20 }}>
        {/* L'icône de la maison 🏠 a été supprimée d'ici pour ne laisser que le texte */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>Rapport de ménage</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>Étape {step + 1} sur {TOTAL}</div>
          </div>
        </div>
        <ProgressBar current={step} total={TOTAL} />
      </div>

      {step === 0 && <Step1Infos onNext={next} />}
      {step === 1 && <Step2Arrivee data={arrivee} setData={setArrivee} onNext={next} onPrev={prev} />}
      {step === 2 && <Step3Attention data={attention} setData={setAttention} onNext={next} onPrev={prev} />}
      {step === 3 && <Step4EtatLieux data={etatLieux} setData={setEtatLieux} onNext={next} onPrev={prev} />}
      {step === 4 && <Step5Consommables data={consommables} setData={setConsommables} onNext={next} onPrev={prev} />}
      {step === 5 && <Step6Photos photos={photos} setPhotos={setPhotos} onNext={next} onPrev={prev} />}
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
  maxWidth: 480,
  margin: "0 auto",
  padding: "24px 20px 60px",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  minHeight: "100vh",
  background: "#fff",
};

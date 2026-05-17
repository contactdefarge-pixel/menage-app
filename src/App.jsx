import { useState, useRef, useCallback } from "react";

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

function padTwo(n) {
  return String(n).padStart(2, "0");
}

function getStamp(label) {
  var d = new Date();
  var date = padTwo(d.getDate()) + "/" + padTwo(d.getMonth() + 1) + "/" + d.getFullYear();
  var time = padTwo(d.getHours()) + "h" + padTwo(d.getMinutes());
  return (label ? label + "  -  " : "") + date + "  " + time;
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

function processPhoto(file, label) {
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

      var stamp = getStamp(label);
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
      }, "image/jpeg", 0.82);
    };
    img.src = url;
  });
}

function ProgressBar({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
      {Array.from({ length: total }).map(function(_, i) {
        return (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i < current ? "#0ea5e9" : i === current ? "#7dd3fc" : "#e2e8f0",
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

function InfoCard({ children }) {
  return (
    <div style={{
      background: "#f0f9ff", border: "1px solid #bae6fd",
      borderRadius: 12, padding: "13px 15px", marginBottom: 14,
      fontSize: 14, color: "#0369a1", lineHeight: 1.6,
    }}>{children}</div>
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
    <input
      type={type} value={value} placeholder={placeholder || ""}
      onChange={function(e) { onChange(e.target.value); }}
      style={baseInput}
      onFocus={function(e) { e.target.style.borderColor = "#0ea5e9"; }}
      onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows }) {
  rows = rows || 4;
  return (
    <textarea
      value={value} placeholder={placeholder || ""} rows={rows}
      onChange={function(e) { onChange(e.target.value); }}
      style={Object.assign({}, baseInput, { resize: "vertical" })}
      onFocus={function(e) { e.target.style.borderColor = "#0ea5e9"; }}
      onBlur={function(e) { e.target.style.borderColor = "#e2e8f0"; }}
    />
  );
}

function Btn({ onClick, disabled, children, secondary }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        padding: "13px 24px", borderRadius: 12, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "#e2e8f0" : secondary ? "#f1f5f9" : "linear-gradient(135deg,#0ea5e9,#0284c7)",
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
    <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
      {[1,2,3,4,5].map(function(s) {
        return (
          <button key={s}
            onClick={function() { onChange(s); }}
            onMouseEnter={function() { setHov(s); }}
            onMouseLeave={function() { setHov(0); }}
            style={{
              background: "none", border: "none", fontSize: 32, cursor: "pointer",
              color: s <= (hov || value) ? "#f59e0b" : "#cbd5e1",
              transform: s <= (hov || value) ? "scale(1.15)" : "scale(1)",
              transition: "color 0.15s, transform 0.1s",
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
        background: copied ? "#dcfce7" : "#e0f2fe", border: "none", borderRadius: 8,
        cursor: "pointer", padding: "4px 10px", fontSize: 13, marginLeft: 10,
        color: copied ? "#16a34a" : "#0369a1", fontWeight: 600, flexShrink: 0,
      }}>{copied ? "Copie !" : "Copier"}</button>
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
        background: copied ? "#dcfce7" : "#e0f2fe", border: "none", borderRadius: 8,
        cursor: "pointer", padding: "4px 10px", fontSize: 13, marginLeft: 10,
        color: copied ? "#16a34a" : "#0369a1", fontWeight: 600, flexShrink: 0,
      }}>{copied ? "Copie !" : "Copier"}</button>
    </div>
  );
}

function Step1Infos({ onNext }) {
  return (
    <div>
      <SectionTitle>Le Nossa</SectionTitle>
      <CopyAdresse adresse="33 Bis rue des Pyrénées, 65100 Lourdes" />
      <InfoCard>
        <strong>WiFi</strong>
        <CopyRow label="Réseau" value="SFR_FE68" />
        <CopyRow label="Mot de passe" value="7grh55pvtr7brf27fury" />
      </InfoCard>
      <InfoCard>
        <strong>Voyageurs</strong><br />
        3 max — 1 lit double 160x190 (parure marron ou grise) + 1 canapé lit
      </InfoCard>
      <InfoCard>
        <strong>Poubelles</strong><br />
        Local poubelle : Place Pyrénées. Badge sur les clés.
      </InfoCard>
      <InfoCard>
        <strong>Consommables</strong><br />
        Placard à droite du lit. Clé cachée dans le meuble TV, porte gauche.
      </InfoCard>
      <InfoCard>
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
    "Ouvrir les fenêtres en grand pour éviter l'humidité.",
    "Retirer systématiquement les cheveux dans les deux bondes de douche.",
    "Une fois le ménage terminé, veiller à laisser la VMC dans les toilettes allumée.",
  ];
  return (
    <div>
      <SectionTitle>Points d'attention</SectionTitle>
      <Subtitle>Merci de prendre connaissance de ces consignes avant de commencer.</Subtitle>
      {points.map(function(pt, i) {
        return (
          <div key={i} style={{
            display: "flex", gap: 12, padding: "12px 14px",
            background: "#f8fafc", borderRadius: 10, marginBottom: 10,
            fontSize: 14, color: "#334155", lineHeight: 1.5,
            borderLeft: "3px solid #0ea5e9",
          }}>
            <span style={{ fontWeight: 700, color: "#0ea5e9", minWidth: 20 }}>{i + 1}.</span>
            <span>{pt}</span>
          </div>
        );
      })}
      <div
        onClick={function() { setData(Object.assign({}, data, { lu: !data.lu })); }}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px", borderRadius: 12, cursor: "pointer",
          background: data.lu ? "#f0fdf4" : "#f8fafc",
          border: "2px solid " + (data.lu ? "#86efac" : "#e2e8f0"),
          margin: "20px 0", transition: "all 0.2s",
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: "2px solid " + (data.lu ? "#22c55e" : "#cbd5e1"),
          background: data.lu ? "#22c55e" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
        }}>
          {data.lu ? <span style={{ color: "#fff", fontSize: 13 }}>&#10003;</span> : null}
        </div>
        <span style={{ fontSize: 14, color: "#334155", fontWeight: 500 }}>
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
        Vérifiez l'appartement à votre arrivée. À la moindre anomalie, prenez des photos — c'est crucial pour les réclamations sur les plateformes.
      </Subtitle>
      <Field label="Notez les voyageurs" required>
        <StarRating value={data.note} onChange={function(v) { setData(Object.assign({}, data, { note: v })); }} />
      </Field>
      <Field label="Observations à l'arrivée" required>
        <Textarea
          value={data.observations}
          onChange={function(v) { setData(Object.assign({}, data, { observations: v })); }}
          placeholder="Problèmes constatés + photos si nécessaire. Sinon écrire RAS."
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
  return (
    <div>
      <SectionTitle>Consommables</SectionTitle>
      <Subtitle>
        Consommables dans le placard à droite du lit. Clé dans le meuble TV, porte gauche.
      </Subtitle>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#0369a1", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
              <span style={{
                background: "#dbeafe", color: "#1d4ed8",
                fontWeight: 700, borderRadius: 6, padding: "2px 10px", fontSize: 13,
              }}>{c.qt}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#0369a1", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          À vérifier
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CONSOMMABLES_VERIFIER.map(function(c) {
            return (
              <span key={c} style={{
                padding: "5px 13px", background: "#f1f5f9", borderRadius: 20,
                fontSize: 13, color: "#475569", border: "1px solid #e2e8f0",
              }}>{c}</span>
            );
          })}
        </div>
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
  var [processing, setProcessing] = useState(false);

  var handleFiles = useCallback(function(files) {
    setProcessing(true);
    var arr = Array.from(files).filter(function(f) { return f.type.startsWith("image/"); });
    var results = [];
    var index = 0;
    function next() {
      if (index >= arr.length) {
        setPhotos(function(prev) { return prev.concat(results); });
        setProcessing(false);
        return;
      }
      processPhoto(arr[index], "Fin de menage").then(function(stamped) {
        results.push({
          id: Math.random().toString(36).slice(2),
          file: stamped,
          preview: URL.createObjectURL(stamped),
          name: arr[index].name,
        });
        index++;
        next();
      });
    }
    next();
  }, [setPhotos]);

  function remove(id) {
    setPhotos(function(prev) { return prev.filter(function(p) { return p.id !== id; }); });
  }

  var btnLabel = photos.length === 0
    ? "Sélectionner les photos"
    : "Ajouter d'autres photos";

  var suivantLabel = "Suivant (" + photos.length + " photo" + (photos.length > 1 ? "s" : "") + ")";

  return (
    <div>
      <SectionTitle>Photos de fin de ménage</SectionTitle>
      <Subtitle>
        Sélectionnez toutes vos photos en une seule fois. L'horodatage est gravé automatiquement sur chaque photo.
      </Subtitle>

      <div style={{
        background: "#f0f9ff", border: "1px solid #bae6fd",
        borderRadius: 12, padding: "12px 15px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Photos attendues
        </div>
        {PIECES.map(function(p) {
          return (
            <div key={p.id} style={{ fontSize: 13, color: "#0369a1", marginBottom: 3 }}>
              <strong>{p.label}</strong> — {p.exemples}
            </div>
          );
        })}
      </div>

      {photos.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {photos.length} photo(s) ajoutée(s)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {photos.map(function(p) {
              return (
                <div key={p.id} style={{ position: "relative" }}>
                  <img src={p.preview} alt={p.name} style={{
                    width: "100%", aspectRatio: "1", objectFit: "cover",
                    borderRadius: 10, border: "2px solid #0ea5e9", display: "block",
                  }} />
                  <button
                    onClick={function() { remove(p.id); }}
                    style={{
                      position: "absolute", top: 4, right: 4,
                      background: "rgba(0,0,0,0.6)", color: "#fff",
                      border: "none", borderRadius: "50%",
                      width: 22, height: 22, cursor: "pointer",
                      fontSize: 12, lineHeight: "22px", textAlign: "center", padding: 0,
                    }}
                  >x</button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div
        onClick={function() { if (!processing && inputRef.current) inputRef.current.click(); }}
        onDragOver={function(e) { e.preventDefault(); }}
        onDrop={function(e) { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        style={{
          border: "2px dashed #bae6fd", borderRadius: 14,
          padding: "32px 20px", textAlign: "center",
          cursor: processing ? "wait" : "pointer",
          background: processing ? "#f0f9ff" : "#f8fafc",
          marginBottom: 24,
        }}
      >
        {processing ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0ea5e9" }}>Traitement en cours...</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Compression et horodatage des photos</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 36, marginBottom: 8 }}>&#128247;</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{btnLabel}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Appuyez pour choisir depuis votre galerie</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
              Sélection multiple · Horodatage automatique · Compression incluse
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef} type="file" accept="image/*" multiple
        style={{ display: "none" }}
        onChange={function(e) { handleFiles(e.target.files); }}
      />

      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev}>Retour</Btn>
        <Btn onClick={onNext} disabled={photos.length === 0}>{suivantLabel}</Btn>
      </div>
    </div>
  );
}

function Step7Recap({ arrivee, etatLieux, consommables, photos, onPrev, onSubmit }) {
  var etoiles = "";
  for (var i = 0; i < etatLieux.note; i++) etoiles += "\u2605";
  for (var j = etatLieux.note; j < 5; j++) etoiles += "\u2606";
  var duree = arrivee.heureDebut + (consommables.heureFin ? " - " + consommables.heureFin : "");

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
          <div>Note : {etoiles}</div>
          <div>{etatLieux.observations}</div>
        </div>
      </div>

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
        <div style={{ fontSize: 14, color: "#166534" }}>
          {photos.length} photo(s) horodatée(s) prêtes à l'envoi
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <Btn secondary onClick={onPrev}>Retour</Btn>
        <Btn onClick={onSubmit}>Envoyer le rapport</Btn>
      </div>
    </div>
  );
}

function StepSuccess({ nom, bien }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <div style={{ fontSize: 64, marginBottom: 20, color: "#22c55e" }}>&#10003;</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
        Rapport envoyé !
      </h2>
      <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6 }}>
        Merci <strong>{nom}</strong>, votre rapport pour <strong>{bien}</strong> a bien été transmis.
      </p>
      <div style={{
        marginTop: 32, padding: "16px 20px",
        background: "#f0fdf4", border: "1px solid #86efac",
        borderRadius: 14, fontSize: 14, color: "#166534",
      }}>
        Vous pouvez fermer cette fenêtre.
      </div>
    </div>
  );
}

var TOTAL = 7;

export default function App() {
  var [step, setStep] = useState(0);
  var [arrivee, setArrivee] = useState({ date: "", heureDebut: "", nom: "", bien: "Le Nossa" });
  var [attention, setAttention] = useState({ lu: false });
  var [etatLieux, setEtatLieux] = useState({ note: 0, observations: "" });
  var [consommables, setConsommables] = useState({ consommablesAPrevoir: "", remarques: "", heureFin: "" });
  var [photos, setPhotos] = useState([]);
  var [done, setDone] = useState(false);

  function next() { setStep(function(s) { return Math.min(s + 1, TOTAL - 1); }); }
  function prev() { setStep(function(s) { return Math.max(s - 1, 0); }); }

  if (done) {
    return (
      <div style={wrap}>
        <StepSuccess nom={arrivee.nom} bien={arrivee.bien} />
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg,#0ea5e9,#0284c7)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>&#127968;</div>
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
          onSubmit={function() { setDone(true); }}
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

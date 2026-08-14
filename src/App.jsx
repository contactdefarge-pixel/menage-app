import React, { useState, useRef, useCallback, useEffect } from "react";

/* ─── DESIGN SYSTEM ─────────────────────────────────────────────────── */
var DS = {
  color: {
    primary:      "#00bab3",
    primaryDark:  "#085157",
    primaryLight: "#4dd4cf",
    primaryBg:    "#f0fafa",
    primaryBorder:"#99e0dd",
    primarySoft:  "#e0f5f5",
    primaryMuted: "#5b8f93",
    surface:      "#ffffff",
    surfaceAlt:   "#f6fbfc",
    border:       "#e2ecee",
    text:         "#085157",
    textMuted:    "#5b8f93",
    textFaint:    "#94b8bb",
    success:      "#16a34a",
    successBg:    "#f0fdf4",
    successBorder:"#86efac",
    warning:      "#9a3412",
    warningBg:    "#fff7ed",
    warningBorder:"#fb923c",
    danger:       "#dc2626",
    dangerBg:     "#fef2f2",
    dangerBorder: "#fca5a5",
    star:         "#f59e0b",
  },
  font: {
    heading: "'Space Grotesk', system-ui, sans-serif",
    body:    "'Wix Madefor Text', system-ui, sans-serif",
  },
  radius: {
    sm:  8,
    md:  12,
    lg:  16,
    xl:  20,
    pill:99,
  },
};

/* ─── DATA ───────────────────────────────────────────────────────────── */
const PIECES = [
  { id: "cuisine",  label: "Cuisine",        exemples: "Vue générale, évier, plaques/micro-ondes" },
  { id: "sdb",      label: "Salle de bain",  exemples: "Douche, lavabo/miroir, bondes et sol" },
  { id: "wc",       label: "Toilettes",      exemples: "WC général, VMC allumée" },
  { id: "chambre",  label: "Chambre",        exemples: "Lit fait, canapé-lit rangé, vue générale" },
  { id: "entree",   label: "Entrée & Salon", exemples: "Couloir, salon général" },
];

const CONSOMMABLES_LAISSER = [
  { id:"cafe",   label:"Dosettes café",           qt:"x4" },
  { id:"the",    label:"Thé (2 de chaque variété)",qt:"x4" },
  { id:"sucre",  label:"Buchettes de sucre",       qt:"x6" },
  { id:"papier", label:"Papier toilette",           qt:"x2" },
  { id:"essuie", label:"Essuie-tout",               qt:"x1" },
  { id:"eponge", label:"Éponge (à changer)",        qt:"x1" },
];

const CONSOMMABLES_VERIFIER = [
  "Liquide vaisselle","Gel WC","Savon main","Gel douche","Huile","Sel","Poivre",
  "Sacs poubelles","Sacs poubelles SdB","Décap' Four","Cif","Fongicide",
];

const STORAGE_KEY        = "menage_draft";
const PHOTO_ANALYSES_KEY = "photo_analyses";
const HASHES_KEY         = "menage_hashes";

/* CHAMPS SURVEILLES ET ETAPES ASSOCIEES */
var WATCHED_FIELDS = [
  { key:"proprietaire",        label:"Facturation",               step:0 },
  { key:"adresse",             label:"Adresse",                   step:0 },
  { key:"chambres",            label:"Nombre de chambres",        step:0 },
  { key:"voyageurs",           label:"Nombre de voyageurs",       step:0 },
  { key:"lits",                label:"Types de lits",             step:0 },
  { key:"wifi",                label:"WiFi",                      step:0 },
  { key:"acces",               label:"Acces logement",            step:0 },
  { key:"boiteCle",            label:"Boite a cle",               step:0 },
  { key:"poubelles",           label:"Poubelles",                 step:0 },
  { key:"forfaitMenage",       label:"Forfait menage",            step:0 },
  { key:"pointsAttention",     label:"Points d attention",        step:2 },
  { key:"consommables",        label:"Consommables",              step:4 },
  { key:"consommablesALaisser",label:"Consommables a laisser",    step:4 },
  { key:"photosReference",     label:"Photos de reference",       step:5 },
];

var STEP_LABELS = { 0:"Informations du logement", 2:"Points d attention", 4:"Consommables", 5:"Photos de fin de menage" };

function hashString(str){ var s=String(str||""),h=0; for(var i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;} return h.toString(36); }
function hashField(val){ if(Array.isArray(val)) return hashString(val.map(function(v){return JSON.stringify(v);}).join("|")); return hashString(val); }
function buildHashes(logement){ var r={}; WATCHED_FIELDS.forEach(function(f){r[f.key]=hashField(logement[f.key]);}); return r; }
function getStoredHashes(slug){ try{var a=JSON.parse(localStorage.getItem(HASHES_KEY)||"{}");return a[slug]||null;}catch(e){return null;} }
function saveHashes(slug,hashes,logement){
  try{
    var a=JSON.parse(localStorage.getItem(HASHES_KEY)||"{}");
    a[slug]=hashes;
    // Also store photo names for per-piece change detection
    if(logement&&logement.photosReference){
      var names={};
      (logement.photosReference||[]).forEach(function(p){names[p.nom]=1;});
      a[slug]._photoNames=names;
    }
    localStorage.setItem(HASHES_KEY,JSON.stringify(a));
  }catch(e){}
}
function detectChanges(slug,logement){
  var stored=getStoredHashes(slug);
  if(!stored) return [];
  var current=buildHashes(logement);
  var changed=[];
  WATCHED_FIELDS.forEach(function(f){
    if(f.key==="photosReference"){
      if(stored[f.key]===undefined||stored[f.key]===current[f.key]) return;
      // Detect which pieces have new photos
      var storedNames={};
      try{ var sp=JSON.parse(localStorage.getItem(HASHES_KEY)||"{}"); var spn=sp[slug]&&sp[slug]._photoNames; if(spn) storedNames=spn; }catch(e){}
      var newPhotos=(logement.photosReference||[]).filter(function(p){ return !storedNames[p.nom]; });
      var newPieces={};
      newPhotos.forEach(function(p){
        var parsed=parseNomPhoto(p.nom);
        var def=trouverDef(parsed.nomPiece);
        var label=def?(parsed.numero?def.label+" "+parsed.numero:def.label):(parsed.nomPiece||"Autre");
        if(!newPieces[label]) newPieces[label]=[];
        newPieces[label].push(p.nom);
      });
      var pieceDetails=Object.keys(newPieces).map(function(k){return k+" ("+newPieces[k].length+" photo"+(newPieces[k].length>1?"s":"")+")";}).join(", ");
      changed.push({key:f.key,label:pieceDetails?"Photos de référence — "+pieceDetails:"Photos de référence",step:f.step,newPhotos:newPhotos.map(function(p){return p.nom;})});
    } else {
      if(stored[f.key]!==undefined&&stored[f.key]!==current[f.key]) changed.push({key:f.key,label:f.label,step:f.step});
    }
  });
  return changed;
}

const DEFAULT_LOGEMENT = {
  nom:"",slug:"",adresse:"",wifi:"",voyageurs:"",lits:"",acces:"",boiteCle:"",
  poubelles:"",consommables:"",consommablesALaisser:"",photosReference:[],
  pointsAttention:"",proprietaire:"",forfaitMenage:"",
};

const VISITE_STEPS  = ["infos","attention","consommables","photos"];
const VISITE_LABELS = { infos:"Infos", attention:"Points d'attention", consommables:"Consommables", photos:"Photos de référence" };

var TOTAL       = 7;
var INIT_ARRIVEE = { date:"", heureDebut:"", nom:"", bien:"" };
var INIT_ATTENTION = { lu:false };
var INIT_ETAT   = { note:0, observations:"" };
var INIT_CONSO  = { consommablesAPrevoir:"", remarques:"", heureFin:"", consommablesSelectionnes:[] };

/* ─── PURE HELPERS ───────────────────────────────────────────────────── */
function padTwo(n)  { return String(n).padStart(2,"0"); }
function getStamp() {
  var d=new Date();
  return padTwo(d.getDate())+"/"+padTwo(d.getMonth()+1)+"/"+d.getFullYear()+"  "+padTwo(d.getHours())+"h"+padTwo(d.getMinutes());
}
function slugify(v) {
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}
function cleanNotionText(v) { return String(v||"").replace(/<br\s*\/?>/gi,"\n").trim(); }

function normalizeLogement(raw) {
  raw=raw||{};
  // rt() ensures a field is always a rich text array
  function rt(v){ if(Array.isArray(v)) return v; if(typeof v==="string"&&v) return [{text:v,bold:false,italic:false,underline:false,strikethrough:false,code:false,color:null,href:null}]; return []; }
  return {
    id:raw.id||"", slug:raw.slug||slugify(raw.nom), nom:raw.nom||"",
    adresse:raw.adresse||"", wifi:rt(raw.wifi), voyageurs:raw.voyageurs||"",
    chambres:raw.chambres||"", lits:rt(raw.lits), acces:rt(raw.acces),
    boiteCle:raw.boiteCle||"", poubelles:rt(raw.poubelles),
    consommables:rt(raw.consommables), consommablesALaisser:rt(raw.consommablesALaisser),
    photosReference:raw.photosReference||[], pointsAttention:rt(raw.pointsAttention),
    proprietaire:raw.proprietaire||"", forfaitMenage:raw.forfaitMenage||"",
  };
}

/* Rich text plain text extraction */
function rtPlain(rt){ if(!rt) return ""; if(typeof rt==="string") return rt; if(Array.isArray(rt)) return rt.map(function(t){return t.text||"";}).join(""); return ""; }

/* ─── RICH TEXT RENDERER ─────────────────────────────────────────────── */
var NOTION_COLOR_MAP = {
  "red":          "#e03e3e", "red_background":    "#fbe4e4",
  "orange":       "#d9730d", "orange_background": "#f8eccc",
  "yellow":       "#dfab01", "yellow_background": "#fef3c7",
  "green":        "#0f7b6c", "green_background":  "#ddedea",
  "blue":         "#0b6e99", "blue_background":   "#ddebf1",
  "purple":       "#6940a5", "purple_background": "#eae4f2",
  "pink":         "#ad1a72", "pink_background":   "#f4dfeb",
  "gray":         "#9b9a97", "gray_background":   "#ebeced",
  "brown":        "#64473a", "brown_background":  "#e9e5e3",
};

function RichSpan({seg}){
  var style={};
  if(seg.bold)          style.fontWeight="700";
  if(seg.italic)        style.fontStyle="italic";
  if(seg.underline)     style.textDecoration="underline";
  if(seg.strikethrough) style.textDecoration="line-through";
  if(seg.code)          { style.fontFamily="monospace"; style.background="#f0f0f0"; style.padding="1px 4px"; style.borderRadius=4; style.fontSize="0.9em"; }
  if(seg.color&&NOTION_COLOR_MAP[seg.color]){
    if(seg.color.endsWith("_background")) style.background=NOTION_COLOR_MAP[seg.color];
    else style.color=NOTION_COLOR_MAP[seg.color];
  }
  if(seg.href) return <a href={seg.href} target="_blank" rel="noopener noreferrer" style={Object.assign({color:DS.color.primary,textDecoration:"underline"},style)}>{seg.text}</a>;
  return <span style={style}>{seg.text}</span>;
}

function RichLine({segments}){
  if(!segments||segments.length===0) return null;
  return <span>{segments.map(function(seg,i){return <RichSpan key={i} seg={seg}/>;})}</span>;
}

function RichText({value}){
  if(!value) return null;
  // value is array of rich text segments — split by newline characters in text
  var lines = [];
  var currentLine = [];
  (Array.isArray(value)?value:[]).forEach(function(seg){
    var parts = (seg.text||"").split("\n");
    parts.forEach(function(part, pi){
      currentLine.push(Object.assign({},seg,{text:part}));
      if(pi < parts.length-1){ lines.push(currentLine); currentLine=[]; }
    });
  });
  lines.push(currentLine);
  return (
    <span>
      {lines.map(function(line,i){
        return <span key={i}><RichLine segments={line}/>{i<lines.length-1?<br/>:null}</span>;
      })}
    </span>
  );
}

function parseConsommablesALaisser(text) {
  if(!text) return [];
  var str = Array.isArray(text) ? text.map(function(t){return t.text||"";}).join("") : String(text||"");
  return str.split("\n").map(function(line){
    line=line.trim(); if(!line) return null;
    var qtMatch=line.match(/x(\d+)/i), qt=qtMatch?"x"+qtMatch[1]:"";
    var commentMatch=line.match(/\(([^)]+)\)/), comment=commentMatch?commentMatch[1]:"";
    var nom=line.replace(/x\d+/i,"").replace(/\([^)]+\)/,"").replace(/\s+/g," ").trim();
    if(!nom) return null;
    return {label:nom,qt:qt,comment:comment};
  }).filter(Boolean);
}

var POINTS_EMOJI_MAP = [
  { keys: ["fenêtre","fenetre","aération","aerer","humidité","humidite","ventil"], emoji: "🪟" },
  { keys: ["douche","bonde","bondes","cheveux","siphon","évacuation","evacuation"], emoji: "🚿" },
  { keys: ["vmc","ventilation","toilette","wc","extraction"], emoji: "💨" },
  { keys: ["poubelle","déchet","dechet","tri","sac"], emoji: "🗑️" },
  { keys: ["lit","parure","drap","coussin","oreiller","couette"], emoji: "🛏️" },
  { keys: ["porte","clé","cle","code","boite","boîte","accès","acces","fermer"], emoji: "🔑" },
  { keys: ["cuisine","four","plaque","micro","frigo","réfrigérateur","vaisselle"], emoji: "🍳" },
  { keys: ["lumière","lumiere","lampe","éclairage","electricite"], emoji: "💡" },
  { keys: ["chauffage","thermostat","température","climatisation"], emoji: "🌡️" },
  { keys: ["wifi","internet","box","routeur"], emoji: "📶" },
  { keys: ["photo","image","appareil"], emoji: "📷" },
  { keys: ["canapé","canape","salon","meuble"], emoji: "🛋️" },
  { keys: ["bain","baignoire","lavabo","robinet"], emoji: "🛁" },
  { keys: ["araignée","araigne","insecte"], emoji: "🕷️" },
  { keys: ["balais", "balai"], emoji: "🧹" },
  { keys: ["barbecue", "bbq", "poele", "poêle"], emoji: "🔥" },
  { keys: ["jardin"], emoji: "🏡" },
  { keys: ["jacuzzi", "baignoire balnéo"], emoji: "🫧" },
];

function parsePointsAttention(text) {
  if (!text) return [];
  var str = Array.isArray(text) ? text.map(function(t){return t.text||"";}).join("") : String(text||"");
  return str.split("\n")
    .map(function(l) { return l.trim().replace(/^[•\-\*]\s*/, ""); })
    .filter(Boolean)
    .map(function(line) {
      var lower = line.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      var found = POINTS_EMOJI_MAP.find(function(entry) {
        return entry.keys.some(function(k) { return lower.includes(k); });
      });
      return { text: line, emoji: found ? found.emoji : "\u2705" };
    });
}

/* photo grouping (shared) */
var PIECES_DEFS = [
  {key:"entree",       label:"Entrée",         aliases:["entree","entrée","couloir","hall"],                      order:1},
  {key:"cuisine",      label:"Cuisine",         aliases:["cuisine"],                                               order:2},
  {key:"salon",        label:"Salon",           aliases:["salon","living","séjour","sejour"],                      order:3},
  {key:"salle a manger",label:"Salle à manger", aliases:["salle à manger","salle a manger"],                      order:4},
  {key:"chambre",      label:"Chambre",         aliases:["chambre","bedroom"],                                     order:5},
  {key:"salle de bain",label:"Salle de bain",   aliases:["salle de bain","sdb","salle_de_bain","bathroom"],       order:6},
  {key:"wc",           label:"WC",              aliases:["wc","toilette","toilettes"],                             order:90},
  {key:"exterieur",    label:"Extérieur",        aliases:["exterieur","extérieur","exter","dehors","balcon","terrasse","jardin"],order:91},
];
function normalizeStr(s){ return (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim(); }
function parseNomPhoto(nom){
  var base=(nom||"").replace(/\.[^.]+$/,"");
  var sansSuffixe=base.replace(/\(\d+\)\s*$/,"").trim();
  var match=sansSuffixe.match(/^(.*?)(?:[-_\s]+(\d+))?\s*$/);
  var nomPiece=normalizeStr((match&&match[1]?match[1]:sansSuffixe).replace(/_/g," "));
  var numero=match&&match[2]?parseInt(match[2],10):null;
  return {nomPiece:nomPiece,numero:numero};
}
function trouverDef(nomPiece){
  return PIECES_DEFS.find(function(def){
    return def.aliases.some(function(alias){ var a=normalizeStr(alias); return nomPiece===a||nomPiece.startsWith(a); });
  });
}
function grouperPhotos(photosRef){
  var groupes={};
  (photosRef||[]).forEach(function(p){
    var parsed=parseNomPhoto(p.nom);
    var def=trouverDef(parsed.nomPiece);
    var groupKey,label,order;
    if(def){
      groupKey=parsed.numero?def.key+"-"+parsed.numero:def.key;
      label=parsed.numero?def.label+" "+parsed.numero:def.label;
      order=def.order*100+(parsed.numero||0);
    } else {
      groupKey=parsed.nomPiece||"autre";
      label=(parsed.nomPiece||"Autre");
      label=label.charAt(0).toUpperCase()+label.slice(1);
      if(parsed.numero){groupKey+="-"+parsed.numero; label+=" "+parsed.numero;}
      order=50*100+(parsed.numero||0);
    }
    if(!groupes[groupKey]) groupes[groupKey]={label:label,order:order,photos:[]};
    groupes[groupKey].photos.push(p);
  });
  return Object.keys(groupes).map(function(k){return [k,groupes[k]];}).sort(function(a,b){return a[1].order-b[1].order;});
}

/* photo analysis cache */
function getPhotoAnalysisCache(){ try{return JSON.parse(localStorage.getItem(PHOTO_ANALYSES_KEY)||"{}");}catch(e){return {};} }
function savePhotoAnalysis(id,piece){ try{var c=getPhotoAnalysisCache();c[id]=piece;localStorage.setItem(PHOTO_ANALYSES_KEY,JSON.stringify(c));}catch(e){} }

/* ─── CANVAS STAMP ───────────────────────────────────────────────────── */
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function processPhoto(file){
  return new Promise(function(resolve){
    var img=new Image(),url=URL.createObjectURL(file);
    img.onload=function(){
      var maxW=2400,scale=img.width>maxW?maxW/img.width:1;
      var w=Math.round(img.width*scale),h=Math.round(img.height*scale);
      var canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
      var ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,w,h);
      var stamp=getStamp(),fontSize=Math.max(18,Math.round(w*0.025));
      ctx.font="bold "+fontSize+"px monospace";
      var tw=ctx.measureText(stamp).width,pad=fontSize*0.6,bh=fontSize+pad*2,bw=tw+pad*2,margin=fontSize*0.8;
      ctx.fillStyle="rgba(0,0,0,0.65)";roundRect(ctx,margin,h-bh-margin,bw,bh,6);ctx.fill();
      ctx.fillStyle="#ffffff";ctx.fillText(stamp,margin+pad,h-margin-pad);
      canvas.toBlob(function(blob){URL.revokeObjectURL(url);resolve(new File([blob],file.name,{type:"image/jpeg"}));
      },"image/jpeg",0.92);
    };img.src=url;
  });
}

/* ─── HOOK ───────────────────────────────────────────────────────────── */
function useScreenWakeLock(active){
  var [status,setStatus]=useState("idle");
  var wakeLockRef=useRef(null);
  useEffect(function(){
    var cancelled=false;
    function release(){ if(wakeLockRef.current){wakeLockRef.current.release().catch(function(){});wakeLockRef.current=null;} }
    function request(){
      if(!active){release();setStatus("idle");return;}
      if(!("wakeLock" in navigator)){setStatus("unsupported");return;}
      if(document.visibilityState!=="visible"){setStatus("waiting");return;}
      navigator.wakeLock.request("screen").then(function(lock){
        if(cancelled){lock.release().catch(function(){});return;}
        wakeLockRef.current=lock;setStatus("active");
        lock.addEventListener("release",function(){if(!cancelled&&active)setStatus("waiting");});
      }).catch(function(){if(!cancelled)setStatus("blocked");});
    }
    function onVis(){if(active&&document.visibilityState==="visible"&&!wakeLockRef.current)request();}
    request();document.addEventListener("visibilitychange",onVis);
    return function(){cancelled=true;document.removeEventListener("visibilitychange",onVis);release();};
  },[active]);
  return status;
}

/* ─── ICONS ──────────────────────────────────────────────────────────── */
var ic = { stroke: DS.color.primaryDark, sw: 2 };
function Ico({d,cx,cy,r,points,x1,y1,x2,y2,extra,size}){
  size=size||20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={ic.stroke} strokeWidth={ic.sw} strokeLinecap="round" strokeLinejoin="round">
      {d&&<path d={d}/>}{extra&&extra.map(function(e,i){return <path key={i} d={e}/>;})}{cx!=null&&<circle cx={cx} cy={cy} r={r} fill={ic.stroke}/>}{points&&<polyline points={points}/>}{x1!=null&&<line x1={x1} y1={y1} x2={x2} y2={y2}/>}
    </svg>
  );
}
function IconWifi()    { return <Ico d="M5 12.55a11 11 0 0 1 14.08 0" extra={["M1.42 9a16 16 0 0 1 21.16 0","M8.53 16.11a6 6 0 0 1 6.95 0"]} cx={12} cy={20} r={1}/>; }
function IconUsers()   { return <Ico d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" extra={["M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"]} cx={9} cy={7} r={4}/>; }
function IconTrash()   { return <Ico points="3 6 5 6 21 6" extra={["M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6","M10 11v6","M14 11v6","M9 6V4h6v2"]}/>; }
function IconBox()     { return <Ico d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" extra={["M3.27 6.96 12 12.01 20.73 6.96"]} x1={12} y1={22.08} x2={12} y2={12}/>; }
function IconKey()     { return <Ico d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>; }
function IconReceipt() { return <Ico d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" extra={["M8 8h8","M8 12h8","M8 16h5"]}/>; }
function IconEuro() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={DS.color.primaryDark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h12"/>
      <path d="M4 14h12"/>
      <path d="M19 6a7 7 0 1 0 0 12"/>
    </svg>
  );
}
function IconCheck(){ return <svg width="72" height="72" viewBox="0 0 72 72" fill="none"><rect x="8" y="8" width="56" height="56" rx="18" fill="#dcfce7"/><rect x="8" y="8" width="56" height="56" rx="18" stroke="#86efac" strokeWidth="2"/><path d="M24 36.5L32.2 44L49 28" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IconCheckSmall(){ return <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4.5 10.4L8.1 14L15.8 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IconCircleCheck(){ return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={DS.color.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l3 3 5-5.5"/></svg>; }

/* ─── GOOGLE FONTS ───────────────────────────────────────────────────── */
(function(){
  if(document.getElementById("izinest-fonts")) return;
  var link=document.createElement("link");
  link.id="izinest-fonts"; link.rel="stylesheet";
  link.href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Wix+Madefor+Text:ital,wght@0,400;0,500;0,600;1,400&display=swap";
  document.head.appendChild(link);
})();

/* ─── PRIMITIVE UI ───────────────────────────────────────────────────── */
function ProgressBar({current,total}){
  return (
    <div style={{display:"flex",gap:3,marginBottom:28}}>
      {Array.from({length:total}).map(function(_,i){
        return <div key={i} style={{flex:1,height:3,borderRadius:2,background:i<current?DS.color.primary:i===current?DS.color.primaryLight:DS.color.border,transition:"background 0.3s"}}/>;
      })}
    </div>
  );
}

function AppHeader({nom,step,total}){
  return (
    <div style={{
      background:DS.color.primaryDark,
      margin:"-24px -20px 24px",
      padding:"20px 20px 16px",
      fontFamily:DS.font.heading,
    }}>
      <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.55)",marginBottom:4}}>
        izinest · rapport de ménage
      </div>
      <div style={{fontSize:22,fontWeight:700,color:"#fff",lineHeight:1.1}}>{nom||"Chargement…"}</div>
      <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginTop:2}}>Étape {step+1} sur {total}</div>
    </div>
  );
}

function SectionTitle({children}){
  return <h2 style={{fontFamily:DS.font.heading,fontSize:20,fontWeight:700,color:DS.color.primaryDark,margin:"0 0 6px",letterSpacing:"-0.01em"}}>{children}</h2>;
}
function Subtitle({children}){
  return <p style={{fontFamily:DS.font.body,color:DS.color.textMuted,fontSize:14,margin:"0 0 20px",lineHeight:1.55}}>{children}</p>;
}

/* InfoCard — icon bubble + label + value */
function InfoCard({icon,title,children}){
  return (
    <div style={{
      display:"flex",alignItems:"flex-start",gap:12,
      background:DS.color.primaryBg,
      border:"1px solid "+DS.color.primaryBorder,
      borderRadius:DS.radius.md,padding:"12px 14px",marginBottom:10,
    }}>
      <div style={{
        width:34,height:34,flexShrink:0,borderRadius:DS.radius.sm,
        background:DS.color.primarySoft,
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:DS.font.heading,fontSize:10,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:DS.color.primary,marginBottom:2}}>{title}</div>
        <div style={{fontFamily:DS.font.body,fontSize:13,color:DS.color.primaryDark,lineHeight:1.5}}>{children}</div>
      </div>
    </div>
  );
}

function InfoCardWithCopy({icon,title,text}){
  var isEmpty = Array.isArray(text) ? text.every(function(t){return !(t.text||"").trim();}) : !cleanNotionText(text);
  if(isEmpty) return null;
  return (
    <InfoCard icon={icon} title={title}>
      {Array.isArray(text) ? <RichText value={text}/> : <FormattedText>{text}</FormattedText>}
    </InfoCard>
  );
}

function WifiCard({text}){
  var plain = Array.isArray(text) ? text.map(function(t){return t.text||"";}).join("") : cleanNotionText(text);
  if(!plain) return null;
  var lines=plain.split("\n").filter(Boolean);
  return (
    <InfoCard icon={<IconWifi/>} title="WiFi">
      {lines.map(function(line,i){
        var isMdp=line.toLowerCase().includes("mot de passe");
        var val=isMdp?line.split(":").slice(1).join(":").trim():"";
        return (
          <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:i>0?2:0}}>
            <span>{line}</span>
            {isMdp&&val?<CopyBtn value={val}/>:null}
          </div>
        );
      })}
    </InfoCard>
  );
}

function CopyBtn({value}){
  var [copied,setCopied]=useState(false);
  function copy(){ navigator.clipboard.writeText(value).then(function(){setCopied(true);setTimeout(function(){setCopied(false);},2000);}); }
  return (
    <button onClick={copy} style={{
      background:copied?DS.color.successBg:DS.color.primarySoft,
      border:"none",borderRadius:DS.radius.sm,cursor:"pointer",
      padding:"3px 10px",fontSize:12,marginLeft:8,
      color:copied?DS.color.success:DS.color.primaryDark,
      fontWeight:600,flexShrink:0,fontFamily:DS.font.body,
    }}>{copied?"Copié !":"Copier"}</button>
  );
}

function CopyAdresse({adresse}){
  var [copied,setCopied]=useState(false);
  function copy(){ navigator.clipboard.writeText(adresse).then(function(){setCopied(true);setTimeout(function(){setCopied(false);},2000);}); }
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
      <span style={{color:DS.color.textMuted,fontSize:13,fontFamily:DS.font.body}}>{adresse}</span>
      <button onClick={copy} style={{
        background:copied?DS.color.successBg:DS.color.primarySoft,
        border:"none",borderRadius:DS.radius.sm,cursor:"pointer",
        padding:"4px 10px",fontSize:12,marginLeft:8,
        color:copied?DS.color.success:DS.color.primaryDark,
        fontWeight:600,flexShrink:0,fontFamily:DS.font.body,
      }}>{copied?"Copié !":"Copier"}</button>
    </div>
  );
}

function MapsLink({url}){ return React.createElement("a",{href:url,target:"_blank",rel:"noopener noreferrer",style:{color:DS.color.primary,fontWeight:700,textDecoration:"none",borderBottom:"1px solid "+DS.color.primaryBorder}},"Voir sur Maps"); }

function FormattedText({children}){
  var lines=cleanNotionText(children).split("\n").filter(function(l){return l.trim();});
  var mapsRe=/https?:\/\/(maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl|www\.google\.[a-z.]+\/maps)[^\s]*/i;
  function renderSeg(line){
    return line.split(/(\*\*[^*]+\*\*)/g).map(function(p,j){
      return p.startsWith("**")&&p.endsWith("**")?<strong key={j}>{p.slice(2,-2)}</strong>:<span key={j}>{p}</span>;
    });
  }
  return (
    <span>
      {lines.map(function(line,i){
        var m=line.match(mapsRe);
        if(m){var url=m[0],before=line.slice(0,m.index).trim();return <span key={i}>{before?" "+before:null}<MapsLink url={url}/>{i<lines.length-1?<br/>:null}</span>;}
        return <span key={i}>{renderSeg(line)}{i<lines.length-1?<br/>:null}</span>;
      })}
    </span>
  );
}

var baseInput={width:"100%",padding:"12px 14px",border:"1.5px solid "+DS.color.border,borderRadius:DS.radius.sm,fontSize:15,outline:"none",boxSizing:"border-box",fontFamily:DS.font.body,background:DS.color.surface,color:DS.color.text,transition:"border-color 0.15s"};

function Input({value,onChange,placeholder,type}){
  return <input type={type||"text"} value={value} placeholder={placeholder||""} onChange={function(e){onChange(e.target.value);}} style={baseInput} onFocus={function(e){e.target.style.borderColor=DS.color.primary;}} onBlur={function(e){e.target.style.borderColor=DS.color.border;}}/>;
}
function Textarea({value,onChange,placeholder,rows}){
  return <textarea value={value} placeholder={placeholder||""} rows={rows||4} onChange={function(e){onChange(e.target.value);}} style={Object.assign({},baseInput,{resize:"vertical"})} onFocus={function(e){e.target.style.borderColor=DS.color.primary;}} onBlur={function(e){e.target.style.borderColor=DS.color.border;}}/>;
}

function Btn({onClick,disabled,children,secondary,danger,fullWidth}){
  var bg,color,border;
  if(disabled)       { bg=DS.color.primarySoft; color=DS.color.textFaint; border="none"; }
  else if(secondary) { bg=DS.color.surface;     color=DS.color.primaryDark; border="1.5px solid "+DS.color.primaryBorder; }
  else if(danger)    { bg=DS.color.dangerBg;    color=DS.color.danger; border="1.5px solid "+DS.color.dangerBorder; }
  else               { bg=DS.color.primaryDark; color="#fff"; border="none"; }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:"13px 22px",borderRadius:DS.radius.md,border:border,
      cursor:disabled?"not-allowed":"pointer",
      background:bg,color:color,
      fontWeight:700,fontSize:14,fontFamily:DS.font.heading,
      width:fullWidth?"100%":undefined,
      transition:"opacity 0.15s",
    }}>{children}</button>
  );
}

function Field({label,required,children}){
  return (
    <div style={{marginBottom:18}}>
      <label style={{display:"block",fontFamily:DS.font.heading,fontWeight:600,fontSize:13,color:DS.color.primaryDark,marginBottom:6}}>
        {label}{required?<span style={{color:DS.color.danger}}> *</span>:null}
      </label>
      {children}
    </div>
  );
}

function StarRating({value,onChange}){
  var [hov,setHov]=useState(0);
  return (
    <div style={{display:"flex",gap:6,margin:"6px 0"}}>
      {[1,2,3,4,5].map(function(s){
        var active=s<=(hov||value);
        return <button key={s} onClick={function(){onChange(s);}} onMouseEnter={function(){setHov(s);}} onMouseLeave={function(){setHov(0);}} style={{background:"none",border:"none",padding:0,cursor:"pointer",fontSize:36,lineHeight:1,color:active?DS.color.star:DS.color.border,transform:active?"scale(1.12)":"scale(1)",transition:"color 0.15s,transform 0.1s"}}>&#9733;</button>;
      })}
    </div>
  );
}

function KeepAwakeWarning({title,children,wakeLockStatus}){
  var statusText="";
  if(wakeLockStatus==="active") statusText="Écran maintenu éveillé pendant cette opération.";
  else if(wakeLockStatus==="unsupported") statusText="Votre navigateur ne supporte pas le maintien de l'écran.";
  else if(wakeLockStatus==="blocked"||wakeLockStatus==="waiting") statusText="Maintien de l'écran indisponible pour le moment.";
  return (
    <div style={{background:DS.color.warningBg,border:"1.5px solid "+DS.color.warningBorder,borderRadius:DS.radius.md,padding:"14px 16px",marginBottom:16,color:DS.color.warning}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <div style={{fontSize:20,lineHeight:1}}>⚠</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:DS.font.heading,fontSize:13,fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>{title}</div>
          <div style={{fontFamily:DS.font.body,fontSize:13,lineHeight:1.5,fontWeight:600}}>{children}</div>
          {statusText?<div style={{fontFamily:DS.font.body,fontSize:12,lineHeight:1.4,marginTop:6,color:"#c2410c"}}>{statusText}</div>:null}
        </div>
      </div>
    </div>
  );
}

function LogementLoading({error}){
  return (
    <div style={{background:DS.color.primaryBg,border:"1px solid "+DS.color.primaryBorder,borderRadius:DS.radius.md,padding:16,marginBottom:18}}>
      <div style={{fontFamily:DS.font.heading,fontSize:14,fontWeight:700,color:DS.color.primaryDark,marginBottom:4}}>
        {error?"Logement chargé en mode secours":"Chargement du logement…"}
      </div>
      <div style={{fontFamily:DS.font.body,fontSize:13,color:error?"#b45309":DS.color.textMuted,lineHeight:1.5}}>
        {error||"Récupération des informations depuis Notion…"}
      </div>
    </div>
  );
}

function ResumeModal({saved,onResume,onRestart}){
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}}>
      <div style={{background:DS.color.surface,borderRadius:DS.radius.xl,padding:28,maxWidth:360,width:"100%"}}>
        <div style={{fontSize:36,marginBottom:12,textAlign:"center"}}>📝</div>
        <h3 style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:18,color:DS.color.primaryDark,textAlign:"center",margin:"0 0 8px"}}>Formulaire en cours</h3>
        <p style={{fontFamily:DS.font.body,fontSize:14,color:DS.color.textMuted,textAlign:"center",margin:"0 0 24px",lineHeight:1.5}}>
          Un formulaire non terminé a été trouvé pour <strong>{saved.arrivee&&saved.arrivee.bien?saved.arrivee.bien:"ce logement"}</strong>. Voulez-vous reprendre où vous en étiez ?
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Btn fullWidth onClick={onResume}>Reprendre le formulaire</Btn>
          <Btn fullWidth secondary onClick={onRestart}>Recommencer à zéro</Btn>
        </div>
      </div>
    </div>
  );
}

function PhotoWarningModal({expected,actual,onConfirm,onCancel}){
  var missing=expected-actual;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}}>
      <div style={{background:DS.color.surface,borderRadius:DS.radius.xl,padding:28,maxWidth:360,width:"100%"}}>
        <div style={{fontSize:44,textAlign:"center",marginBottom:12}}>✋</div>
        <h3 style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:18,color:DS.color.primaryDark,textAlign:"center",margin:"0 0 12px"}}>Photos manquantes</h3>
        <p style={{fontFamily:DS.font.body,fontSize:14,color:DS.color.textMuted,textAlign:"center",margin:"0 0 8px",lineHeight:1.5}}>
          Vous avez uploadé <strong>{actual} photo{actual>1?"s":""}</strong> sur <strong>{expected} attendue{expected>1?"s":""}</strong>.
        </p>
        <p style={{fontFamily:DS.font.body,fontSize:14,color:DS.color.textMuted,textAlign:"center",margin:"0 0 24px",lineHeight:1.5}}>
          Il manque <strong style={{color:DS.color.danger}}>{missing} photo{missing>1?"s":""}</strong>. Continuer quand même ?
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Btn fullWidth onClick={onCancel}>Ajouter les photos manquantes</Btn>
          <Btn fullWidth secondary onClick={onConfirm}>Continuer quand même</Btn>
        </div>
      </div>
    </div>
  );
}

/* BANDEAU MODIFICATION */
function ChangeBanner({changes,stepIndex,onAcknowledge,acknowledged}){
  var stepChanges=changes.filter(function(c){return c.step===stepIndex;});
  if(stepChanges.length===0||acknowledged) return null;
  return (
    <div style={{background:"#fffbeb",border:"2px solid #f59e0b",borderRadius:DS.radius.md,padding:"14px 16px",marginBottom:20}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <span style={{fontSize:20,flexShrink:0}}>🔔</span>
        <div style={{flex:1}}>
          <div style={{fontFamily:DS.font.heading,fontSize:13,fontWeight:700,color:"#92400e",marginBottom:6}}>Mise à jour depuis votre dernière visite</div>
          <div style={{fontFamily:DS.font.body,fontSize:13,color:"#92400e",marginBottom:10,lineHeight:1.5}}>
            Les informations suivantes ont été modifiées :
            <ul style={{margin:"6px 0 0 16px",padding:0}}>
              {stepChanges.map(function(c,i){return <li key={i} style={{marginBottom:2}}>{c.label}</li>;})}
            </ul>
          </div>
          <button onClick={onAcknowledge} style={{background:"#f59e0b",border:"none",borderRadius:DS.radius.sm,color:"#fff",fontWeight:700,fontSize:13,padding:"8px 16px",cursor:"pointer",fontFamily:DS.font.heading,width:"100%"}}>J'ai pris connaissance des modifications</button>
        </div>
      </div>
    </div>
  );
}

/* ─── STEP COMPONENTS ────────────────────────────────────────────────── */
function Step1Infos({logement,loading,error,onNext,onModeVisite,changes,acknowledged,onAcknowledge}){
  var voyageurs=logement.voyageurs?logement.voyageurs+" max":"";
  var voyageursText=[voyageurs,cleanNotionText(logement.lits)].filter(Boolean).join("\n");
  var accesText=cleanNotionText(logement.acces);
  if(logement.boiteCle) accesText+=(accesText?"\n":"")+"**Code boîte à clé : "+logement.boiteCle+"**";
  return (
    <div>
      {loading||error?<LogementLoading error={error}/>:null}
      <CopyAdresse adresse={logement.adresse}/>
      <InfoCardWithCopy icon={<IconReceipt/>} title="Facturation à adresser à" text={logement.proprietaire}/>
      <InfoCardWithCopy icon={<IconEuro/>} title="Forfait ménage" text={logement.forfaitMenage}/>
      <WifiCard text={logement.wifi}/>
      <InfoCardWithCopy icon={<IconUsers/>} title="Voyageurs" text={voyageursText}/>
      <InfoCardWithCopy icon={<IconTrash/>} title="Poubelles" text={logement.poubelles}/>
      <InfoCardWithCopy icon={<IconBox/>} title="Consommables" text={logement.consommables}/>
      <InfoCardWithCopy icon={<IconKey/>} title="Accès logement" text={accesText}/>
      <ChangeBanner changes={changes||[]} stepIndex={0} onAcknowledge={onAcknowledge} acknowledged={acknowledged}/>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
        <Btn fullWidth onClick={onNext} disabled={!!(changes&&changes.some(function(c){return c.step===0;})&&!acknowledged)}>Commencer le rapport</Btn>
        <button onClick={onModeVisite} style={{width:"100%",padding:"13px",borderRadius:DS.radius.md,border:"1.5px solid "+DS.color.primaryBorder,background:DS.color.surface,color:DS.color.primaryDark,fontWeight:600,fontSize:14,fontFamily:DS.font.heading,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>👁 Mode visite</button>
      </div>
    </div>
  );
}

function Step2Arrivee({data,setData,onNext,onPrev}){
  var ok=data.date&&data.heureDebut&&data.nom&&data.bien;
  return (
    <div>
      <SectionTitle>Arrivée sur les lieux</SectionTitle>
      <Subtitle>Renseignez les informations de début d'intervention.</Subtitle>
      <Field label="Date" required><Input type="date" value={data.date} onChange={function(v){setData(Object.assign({},data,{date:v}));}}/></Field>
      <Field label="Heure de début" required><Input type="time" value={data.heureDebut} onChange={function(v){setData(Object.assign({},data,{heureDebut:v}));}}/></Field>
      <Field label="Prénom, Nom" required><Input value={data.nom} onChange={function(v){setData(Object.assign({},data,{nom:v}));}} placeholder="Marie Dupont"/></Field>
      <Field label="Nom du bien" required><Input value={data.bien} onChange={function(v){setData(Object.assign({},data,{bien:v}));}}/></Field>
      <div style={{display:"flex",gap:10}}><Btn secondary onClick={onPrev}>Retour</Btn><Btn onClick={onNext} disabled={!ok}>Suivant</Btn></div>
    </div>
  );
}

function Step3Attention({data,setData,logement,onNext,onPrev,changes,acknowledged,onAcknowledge}){
  var points=parsePointsAttention(logement&&logement.pointsAttention);
  if(points.length===0) points=[{emoji:"",text:""},{emoji:"",text:""},{emoji:"",text:""}];
  return (
    <div>
      <SectionTitle>Points d'attention</SectionTitle>
      <Subtitle>Merci de prendre connaissance de ces consignes avant de commencer.</Subtitle>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {points.map(function(pt,i){
          return (
            <div key={i} style={{display:"flex",gap:14,padding:"14px 16px",background:DS.color.surface,borderRadius:DS.radius.md,fontSize:14,color:DS.color.primaryDark,lineHeight:1.5,border:"1px solid "+DS.color.border}}>
              <span style={{fontSize:20,flexShrink:0}}>{pt.emoji}</span>
              <span style={{fontFamily:DS.font.body}}>{pt.text}</span>
            </div>
          );
        })}
      </div>
      <div onClick={function(){setData(Object.assign({},data,{lu:!data.lu}));}} style={{
        display:"flex",alignItems:"center",gap:14,
        padding:"16px 18px",borderRadius:DS.radius.md,cursor:"pointer",
        background:data.lu?DS.color.primaryBg:DS.color.surfaceAlt,
        border:"1.5px solid "+(data.lu?DS.color.primary:DS.color.border),
        marginBottom:24,transition:"all 0.2s",
      }}>
        <span style={{fontSize:20,lineHeight:1,flexShrink:0,filter:data.lu?"none":"grayscale(1) opacity(0.4)"}}>✅</span>
        <span style={{fontFamily:DS.font.body,fontSize:14,color:DS.color.primaryDark,fontWeight:600}}>J'ai pris connaissance des points d'attention</span>
      </div>
      <ChangeBanner changes={changes||[]} stepIndex={2} onAcknowledge={onAcknowledge} acknowledged={acknowledged}/>
      <div style={{display:"flex",gap:10}}><Btn secondary onClick={onPrev}>Retour</Btn><Btn onClick={onNext} disabled={!data.lu||!!(changes&&changes.some(function(c){return c.step===2;})&&!acknowledged)}>Suivant</Btn></div>
    </div>
  );
}

function Step4EtatLieux({data,setData,photosArrivee,setPhotosArrivee,onNext,onPrev}){
  var [isProcessingPhotos,setIsProcessingPhotos]=useState(false);
  var ok=data.note>0&&data.observations;
  return (
    <div>
      <SectionTitle>État des lieux</SectionTitle>
      <Subtitle>Vérifiez l'appartement à votre arrivée. À la moindre anomalie, prenez des photos.</Subtitle>
      <Field label="Notez les voyageurs" required><StarRating value={data.note} onChange={function(v){setData(Object.assign({},data,{note:v}));}}/></Field>
      <Field label="Observations à l'arrivée" required><Textarea value={data.observations} onChange={function(v){setData(Object.assign({},data,{observations:v}));}} placeholder="Problèmes constatés. Sinon écrire RAS."/></Field>
      <PhotoModule photos={photosArrivee} setPhotos={setPhotosArrivee} title="Photos à l'arrivée" subtitle="Ajoutez des photos si le logement a été laissé sale ou dégradé." infoTitle="Photos utiles" infoItems={[{id:"salete",label:"Saleté",exemples:"Sol, évier, sanitaires, linge ou déchets laissés"},{id:"degradation",label:"Dégradations",exemples:"Objets cassés, murs, mobilier, traces ou dommages visibles"}]} emptyLabel="Ajouter des photos d'arrivée" addLabel="Ajouter d'autres photos d'arrivée" required={false} onProcessingChange={setIsProcessingPhotos}/>
      <div style={{display:"flex",gap:10}}><Btn secondary onClick={onPrev} disabled={isProcessingPhotos}>Retour</Btn><Btn onClick={onNext} disabled={!ok||isProcessingPhotos}>Suivant</Btn></div>
    </div>
  );
}

function Step5Consommables({data,setData,logement,onNext,onPrev,changes,acknowledged,onAcknowledge}){
  var ok=data.consommablesAPrevoir!==undefined&&data.remarques!==undefined&&data.heureFin;
  var selected=data.consommablesSelectionnes||[];
  function toggleConso(c){ var next=selected.includes(c)?selected.filter(function(x){return x!==c;}):selected.concat([c]); setData(Object.assign({},data,{consommablesSelectionnes:next,consommablesAPrevoir:next.join(", ")})); }
  var itemsALaisser=parseConsommablesALaisser(logement&&logement.consommablesALaisser);
  if(itemsALaisser.length===0) itemsALaisser=CONSOMMABLES_LAISSER;
  return (
    <div>
      <SectionTitle>Consommables</SectionTitle>
      {logement.consommables&&logement.consommables.length>0?<Subtitle><RichText value={logement.consommables}/></Subtitle>:null}
      <div style={{marginBottom:18}}>
        <div style={{fontFamily:DS.font.heading,fontWeight:600,fontSize:11,color:DS.color.primary,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>À laisser</div>
        {itemsALaisser.map(function(c,i){
          return (
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",background:DS.color.primaryBg,borderRadius:DS.radius.sm,fontSize:14,marginBottom:6,fontFamily:DS.font.body,color:DS.color.primaryDark}}>
              <span style={{flex:1}}>{c.label}{c.comment?<span style={{color:DS.color.textFaint,fontSize:12,marginLeft:6}}>({c.comment})</span>:null}</span>
              {c.qt?<span style={{background:DS.color.primarySoft,color:DS.color.primaryDark,fontWeight:700,borderRadius:DS.radius.sm,padding:"2px 10px",fontSize:12,flexShrink:0}}>{c.qt}</span>:null}
            </div>
          );
        })}
      </div>
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:DS.font.heading,fontWeight:600,fontSize:11,color:DS.color.primary,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>À vérifier</div>
        <div style={{fontFamily:DS.font.body,fontSize:12,color:DS.color.textFaint,marginBottom:10}}>Appuyez sur un article s'il faut le réapprovisionner.</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {CONSOMMABLES_VERIFIER.map(function(c){
            var isSelected=selected.includes(c);
            return (
              <button key={c} onClick={function(){toggleConso(c);}} style={{padding:"7px 14px",borderRadius:DS.radius.pill,fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s",border:"none",background:isSelected?DS.color.primary:DS.color.primaryBg,color:isSelected?"#fff":DS.color.primaryMuted,fontFamily:DS.font.heading,display:"inline-flex",alignItems:"center",gap:5}}>
                {isSelected?<IconCheckSmall/>:null}<span>{c}</span>
              </button>
            );
          })}
        </div>
        {selected.length>0?<div style={{marginTop:10,fontFamily:DS.font.body,fontSize:13,color:DS.color.primary,fontWeight:600}}>{selected.length} article(s) sélectionné(s)</div>:null}
      </div>
      <Field label="Consommables à prévoir" required><Textarea value={data.consommablesAPrevoir||""} onChange={function(v){setData(Object.assign({},data,{consommablesAPrevoir:v}));}} placeholder="Notez les consommables manquants à réapprovisionner." rows={3}/></Field>
      <Field label="Remarques sur le logement" required><Textarea value={data.remarques||""} onChange={function(v){setData(Object.assign({},data,{remarques:v}));}} placeholder="Interventions à prévoir, anomalies constatées…" rows={3}/></Field>
      <Field label="Heure de fin d'intervention" required><Input type="time" value={data.heureFin||""} onChange={function(v){setData(Object.assign({},data,{heureFin:v}));}}/></Field>
      <ChangeBanner changes={changes||[]} stepIndex={4} onAcknowledge={onAcknowledge} acknowledged={acknowledged}/>
      <div style={{display:"flex",gap:10}}><Btn secondary onClick={onPrev}>Retour</Btn><Btn onClick={onNext} disabled={!ok||!!(changes&&changes.some(function(c){return c.step===4;})&&!acknowledged)}>Suivant</Btn></div>
    </div>
  );
}

function PhotoModule({photos,setPhotos,title,subtitle,infoTitle,infoItems,emptyLabel,addLabel,required,onProcessingChange}){
  var inputRef=useRef();
  var [progress,setProgress]=useState({current:0,total:0});
  var isProcessing=progress.total>0;
  var wakeLockStatus=useScreenWakeLock(isProcessing);
  useEffect(function(){if(onProcessingChange)onProcessingChange(isProcessing);},[isProcessing,onProcessingChange]);
  var handleFiles=useCallback(function(files){
    var arr=Array.from(files).filter(function(f){return f.type.startsWith("image/");});
    if(arr.length===0) return;
    setProgress({current:0,total:arr.length});
    var results=[],index=0;
    function processNext(){
      if(index>=arr.length){setPhotos(function(prev){return prev.concat(results);});setProgress({current:0,total:0});return;}
      var current=index;
      setTimeout(function(){
        processPhoto(arr[current]).then(function(stamped){
          results.push({id:Math.random().toString(36).slice(2),file:stamped,preview:URL.createObjectURL(stamped),name:arr[current].name});
          index++;setProgress({current:index,total:arr.length});processNext();
        });
      },50);
    }
    processNext();
  },[setPhotos]);
  function remove(id){setPhotos(function(prev){return prev.filter(function(p){return p.id!==id;});});}
  var pct=progress.total>0?Math.round((progress.current/progress.total)*100):0;
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <Subtitle>{subtitle}</Subtitle>
      <div style={{background:DS.color.primaryBg,border:"1px solid "+DS.color.primaryBorder,borderRadius:DS.radius.md,padding:"12px 15px",marginBottom:20}}>
        <div style={{fontFamily:DS.font.heading,fontSize:11,fontWeight:600,color:DS.color.primary,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>{infoTitle}</div>
        {infoItems.map(function(p){return <div key={p.id} style={{fontFamily:DS.font.body,fontSize:13,color:DS.color.primaryDark,marginBottom:3}}><strong>{p.label}</strong> — {p.exemples}</div>;})}
      </div>
      {isProcessing?(
        <div>
          <KeepAwakeWarning title="Traitement en cours" wakeLockStatus={wakeLockStatus}>Gardez cette page ouverte et le téléphone déverrouillé jusqu'à la fin de l'horodatage.</KeepAwakeWarning>
          <div style={{background:DS.color.primaryBg,border:"1px solid "+DS.color.primaryBorder,borderRadius:DS.radius.md,padding:16,marginBottom:16}}>
            <div style={{fontFamily:DS.font.heading,fontSize:14,fontWeight:700,color:DS.color.primaryDark,marginBottom:8}}>Traitement {progress.current}/{progress.total} ({pct}%)</div>
            <div style={{background:DS.color.primarySoft,borderRadius:DS.radius.sm,height:8,overflow:"hidden",marginBottom:6}}>
              <div style={{background:DS.color.primary,height:"100%",width:pct+"%",transition:"width 0.2s",borderRadius:DS.radius.sm}}/>
            </div>
            <div style={{fontFamily:DS.font.body,fontSize:12,color:DS.color.textMuted,fontWeight:600}}>Ne quittez pas cette page. Ne verrouillez pas l'écran.</div>
          </div>
        </div>
      ):null}
      {photos.length>0?(
        <div style={{marginBottom:16}}>
          <div style={{fontFamily:DS.font.heading,fontSize:11,fontWeight:600,color:DS.color.textMuted,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>{photos.length} photo(s) prête(s)</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {photos.map(function(p){return (
              <div key={p.id} style={{position:"relative"}}>
                <img src={p.preview} alt={p.name} style={{width:"100%",aspectRatio:"1",objectFit:"cover",borderRadius:DS.radius.sm,border:"2px solid "+DS.color.primary,display:"block"}}/>
                <button onClick={function(){remove(p.id);}} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:"50%",width:22,height:22,cursor:"pointer",fontSize:12,lineHeight:"22px",textAlign:"center",padding:0}}>×</button>
              </div>
            );})}
          </div>
        </div>
      ):null}
      <div onClick={function(){if(!isProcessing&&inputRef.current)inputRef.current.click();}} style={{border:"1.5px dashed "+(isProcessing?DS.color.border:DS.color.primaryBorder),borderRadius:DS.radius.lg,padding:"28px 20px",textAlign:"center",cursor:isProcessing?"not-allowed":"pointer",background:DS.color.primaryBg,marginBottom:24,opacity:isProcessing?0.5:1}}>
        <div style={{fontSize:32,marginBottom:8}}>📷</div>
        <div style={{fontFamily:DS.font.heading,fontSize:15,fontWeight:700,color:DS.color.primaryDark,marginBottom:4}}>{photos.length===0?emptyLabel:addLabel}</div>
        <div style={{fontFamily:DS.font.body,fontSize:13,color:DS.color.textMuted}}>Appuyez pour choisir depuis votre galerie</div>
        <div style={{fontFamily:DS.font.body,fontSize:11,color:DS.color.textFaint,marginTop:6}}>Sélection multiple · Horodatage automatique · Compression incluse</div>
        {!required&&photos.length===0?<div style={{fontFamily:DS.font.body,fontSize:11,color:DS.color.textFaint,marginTop:4}}>Optionnel</div>:null}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={function(e){handleFiles(e.target.files);}}/>
    </div>
  );
}

function Step6Photos({photos,setPhotos,logement,onNext,onPrev,changes,acknowledged,onAcknowledge}){
  var [isProcessing,setIsProcessing]=useState(false);
  var [showWarning,setShowWarning]=useState(false);
  var expectedCount=logement&&logement.photosReference?logement.photosReference.length:0;
  function handleNext(){ if(expectedCount>0&&photos.length<expectedCount){setShowWarning(true);}else{onNext();} }
  var suivantLabel="Suivant ("+photos.length+" photo"+(photos.length>1?"s":"")+")";
  var groupes=grouperPhotos(logement&&logement.photosReference);
  return (
    <div>
      {showWarning?<PhotoWarningModal expected={expectedCount} actual={photos.length} onConfirm={function(){setShowWarning(false);onNext();}} onCancel={function(){setShowWarning(false);}}/>:null}
      {groupes.length>0?(
        <div style={{marginBottom:28}}>
          <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:15,color:DS.color.primaryDark,marginBottom:4}}>📋 Photos de référence</div>
          <div style={{fontFamily:DS.font.body,fontSize:13,color:DS.color.textMuted,marginBottom:16}}>Reproduisez ces photos pour chaque pièce.</div>
          {groupes.map(function(entry){
            var pieceKey=entry[0],groupe=entry[1];
            return (
              <div key={pieceKey} style={{marginBottom:16}}>
                <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:15,color:DS.color.primaryDark,marginBottom:8}}>{groupe.label}</div>
                <div style={{columns:2,gap:8}}>
                  {groupe.photos.map(function(p,i){
                    var isNew=changes&&changes.some(function(c){return c.newPhotos&&c.newPhotos.indexOf(p.nom)!==-1;});
                    return (
                      <div key={i} style={{position:"relative",breakInside:"avoid",marginBottom:8}}>
                        <img src={p.url} alt={p.nom} loading="lazy" style={{width:"100%",borderRadius:DS.radius.sm,border:isNew?"2px solid #f59e0b":"1.5px solid "+DS.color.primaryBorder,display:"block"}}/>
                        {isNew?<div style={{position:"absolute",top:6,left:6,background:"#f59e0b",color:"#fff",fontFamily:DS.font.heading,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:DS.radius.pill}}>Nouveau</div>:null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ):null}
      <PhotoModule photos={photos} setPhotos={setPhotos} title="Photos de fin de ménage" subtitle="Sélectionnez toutes vos photos en une seule fois." infoTitle="Photos attendues" infoItems={PIECES} emptyLabel="Sélectionner les photos" addLabel="Ajouter d'autres photos" required={true} onProcessingChange={setIsProcessing}/>
      <ChangeBanner changes={changes||[]} stepIndex={5} onAcknowledge={onAcknowledge} acknowledged={acknowledged}/>
      <div style={{display:"flex",gap:10}}><Btn secondary onClick={onPrev} disabled={isProcessing}>Retour</Btn><Btn onClick={handleNext} disabled={photos.length===0||isProcessing||!!(changes&&changes.some(function(c){return c.step===5;})&&!acknowledged)}>{suivantLabel}</Btn></div>
    </div>
  );
}

function Step7Recap({arrivee,etatLieux,consommables,photosArrivee,photos,onPrev,onSubmit,sending,sendError,sendProgress}){
  var etoiles="";for(var i=0;i<etatLieux.note;i++)etoiles+="★";for(var j=etatLieux.note;j<5;j++)etoiles+="☆";
  var duree=arrivee.heureDebut+(consommables.heureFin?" - "+consommables.heureFin:"");
  var selected=consommables.consommablesSelectionnes||[];
  var wakeLockStatus=useScreenWakeLock(sending);
  var recap={background:DS.color.surfaceAlt,borderRadius:DS.radius.md,padding:16,marginBottom:12};
  var recapLabel={fontFamily:DS.font.heading,fontWeight:600,fontSize:11,color:DS.color.textMuted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"};
  return (
    <div>
      <SectionTitle>Récapitulatif</SectionTitle>
      <Subtitle>Vérifiez les informations avant d'envoyer le rapport.</Subtitle>
      <div style={recap}><div style={recapLabel}>Intervention</div><div style={{fontFamily:DS.font.body,fontSize:14,color:DS.color.primaryDark,lineHeight:1.9}}><div>{arrivee.nom}</div><div>{arrivee.date} — {duree}</div><div>{arrivee.bien}</div></div></div>
      <div style={recap}><div style={recapLabel}>État des lieux</div><div style={{fontFamily:DS.font.body,fontSize:14,color:DS.color.primaryDark,lineHeight:1.9}}><div style={{color:DS.color.star,fontSize:18}}>{etoiles}</div><div>{etatLieux.observations}</div></div></div>
      {selected.length>0?<div style={recap}><div style={recapLabel}>Consommables à réapprovisionner</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{selected.map(function(c){return <span key={c} style={{background:DS.color.primarySoft,color:DS.color.primaryDark,borderRadius:DS.radius.pill,padding:"3px 12px",fontSize:13,fontWeight:600,fontFamily:DS.font.body}}>{c}</span>;})}</div></div>:null}
      {consommables.consommablesAPrevoir?<div style={recap}><div style={recapLabel}>Consommables à prévoir</div><div style={{fontFamily:DS.font.body,fontSize:14,color:DS.color.primaryDark}}>{consommables.consommablesAPrevoir}</div></div>:null}
      {consommables.remarques?<div style={recap}><div style={recapLabel}>Remarques</div><div style={{fontFamily:DS.font.body,fontSize:14,color:DS.color.primaryDark}}>{consommables.remarques}</div></div>:null}
      <div style={{background:DS.color.successBg,border:"1px solid "+DS.color.successBorder,borderRadius:DS.radius.md,padding:16,marginBottom:20}}>
        <div style={{fontFamily:DS.font.heading,fontWeight:600,fontSize:11,color:DS.color.success,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>Photos</div>
        <div style={{fontFamily:DS.font.body,fontSize:14,color:"#166534",marginBottom:4}}>{photosArrivee.length} photo(s) d'arrivée prête(s)</div>
        <div style={{fontFamily:DS.font.body,fontSize:14,color:"#166534"}}>{photos.length} photo(s) horodatée(s)</div>
      </div>
      {sending?<div style={{marginBottom:16}}><KeepAwakeWarning title="Envoi en cours" wakeLockStatus={wakeLockStatus}>Gardez cette page ouverte jusqu'au message de confirmation.</KeepAwakeWarning><div style={{fontFamily:DS.font.body,fontSize:13,color:DS.color.primaryDark,fontWeight:600,marginBottom:8}}>Upload : {sendProgress}%</div><div style={{background:DS.color.primarySoft,borderRadius:DS.radius.sm,height:6,overflow:"hidden"}}><div style={{background:DS.color.primary,height:"100%",width:sendProgress+"%",transition:"width 0.3s",borderRadius:DS.radius.sm}}/></div></div>:null}
      {sendError?<div style={{background:DS.color.dangerBg,border:"1px solid "+DS.color.dangerBorder,borderRadius:DS.radius.md,padding:"12px 16px",marginBottom:16,fontFamily:DS.font.body,fontSize:14,color:DS.color.danger}}>{sendError}</div>:null}
      <div style={{display:"flex",gap:10}}><Btn secondary onClick={onPrev} disabled={sending}>Retour</Btn><Btn onClick={onSubmit} disabled={sending}>{sending?"Envoi en cours…":"Envoyer le rapport"}</Btn></div>
    </div>
  );
}

function StepSuccess({nom,bien}){
  return (
    <div style={{textAlign:"center",padding:"48px 0"}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:20}}><IconCheck/></div>
      <h2 style={{fontFamily:DS.font.heading,fontSize:24,fontWeight:700,color:DS.color.primaryDark,marginBottom:10}}>Rapport envoyé !</h2>
      <p style={{fontFamily:DS.font.body,color:DS.color.textMuted,fontSize:15,lineHeight:1.6}}>Merci <strong>{nom}</strong>, votre rapport pour <strong>{bien}</strong> a bien été transmis.</p>
      <div style={{marginTop:32,padding:"16px 20px",background:DS.color.successBg,border:"1px solid "+DS.color.successBorder,borderRadius:DS.radius.md,fontFamily:DS.font.body,fontSize:14,color:"#166534"}}>Vous pouvez fermer cette fenêtre.</div>
    </div>
  );
}

/* ─── MODE VISITE ────────────────────────────────────────────────────── */
function ModeVisite({logement,onQuitter}){
  var [stepIndex,setStepIndex]=useState(0);
  var step=VISITE_STEPS[stepIndex];
  var points=parsePointsAttention(logement&&logement.pointsAttention);
  var itemsALaisser=parseConsommablesALaisser(logement&&logement.consommablesALaisser);
  if(itemsALaisser.length===0) itemsALaisser=CONSOMMABLES_LAISSER;
  var groupes=grouperPhotos(logement&&logement.photosReference);
  var voyageursText=[logement.voyageurs?logement.voyageurs+" max":"",cleanNotionText(logement.lits)].filter(Boolean).join("\n");
  var accesText=cleanNotionText(logement.acces)+(logement.boiteCle?"\n**Code boîte à clé : "+logement.boiteCle+"**":"");
  return (
    <div style={wrap}>
      <div style={{background:DS.color.primaryDark,color:"#fff",borderRadius:DS.radius.md,padding:"10px 16px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontFamily:DS.font.heading}}>
          <span>👁</span>
          <span style={{fontWeight:700,fontSize:14}}>Mode visite</span>
          <span style={{fontSize:12,opacity:0.6}}>— lecture seule</span>
        </div>
        <button onClick={onQuitter} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:DS.radius.sm,color:"#fff",fontWeight:600,fontSize:13,padding:"5px 12px",cursor:"pointer",fontFamily:DS.font.heading}}>Quitter</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto",paddingBottom:4}}>
        {VISITE_STEPS.map(function(s,i){
          return <button key={s} onClick={function(){setStepIndex(i);}} style={{padding:"8px 14px",borderRadius:DS.radius.pill,border:"none",cursor:"pointer",fontFamily:DS.font.heading,fontWeight:600,fontSize:13,whiteSpace:"nowrap",background:stepIndex===i?DS.color.primary:DS.color.primaryBg,color:stepIndex===i?"#fff":DS.color.primaryMuted,flexShrink:0}}>{VISITE_LABELS[s]}</button>;
        })}
      </div>
      {step==="infos"&&(
        <div>
          <SectionTitle>{logement.nom}</SectionTitle>
          <CopyAdresse adresse={logement.adresse}/>
          <InfoCardWithCopy icon={<IconReceipt/>} title="Facturation à adresser à" text={logement.proprietaire}/>
          <InfoCardWithCopy icon={<IconEuro/>} title="Forfait ménage" text={logement.forfaitMenage}/>
          <WifiCard text={logement.wifi}/>
          <InfoCardWithCopy icon={<IconUsers/>} title="Voyageurs" text={voyageursText}/>
          <InfoCardWithCopy icon={<IconTrash/>} title="Poubelles" text={logement.poubelles}/>
          <InfoCardWithCopy icon={<IconBox/>} title="Consommables" text={logement.consommables}/>
          <InfoCardWithCopy icon={<IconKey/>} title="Accès logement" text={accesText}/>
        </div>
      )}
      {step==="attention"&&(
        <div>
          <SectionTitle>Points d'attention</SectionTitle>
          <Subtitle>Consignes à respecter pendant l'intervention.</Subtitle>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {points.map(function(pt,i){return <div key={i} style={{display:"flex",gap:14,padding:"14px 16px",background:DS.color.surface,borderRadius:DS.radius.md,fontSize:14,color:DS.color.primaryDark,lineHeight:1.5,border:"1px solid "+DS.color.border,fontFamily:DS.font.body}}><span style={{fontSize:20,flexShrink:0}}>{pt.emoji}</span><span>{pt.text}</span></div>;})}
          </div>
        </div>
      )}
      {step==="consommables"&&(
        <div>
          <SectionTitle>Consommables</SectionTitle>
          {logement.consommables&&logement.consommables.length>0?<Subtitle><RichText value={logement.consommables}/></Subtitle>:null}
          <div style={{fontFamily:DS.font.heading,fontWeight:600,fontSize:11,color:DS.color.primary,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>À laisser</div>
          {itemsALaisser.map(function(c,i){return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",background:DS.color.primaryBg,borderRadius:DS.radius.sm,fontSize:14,marginBottom:6,fontFamily:DS.font.body,color:DS.color.primaryDark}}><span style={{flex:1}}>{c.label}{c.comment?<span style={{color:DS.color.textFaint,fontSize:12,marginLeft:6}}>({c.comment})</span>:null}</span>{c.qt?<span style={{background:DS.color.primarySoft,color:DS.color.primaryDark,fontWeight:700,borderRadius:DS.radius.sm,padding:"2px 10px",fontSize:12,flexShrink:0}}>{c.qt}</span>:null}</div>;})}
        </div>
      )}
      {step==="photos"&&(
        <div>
          <SectionTitle>Photos de référence</SectionTitle>
          <Subtitle>Photos à reproduire lors de l'intervention.</Subtitle>
          {groupes.length===0?<div style={{fontFamily:DS.font.body,color:DS.color.textFaint,fontSize:14,textAlign:"center",padding:32}}>Aucune photo de référence disponible.</div>:groupes.map(function(entry){var pieceKey=entry[0],groupe=entry[1];return <div key={pieceKey} style={{marginBottom:20}}><div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:15,color:DS.color.primaryDark,marginBottom:8}}>{groupe.label}</div><div style={{columns:2,gap:8}}>{groupe.photos.map(function(p,i){return <img key={i} src={p.url} alt={p.nom} loading="lazy" style={{width:"100%",marginBottom:8,borderRadius:DS.radius.sm,border:"1.5px solid "+DS.color.primaryBorder,display:"block",breakInside:"avoid"}}/>;})}</div></div>;})}
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:28}}>
        <button onClick={function(){setStepIndex(function(i){return Math.max(0,i-1);});}} disabled={stepIndex===0} style={{flex:1,padding:"12px",borderRadius:DS.radius.md,border:"1.5px solid "+DS.color.border,cursor:stepIndex===0?"not-allowed":"pointer",background:DS.color.surface,color:stepIndex===0?DS.color.textFaint:DS.color.primaryDark,fontWeight:600,fontSize:14,fontFamily:DS.font.heading}}>← Précédent</button>
        <button onClick={function(){setStepIndex(function(i){return Math.min(VISITE_STEPS.length-1,i+1);});}} disabled={stepIndex===VISITE_STEPS.length-1} style={{flex:2,padding:"12px",borderRadius:DS.radius.md,border:"none",cursor:stepIndex===VISITE_STEPS.length-1?"not-allowed":"pointer",background:stepIndex===VISITE_STEPS.length-1?DS.color.primaryBg:DS.color.primaryDark,color:stepIndex===VISITE_STEPS.length-1?DS.color.textFaint:"#fff",fontWeight:700,fontSize:14,fontFamily:DS.font.heading}}>Suivant →</button>
      </div>
    </div>
  );
}

/* ─── PAGE ACCUEIL ───────────────────────────────────────────────────── */
function PageAccueil(){
  var [logements,setLogements]=useState([]);
  var [loading,setLoading]=useState(true);
  useEffect(function(){
    fetch("/api/logements").then(function(r){return r.json();}).then(function(data){setLogements(data.logements||[]);setLoading(false);}).catch(function(){setLoading(false);});
  },[]);
  return (
    <div style={{minHeight:"100vh",background:DS.color.surface,fontFamily:DS.font.body}}>
      <div style={{background:DS.color.primaryDark,padding:"28px 24px 24px",fontFamily:DS.font.heading}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",marginBottom:6}}>izinest</div>
        <div style={{fontSize:26,fontWeight:700,color:"#fff",lineHeight:1.1}}>Mes logements</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginTop:4}}>Sélectionnez un logement pour commencer</div>
      </div>
      <div style={{maxWidth:560,margin:"0 auto",padding:"24px 20px 60px"}}>
        {loading?<div style={{padding:32,textAlign:"center",color:DS.color.textMuted,fontFamily:DS.font.body}}>Chargement…</div>:null}
        {logements.map(function(l){
          return (
            <a key={l.slug} href={"/"+l.slug} style={{textDecoration:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:16,background:DS.color.surface,border:"1px solid "+DS.color.border,borderRadius:DS.radius.md,padding:"16px 20px",marginBottom:10,cursor:"pointer"}}>
                <div style={{width:42,height:42,borderRadius:DS.radius.md,background:DS.color.primaryBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🏠</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:16,color:DS.color.primaryDark}}>{l.nom}</div>
                  <div style={{fontFamily:DS.font.body,fontSize:13,color:DS.color.textMuted,marginTop:2}}>{l.adresse}</div>
                </div>
                <div style={{color:DS.color.primary,fontSize:18,flexShrink:0}}>›</div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/* ─── APP ────────────────────────────────────────────────────────────── */
export default function App(){
  var [step,setStep]=useState(0);
  var [arrivee,setArrivee]=useState(INIT_ARRIVEE);
  var [attention,setAttention]=useState(INIT_ATTENTION);
  var [etatLieux,setEtatLieux]=useState(INIT_ETAT);
  var [consommables,setConsommables]=useState(INIT_CONSO);
  var [photosArrivee,setPhotosArrivee]=useState([]);
  var [photos,setPhotos]=useState([]);
  var [done,setDone]=useState(false);
  var [sending,setSending]=useState(false);
  var [sendError,setSendError]=useState("");
  var [sendProgress,setSendProgress]=useState(0);
  var [showResume,setShowResume]=useState(false);
  var [savedDraft,setSavedDraft]=useState(null);
  var [logement,setLogement]=useState(DEFAULT_LOGEMENT);
  var [logementLoading,setLogementLoading]=useState(true);
  var [logementError,setLogementError]=useState("");
  var [modeVisite,setModeVisite]=useState(false);
  var [changes,setChanges]=useState([]);
  var [acknowledgedSteps,setAcknowledgedSteps]=useState({});

  useEffect(function(){
    var pathSlug=window.location.pathname.split("/").filter(Boolean).pop();
    var slug=slugify(pathSlug||"");
    if(!slug) return;
    var cancelled=false;
    setLogementLoading(true); setLogementError("");
    fetch("/api/logement?slug="+encodeURIComponent(slug))
      .then(function(res){return res.json().then(function(data){if(!res.ok)throw new Error(data.error||"Logement introuvable");return data;});})
      .then(function(data){if(cancelled||!data.logement)return;var nl=normalizeLogement(data.logement);setLogement(nl);setArrivee(function(prev){if(prev.bien&&prev.bien!==INIT_ARRIVEE.bien)return prev;return Object.assign({},prev,{bien:nl.nom||""});});var slug=slugify(nl.slug||nl.nom);var detected=detectChanges(slug,nl);setChanges(detected);saveHashes(slug,buildHashes(nl),nl);})
      .catch(function(e){if(!cancelled)setLogementError(e.message||"Impossible de charger le logement.");})
      .finally(function(){if(!cancelled)setLogementLoading(false);});
    return function(){cancelled=true;};
  },[]);

  useEffect(function(){
    if(logement&&logement.photosReference){logement.photosReference.forEach(function(p){var img=new Image();img.src=p.url;});}
  },[logement]);

  useEffect(function(){
    try{var raw=localStorage.getItem(STORAGE_KEY);if(raw){var draft=JSON.parse(raw);if(draft&&draft.step>0){setSavedDraft(draft);setShowResume(true);}}}catch(e){}
  },[]);

  useEffect(function(){
    if(done){localStorage.removeItem(STORAGE_KEY);return;}
    if(step===0)return;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({step:step,arrivee:arrivee,attention:attention,etatLieux:etatLieux,consommables:consommables}));}catch(e){}
  },[step,arrivee,attention,etatLieux,consommables,done]);

  useEffect(function(){
    function onBeforeUnload(e){if(!sending)return;e.preventDefault();e.returnValue="";}
    window.addEventListener("beforeunload",onBeforeUnload);
    return function(){window.removeEventListener("beforeunload",onBeforeUnload);};
  },[sending]);

  function handleResume(){setStep(savedDraft.step);setArrivee(savedDraft.arrivee||INIT_ARRIVEE);setAttention(savedDraft.attention||INIT_ATTENTION);setEtatLieux(savedDraft.etatLieux||INIT_ETAT);setConsommables(savedDraft.consommables||INIT_CONSO);setShowResume(false);}
  function handleRestart(){localStorage.removeItem(STORAGE_KEY);setShowResume(false);}
  function next(){setStep(function(s){return Math.min(s+1,TOTAL-1);});}
  function prev(){setStep(function(s){return Math.max(s-1,0);});}

  function handleSubmit(){
    setSending(true);setSendError("");setSendProgress(0);
    function uploadOne(p){var fd=new FormData();fd.append("file",p.file,p.name);return fetch("/api/upload-photo",{method:"POST",body:fd}).then(function(r){return r.json();}).then(function(data){return data.uploadId?{uploadId:data.uploadId,name:p.name}:null;}).catch(function(){return null;});}
    var allPhotos=photosArrivee.concat(photos);
    var resultsArrivee=new Array(photosArrivee.length).fill(null);
    var resultsFin=new Array(photos.length).fill(null);
    var completed=0,BATCH=5;
    function runBatch(startIndex){
      if(startIndex>=allPhotos.length){
        var vA=resultsArrivee.filter(function(r){return r!==null;});
        var vF=resultsFin.filter(function(r){return r!==null;});
        fetch("/api/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({arrivee:arrivee,etatLieux:etatLieux,consommables:consommables,photosArrivee:vA,photos:vF})})
          .then(function(res){return res.json();})
          .then(function(data){setSending(false);if(data.success){localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(PHOTO_ANALYSES_KEY);setDone(true);}else setSendError("Erreur lors de l'envoi. Réessayez.");})
          .catch(function(){setSending(false);setSendError("Erreur réseau. Vérifiez votre connexion.");});
        return;
      }
      var batch=allPhotos.slice(startIndex,startIndex+BATCH);
      Promise.all(batch.map(function(p,i){return uploadOne(p).then(function(result){var gi=startIndex+i;if(gi<photosArrivee.length)resultsArrivee[gi]=result;else resultsFin[gi-photosArrivee.length]=result;completed++;setSendProgress(allPhotos.length>0?Math.round((completed/allPhotos.length)*100):0);});})).then(function(){runBatch(startIndex+BATCH);});
    }
    runBatch(0);
  }

  if(done) return <div style={wrap}><StepSuccess nom={arrivee.nom} bien={arrivee.bien}/></div>;
  if(modeVisite) return <ModeVisite logement={logement} onQuitter={function(){setModeVisite(false);}}/>;

  var pathSlug=window.location.pathname.split("/").filter(Boolean).pop();
  if(!pathSlug) return <PageAccueil/>;

  return (
    <div style={wrap}>
      {showResume?<ResumeModal saved={savedDraft} onResume={handleResume} onRestart={handleRestart}/>:null}
      <AppHeader nom={logement.nom} step={step} total={TOTAL}/>
      <ProgressBar current={step} total={TOTAL}/>
      {step===0&&<Step1Infos logement={logement} loading={logementLoading} error={logementError} onNext={next} onModeVisite={function(){setModeVisite(true);}} changes={changes} acknowledged={acknowledgedSteps[0]} onAcknowledge={function(){setAcknowledgedSteps(function(p){return Object.assign({},p,{0:true});});}}/>}
      {step===1&&<Step2Arrivee data={arrivee} setData={setArrivee} onNext={next} onPrev={prev}/>}
      {step===2&&<Step3Attention data={attention} setData={setAttention} logement={logement} onNext={next} onPrev={prev} changes={changes} acknowledged={acknowledgedSteps[2]} onAcknowledge={function(){setAcknowledgedSteps(function(p){return Object.assign({},p,{2:true});});}}/>}
      {step===3&&<Step4EtatLieux data={etatLieux} setData={setEtatLieux} photosArrivee={photosArrivee} setPhotosArrivee={setPhotosArrivee} onNext={next} onPrev={prev}/>}
      {step===4&&<Step5Consommables data={consommables} setData={setConsommables} logement={logement} onNext={next} onPrev={prev} changes={changes} acknowledged={acknowledgedSteps[4]} onAcknowledge={function(){setAcknowledgedSteps(function(p){return Object.assign({},p,{4:true});});}}/>}
      {step===5&&<Step6Photos photos={photos} setPhotos={setPhotos} logement={logement} onNext={next} onPrev={prev} changes={changes} acknowledged={acknowledgedSteps[5]} onAcknowledge={function(){setAcknowledgedSteps(function(p){return Object.assign({},p,{5:true});});}}/>}
      {step===6&&<Step7Recap arrivee={arrivee} etatLieux={etatLieux} consommables={consommables} photosArrivee={photosArrivee} photos={photos} onPrev={prev} onSubmit={handleSubmit} sending={sending} sendError={sendError} sendProgress={sendProgress}/>}
    </div>
  );
}

var wrap={maxWidth:480,margin:"0 auto",padding:"24px 20px 60px",fontFamily:DS.font.body,minHeight:"100vh",background:DS.color.surface};

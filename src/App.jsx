import React, { useState, useRef, useCallback, useEffect } from "react";
import exifr from "exifr";
import { CircleCheck, MapPin, Wifi, Users, Trash2, Package, KeyRound, Receipt, Euro, Copy as CopyIcon, Navigation, BellRing, Check, Eye, LogOut, CalendarX2, Coffee, Sparkles, CalendarClock, Clock, SwitchCamera } from "lucide-react";

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
  { key:"boiteCle",            label:"Codes d'accès",               step:0 },
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
function photoId(p){ var u=String((p&&p.url)||"").split("?")[0]; return u||String((p&&p.nom)||""); }
function libellePiece(nom){ var parsed=parseNomPhoto(nom); var def=trouverDef(parsed.nomPiece); var l=def?def.label:(parsed.nomPiece||"Autre"); l=l.charAt(0).toUpperCase()+l.slice(1); return parsed.numero?l+" "+parsed.numero:l; }
function buildHashes(logement){ var r={}; WATCHED_FIELDS.forEach(function(f){ r[f.key]= f.key==="photosReference" ? hashString((logement.photosReference||[]).map(photoId).sort().join("|")) : hashField(logement[f.key]); }); return r; }
function getStoredHashes(slug){ try{var a=JSON.parse(localStorage.getItem(HASHES_KEY)||"{}");return a[slug]||null;}catch(e){return null;} }
function saveHashes(slug,hashes,logement){
  try{
    var a=JSON.parse(localStorage.getItem(HASHES_KEY)||"{}");
    a[slug]=hashes;
    // Also store photo names for per-piece change detection
    if(logement&&logement.photosReference){
      var ids={};
      (logement.photosReference||[]).forEach(function(p){ids[photoId(p)]=p.nom;});
      a[slug]._photoIds=ids;
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
      var avant=null;
      try{ var sp=JSON.parse(localStorage.getItem(HASHES_KEY)||"{}"); avant=sp[slug]&&sp[slug]._photoIds; }catch(e){}
      if(!avant) return; // ancienne version de l'appli : pas de base de comparaison fiable
      var maintenant={}; (logement.photosReference||[]).forEach(function(p){maintenant[photoId(p)]=p.nom;});
      var ajout=(logement.photosReference||[]).filter(function(p){return !avant[photoId(p)];});
      var retraits=Object.keys(avant).filter(function(id){return !maintenant[id];}).map(function(id){return avant[id];});
      var parPiece={};
      ajout.forEach(function(p){ var k=libellePiece(p.nom); (parPiece[k]=parPiece[k]||{n:0,r:0}).n++; });
      retraits.forEach(function(nom){ var k=libellePiece(nom); (parPiece[k]=parPiece[k]||{n:0,r:0}).r++; });
      var pieces=Object.keys(parPiece);
      if(!pieces.length) return;
      var detail=pieces.map(function(k){ var x=parPiece[k];
        if(x.n&&x.r&&x.n===x.r) return k+" : "+x.n+" photo"+(x.n>1?"s":"")+" remplacée"+(x.n>1?"s":"");
        var t=[]; if(x.n) t.push(x.n+" nouvelle"+(x.n>1?"s":"")); if(x.r) t.push(x.r+" retirée"+(x.r>1?"s":""));
        return k+" : "+t.join(", ");
      }).join(" · ");
      changed.push({key:f.key,label:"Photos de référence — "+detail,step:f.step,newPhotos:ajout.map(function(p){return p.nom;}),pieces:pieces});
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
    chambres:raw.chambres||"", lits:rt(raw.lits), linge:rt(raw.linge), acces:rt(raw.acces),
    boiteCle:raw.boiteCle||"", poubelles:rt(raw.poubelles),
    consommables:rt(raw.consommables), consommablesALaisser:rt(raw.consommablesALaisser), consommablesARecuperer:!!raw.consommablesARecuperer, aApporter:raw.aApporter||{items:[],rapports:[]}, prochaineResa:raw.prochaineResa||null,
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
  { keys: ["chauffage","thermostat","temperature","climatisation"], emoji: "🌡️" },
  { keys: ["wifi","internet","box","routeur"], emoji: "📶" },
  { keys: ["photo","image","appareil"], emoji: "📷" },
  { keys: ["canapé","canape","salon","meuble"], emoji: "🛋️" },
  { keys: ["bain","baignoire","lavabo","robinet"], emoji: "🛁" },
  { keys: ["araignée","araigne","insecte"], emoji: "🕷️" },
  { keys: ["balais", "balai"], emoji: "🧹" },
  { keys: ["barbecue", "bbq", "poele", "poêle"], emoji: "🔥" },
  { keys: ["jardin", "mobilier exterieur"], emoji: "🏡" },
  { keys: ["jacuzzi", "baignoire balneo"], emoji: "🫧" },
  { keys: ["tv", "television", "tele"], emoji: "📺" },
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
function getStampFromDate(d){
  return padTwo(d.getDate())+"/"+padTwo(d.getMonth()+1)+"/"+d.getFullYear()+"  "+padTwo(d.getHours())+"h"+padTwo(d.getMinutes());
}

function applyStampToCanvas(img, stampDate){
  var maxW=2400,scale=img.width>maxW?maxW/img.width:1;
  var w=Math.round(img.width*scale),h=Math.round(img.height*scale);
  var canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
  var ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,w,h);
  var stamp=getStampFromDate(stampDate);
  var fontSize=Math.max(18,Math.round(w*0.025));
  ctx.font="bold "+fontSize+"px monospace";
  var tw=ctx.measureText(stamp).width,pad=fontSize*0.6,bh=fontSize+pad*2,bw=tw+pad*2,margin=fontSize*0.8;
  ctx.fillStyle="rgba(0,0,0,0.65)";roundRect(ctx,margin,h-bh-margin,bw,bh,6);ctx.fill();
  ctx.fillStyle="#ffffff";ctx.fillText(stamp,margin+pad,h-margin-pad);
  return canvas;
}

function processPhoto(file){
  return new Promise(function(resolve){
    // Lire la date EXIF en parallèle du chargement de l'image
    var exifPromise = exifr.parse(file, ["DateTimeOriginal","DateTime","CreateDate"])
      .then(function(exif){
        if(exif && (exif.DateTimeOriginal || exif.DateTime || exif.CreateDate)){
          return exif.DateTimeOriginal || exif.DateTime || exif.CreateDate;
        }
        return null;
      })
      .catch(function(){ return null; });

    var img=new Image();
    var url=URL.createObjectURL(file);

    img.onload=function(){
      exifPromise.then(function(exifDate){
        var stampDate = exifDate ? new Date(exifDate) : new Date();
        // Fallback si date invalide
        if(isNaN(stampDate.getTime())) stampDate = new Date();
        var canvas = applyStampToCanvas(img, stampDate);
        canvas.toBlob(function(blob){
          URL.revokeObjectURL(url);
          resolve(new File([blob],file.name,{type:"image/jpeg"}));
        },"image/jpeg",0.92);
      });
    };
    img.src=url;
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
/* Icônes Lucide : même famille, trait 2 px, couleur = celle du texte (currentColor) */
var LI={size:18,strokeWidth:2,color:"currentColor"};
function IconPin()     { return <MapPin {...LI}/>; }
function IconWifi()    { return <Wifi {...LI}/>; }
function IconUsers()   { return <Users {...LI}/>; }
function IconTrash()   { return <Trash2 {...LI}/>; }
function IconBox()     { return <Package {...LI}/>; }
function IconKey()     { return <KeyRound {...LI}/>; }
function IconReceipt() { return <Receipt {...LI}/>; }
function IconEuro()    { return <Euro {...LI}/>; }
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.55)"}}>izinest · rapport de ménage</div>
        <div style={{fontSize:12,color:DS.color.primaryBorder}}>Étape {step+1} / {total}</div>
      </div>
      <div style={{fontSize:24,fontWeight:700,color:"#fff",lineHeight:1.1}}>{nom||"Chargement…"}</div>
      <div style={{display:"flex",gap:4,marginTop:12}}>
        {Array.from({length:total}).map(function(_,i){return <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?DS.color.primaryBorder:"rgba(255,255,255,0.2)"}}/>;})}
      </div>
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
        display:"flex",alignItems:"center",justifyContent:"center",color:DS.color.primaryDark,
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
  var visible=stepChanges.length>0&&!acknowledged;
  if(!visible) return null;
  return (
    <div style={{position:"sticky",top:12,zIndex:500,marginBottom:16}}>
      <div style={{
        background:"#fffbeb",border:"1.5px solid #fcd34d",borderRadius:DS.radius.xl,padding:14,
        boxShadow:"0 4px 16px rgba(180,83,9,0.18)",display:"flex",gap:12,alignItems:"flex-start"}}>
        <div style={{width:34,height:34,flexShrink:0,borderRadius:DS.radius.md,background:"#f59e0b",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <BellRing size={18} strokeWidth={2}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:DS.font.heading,fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#b45309",marginBottom:2}}>Mise à jour</div>
          <div style={{fontFamily:DS.font.heading,fontSize:14,fontWeight:700,color:"#78350f",marginBottom:4}}>Depuis votre dernière visite</div>
          <div style={{fontFamily:DS.font.body,fontSize:13,color:"#78350f",marginBottom:12,lineHeight:1.45}}>
            {stepChanges.map(function(c,i){return <span key={i}>{i>0?" · ":""}{c.label}</span>;})}
          </div>
          <button onClick={onAcknowledge} style={{display:"inline-flex",alignItems:"center",gap:6,background:"#92400e",border:"none",borderRadius:DS.radius.pill,color:"#fff",fontWeight:600,fontSize:13,padding:"8px 16px",cursor:"pointer",fontFamily:DS.font.heading}}><Check size={14} strokeWidth={2.5}/>J'ai pris connaissance</button>
        </div>
      </div>
    </div>
  );
}

function ChangeBannerSpacer(){ return null; }

/* ─── STEP COMPONENTS ────────────────────────────────────────────────── */
function plainOf(v){ return Array.isArray(v) ? v.map(function(t){return t.text||"";}).join("").trim() : cleanNotionText(v); }
function Tuile({span,bg,fg,icon,titre,children,border}){
  return (
    <div style={{gridColumn:"span "+span,background:bg,color:fg,borderRadius:DS.radius.xl,padding:14,boxShadow:"0 1px 2px rgba(8,81,87,0.08)",border:border||"none",minWidth:0}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{display:"inline-flex",flexShrink:0}}>{icon}</span>
        <span style={{fontFamily:DS.font.heading,fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>{titre}</span>
      </div>
      <div style={{marginTop:8,fontFamily:DS.font.body}}>{children}</div>
    </div>
  );
}
/* ── Prochaine réservation (Beds24) : tuile en tête de la page 1 ── */
function TuileResa({resa}){
  if(!resa||!resa.arrivee) return null;
  var auj=new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Paris"});
  var j=Math.round((Date.parse(resa.arrivee+"T12:00:00Z")-Date.parse(auj+"T12:00:00Z"))/86400000);
  var quand=j<=0?"Aujourd'hui":j===1?"Demain":majuscule(new Date(resa.arrivee+"T12:00:00Z").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"}));
  var dans=j<=1?"":"dans "+j+" jours";
  var nuits=resa.depart?Math.round((Date.parse(resa.depart)-Date.parse(resa.arrivee))/86400000):0;
  var depart=resa.depart?new Date(resa.depart+"T12:00:00Z").toLocaleDateString("fr-FR",{day:"numeric",month:"short",timeZone:"UTC"}):"";
  var pers=[resa.adultes?resa.adultes+" adulte"+(resa.adultes>1?"s":""):"",resa.enfants?resa.enfants+" enfant"+(resa.enfants>1?"s":""):""].filter(Boolean).join(" · ");
  var client=[resa.prenom,resa.nom?resa.nom.charAt(0).toUpperCase()+".":""].filter(Boolean).join(" ");
  var urgent=j<=0;
  var T=DS.color.primaryDark;
  return (
    <Tuile span={2} bg={urgent?"#fff4ec":"#fff"} fg={urgent?"#9a3412":T} icon={<CalendarClock size={18} strokeWidth={2}/>} titre="Prochaine réservation" border={"1.5px solid "+(urgent?"#fdba74":DS.color.primaryBorder)}>
      <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
        <span style={{fontFamily:DS.font.heading,fontSize:22,fontWeight:700,lineHeight:1.15}}>{quand}</span>
        {dans&&<span style={{fontSize:13,fontWeight:600,opacity:.75}}>{dans}</span>}
        {resa.heureArrivee&&<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:13,fontWeight:700,padding:"2px 9px",borderRadius:DS.radius.pill,background:urgent?"#fed7aa":DS.color.primarySoft}}><Clock size={13} strokeWidth={2.2}/>{resa.heureArrivee}</span>}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:"4px 14px",marginTop:8,fontSize:13,color:urgent?"#7c2d12":"#2c4b4e"}}>
        {pers&&<span style={{display:"inline-flex",alignItems:"center",gap:5}}><Users size={14} strokeWidth={2}/>{pers}</span>}
        {nuits>0&&<span>{nuits} nuit{nuits>1?"s":""} · départ le {depart}</span>}
        {client&&<span style={{opacity:.8}}>{client}</span>}
      </div>
    </Tuile>
  );
}
/* ── Linge à récupérer : bouton dans la tuile Voyageurs -> panneau du bas avec cases à cocher ── */
function majuscule(t){ t=String(t||"").trim(); return t?t.charAt(0).toUpperCase()+t.slice(1):t; }
function lignesConso(v){
  return parseConsommablesALaisser(v).map(function(c){
    var n=c.qt?c.qt.replace(/^x/i,""):"";
    return (n?n+" × ":"")+majuscule(c.label)+(c.comment?" ("+c.comment+")":"");
  });
}
function IconLinge({size}){
  size=size||16;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/>
      <path d="M5 10h14a1 1 0 0 1 1 1v4H4v-4a1 1 0 0 1 1-1z"/>
      <path d="M6 5h12a1 1 0 0 1 1 1v4H5V6a1 1 0 0 1 1-1z"/>
      <path d="M16 15v5M15 10v5M14 5v5"/>
    </svg>
  );
}
function lignesLinge(v){ return plainOf(v).split("\n").map(function(l){return l.replace(/^[-•*\s]+/,"").trim();}).filter(Boolean); }
function totalLinge(lignes){
  var n=0, num=0;
  lignes.forEach(function(l){ var m=l.match(/^(\d+)\s*[x×]?\s*/i); if(m){ n+=parseInt(m[1],10); num++; } else n+=1; });
  return n;
}

function PanneauLinge({lignes,onClose,titre,icone,avant,avantTitre}){
  avant=avant||[];
  var [coches,setCoches]=useState({});
  var nb=Object.keys(coches).filter(function(k){return coches[k];}).length;
  var [vu,setVu]=useState(false);
  useEffect(function(){ var t=setTimeout(function(){setVu(true);},10); return function(){clearTimeout(t);}; },[]);
  function fermer(){ setVu(false); setTimeout(onClose,250); }
  return (
    <div onClick={fermer} style={{position:"fixed",inset:0,zIndex:900,background:vu?"rgba(5,40,44,0.45)":"rgba(5,40,44,0)",transition:"background .25s ease"}}>
      <div onClick={function(e){e.stopPropagation();}} style={{position:"absolute",left:0,right:0,bottom:0,maxWidth:480,margin:"0 auto",background:"#fff",borderRadius:"22px 22px 0 0",padding:"10px 20px 26px",
        transform:vu?"translateY(0)":"translateY(100%)",transition:"transform .28s cubic-bezier(.2,.8,.2,1)",boxShadow:"0 -10px 30px rgba(0,0,0,0.15)",maxHeight:"75vh",overflowY:"auto"}}>
        <div style={{width:40,height:5,borderRadius:3,background:DS.color.border,margin:"0 auto 14px"}}/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
          <div style={{width:36,height:36,borderRadius:10,background:DS.color.primary,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{icone||<IconLinge size={19}/>}</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:DS.font.heading,fontSize:18,fontWeight:700,color:DS.color.primaryDark}}>{titre||"Linge à récupérer"}</div>
            <div style={{fontFamily:DS.font.body,fontSize:12,color:DS.color.textMuted}}>{nb} / {lignes.length+avant.length} récupéré{nb>1?"s":""}</div>
          </div>
        </div>
        <div style={{height:4,borderRadius:2,background:DS.color.primarySoft,margin:"12px 0 14px",overflow:"hidden"}}><div style={{height:"100%",width:(nb/Math.max(1,lignes.length+avant.length)*100)+"%",background:DS.color.primary,transition:"width .2s"}}/></div>
        {avant.length>0&&(
          <div style={{marginBottom:14}}>
            <div style={{fontFamily:DS.font.heading,fontSize:11,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#b45309",margin:"0 2px 8px"}}>{avantTitre||"À prendre au stock izinest"}</div>
            {avant.map(function(l,i){
              var k="a"+i, on=!!coches[k];
              return (
                <div key={k} onClick={function(){var c=Object.assign({},coches);c[k]=!on;setCoches(c);}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px",borderRadius:12,marginBottom:6,cursor:"pointer",background:on?"#fef3c7":"#fffbeb",border:"1.5px solid "+(on?"#f59e0b":"#fde68a")}}>
                  <span style={{width:22,height:22,borderRadius:7,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:on?"#f59e0b":"#fff",border:"1.5px solid "+(on?"#f59e0b":"#fcd34d"),color:"#fff"}}>{on?<Check size={14} strokeWidth={3}/>:null}</span>
                  <span style={{fontFamily:DS.font.body,fontSize:15,color:"#78350f",textDecoration:on?"line-through":"none",opacity:on?.7:1}}>{l}</span>
                </div>
              );
            })}
            {lignes.length>0&&<div style={{fontFamily:DS.font.heading,fontSize:11,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:DS.color.primary,margin:"14px 2px 8px"}}>Liste habituelle</div>}
          </div>
        )}
        {lignes.map(function(l,i){
          var on=!!coches[i];
          return (
            <div key={i} onClick={function(){var c=Object.assign({},coches);c[i]=!on;setCoches(c);}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 12px",borderRadius:12,marginBottom:6,cursor:"pointer",
              background:on?DS.color.primarySoft:DS.color.primaryBg,border:"1.5px solid "+(on?DS.color.primary:"transparent"),transition:"all .15s"}}>
              <span style={{width:22,height:22,borderRadius:7,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:on?DS.color.primary:"#fff",border:"1.5px solid "+(on?DS.color.primary:DS.color.primaryBorder),color:"#fff"}}>{on?<Check size={14} strokeWidth={3}/>:null}</span>
              <span style={{fontFamily:DS.font.body,fontSize:15,color:DS.color.primaryDark,textDecoration:on?"line-through":"none",opacity:on?.7:1}}>{l}</span>
            </div>
          );
        })}
        <button onClick={fermer} style={{marginTop:10,width:"100%",height:48,borderRadius:DS.radius.md,border:"none",background:DS.color.primaryDark,color:"#fff",fontFamily:DS.font.heading,fontWeight:700,fontSize:15,cursor:"pointer"}}>Fermer</button>
      </div>
    </div>
  );
}

function BtnTuile({onClick,icon,label,copie}){
  var [ok,setOk]=useState(false);
  return <button onClick={function(){onClick();setOk(true);setTimeout(function(){setOk(false);},2000);}} style={{display:"inline-flex",alignItems:"center",gap:6,height:34,padding:"0 14px",borderRadius:DS.radius.pill,border:"none",background:DS.color.primarySoft,color:DS.color.primaryDark,fontSize:13,fontWeight:600,fontFamily:DS.font.heading,cursor:"pointer"}}>{icon}{ok?copie:label}</button>;
}
function CodeBox({label,value}){
  var [copied,setCopied]=useState(false);
  function copy(){ navigator.clipboard.writeText(value).then(function(){setCopied(true);setTimeout(function(){setCopied(false);},2000);}); }
  return (
    <button onClick={copy} style={{flex:1,minWidth:0,textAlign:"left",background:"rgba(255,255,255,0.2)",border:"none",borderRadius:DS.radius.md,padding:"8px 10px",color:"#fff",cursor:"pointer"}}>
      <div style={{fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:DS.font.body}}>{copied?"Copié !":label}</div>
      <div style={{fontFamily:DS.font.heading,fontSize:value.length>10?18:22,fontWeight:700,letterSpacing:"0.1em",overflowWrap:"anywhere",lineHeight:1.2,marginTop:2}}>{value}</div>
    </button>
  );
}
/* « Code immeuble : 1265A » -> {label, code} ; une ligne sans « : » -> libellé « Code » */
function lireCodes(txt){
  return String(txt||"").split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){
    var m=l.match(/^(.*?)\s*[:：]\s*(.+)$/);
    return m&&m[1]?{label:majuscule(m[1]),code:m[2].trim()}:{label:"Code",code:l};
  });
}
function GrilleInfos({logement}){
  var voyageurs=logement.voyageurs?logement.voyageurs+" max":"";
  var litsOk=Array.isArray(logement.lits)&&logement.lits.length>0;
  var lingeOk=plainOf(logement.linge).length>0;
  var lignes=lignesLinge(logement.linge);
  var [panneauLinge,setPanneauLinge]=useState(false);
  var [panneauConso,setPanneauConso]=useState(false);
  var accesTxt=plainOf(logement.acces);
  var cle=plainOf(logement.boiteCle);
  var forfait=plainOf(logement.forfaitMenage);
  var factur=plainOf(logement.proprietaire);
  var wifiTxt=plainOf(logement.wifi);
  var poub=plainOf(logement.poubelles);
  var conso=plainOf(logement.consommables);
  var adresse=plainOf(logement.adresse);
  var wifiLines=wifiTxt?wifiTxt.split("\n").filter(Boolean):[];
  var T=DS.color.primaryDark;
  var BORD="1.5px solid "+DS.color.primaryBorder;
  var rich=function(v){ return Array.isArray(v)?<RichText value={v}/>:<FormattedText>{v}</FormattedText>; };
  var petit={fontSize:12,lineHeight:1.45,color:"#2c4b4e"};
  var consoRecup=logement.consommablesARecuperer?lignesConso(logement.consommablesALaisser):[];
  var consoStock=logement.consommablesARecuperer?((logement.aApporter&&logement.aApporter.items)||[]):[];
  var spanBas=(poub&&(conso||consoRecup.length||consoStock.length))?1:2;
  return (
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <TuileResa resa={logement.prochaineResa}/>
        {adresse&&(
          <Tuile span={2} bg="#fff" fg={T} icon={<IconPin/>} titre="Adresse" border={BORD}>
            <div style={{fontSize:15,fontWeight:600,color:"#0f2e31",marginBottom:10}}>{adresse}</div>
            <div style={{display:"flex",gap:8}}>
              <BtnTuile onClick={function(){navigator.clipboard.writeText(adresse);}} icon={<CopyIcon size={14} strokeWidth={2}/>} label="Copier" copie="Copié !"/>
              <a href={"https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(adresse)} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,height:34,padding:"0 14px",borderRadius:DS.radius.pill,background:T,color:"#fff",fontSize:13,fontWeight:600,textDecoration:"none",fontFamily:DS.font.heading}}><Navigation size={14} strokeWidth={2}/>Itinéraire</a>
            </div>
          </Tuile>
        )}
        {(accesTxt||cle)&&(
          <Tuile span={2} bg={DS.color.primary} fg="#fff" icon={<IconKey/>} titre="Accès">
            {cle?(function(){ var codes=lireCodes(cle); return <div style={{display:"grid",gridTemplateColumns:codes.length>1?"1fr 1fr":"1fr",gap:8,marginBottom:accesTxt?10:0}}>{codes.map(function(c,i){ return <div key={i} style={{display:"flex",minWidth:0,gridColumn:(codes.length%2===1&&i===codes.length-1&&codes.length>1)?"span 2":"auto"}}><CodeBox label={c.label} value={c.code}/></div>; })}</div>; })():null}
            {accesTxt?<div style={{fontSize:13,lineHeight:1.45}}>{rich(logement.acces)}</div>:null}
          </Tuile>
        )}
        {(voyageurs||litsOk)&&(
          <Tuile span={(forfait||factur)?1:2} bg={DS.color.primarySoft} fg={T} icon={<IconUsers/>} titre="Voyageurs" border={BORD}>
            {voyageurs?<div style={{fontFamily:DS.font.heading,fontSize:22,fontWeight:700}}>{voyageurs}</div>:null}
            {litsOk?<div style={petit}><RichText value={logement.lits}/></div>:null}
            {lingeOk&&(
              <button onClick={function(){setPanneauLinge(true);}} style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:6,height:32,padding:"0 12px",whiteSpace:"nowrap",borderRadius:DS.radius.pill,border:"none",background:DS.color.primary,color:"#fff",fontFamily:DS.font.heading,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                <IconLinge size={15}/>Linge · {totalLinge(lignes)}
              </button>
            )}
          </Tuile>
        )}
        {(forfait||factur)&&(
          <Tuile span={(voyageurs||litsOk)?1:2} bg={T} fg="#fff" icon={<IconEuro/>} titre="Forfait ménage">
            {forfait?<div style={{fontFamily:DS.font.heading,fontSize:26,fontWeight:700,lineHeight:1.1}}>{forfait}</div>:null}
            {factur?<div style={{marginTop:forfait?8:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",opacity:0.8}}><Receipt size={12} strokeWidth={2}/>Facturation à</div>
              <div style={{fontSize:13,fontWeight:600,marginTop:2}}>{factur}</div>
            </div>:null}
          </Tuile>
        )}
        {wifiLines.length>0&&(
          <Tuile span={2} bg="#fff" fg={T} icon={<IconWifi/>} titre="Wifi" border={BORD}>
            {wifiLines.map(function(line,i){
              var isMdp=line.toLowerCase().includes("mot de passe");
              var val=isMdp?line.split(":").slice(1).join(":").trim():"";
              return (
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:i>0?2:0,fontSize:14,color:"#0f2e31"}}>
                  <span>{line}</span>{isMdp&&val?<CopyBtn value={val}/>:null}
                </div>
              );
            })}
          </Tuile>
        )}
        {poub&&(
          <Tuile span={spanBas} bg="#fff" fg={T} icon={<IconTrash/>} titre="Poubelles" border={BORD}><div style={petit}>{rich(logement.poubelles)}</div></Tuile>
        )}
        {(conso||consoRecup.length>0||consoStock.length>0)&&(
          <Tuile span={spanBas} bg="#fff" fg={T} icon={<IconBox/>} titre="Consommables" border={BORD}>
            <div style={petit}>{rich(logement.consommables)}</div>
            {consoStock.length>0&&<div style={{marginTop:8,fontSize:12,fontWeight:600,color:"#b45309",lineHeight:1.35}}>🛒 {consoStock.length} article{consoStock.length>1?"s":""} signalé{consoStock.length>1?"s":""} au dernier ménage</div>}
            {(consoRecup.length>0||consoStock.length>0)&&(
              <button onClick={function(){setPanneauConso(true);}} style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:6,height:32,padding:"0 12px",whiteSpace:"nowrap",borderRadius:DS.radius.pill,border:"none",background:DS.color.primary,color:"#fff",fontFamily:DS.font.heading,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                <Package size={14} strokeWidth={2.2}/>À récupérer · {totalLinge(consoRecup)+consoStock.length}
              </button>
            )}
          </Tuile>
        )}
        {panneauLinge&&<PanneauLinge lignes={lignes} onClose={function(){setPanneauLinge(false);}}/>}
        {panneauConso&&<PanneauLinge lignes={consoRecup} avant={consoStock} avantTitre="Signalé au dernier ménage" titre="Consommables à récupérer" icone={<Package size={19} strokeWidth={2}/>} onClose={function(){setPanneauConso(false);}}/>}
      </div>
  );
}

function Step1Infos({logement,loading,error,onNext,onModeVisite,changes,acknowledged,onAcknowledge}){
  var bloque=!!(changes&&changes.some(function(c){return c.step===0;})&&!acknowledged);
  return (
    <div>
      <ChangeBanner changes={changes||[]} stepIndex={0} onAcknowledge={onAcknowledge} acknowledged={acknowledged}/>
      {loading||error?<LogementLoading error={error}/>:null}
      <GrilleInfos logement={logement}/>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:18}}>
        <Btn fullWidth onClick={onNext} disabled={bloque}>Commencer le rapport</Btn>
        <button onClick={onModeVisite} style={{width:"100%",padding:"13px",borderRadius:DS.radius.md,border:"1.5px solid "+DS.color.primaryBorder,background:DS.color.surface,color:DS.color.primaryDark,fontWeight:600,fontSize:14,fontFamily:DS.font.heading,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Eye size={16} strokeWidth={2}/>Mode visite</button>
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
      <ChangeBanner changes={changes||[]} stepIndex={2} onAcknowledge={onAcknowledge} acknowledged={acknowledged}/>
      <ChangeBannerSpacer changes={changes||[]} stepIndex={2} acknowledged={acknowledged}/>
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
      <ChangeBanner changes={changes||[]} stepIndex={4} onAcknowledge={onAcknowledge} acknowledged={acknowledged}/>
      <ChangeBannerSpacer changes={changes||[]} stepIndex={4} acknowledged={acknowledged}/>
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
      {logement&&logement.consommablesARecuperer&&logement.aApporter&&logement.aApporter.items.length>0&&(function(){
        var it=logement.aApporter.items, ap=data.apportes||[];
        function maj(n){ setData(Object.assign({},data,{apportes:n})); }
        return (
          <div style={{marginBottom:20,padding:14,borderRadius:DS.radius.md,background:"#fffbeb",border:"1.5px solid #fde68a"}}>
            <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:13,color:"#92400e",marginBottom:4}}>🛒 Avez-vous apporté ces articles ?</div>
            <div style={{fontFamily:DS.font.body,fontSize:12,color:"#b45309",marginBottom:10}}>Signalés au dernier ménage. Ce qui n'est pas coché restera à prévoir pour le prochain passage.</div>
            {it.map(function(a){ var on=ap.indexOf(a)!==-1; return (
              <div key={a} onClick={function(){maj(on?ap.filter(function(x){return x!==a;}):ap.concat([a]));}} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:DS.radius.sm,marginBottom:6,cursor:"pointer",background:on?"#fef3c7":"#fff",border:"1.5px solid "+(on?"#f59e0b":"#fde68a")}}>
                <span style={{width:20,height:20,borderRadius:6,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:on?"#f59e0b":"#fff",border:"1.5px solid "+(on?"#f59e0b":"#fcd34d"),color:"#fff"}}>{on?<Check size={13} strokeWidth={3}/>:null}</span>
                <span style={{fontFamily:DS.font.body,fontSize:14,color:"#78350f"}}>{a}</span>
              </div>
            ); })}
          </div>
        );
      })()}

      <Field label="Consommables à prévoir" required><Textarea value={data.consommablesAPrevoir||""} onChange={function(v){setData(Object.assign({},data,{consommablesAPrevoir:v}));}} placeholder="Notez les consommables manquants à réapprovisionner." rows={3}/></Field>
      <Field label="Remarques sur le logement" required><Textarea value={data.remarques||""} onChange={function(v){setData(Object.assign({},data,{remarques:v}));}} placeholder="Interventions à prévoir, anomalies constatées…" rows={3}/></Field>
      <Field label="Heure de fin d'intervention" required><Input type="time" value={data.heureFin||""} onChange={function(v){setData(Object.assign({},data,{heureFin:v}));}}/></Field>
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

/* ── Photos du brouillon conservées dans le téléphone (IndexedDB) : elles survivent à une actualisation ── */
var IDB_PHOTOS="izinest_photos";
function idbOuvrir(){ return new Promise(function(res,rej){ try{ var r=indexedDB.open(IDB_PHOTOS,1); r.onupgradeneeded=function(){ r.result.createObjectStore("p",{keyPath:"id"}); }; r.onsuccess=function(){res(r.result);}; r.onerror=function(){rej(r.error);}; }catch(e){rej(e);} }); }
function idbTx(mode,fn){ return idbOuvrir().then(function(db){ return new Promise(function(res,rej){ var tx=db.transaction("p",mode); var st=tx.objectStore("p"); var out=fn(st); tx.oncomplete=function(){res(out&&out.result!==undefined?out.result:out);}; tx.onerror=function(){rej(tx.error);}; }); }); }
function idbPhotosTout(){ return idbTx("readonly",function(st){return st.getAll();}).catch(function(){return [];}); }
function idbPhotoPut(rec){ return idbTx("readwrite",function(st){st.put(rec);}).catch(function(){}); }
function idbPhotoSuppr(id){ return idbTx("readwrite",function(st){st.delete(id);}).catch(function(){}); }
function idbPhotosVider(){ return idbTx("readwrite",function(st){st.clear();}).catch(function(){}); }
function recVersPhoto(r){ var f=new File([r.blob],r.name||"photo.jpg",{type:r.blob.type||"image/jpeg"}); return {id:r.id,file:f,preview:URL.createObjectURL(f),name:r.name,ref:r.ref||""}; }

/* horodatage en arrière-plan, une photo après l'autre */
var fileTraitement=Promise.resolve();
function traiterEnFond(file,cb){ fileTraitement=fileTraitement.then(function(){ return processPhoto(file).then(cb).catch(function(){ cb(file); }); }); }

/* ── Prise de photos guidée : caméra en plein écran, photo de référence en vignette ou en superposition ── */
function CameraGuidee({references,photos,setPhotos,onClose}){
  var videoRef=useRef(null), streamRef=useRef(null);
  var faites={}; photos.forEach(function(p){ if(p.ref) faites[p.ref]=true; });
  var premier=references.findIndex(function(r){return !faites[r.nom];});
  var [idx,setIdx]=useState(premier===-1?0:premier);
  var [erreur,setErreur]=useState("");
  var [pret,setPret]=useState(false);
  var [diag,setDiag]=useState(""); var [voirDiag,setVoirDiag]=useState(false);
  var [grand,setGrand]=useState(false);
  var [portrait,setPortrait]=useState(false);
  var [flash,setFlash]=useState(false);
  // objectifs : {mode:"zoom",min} (zoom < 1 = ultra grand angle) ou {mode:"devices",ultra,normal} ou {mode:"cycle",liste}
  var [objectifs,setObjectifs]=useState(null);
  var [objectif,setObjectif]=useState("1"); // "0.5" | "1" | index dans la liste (mode cycle)
  var resolution={width:{ideal:1920},height:{ideal:1440}};
  function brancher(st){ streamRef.current=st; if(videoRef.current){videoRef.current.srcObject=st; videoRef.current.play().catch(function(){});} }
  function arreter(){ if(streamRef.current) streamRef.current.getTracks().forEach(function(t){t.stop();}); streamRef.current=null; }
  function detecterObjectifs(st){
    var track=st.getVideoTracks()[0];
    var caps={}; try{ caps=track&&track.getCapabilities?track.getCapabilities():{}; }catch(e){}
    var courantId=track&&track.getSettings?track.getSettings().deviceId:"";
    var infoZoom=caps&&caps.zoom?("zoom "+caps.zoom.min+"–"+caps.zoom.max):"pas de zoom";
    if(caps&&caps.zoom&&caps.zoom.min<1){ setObjectifs({mode:"zoom",min:Math.max(caps.zoom.min,0.5)}); setDiag(infoZoom); return; }
    if(!navigator.mediaDevices.enumerateDevices){ setDiag(infoZoom+" · pas de liste"); return; }
    navigator.mediaDevices.enumerateDevices().then(function(devs){
      var cams=devs.filter(function(d){ return d.kind==="videoinput"; });
      setDiag(infoZoom+" · "+cams.length+" caméra(s) : "+cams.map(function(d){return (d.label||"?")+(d.deviceId===courantId?" [actuelle]":"");}).join(" | "));
      var arriere=cams.filter(function(d){ return !/front|avant|user|facetime/i.test(d.label||""); });
      var ultra=arriere.find(function(d){ return /ultra|grand.?angle|wide/i.test(d.label||"")&&!/dual|double|triple|t[ée]l[ée]/i.test(d.label||""); });
      if(ultra&&ultra.deviceId!==courantId){ setObjectifs({mode:"devices",ultra:ultra.deviceId,normal:courantId}); return; }
      if(arriere.length>=2) setObjectifs({mode:"cycle",liste:arriere.map(function(d){return d.deviceId;}),courant:Math.max(0,arriere.findIndex(function(d){return d.deviceId===courantId;}))});
    }).catch(function(){});
  }
  useEffect(function(){
    var annule=false;
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ setErreur("Caméra indisponible sur cet appareil. Utilisez l'import depuis la galerie."); return; }
    navigator.mediaDevices.getUserMedia({audio:false,video:Object.assign({facingMode:{ideal:"environment"}},resolution)})
      .then(function(st){ if(annule){st.getTracks().forEach(function(t){t.stop();});return;} brancher(st); setPret(true); detecterObjectifs(st); })
      .catch(function(){ setErreur("Accès à la caméra refusé. Autorisez la caméra pour ce site dans les réglages, ou utilisez l'import depuis la galerie."); });
    return function(){ annule=true; arreter(); };
  },[]);
  function changerDevice(id,val){
    setPret(false); arreter();
    navigator.mediaDevices.getUserMedia({audio:false,video:Object.assign({deviceId:{exact:id}},resolution)})
      .then(function(st){ brancher(st); setObjectif(val); setPret(true); })
      .catch(function(){ navigator.mediaDevices.getUserMedia({audio:false,video:Object.assign({facingMode:{ideal:"environment"}},resolution)}).then(function(st){ brancher(st); setObjectif("1"); setPret(true); }); });
  }
  function choisirObjectif(val){
    if(!objectifs||val===objectif) return;
    if(objectifs.mode==="zoom"){
      var track=streamRef.current&&streamRef.current.getVideoTracks()[0]; if(!track) return;
      track.applyConstraints({advanced:[{zoom:val==="0.5"?objectifs.min:1}]}).then(function(){setObjectif(val);}).catch(function(){});
    } else if(objectifs.mode==="devices"){
      changerDevice(val==="0.5"?objectifs.ultra:objectifs.normal,val);
    }
  }
  function objectifSuivant(){
    var n=(objectifs.courant+1)%objectifs.liste.length;
    setObjectifs(Object.assign({},objectifs,{courant:n}));
    changerDevice(objectifs.liste[n],String(n));
  }
  var ref=references[idx]||null;
  var nbFaites=references.filter(function(r){return faites[r.nom];}).length;
  function suivante(depuis){ for(var k=1;k<=references.length;k++){ var j=(depuis+k)%references.length; if(!faites[references[j].nom]&&j!==depuis) return j; } return -1; }
  // précharge des images de référence (versions légères)
  useEffect(function(){ references.forEach(function(r){ var a=new Image(); a.src=r.moyen||r.url; var b=new Image(); b.src=r.mini||r.url; }); },[]);
  function declencher(){
    var v=videoRef.current; if(!v||!v.videoWidth) return;
    setFlash(true); setTimeout(function(){setFlash(false);},120);
    var c=document.createElement("canvas"); c.width=v.videoWidth; c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0,c.width,c.height);
    var refNom=ref?ref.nom:"";
    var n=suivante(idx);
    faites[refNom]=true;
    if(n===-1) setTimeout(function(){onClose(true);},250); else setIdx(n);
    c.toBlob(function(blob){
      var nom=(refNom?refNom.replace(/\.[^.]+$/,""):"photo")+"-"+Date.now()+".jpg";
      var brut=new File([blob],nom,{type:"image/jpeg"});
      var id=Math.random().toString(36).slice(2);
      var item={id:id,file:brut,preview:URL.createObjectURL(brut),name:nom,ref:refNom,traitement:true};
      // une seule photo par référence : la nouvelle remplace l'ancienne
      setPhotos(function(prev){ return prev.filter(function(p){return !(refNom&&p.ref===refNom);}).concat([item]); });
      traiterEnFond(brut,function(stamped){
        setPhotos(function(prev){ return prev.map(function(p){ return p.id===id?Object.assign({},p,{file:stamped,preview:URL.createObjectURL(stamped),traitement:false}):p; }); });
      });
    },"image/jpeg",0.9);
  }
  var noir="rgba(0,0,0,0.55)";
  var rond={width:44,height:44,borderRadius:22,border:"none",background:noir,color:"#fff",fontFamily:DS.font.heading,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"};
  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"#000",color:"#fff",fontFamily:DS.font.body,overflow:"hidden"}}>
      <video ref={videoRef} playsInline muted autoPlay style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
      {flash&&<div style={{position:"absolute",inset:0,background:"#fff",opacity:.7}}/>}
      {/* en-tête */}
      <div style={{position:"absolute",top:0,left:0,right:0,padding:"calc(env(safe-area-inset-top) + 12px) 14px 30px",background:"linear-gradient(180deg, rgba(0,0,0,.65), rgba(0,0,0,0))",display:"flex",alignItems:"flex-start",gap:10}}>
        <button onClick={function(){onClose(false);}} style={rond} aria-label="Fermer">✕</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:16}}>{ref?libellePiece(ref.nom):"Photos"}</div>
          <div onClick={function(){setVoirDiag(!voirDiag);}} style={{fontSize:12,opacity:.85}}>Photo {idx+1} / {references.length} · {nbFaites} faite{nbFaites>1?"s":""}</div>
          {voirDiag&&<div style={{fontSize:10,opacity:.8,marginTop:4,lineHeight:1.3}}>{diag||"détection en cours…"}</div>}
          <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,.25)",marginTop:6,overflow:"hidden"}}><div style={{height:"100%",width:(nbFaites/Math.max(1,references.length)*100)+"%",background:DS.color.primary}}/></div>
        </div>
      </div>
      {/* vignette de référence */}
      {ref&&(
        <div onClick={function(){setGrand(!grand);}} style={{position:"absolute",top:"calc(env(safe-area-inset-top) + 86px)",right:12,width:grand?(portrait?"60%":"78%"):(portrait?"32%":"44%"),maxWidth:grand?520:(portrait?170:240),transition:"width .2s",borderRadius:12,overflow:"hidden",border:"2px solid #fff",boxShadow:"0 6px 18px rgba(0,0,0,.4)",cursor:"pointer"}}>
          <img src={ref.moyen||ref.url} alt="Référence" onLoad={function(e){ setPortrait(e.currentTarget.naturalHeight>e.currentTarget.naturalWidth); }} style={{width:"100%",display:"block"}}/>
          <div style={{position:"absolute",left:0,right:0,bottom:0,background:noir,fontSize:10,fontWeight:700,textAlign:"center",padding:"3px 0",textTransform:"uppercase",letterSpacing:".06em"}}>Référence{faites[ref.nom]?" · faite":""}</div>
        </div>
      )}
      {erreur&&<div style={{position:"absolute",left:20,right:20,top:"40%",background:"rgba(0,0,0,.8)",borderRadius:14,padding:18,textAlign:"center",fontSize:14,lineHeight:1.5}}>{erreur}</div>}
      {!erreur&&!pret&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,background:"#000"}}>
          <style>{"@keyframes izSpin{to{transform:rotate(360deg)}}"}</style>
          <div style={{width:54,height:54,borderRadius:27,border:"4px solid rgba(255,255,255,.2)",borderTopColor:DS.color.primary,animation:"izSpin .8s linear infinite"}}/>
          <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:16}}>Ouverture de la caméra…</div>
          <div style={{fontSize:13,opacity:.7,maxWidth:260,textAlign:"center"}}>Autorisez l'accès à la caméra si le téléphone le demande.</div>
        </div>
      )}
      {/* commandes */}
      <div style={{position:"absolute",left:0,right:0,bottom:0,padding:"30px 20px calc(env(safe-area-inset-bottom) + 20px)",background:"linear-gradient(0deg, rgba(0,0,0,.7), rgba(0,0,0,0))"}}>
        <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:16,scrollbarWidth:"none"}} className="iz-track">
          {references.map(function(r,i){ var on=i===idx; return (
            <div key={r.nom} onClick={function(){setIdx(i);}} style={{position:"relative",flexShrink:0,width:44,height:44,borderRadius:8,overflow:"hidden",border:"2px solid "+(on?"#fff":"transparent"),opacity:on?1:.75,cursor:"pointer"}}>
              <img src={r.mini||r.url} alt="" decoding="async" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              {faites[r.nom]&&<div style={{position:"absolute",inset:0,background:"rgba(0,186,179,.55)",display:"flex",alignItems:"center",justifyContent:"center"}}><Check size={20} strokeWidth={3}/></div>}
            </div>
          ); })}
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{width:96,display:"flex",justifyContent:"flex-start"}}>
            {objectifs&&objectifs.mode!=="cycle"&&(
              <div style={{display:"flex",gap:2,padding:3,borderRadius:22,background:noir}}>
                {[["0.5",objectifs.mode==="zoom"&&objectifs.min>0.5?String(Math.round(objectifs.min*10)/10).replace(".",",")+"×":"0,5×"],["1","1×"]].map(function(o){ var on=objectif===o[0]; return (
                  <button key={o[0]} onClick={function(){choisirObjectif(o[0]);}} aria-label={o[0]==="0.5"?"Grand angle":"Objectif classique"} style={{minWidth:42,height:38,borderRadius:19,border:"none",background:on?"rgba(255,255,255,.95)":"transparent",color:on?"#0f2e31":"#fff",fontFamily:DS.font.heading,fontWeight:700,fontSize:13,cursor:"pointer"}}>{o[1]}</button>
                ); })}
              </div>
            )}
            {objectifs&&objectifs.mode==="cycle"&&(
              <button onClick={objectifSuivant} aria-label="Changer d'objectif" style={Object.assign({},rond,{width:"auto",padding:"0 12px",gap:6})}><SwitchCamera size={16} strokeWidth={2}/>{objectifs.courant+1}/{objectifs.liste.length}</button>
            )}
          </div>
          <button onClick={declencher} disabled={!pret} aria-label="Prendre la photo" style={{width:76,height:76,borderRadius:38,border:"5px solid #fff",background:"rgba(255,255,255,.9)",cursor:"pointer",boxShadow:"0 0 0 3px rgba(0,0,0,.25)",transform:flash?"scale(.9)":"none",transition:"transform .1s"}}/>
          <div style={{width:96,display:"flex",justifyContent:"flex-end"}}><button onClick={function(){ var n=suivante(idx); if(n===-1) n=(idx+1)%references.length; setIdx(n); }} style={Object.assign({},rond,{width:"auto",padding:"0 14px"})}>Passer</button></div>
        </div>
      </div>
    </div>
  );
}


function Step6Photos({photos,setPhotos,logement,onNext,onPrev,changes,acknowledged,onAcknowledge}){
  var [isProcessing,setIsProcessing]=useState(false);
  var [showWarning,setShowWarning]=useState(false);
  var expectedCount=logement&&logement.photosReference?logement.photosReference.length:0;
  function handleNext(){ if(expectedCount>0&&photos.length<expectedCount){setShowWarning(true);}else{onNext();} }
  var enTraitement=photos.filter(function(p){return p.traitement;}).length;
  var suivantLabel=enTraitement?"Traitement des photos… ("+enTraitement+")":"Suivant ("+photos.length+" photo"+(photos.length>1?"s":"")+")";
  var groupes=grouperPhotos(logement&&logement.photosReference);
  var [camera,setCamera]=useState(false);
  var refsOrdonnees=[]; groupes.forEach(function(e){ e[1].photos.forEach(function(p){ refsOrdonnees.push(p); }); });
  var faitesRef={}; photos.forEach(function(p){ if(p.ref) faitesRef[p.ref]=true; });
  var nbRefFaites=refsOrdonnees.filter(function(r){return faitesRef[r.nom];}).length;
  return (
    <div>
      {camera&&<CameraGuidee references={refsOrdonnees} photos={photos} setPhotos={setPhotos} onClose={function(){setCamera(false);}}/>}
      {refsOrdonnees.length>0&&(
        <button onClick={function(){setCamera(true);}} onPointerDown={function(e){e.currentTarget.style.opacity=".75";}} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:"14px 16px",marginBottom:22,borderRadius:DS.radius.lg,border:"none",background:DS.color.primaryDark,color:"#fff",cursor:"pointer",textAlign:"left"}}>
          <span style={{fontSize:26}}>📸</span>
          <span style={{flex:1}}>
            <span style={{display:"block",fontFamily:DS.font.heading,fontWeight:700,fontSize:15}}>Prendre les photos avec le guide</span>
            <span style={{display:"block",fontFamily:DS.font.body,fontSize:12,opacity:.8,marginTop:2}}>La caméra s'ouvre avec la photo de référence à reproduire · {nbRefFaites} / {refsOrdonnees.length} faites</span>
          </span>
          <span style={{fontSize:18}}>→</span>
        </button>
      )}
      {showWarning?<PhotoWarningModal expected={expectedCount} actual={photos.length} onConfirm={function(){setShowWarning(false);onNext();}} onCancel={function(){setShowWarning(false);}}/>:null}
      {groupes.length>0?(
        <div style={{marginBottom:28}}>
          <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:15,color:DS.color.primaryDark,marginBottom:4}}>📋 Photos de référence</div>
          <div style={{fontFamily:DS.font.body,fontSize:13,color:DS.color.textMuted,marginBottom:16}}>Reproduisez ces photos pour chaque pièce.</div>
          {groupes.map(function(entry){
            var pieceKey=entry[0],groupe=entry[1];
            return (
              <div key={pieceKey} style={{marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:8,fontFamily:DS.font.heading,fontWeight:700,fontSize:15,color:DS.color.primaryDark,marginBottom:8}}>{groupe.label}
                  {changes&&changes.some(function(c){return c.pieces&&c.pieces.indexOf(groupe.label)!==-1;})&&<span style={{background:"#f59e0b",color:"#fff",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:99}}>Mise à jour</span>}
                </div>
                <div style={{columns:2,gap:8}}>
                  {groupe.photos.map(function(p,i){
                    var isNew=changes&&changes.some(function(c){return c.newPhotos&&c.newPhotos.indexOf(p.nom)!==-1;});
                    var fait=faitesRef[p.nom];
                    return (
                      <div key={i} style={{position:"relative",breakInside:"avoid",marginBottom:8}}>
                        <img src={p.moyen||p.url} alt={p.nom} loading="lazy" style={{width:"100%",borderRadius:DS.radius.sm,border:isNew?"2px solid #f59e0b":"1.5px solid "+DS.color.primaryBorder,display:"block"}}/>
                        {isNew?<div style={{position:"absolute",top:6,left:6,background:"#f59e0b",color:"#fff",fontFamily:DS.font.heading,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:DS.radius.pill}}>Nouveau</div>:null}
                        {fait?<div style={{position:"absolute",top:6,right:6,display:"flex",alignItems:"center",gap:4,background:DS.color.primary,color:"#fff",fontFamily:DS.font.heading,fontSize:11,fontWeight:700,padding:"3px 8px 3px 5px",borderRadius:DS.radius.pill}}><CircleCheck size={14} strokeWidth={2.4}/>Faite</div>:null}
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
      <ChangeBannerSpacer changes={changes||[]} stepIndex={5} acknowledged={acknowledged}/>
      <div style={{display:"flex",gap:10}}><Btn secondary onClick={onPrev} disabled={isProcessing}>Retour</Btn><Btn onClick={handleNext} disabled={photos.length===0||isProcessing||enTraitement>0||!!(changes&&changes.some(function(c){return c.step===5;})&&!acknowledged)}>{suivantLabel}</Btn></div>
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
  var voyageursVisite=logement.voyageurs?logement.voyageurs+" max":"";
  var accesRtVisite=Array.isArray(logement.acces)?logement.acces:[];
  return (
    <div style={wrap}>
      <div style={{background:DS.color.primaryDark,margin:"-24px -20px 16px",padding:"20px 20px 16px",fontFamily:DS.font.heading,color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.55)"}}><Eye size={13} strokeWidth={2}/>Mode visite · lecture seule</div>
          <button onClick={onQuitter} style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.15)",border:"none",borderRadius:DS.radius.pill,color:"#fff",fontWeight:600,fontSize:12,padding:"5px 12px",cursor:"pointer",fontFamily:DS.font.heading}}><LogOut size={13} strokeWidth={2}/>Quitter</button>
        </div>
        <div style={{fontSize:24,fontWeight:700,lineHeight:1.1}}>{logement.nom||"Chargement…"}</div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {VISITE_STEPS.map(function(s,i){
          return <button key={s} onClick={function(){setStepIndex(i);}} style={{padding:"8px 14px",borderRadius:DS.radius.pill,border:"1.5px solid "+(stepIndex===i?DS.color.primary:DS.color.primaryBorder),cursor:"pointer",fontFamily:DS.font.heading,fontWeight:600,fontSize:13,whiteSpace:"nowrap",background:stepIndex===i?DS.color.primary:"#fff",color:stepIndex===i?"#fff":DS.color.primaryDark,flexShrink:0}}>{VISITE_LABELS[s]}</button>;
        })}
      </div>
      {step==="infos"&&<GrilleInfos logement={logement}/>}
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
/* ─── ESPACE PRESTATAIRE ─────────────────────────────────────────────── */
var PRESTA_KEY = "prestataire_session";

function getSession(){ try{ return JSON.parse(localStorage.getItem(PRESTA_KEY)||"null"); }catch(e){ return null; } }
function saveSession(p){ try{ localStorage.setItem(PRESTA_KEY, JSON.stringify(p)); }catch(e){} }
function clearSession(){ try{ localStorage.removeItem(PRESTA_KEY); }catch(e){} }

function formatDateFr(str){
  if(!str) return "";
  var d=new Date(str);
  return d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
}

/* Illustration du logement : propriété Notion « Type » des logements, sinon détection par le nom.
   appartement indépendant -> villa.png ; maison moderne -> maison-campagne.png ;
   appartement -> maison-ville.png ou immeuble.png (alterné, stable par logement) ; maison -> petite-maison.png */
function hashStr(v){ var h=0; v=String(v||""); for(var i=0;i<v.length;i++){ h=(h*31+v.charCodeAt(i))|0; } return Math.abs(h); }
function pickMaison(mission){
  var norm=function(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();};
  var appart=function(){ return hashStr(mission.logement||mission.logementNom||mission.id)%2 ? "immeuble" : "maison-ville"; };
  var sources=[mission.type, mission.logementNom||mission.nom];
  for(var i=0;i<sources.length;i++){
    var t=norm(sources[i]); if(!t) continue;
    if(/(appartement|appart|logement|studio)\s+independant|independant/.test(t)) return "villa";
    if(/maison\s+moderne|moderne|contemporain/.test(t)) return "maison-campagne";
    if(/appartement|appart\b|\bapt\b|immeuble|residence|studio|duplex|loft|t1|t2|t3/.test(t)) return appart();
    if(/maison|villa|gite|chalet|pavillon/.test(t)) return "petite-maison";
  }
  return "petite-maison";
}

/* Urgence : ménage dans 0 à 3 jours (heure de Paris) */
function joursAvant(date){
  if(!date) return Infinity;
  var auj=new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Paris"});
  var p=function(x){var a=String(x).slice(0,10).split("-");return Date.UTC(+a[0],a[1]-1,+a[2]);};
  return Math.round((p(date)-p(auj))/86400000);
}
function libelleUrgence(j){ return j<=0?"Aujourd'hui":j===1?"Demain":"Dans "+j+" jours"; }

function IconSvg(props){
  return (
    <svg width={props.size||16} height={props.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.sw||1.8} strokeLinecap="round" strokeLinejoin="round" style={props.style} aria-hidden="true">{props.children}</svg>
  );
}

function MissionCardRiche({mission, total, currentIdx, onAccepter, onRefuser, onPostuler, onRetirer}){
  var [loading, setLoading] = useState(false);
  var jourCourt = "", jourNum = "", moisCourt = "";
  if(mission.date){
    var d = new Date(mission.date);
    jourCourt = d.toLocaleDateString("fr-FR",{weekday:"short"}).replace(".","");
    jourCourt = jourCourt.charAt(0).toUpperCase()+jourCourt.slice(1);
    jourNum = d.getDate();
    moisCourt = d.toLocaleDateString("fr-FR",{month:"short"});
  }
  var titre = mission.logementNom || String(mission.nom||"").split(" — ")[0];
  var maison = pickMaison(mission);
  var jr = joursAvant(mission.date);
  var urgente = jr>=0 && jr<=3;
  var [heroKo, setHeroKo] = useState(false);
  var [heroOk, setHeroOk] = useState(false);
  var labelStyle = {fontFamily:DS.font.body,fontSize:11,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",color:"#0a6a70"};
  return (
    <div style={{background:DS.color.primaryDark,borderRadius:20,padding:"22px 22px 18px",color:"#fff",
      boxShadow:"0 1px 2px rgba(8,81,87,0.15), 0 12px 28px rgba(8,81,87,0.22)",
      display:"flex",flexDirection:"column",gap:16,userSelect:"none",boxSizing:"border-box"}}>
      {mission.hero&&!heroKo
        ?<div style={{position:"relative",margin:"-22px -22px 8px",height:200,borderRadius:"18px 18px 0 0",overflow:"hidden",background:"#0a6a70"}}>
            <img src={mission.hero} alt="" draggable={false} loading={currentIdx<2?"eager":"lazy"} decoding="async" fetchpriority={currentIdx===0?"high":"auto"}
              onLoad={function(){setHeroOk(true);}} onError={function(){setHeroKo(true);}}
              style={{width:"100%",height:"100%",objectFit:"cover",display:"block",opacity:heroOk?1:0,transition:"opacity .35s ease"}}/>
            <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 32%, rgba(8,81,87,0) 50%, rgba(8,81,87,0.35) 68%, rgba(8,81,87,0.75) 84%, rgba(8,81,87,0.95) 95%, #085157 100%)"}}/>
            <div style={{position:"absolute",top:14,left:14,right:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              {urgente?<span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#f59e0b",color:"#451a03",borderRadius:DS.radius.pill,padding:"4px 12px",fontFamily:DS.font.heading,fontSize:12,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase"}}>
                <span style={{width:7,height:7,borderRadius:4,background:"#451a03",animation:"izPulse 1.2s ease-in-out infinite"}}/>Urgent · {libelleUrgence(jr)}
              </span>:<span/>}
              {total>1&&<span style={{fontFamily:DS.font.heading,fontSize:12,fontWeight:700,color:"#fff",background:"rgba(0,0,0,0.35)",borderRadius:DS.radius.pill,padding:"3px 10px"}}>{currentIdx+1} / {total}</span>}
            </div>
          </div>
        :<React.Fragment>
        {(total>1||urgente)&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:26}}>
            {urgente
              ?<span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#f59e0b",color:"#451a03",borderRadius:DS.radius.pill,padding:"4px 12px",fontFamily:DS.font.heading,fontSize:12,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase"}}>
                  <span style={{width:7,height:7,borderRadius:4,background:"#451a03",animation:"izPulse 1.2s ease-in-out infinite"}}/>Urgent · {libelleUrgence(jr)}
                </span>
              :<span/>}
            {total>1&&<span style={{fontFamily:DS.font.heading,fontSize:12,fontWeight:600,color:"#99e0dd"}}>{currentIdx+1} / {total}</span>}
          </div>
        )}
        <img src={"/illustrations/maisons/"+maison+".png"} alt="" draggable={false} style={{display:"block",width:220,maxWidth:"66%",height:"auto",margin:"-6px auto -10px",filter:"drop-shadow(0 10px 18px rgba(0,0,0,0.25))"}}/>
          </React.Fragment>}
      <div style={{display:"flex",gap:16,alignItems:"stretch"}}>
        {mission.date&&(
          <div style={{width:72,flexShrink:0,borderRadius:14,background:"#e0f5f5",color:DS.color.primaryDark,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 0"}}>
            <div style={labelStyle}>{jourCourt}</div>
            <div style={{fontFamily:DS.font.heading,fontSize:34,fontWeight:700,lineHeight:1.05}}>{jourNum}</div>
            <div style={labelStyle}>{moisCourt}</div>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",justifyContent:"center",gap:6,minWidth:0}}>
          <div style={{fontFamily:DS.font.heading,fontSize:24,fontWeight:700,lineHeight:1.1,color:"#fff"}}>{titre}</div>
          {mission.adresse&&(
            <div style={{display:"flex",alignItems:"flex-start",gap:6,fontFamily:DS.font.body,fontSize:13,lineHeight:1.4,color:"#99e0dd"}}>
              <IconSvg style={{flexShrink:0,marginTop:1}}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></IconSvg>
              <span>{mission.adresse}</span>
            </div>
          )}
        </div>
      </div>
      {(mission.dureeEstimee||mission.forfaitMenage)&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.18)"}}>
          {mission.dureeEstimee
            ?<span style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.14)",borderRadius:DS.radius.pill,padding:"5px 12px",fontFamily:DS.font.body,fontSize:12,fontWeight:600}}>
                <IconSvg size={14} sw={2}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></IconSvg>
                <span>{mission.dureeEstimee}</span>
              </span>
            :<span/>}
          {mission.forfaitMenage&&<div style={{textAlign:"right"}}>
            <div style={{fontFamily:DS.font.heading,fontSize:40,fontWeight:700,lineHeight:1}}>{mission.forfaitMenage}</div>
          </div>}
        </div>
      )}
      {mission.attribution==="postuler"
        ?(mission.candidature
          ?<div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,height:50,borderRadius:12,background:"rgba(255,255,255,0.16)",color:"#fff",fontWeight:700,fontSize:15,fontFamily:DS.font.heading}}>
                <IconSvg size={18} sw={2.4}><path d="M5 12.5l4.5 4.5L19 7.5"/></IconSvg>Candidature envoyée
              </div>
              <div style={{fontFamily:DS.font.body,fontSize:12,color:"#99e0dd",textAlign:"center"}}>Vous serez prévenue dès que la mission est confirmée.</div>
              <button onClick={function(){setLoading(true);onRetirer(mission).finally(function(){setLoading(false);});}} disabled={loading} style={{height:42,borderRadius:12,border:"1.5px solid rgba(255,255,255,0.5)",background:"transparent",color:"#fff",fontWeight:600,fontSize:14,fontFamily:DS.font.heading,cursor:loading?"not-allowed":"pointer"}}>
                {loading?"…":"Retirer ma candidature"}
              </button>
            </div>
          :<div style={{display:"flex",gap:10}}>
              <button onClick={function(){setLoading(true);onPostuler(mission).finally(function(){setLoading(false);});}} disabled={loading} style={{flex:2,height:50,borderRadius:12,border:"none",background:"#fff",color:DS.color.primaryDark,fontWeight:700,fontSize:15,fontFamily:DS.font.heading,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {loading?"…":<span style={{display:"flex",alignItems:"center",gap:8}}><IconSvg size={18} sw={2.2}><path d="M7 11l5-8 1.5.9c.8.5 1 1.5.6 2.3L13 8h5a2 2 0 0 1 2 2.4l-1.2 6A3 3 0 0 1 15.9 19H7z"/><path d="M3 11h4v8H3z"/></IconSvg>Postuler</span>}
              </button>
              <button onClick={function(){setLoading(true);onRefuser(mission).finally(function(){setLoading(false);});}} disabled={loading} style={{flex:1,height:50,borderRadius:12,border:"1.5px solid rgba(255,255,255,0.5)",background:"transparent",color:"#fff",fontWeight:600,fontSize:15,fontFamily:DS.font.heading,cursor:loading?"not-allowed":"pointer"}}>
                Refuser
              </button>
            </div>)
        :<div style={{display:"flex",gap:10}}>
            <button onClick={function(){setLoading(true);onAccepter(mission).finally(function(){setLoading(false);});}} disabled={loading} style={{flex:2,height:50,borderRadius:12,border:"none",background:"#fff",color:DS.color.primaryDark,fontWeight:700,fontSize:15,fontFamily:DS.font.heading,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {loading?"…":<span style={{display:"flex",alignItems:"center",gap:8}}><IconSvg size={18} sw={2.4}><path d="M5 12.5l4.5 4.5L19 7.5"/></IconSvg>Accepter</span>}
            </button>
            <button onClick={function(){setLoading(true);onRefuser(mission).finally(function(){setLoading(false);});}} disabled={loading} style={{flex:1,height:50,borderRadius:12,border:"1.5px solid rgba(255,255,255,0.5)",background:"transparent",color:"#fff",fontWeight:600,fontSize:15,fontFamily:DS.font.heading,cursor:loading?"not-allowed":"pointer"}}>
              Refuser
            </button>
          </div>}
    </div>
  );
}

/* ── État vide (aucune mission disponible) ─────────────────────────────
   3 variantes à comparer : ajouter ?vide=1, ?vide=2 ou ?vide=3 à l'adresse pour forcer l'affichage. */
var VIDE_PARAM=(function(){ try{ return new URLSearchParams(window.location.search).get("vide")||""; }catch(e){ return ""; } })();
var VIDE_FORCE=/^[123]$/.test(VIDE_PARAM);
var VIDE_VARIANTE=VIDE_FORCE?+VIDE_PARAM:2;

function EtatVide({variante,prochaine,onAgenda,onActualiser}){
  var H=DS.font.heading, Bf=DS.font.body;
  var dateProchaine=prochaine&&prochaine.date?new Date(prochaine.date).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}):"";
  var btnPlein={height:46,padding:"0 18px",borderRadius:DS.radius.md,border:"none",background:DS.color.primaryDark,color:"#fff",fontFamily:H,fontWeight:700,fontSize:14,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8};
  var btnVide={height:46,padding:"0 18px",borderRadius:DS.radius.md,border:"1.5px solid "+DS.color.primaryBorder,background:"#fff",color:DS.color.primaryDark,fontFamily:H,fontWeight:600,fontSize:14,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8};
  var ico=function(el){return <IconSvg size={16} sw={2.2}>{el}</IconSvg>;};

  /* 1 — Message centré avec pictogramme */
  if(variante===1) return (
    <div style={{textAlign:"center",padding:"40px 12px 24px"}}>
      <div style={{position:"relative",width:112,height:112,margin:"0 auto 22px"}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",background:DS.color.primarySoft}}/>
        <div style={{position:"absolute",inset:16,borderRadius:"50%",background:"#fff",border:"1.5px solid "+DS.color.primaryBorder,display:"flex",alignItems:"center",justifyContent:"center",color:DS.color.primary}}>
          <CalendarX2 size={38} strokeWidth={1.8}/>
        </div>
        <span style={{position:"absolute",top:6,right:2,color:DS.color.primary}}><Sparkles size={20} strokeWidth={2}/></span>
      </div>
      <div style={{fontFamily:H,fontSize:20,fontWeight:700,color:DS.color.primaryDark,marginBottom:8}}>Aucune mission pour le moment</div>
      <div style={{fontFamily:Bf,fontSize:14,lineHeight:1.55,color:DS.color.textMuted,maxWidth:300,margin:"0 auto 22px"}}>
        Vous recevrez un e-mail dès qu'une nouvelle mission s'ouvre pour vous. Les missions sont publiées jusqu'à 30 jours à l'avance.
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
        <button onClick={onActualiser} style={btnVide}>{ico(<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>)}Actualiser</button>
        <button onClick={onAgenda} style={btnPlein}>Mon agenda</button>
      </div>
    </div>
  );

  /* 2 — Carte fantôme à la place des cartes de missions */
  if(variante===2) return (
    <div style={{position:"relative",paddingTop:16}}>
      <div style={{position:"absolute",top:0,left:16,right:16,height:60,borderRadius:20,border:"1.5px dashed "+DS.color.primaryBorder,opacity:.5}}/>
      <div style={{position:"absolute",top:8,left:8,right:8,height:60,borderRadius:20,border:"1.5px dashed "+DS.color.primaryBorder,opacity:.8}}/>
      <div style={{position:"relative",borderRadius:20,border:"2px dashed "+DS.color.primaryBorder,background:"rgba(255,255,255,0.85)",padding:"28px 22px 22px",textAlign:"center"}}>
        <div style={{height:110,borderRadius:14,background:"repeating-linear-gradient(135deg, #f0fafa 0 10px, #e6f6f5 10px 20px)",marginBottom:18,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:8,background:DS.color.primaryDark,color:"#fff",borderRadius:DS.radius.pill,padding:"7px 14px",fontFamily:H,fontSize:12,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase"}}>
            <Coffee size={14} strokeWidth={2.2}/>Rien de prévu
          </span>
        </div>
        <div style={{fontFamily:H,fontSize:19,fontWeight:700,color:DS.color.primaryDark,marginBottom:6}}>Pas de mission disponible</div>
        <div style={{fontFamily:Bf,fontSize:13.5,lineHeight:1.5,color:DS.color.textMuted,marginBottom:18}}>Les nouvelles missions apparaîtront ici. On vous prévient par e-mail.</div>
        {dateProchaine
          ?<div onClick={onAgenda} style={{display:"flex",alignItems:"center",gap:12,background:DS.color.primaryDark,borderRadius:14,padding:"12px 14px",cursor:"pointer",marginBottom:12,textAlign:"left",color:"#fff"}}>
              <div style={{width:40,height:40,borderRadius:10,background:"#e0f5f5",color:DS.color.primaryDark,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CalendarX2 size={20} strokeWidth={2}/></div>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontFamily:Bf,fontSize:11,color:"#99e0dd",textTransform:"uppercase",letterSpacing:".08em"}}>Votre prochaine mission</div>
                <div style={{fontFamily:H,fontSize:15,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{(prochaine.logementNom||String(prochaine.nom||"").split(" — ")[0])} · {dateProchaine}</div>
              </div>
              <IconSvg size={18} sw={2.2}><path d="M9 6l6 6-6 6"/></IconSvg>
            </div>
          :null}
        <button onClick={onActualiser} style={Object.assign({},btnVide,{width:"100%"})}>{ico(<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>)}Vérifier à nouveau</button>
      </div>
    </div>
  );

  /* 3 — Carte sombre « tout est calme » + prochaine mission de l'agenda */
  return (
    <div style={{background:DS.color.primaryDark,borderRadius:20,padding:"24px 22px 20px",color:"#fff",boxShadow:"0 12px 28px rgba(8,81,87,0.22)",overflow:"hidden",position:"relative"}}>
      <img src="/illustrations/maisons/petite-maison.png" alt="" style={{position:"absolute",right:-28,top:-10,width:170,opacity:.22,pointerEvents:"none"}}/>
      <div style={{fontFamily:H,fontSize:11,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#99e0dd",marginBottom:10}}>Missions disponibles</div>
      <div style={{fontFamily:H,fontSize:26,fontWeight:700,lineHeight:1.1,marginBottom:8,maxWidth:230}}>Tout est calme pour l'instant</div>
      <div style={{fontFamily:Bf,fontSize:14,lineHeight:1.5,color:"#cdeeed",marginBottom:20,maxWidth:280}}>Aucune mission ouverte à la candidature. Vous serez prévenue par e-mail.</div>
      {dateProchaine
        ?<div onClick={onAgenda} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.1)",borderRadius:14,padding:"12px 14px",cursor:"pointer",marginBottom:14}}>
            <div style={{width:40,height:40,borderRadius:10,background:"#e0f5f5",color:DS.color.primaryDark,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CalendarX2 size={20} strokeWidth={2}/></div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontFamily:Bf,fontSize:11,color:"#99e0dd",textTransform:"uppercase",letterSpacing:".08em"}}>Votre prochaine mission</div>
              <div style={{fontFamily:H,fontSize:15,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{(prochaine.logementNom||String(prochaine.nom||"").split(" — ")[0])} · {dateProchaine}</div>
            </div>
          </div>
        :null}
      <button onClick={onActualiser} style={{width:"100%",height:46,borderRadius:DS.radius.md,border:"1.5px solid rgba(255,255,255,0.45)",background:"transparent",color:"#fff",fontFamily:H,fontWeight:600,fontSize:14,cursor:"pointer"}}>Actualiser</button>
    </div>
  );
}

function StackedCarousel({missions, onAccepter, onRefuser, onPostuler, onRetirer}){
  var [activeIndex, setActiveIndex] = useState(0);
  var trackRef = useRef(null);
  var total = missions.length;

  // carte la plus proche du centre = carte active
  function onScroll(){
    var el=trackRef.current; if(!el) return;
    var kids=el.children, mid=el.scrollLeft+el.clientWidth/2, best=0, dist=Infinity;
    for(var i=0;i<kids.length;i++){ var c=kids[i].offsetLeft+kids[i].offsetWidth/2; var d=Math.abs(c-mid); if(d<dist){dist=d;best=i;} }
    if(best!==activeIndex) setActiveIndex(best);
  }
  function goTo(i){
    var el=trackRef.current; if(!el) return;
    i=Math.max(0,Math.min(total-1,i));
    var k=el.children[i]; if(!k) return;
    el.scrollTo({left:k.offsetLeft-(el.clientWidth-k.offsetWidth)/2,behavior:"smooth"});
  }
  useEffect(function(){ if(activeIndex>total-1) setActiveIndex(Math.max(0,total-1)); },[total]);
  if(total===0) return null;

  var arrow=function(dir){
    var off=dir<0?activeIndex===0:activeIndex===total-1;
    return (
      <button aria-label={dir<0?"Mission précédente":"Mission suivante"} onClick={function(){goTo(activeIndex+dir);}} disabled={off}
        style={{width:36,height:36,borderRadius:18,border:"1.5px solid "+DS.color.primaryBorder,background:"#fff",color:DS.color.primaryDark,cursor:off?"default":"pointer",opacity:off?0.35:1,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
        <IconSvg size={18} sw={2.2}>{dir<0?<path d="M15 6l-6 6 6 6"/>:<path d="M9 6l6 6-6 6"/>}</IconSvg>
      </button>
    );
  };

  return (
    <div style={{position:"relative",width:"100%",paddingBottom:24}}>
      <style>{"@keyframes izPulse{0%,100%{opacity:1}50%{opacity:.25}} .iz-track::-webkit-scrollbar{display:none}"}</style>
      <div ref={trackRef} className="iz-track" onScroll={onScroll}
        style={{display:"flex",alignItems:"flex-start",gap:12,overflowX:"auto",scrollSnapType:"x mandatory",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",
                margin:"0 -20px",padding:"6px 20px 10px",scrollPadding:"0 20px",overscrollBehaviorX:"contain"}}>
        {missions.map(function(m,i){
          var on=i===activeIndex;
          return (
            <div key={m.id} style={{flex:"0 0 "+(total>1?"88%":"100%"),scrollSnapAlign:"center",scrollSnapStop:"always",
              transform:on?"scale(1)":"scale(0.94)",opacity:on?1:0.55,transition:"transform .3s ease, opacity .3s ease",transformOrigin:"center top"}}>
              <MissionCardRiche mission={m} total={total} currentIdx={i}
                onAccepter={onAccepter} onRefuser={onRefuser} onPostuler={onPostuler} onRetirer={onRetirer}/>
            </div>
          );
        })}
      </div>
      {total>1&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginTop:10,width:"100%"}}>
          <div style={{flexShrink:0}}>{arrow(-1)}</div>
          {total<=7
            ?<div style={{display:"flex",gap:6,alignItems:"center"}}>
                {missions.map(function(m,i){
                  var on=i===activeIndex;
                  return <button key={i} aria-label={"Mission "+(i+1)} onClick={function(){goTo(i);}} style={{width:on?20:7,height:7,borderRadius:4,border:"none",padding:0,cursor:"pointer",transition:"all .2s",background:on?DS.color.primary:DS.color.border}}/>;
                })}
              </div>
            /* beaucoup de missions : barre de progression + compteur, largeur fixe */
            :<div style={{display:"flex",alignItems:"center",gap:10,flex:"0 1 160px",minWidth:0}}>
                <div style={{flex:1,height:6,borderRadius:3,background:DS.color.border,overflow:"hidden"}}>
                  <div style={{width:((activeIndex+1)/total*100)+"%",height:"100%",borderRadius:3,background:DS.color.primary,transition:"width .25s ease"}}/>
                </div>
                <span style={{fontFamily:DS.font.heading,fontSize:12,fontWeight:600,color:DS.color.primaryDark,whiteSpace:"nowrap"}}>{activeIndex+1} / {total}</span>
              </div>}
          <div style={{flexShrink:0}}>{arrow(1)}</div>
        </div>
      )}
    </div>
  );
}

function MissionCard({mission, onAccepter, onRefuser, mode}){
  var [loading, setLoading] = useState(false);
  var isPast = mission.date && new Date(mission.date) < new Date();
  var statusColor = mission.etat==="Acceptée" ? DS.color.success : mission.etat==="Disponible" ? DS.color.primary : DS.color.textMuted;
  return (
    <div style={{background:DS.color.surface,border:"1px solid "+DS.color.border,borderRadius:DS.radius.md,padding:"16px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:15,color:DS.color.primaryDark}}>{mission.nom}</div>
          <div style={{fontFamily:DS.font.body,fontSize:13,color:DS.color.textMuted,marginTop:2}}>{formatDateFr(mission.date)}</div>
        </div>
        <span style={{background:statusColor+"22",color:statusColor,fontFamily:DS.font.heading,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:DS.radius.pill,textTransform:"uppercase",letterSpacing:"0.05em"}}>{mission.etat}</span>
      </div>
      {mode==="mesmissions" && !isPast && mission.aApporter && mission.aApporter.length>0 && (
        <div style={{marginTop:6,padding:"10px 12px",borderRadius:DS.radius.sm,background:"#fffbeb",border:"1px solid #fde68a",color:"#78350f",fontSize:13,fontFamily:DS.font.body,lineHeight:1.45}}>
          <strong>🛒 À prendre au stock izinest :</strong> {mission.aApporter.join(", ")}
        </div>
      )}
      {mode==="mesmissions" && mission.slug && !isPast && (
        <a href={"/"+mission.slug} style={{display:"block",marginTop:10,padding:"10px",borderRadius:DS.radius.sm,background:DS.color.primaryBg,color:DS.color.primaryDark,fontWeight:700,fontSize:13,fontFamily:DS.font.heading,textDecoration:"none",textAlign:"center",border:"1px solid "+DS.color.primaryBorder}}>
          Ouvrir le formulaire →
        </a>
      )}
      {mode==="mesmissions" && isPast && (
        <div style={{marginTop:8,fontSize:12,color:DS.color.textFaint,fontFamily:DS.font.body}}>Mission passée</div>
      )}
    </div>
  );
}

function LoginPrestataire({onLogin}){
  var [username, setUsername] = useState("");
  var [password, setPassword] = useState("");
  var [error, setError] = useState("");
  var [loading, setLoading] = useState(false);

  function handleSubmit(){
    if(!username||!password) return;
    setLoading(true); setError("");
    fetch("/api/auth-prestataire",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})})
      .then(function(r){return r.json();})
      .then(function(data){
        if(data.success){ saveSession(data.prestataire); onLogin(data.prestataire); }
        else setError(data.error||"Identifiants incorrects");
      })
      .catch(function(){ setError("Erreur réseau"); })
      .finally(function(){ setLoading(false); });
  }

  return (
    <div style={{minHeight:"100vh",background:DS.color.surface,fontFamily:DS.font.body}}>
      <div style={{background:DS.color.primaryDark,padding:"28px 24px 24px",fontFamily:DS.font.heading}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",marginBottom:6}}>izinest</div>
        <div style={{fontSize:24,fontWeight:700,color:"#fff"}}>Espace prestataire</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginTop:4}}>Connectez-vous pour voir vos missions</div>
      </div>
      <div style={{maxWidth:400,margin:"0 auto",padding:"32px 20px"}}>
        {error?<div style={{background:DS.color.dangerBg,border:"1px solid "+DS.color.dangerBorder,borderRadius:DS.radius.md,padding:"12px 16px",marginBottom:16,fontSize:14,color:DS.color.danger,fontFamily:DS.font.body}}>{error}</div>:null}
        <Field label="Nom d'utilisateur"><Input value={username} onChange={setUsername} placeholder="simondefarge"/></Field>
        <Field label="Mot de passe"><Input type="password" value={password} onChange={setPassword} placeholder="••••••••"/></Field>
        <Btn fullWidth onClick={handleSubmit} disabled={loading||!username||!password}>{loading?"Connexion…":"Se connecter"}</Btn>
      </div>
    </div>
  );
}

function AgendaPrestataire({prestataire, onLogout}){
  var [tab, setTab] = useState("disponibles");
  var [disponibles, setDisponibles] = useState([]);
  var [mesMissions, setMesMissions] = useState([]);
  var [loading, setLoading] = useState(true);
  var [toast, setToast] = useState("");

  function showToast(msg){ setToast(msg); setTimeout(function(){setToast("");},3000); }

  function loadMissions(){
    setLoading(true);
    fetch("/api/missions?prestataireId="+encodeURIComponent(prestataire.id)+"&prestataireNom="+encodeURIComponent(prestataire.nom))
      .then(function(r){return r.json();})
      .then(function(data){
        setDisponibles(data.disponibles||[]);
        setMesMissions(data.mesMissions||[]);
      })
      .finally(function(){setLoading(false);});
  }

  useEffect(loadMissions,[]);

  function handleAction(mission, action){
    return fetch("/api/mission-action",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        missionId:mission.id,
        action:action,
        prestataireId:prestataire.id,
        prestataireNom:prestataire.nom,
        missionNom:mission.nom,
      })
    }).then(function(r){
      if(!r.ok) return r.json().then(function(d){ throw new Error(d.error||"Erreur"); });
      if(action==="postuler"||action==="retirer"){
        setDisponibles(function(prev){ return prev.map(function(m){ return m.id===mission.id?Object.assign({},m,{candidature:action==="postuler"}):m; }); });
        showToast(action==="postuler"?"Candidature envoyée 🙋":"Candidature retirée");
        return;
      }
      if(action==="accepter"){
        setDisponibles(function(prev){ return prev.filter(function(m){ return m.id!==mission.id; }); });
        setMesMissions(function(prev){ return prev.concat([Object.assign({},mission,{etat:"Acceptée",prestataire:prestataire.id})]); });
        showToast("Mission acceptée ✅");
      } else {
        setDisponibles(function(prev){ return prev.filter(function(m){ return m.id!==mission.id; }); });
        showToast("Mission refusée");
      }
    }).catch(function(e){ showToast("Erreur : "+e.message); });
  }

  var missionsFutures = mesMissions.filter(function(m){ return !m.date||new Date(m.date)>=new Date(); });
  var missionsPassees = mesMissions.filter(function(m){ return m.date&&new Date(m.date)<new Date(); });

  return (
    <div style={{minHeight:"100vh",background:DS.color.surface,fontFamily:DS.font.body}}>
      {toast?<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:DS.color.primaryDark,color:"#fff",padding:"10px 20px",borderRadius:DS.radius.md,fontFamily:DS.font.heading,fontWeight:600,fontSize:14,zIndex:9999}}>{toast}</div>:null}
      <div style={{background:DS.color.primaryDark,padding:"20px 20px 16px",fontFamily:DS.font.heading}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",marginBottom:4}}>izinest · Espace prestataire</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{color:"#fff",lineHeight:1.15}}><div style={{fontSize:14,fontWeight:500,opacity:0.85,marginBottom:2}}>Bonjour</div><div style={{fontSize:22,fontWeight:700}}>{prestataire.nom} 👋</div></div>
          <button onClick={function(){clearSession();onLogout();}} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:DS.radius.sm,color:"#fff",fontSize:12,fontWeight:600,padding:"5px 12px",cursor:"pointer",fontFamily:DS.font.heading}}>Déconnexion</button>
        </div>
      </div>

      <div style={{display:"flex",gap:0,borderBottom:"1px solid "+DS.color.border,background:DS.color.surface}}>
        {[
          {key:"disponibles",label:"Disponibles",count:disponibles.length},
          {key:"agenda",label:"Mon agenda",count:missionsFutures.length},
          {key:"historique",label:"Historique"},
        ].map(function(t){
          return (
            <button key={t.key} onClick={function(){setTab(t.key);}} style={{flex:1,padding:"12px 8px",border:"none",borderBottom:tab===t.key?"2.5px solid "+DS.color.primary:"2.5px solid transparent",background:"none",fontFamily:DS.font.heading,fontWeight:tab===t.key?700:500,fontSize:13,color:tab===t.key?DS.color.primary:DS.color.textMuted,cursor:"pointer"}}>
              {t.label}{t.count>0?<span style={{marginLeft:5,background:DS.color.primarySoft,color:DS.color.primary,borderRadius:DS.radius.pill,padding:"1px 7px",fontSize:11,fontWeight:700}}>{t.count}</span>:null}
            </button>
          );
        })}
      </div>

      <div style={{maxWidth:480,margin:"0 auto",padding:"20px 20px 60px"}}>
        {loading?<div style={{textAlign:"center",padding:32,color:DS.color.textMuted}}>Chargement…</div>:null}

        {!loading&&tab==="disponibles"&&(
          (disponibles.length===0||VIDE_FORCE)
            ?<EtatVide variante={VIDE_VARIANTE} prochaine={missionsFutures[0]} onAgenda={function(){setTab("agenda");}} onActualiser={loadMissions}/>
            :<StackedCarousel
                missions={disponibles}
                onAccepter={function(m){return handleAction(m,"accepter");}}
                onRefuser={function(m){return handleAction(m,"refuser");}}
                onPostuler={function(m){return handleAction(m,"postuler");}}
                onRetirer={function(m){return handleAction(m,"retirer");}}
              />
        )}

        {!loading&&tab==="agenda"&&(
          missionsFutures.length===0
            ?<div style={{textAlign:"center",padding:32,color:DS.color.textMuted,fontFamily:DS.font.body}}>Aucune mission à venir.</div>
            :missionsFutures.map(function(m){return <MissionCard key={m.id} mission={m} mode="mesmissions" onAccepter={function(){}} onRefuser={function(){}}/>;})
        )}

        {!loading&&tab==="historique"&&(
          missionsPassees.length===0
            ?<div style={{textAlign:"center",padding:32,color:DS.color.textMuted,fontFamily:DS.font.body}}>Aucune mission passée.</div>
            :missionsPassees.map(function(m){return <MissionCard key={m.id} mission={m} mode="mesmissions" onAccepter={function(){}} onRefuser={function(){}}/>;})
        )}
      </div>
    </div>
  );
}

function PagePrestataire(){
  var [prestataire, setPrestataire] = useState(function(){ return getSession(); });

  if(!prestataire) return <LoginPrestataire onLogin={function(p){ setPrestataire(p); }}/>;
  return <AgendaPrestataire prestataire={prestataire} onLogout={function(){ setPrestataire(null); }}/>;
}


/* ─── ADMIN : validation des candidatures ─────────────────────────────── */
var ADMIN_KEY="izinest_admin_pwd";
var NIVEAUX={1:"Prioritaire",2:"Confirmée",3:"Standard"};
function PageAdmin({ongletInitial}){
  var [onglet,setOnglet]=useState(ongletInitial||"candidatures");
  var [pwd,setPwd]=useState(function(){ try{return sessionStorage.getItem(ADMIN_KEY)||"";}catch(e){return "";} });
  var [saisie,setSaisie]=useState("");
  var [missions,setMissions]=useState(null);
  var [attribuees,setAttribuees]=useState([]);
  var [erreur,setErreur]=useState("");
  var [busy,setBusy]=useState("");
  var [toast,setToast]=useState("");
  function showToast(m){ setToast(m); setTimeout(function(){setToast("");},m.length>60?9000:3000); }
  function charger(p){
    setErreur("");
    fetch("/api/admin-missions",{headers:{"x-admin-password":p}})
      .then(function(r){return r.json().then(function(d){ if(!r.ok) throw new Error(d.error||"Erreur"); return d; });})
      .then(function(d){ setMissions(d.missions||[]); setAttribuees(d.attribuees||[]); try{sessionStorage.setItem(ADMIN_KEY,p);}catch(e){} })
      .catch(function(e){ setErreur(e.message); setMissions(null); setPwd(""); try{sessionStorage.removeItem(ADMIN_KEY);}catch(x){} });
  }
  useEffect(function(){ if(pwd) charger(pwd); },[pwd]);
  function valider(m,c){
    if(!window.confirm("Accepter la candidature de "+c.nom+" pour "+(m.logementNom||m.nom)+" ?")) return;
    setBusy(m.id+c.id);
    fetch("/api/admin-missions",{method:"POST",headers:{"Content-Type":"application/json","x-admin-password":pwd},body:JSON.stringify({missionId:m.id,prestataireId:c.id,missionNom:m.logementNom||m.nom,date:formatDateFr(m.date)})})
      .then(function(r){return r.json().then(function(d){ if(!r.ok) throw new Error(d.error||"Erreur"); return d; });})
      .then(function(d){ setMissions(function(prev){return prev.filter(function(x){return x.id!==m.id;});}); showToast(c.nom+(d.emailEnvoye?" acceptée, e-mail envoyé ✅":" acceptée, e-mail NON envoyé : "+String(d.emailErreur||"inconnu").slice(0,140))); charger(pwd); })
      .catch(function(e){ showToast("Erreur : "+e.message); })
      .finally(function(){ setBusy(""); });
  }
  function relancer(m){
    if(!window.confirm("Renvoyer l'e-mail de la mission "+(m.logementNom||m.nom)+" aux prestataires disponibles ?")) return;
    setBusy("r"+m.id);
    apiAdmin(pwd,null,{vue:"relance",id:m.id}).then(function(d){ showToast("Relance envoyée à "+d.envoyes+" prestataire"+(d.envoyes>1?"s":"")); }).catch(function(e){ showToast("Erreur : "+e.message); }).finally(function(){ setBusy(""); });
  }
  function prime(m){
    var v=window.prompt("Prime affichée sur la carte (en €, vide ou 0 pour retirer) :", m.prime||"");
    if(v===null) return;
    setBusy("p"+m.id);
    apiAdmin(pwd,null,{vue:"prime",id:m.id,prime:String(v).replace(",",".")}).then(function(){ showToast("Prime enregistrée"); charger(pwd); }).catch(function(e){ showToast("Erreur : "+e.message); }).finally(function(){ setBusy(""); });
  }
  function annuler(a){
    if(!window.confirm("Annuler la mission "+(a.logementNom||a.nom)+" du "+formatDateFr(a.date)+" ?\n"+a.prestataire+" sera prévenue par e-mail. La mission sera supprimée.")) return;
    setBusy("x"+a.id);
    fetch("/api/admin-missions",{method:"POST",headers:{"Content-Type":"application/json","x-admin-password":pwd},body:JSON.stringify({action:"annuler",missionId:a.id})})
      .then(function(r){return r.json().then(function(d){ if(!r.ok) throw new Error(d.error||"Erreur"); return d; });})
      .then(function(d){ setAttribuees(function(prev){return prev.filter(function(x){return x.id!==a.id;});}); showToast(d.emailEnvoye?"Mission annulée, e-mail envoyé ✅":"Mission annulée, e-mail NON envoyé : "+String(d.emailErreur||"inconnu").slice(0,140)); })
      .catch(function(e){ showToast("Erreur : "+e.message); })
      .finally(function(){ setBusy(""); });
  }
  var ONGLETS=[["candidatures","Candidatures"],["planning","Planning"],["courses","Courses"],["pressing","Pressing"],["logements","Logements"],["releves","Relevés"]];
  var head=(
    <div style={{background:DS.color.primaryDark,padding:"20px 20px 0",fontFamily:DS.font.heading}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",marginBottom:4}}>izinest · Admin</div>
        <div style={{fontSize:20,fontWeight:700,color:"#fff",marginBottom:14}}>{(ONGLETS.find(function(o){return o[0]===onglet;})||ONGLETS[0])[1]}</div>
        {pwd&&missions!==null&&(
          <div className="iz-track" style={{display:"flex",gap:4,overflowX:"auto",scrollbarWidth:"none"}}>
            {ONGLETS.map(function(o){ var on=o[0]===onglet; return (
              <button key={o[0]} onClick={function(){setOnglet(o[0]); }}
                style={{flexShrink:0,padding:"10px 14px",border:"none",borderBottom:"3px solid "+(on?DS.color.primary:"transparent"),background:"none",color:on?"#fff":"rgba(255,255,255,0.6)",fontFamily:DS.font.heading,fontWeight:700,fontSize:14,cursor:"pointer"}}>{o[1]}</button>
            ); })}
          </div>
        )}
      </div>
    </div>
  );
  if(!pwd||missions===null){
    return (
      <div style={{minHeight:"100vh",background:DS.color.surface,fontFamily:DS.font.body}}>
        {head}
        <div style={{maxWidth:380,margin:"0 auto",padding:"32px 20px"}}>
          <input type="password" value={saisie} onChange={function(e){setSaisie(e.target.value);}} placeholder="Mot de passe admin" style={{width:"100%",boxSizing:"border-box",padding:"12px 14px",borderRadius:DS.radius.md,border:"1px solid "+DS.color.border,fontSize:15,fontFamily:DS.font.body,marginBottom:12}}/>
          {erreur?<div style={{color:"#b91c1c",fontSize:13,marginBottom:12}}>{erreur}</div>:null}
          <button onClick={function(){setPwd(saisie);}} style={{width:"100%",height:48,borderRadius:DS.radius.md,border:"none",background:DS.color.primary,color:"#fff",fontWeight:700,fontSize:15,fontFamily:DS.font.heading,cursor:"pointer"}}>Entrer</button>
        </div>
      </div>
    );
  }
  if(onglet!=="candidatures"){
    return (
      <div style={{minHeight:"100vh",background:DS.color.surfaceAlt,fontFamily:DS.font.body}}>
        {head}
        <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 16px 60px"}}>
          {onglet==="planning"&&<AdminPlanning pwd={pwd}/>}
          {onglet==="courses"&&<AdminCourses pwd={pwd}/>}
          {onglet==="pressing"&&<AdminPressing pwd={pwd}/>}
          {onglet==="logements"&&<AdminLogements pwd={pwd}/>}
          {onglet==="releves"&&<AdminReleves pwd={pwd}/>}
        </div>
      </div>
    );
  }
  var avec=missions.filter(function(m){return m.candidats.length>0;});
  var sans=missions.filter(function(m){return m.candidats.length===0&&m.attribution==="postuler";});
  return (
    <div style={{minHeight:"100vh",background:DS.color.surface,fontFamily:DS.font.body}}>
      {toast?<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",background:DS.color.primaryDark,color:"#fff",padding:"10px 20px",borderRadius:DS.radius.md,fontFamily:DS.font.heading,fontWeight:600,fontSize:14,zIndex:9999}}>{toast}</div>:null}
      {head}
      <div style={{maxWidth:560,margin:"0 auto",padding:"20px 20px 60px"}}>
        {avec.length===0&&<div style={{textAlign:"center",padding:32,color:DS.color.textMuted}}>Aucune candidature en attente.</div>}
        {avec.map(function(m){
          return (
            <div key={m.id} style={{background:DS.color.surface,border:"1px solid "+DS.color.border,borderRadius:DS.radius.md,padding:16,marginBottom:12}}>
              <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:16,color:DS.color.primaryDark}}>{m.logementNom||m.nom}</div>
              <div style={{fontSize:13,color:DS.color.textMuted,margin:"2px 0 12px"}}>{formatDateFr(m.date)}</div>
              {m.candidats.map(function(c){
                return (
                  <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 0",borderTop:"1px solid "+DS.color.border}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontFamily:DS.font.heading,fontWeight:600,fontSize:14,color:DS.color.primaryDark}}>{c.nom}</div>
                      <div style={{fontSize:12,color:DS.color.textMuted}}>{c.niveau?("Niveau "+c.niveau+" · "+NIVEAUX[c.niveau]):"Niveau non renseigné"}</div>
                    </div>
                    <button disabled={busy===m.id+c.id} onClick={function(){valider(m,c);}} style={{flexShrink:0,height:38,padding:"0 16px",borderRadius:DS.radius.sm,border:"none",background:DS.color.primary,color:"#fff",fontWeight:700,fontSize:13,fontFamily:DS.font.heading,cursor:"pointer"}}>{busy===m.id+c.id?"…":"Accepter"}</button>
                  </div>
                );
              })}
            </div>
          );
        })}
        {sans.length>0&&(
          <div style={{marginTop:24}}>
            <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:13,color:DS.color.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Sans candidat</div>
            {sans.map(function(m){ return (
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",padding:"10px 0",borderTop:"1px solid "+DS.color.border,fontSize:14,color:DS.color.primaryDark}}>
                <div style={{flex:"1 1 180px",minWidth:0}}>
                  <div style={{fontFamily:DS.font.heading,fontWeight:600}}>{m.logementNom||m.nom}</div>
                  <div style={{fontSize:12,color:DS.color.textMuted}}>{formatDateFr(m.date)}</div>
                </div>
                <button disabled={busy==="r"+m.id} onClick={function(){relancer(m);}} style={btnAdminVide}>{busy==="r"+m.id?"…":"Relancer"}</button>
              </div>
            ); })}
          </div>
        )}
        {attribuees.length>0&&(
          <div style={{marginTop:28}}>
            <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:13,color:DS.color.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Missions attribuées</div>
            {attribuees.map(function(a){
              return (
                <div key={a.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 0",borderTop:"1px solid "+DS.color.border}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontFamily:DS.font.heading,fontWeight:600,fontSize:14,color:DS.color.primaryDark}}>{a.logementNom||a.nom}</div>
                    <div style={{fontSize:12,color:DS.color.textMuted}}>{formatDateFr(a.date)} · {a.prestataire||"—"}</div>
                  </div>
                  <button disabled={busy==="x"+a.id} onClick={function(){annuler(a);}} style={{flexShrink:0,height:34,padding:"0 14px",borderRadius:DS.radius.sm,border:"1.5px solid #dc2626",background:"none",color:"#dc2626",fontWeight:700,fontSize:12,fontFamily:DS.font.heading,cursor:"pointer"}}>{busy==="x"+a.id?"…":"Annuler"}</button>
                </div>
              );
            })}
          </div>
        )}
        <button onClick={function(){charger(pwd);}} style={{marginTop:20,width:"100%",height:44,borderRadius:DS.radius.md,border:"1px solid "+DS.color.border,background:"none",color:DS.color.primaryDark,fontWeight:600,fontSize:14,fontFamily:DS.font.heading,cursor:"pointer"}}>Actualiser</button>
      </div>
    </div>
  );
}


/* ── Admin : utilitaires ─────────────────────────────────────────────── */
function apiAdmin(pwd, query, body){
  return fetch("/api/admin-missions"+(query?"?"+query:""),{method:body?"POST":"GET",headers:{"Content-Type":"application/json","x-admin-password":pwd},body:body?JSON.stringify(body):undefined})
    .then(function(r){return r.json().then(function(d){ if(!r.ok) throw new Error(d.error||"Erreur"); return d; });});
}
var carteAdmin={background:"#fff",border:"1px solid "+DS.color.border,borderRadius:DS.radius.lg,padding:16,boxShadow:"0 1px 2px rgba(8,81,87,0.05)"};
var btnAdmin={height:36,padding:"0 14px",borderRadius:DS.radius.sm,border:"none",background:DS.color.primary,color:"#fff",fontWeight:700,fontSize:13,fontFamily:DS.font.heading,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6};
var btnAdminVide={height:36,padding:"0 14px",borderRadius:DS.radius.sm,border:"1.5px solid "+DS.color.primaryBorder,background:"#fff",color:DS.color.primaryDark,fontWeight:600,fontSize:13,fontFamily:DS.font.heading,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6};
function Chargement({erreur}){ return <div style={{textAlign:"center",padding:40,color:erreur?"#b91c1c":DS.color.textMuted,fontFamily:DS.font.body}}>{erreur||"Chargement…"}</div>; }
function useLargeur(){ var [w,setW]=useState(window.innerWidth); useEffect(function(){ function f(){setW(window.innerWidth);} window.addEventListener("resize",f); return function(){window.removeEventListener("resize",f);}; },[]); return w; }
var PALETTE_PRESTA=["#00bab3","#7c5cff","#f59e0b","#e5487a","#2f80ed","#16a34a","#c2410c","#0e7490"];
function couleurPresta(nom){ return PALETTE_PRESTA[hashStr(nom)%PALETTE_PRESTA.length]; }
function lundiDe(d){ var x=new Date(d); x.setHours(12,0,0,0); var j=(x.getDay()+6)%7; x.setDate(x.getDate()-j); return x.toISOString().slice(0,10); }
function ajouterJours(iso,n){ var x=new Date(iso+"T12:00:00"); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); }

/* ── Planning de la semaine ──────────────────────────────────────────── */
function AdminPlanning({pwd}){
  var [debut,setDebut]=useState(function(){return lundiDe(new Date());});
  var [data,setData]=useState(null); var [err,setErr]=useState("");
  var large=useLargeur()>=820;
  useEffect(function(){ setData(null); setErr(""); apiAdmin(pwd,"vue=planning&debut="+debut).then(setData).catch(function(e){setErr(e.message);}); },[debut]);
  var jours=[0,1,2,3,4,5,6].map(function(i){return ajouterJours(debut,i);});
  var auj=new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Paris"});
  var titre=new Date(debut+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long"})+" – "+new Date(ajouterJours(debut,6)+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
  var missions=(data&&data.missions)||[];
  var prestas=[]; missions.forEach(function(m){ if(m.prestataire&&prestas.indexOf(m.prestataire)===-1) prestas.push(m.prestataire); });
  var nbNonPourvues=missions.filter(function(m){return !m.prestataire;}).length;
  function chip(m){
    var c=m.prestataire?couleurPresta(m.prestataire):"#f59e0b";
    return (
      <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" style={{display:"block",textDecoration:"none",background:m.prestataire?"#fff":"#fffbeb",border:"1px solid "+(m.prestataire?DS.color.border:"#fcd34d"),borderLeft:"4px solid "+c,borderRadius:10,padding:"8px 10px",marginBottom:6}}>
        <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:13,color:DS.color.primaryDark,lineHeight:1.25}}>{m.logementNom||String(m.nom||"").split(" — ")[0]}</div>
        <div style={{fontSize:12,marginTop:2,color:m.prestataire?c:"#b45309",fontWeight:600}}>{m.prestataire||("Non pourvue"+(m.candidats?" · "+m.candidats+" candidat"+(m.candidats>1?"s":""):""))}</div>
      </a>
    );
  }
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:14}}>
        <button style={btnAdminVide} onClick={function(){setDebut(ajouterJours(debut,-7));}}>←</button>
        <button style={btnAdminVide} onClick={function(){setDebut(lundiDe(new Date()));}}>Cette semaine</button>
        <button style={btnAdminVide} onClick={function(){setDebut(ajouterJours(debut,7));}}>→</button>
        <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:16,color:DS.color.primaryDark,marginLeft:6}}>{titre}</div>
      </div>
      {data&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          <span style={{fontSize:12,fontWeight:700,fontFamily:DS.font.heading,padding:"4px 10px",borderRadius:99,background:DS.color.primarySoft,color:DS.color.primaryDark}}>{missions.length} mission{missions.length>1?"s":""}</span>
          {nbNonPourvues>0&&<span style={{fontSize:12,fontWeight:700,fontFamily:DS.font.heading,padding:"4px 10px",borderRadius:99,background:"#fef3c7",color:"#92400e"}}>{nbNonPourvues} non pourvue{nbNonPourvues>1?"s":""}</span>}
          {prestas.map(function(p){ return <span key={p} style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,padding:"4px 10px",borderRadius:99,background:"#fff",border:"1px solid "+DS.color.border,color:DS.color.primaryDark}}><span style={{width:8,height:8,borderRadius:4,background:couleurPresta(p)}}/>{p}</span>; })}
        </div>
      )}
      {!data?<Chargement erreur={err}/>:(
        <div style={{display:large?"grid":"block",gridTemplateColumns:"repeat(7, minmax(0,1fr))",gap:8}}>
          {jours.map(function(j){
            var dm=missions.filter(function(m){return m.date===j;});
            var d=new Date(j+"T12:00:00"); var ajd=j===auj;
            return (
              <div key={j} style={{background:ajd?DS.color.primarySoft:"#fff",border:"1px solid "+(ajd?DS.color.primaryBorder:DS.color.border),borderRadius:12,padding:8,marginBottom:large?0:8,minHeight:large?160:0}}>
                <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:8,padding:"2px 2px 0"}}>
                  <span style={{fontFamily:DS.font.heading,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:DS.color.textMuted}}>{d.toLocaleDateString("fr-FR",{weekday:"short"}).replace(".","")}</span>
                  <span style={{fontFamily:DS.font.heading,fontSize:18,fontWeight:700,color:DS.color.primaryDark}}>{d.getDate()}</span>
                  {dm.length>0&&<span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:DS.color.primary}}>{dm.length}</span>}
                </div>
                {dm.length===0?<div style={{fontSize:12,color:DS.color.textFaint,padding:"2px 4px"}}>—</div>:dm.map(chip)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Liste de courses (consommables à prévoir des rapports) ─────────── */
function AdminCourses({pwd}){
  var [data,setData]=useState(null); var [err,setErr]=useState(""); var [busy,setBusy]=useState(""); var [copie,setCopie]=useState("");
  function charger(){ setErr(""); apiAdmin(pwd,"vue=courses").then(setData).catch(function(e){setErr(e.message);}); }
  useEffect(charger,[]);
  if(!data) return <Chargement erreur={err}/>;
  var groupes={}; data.rapports.forEach(function(r){ (groupes[r.logement]=groupes[r.logement]||[]).push(r); });
  var noms=Object.keys(groupes).sort();
  function articles(liste){ var vus={}; var out=[]; liste.forEach(function(r){ r.texte.split(/[,\n;]+/).map(function(x){return majuscule(x);}).filter(Boolean).forEach(function(a){ var k=a.toLowerCase(); if(!vus[k]){vus[k]=1; out.push(a);} }); }); return out; }
  function fait(nom){
    if(!window.confirm("Marquer les courses de « "+nom+" » comme faites ?")) return;
    setBusy(nom);
    apiAdmin(pwd,null,{vue:"courses",ids:groupes[nom].map(function(r){return r.id;})}).then(charger).catch(function(e){alert(e.message);}).finally(function(){setBusy("");});
  }
  function copier(){
    var t=noms.map(function(n){return n+" :\n"+articles(groupes[n]).map(function(a){return "  - "+a;}).join("\n");}).join("\n\n");
    navigator.clipboard.writeText(t).then(function(){setCopie("ok");setTimeout(function(){setCopie("");},2000);});
  }
  if(noms.length===0) return <div style={Object.assign({},carteAdmin,{textAlign:"center",padding:40,color:DS.color.textMuted})}>Rien à acheter : aucun consommable signalé dans les rapports.</div>;
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:14}}>
        <div style={{fontSize:14,color:DS.color.textMuted}}>{noms.length} logement{noms.length>1?"s":""} à réapprovisionner · d'après les rapports de ménage</div>
        <button style={btnAdminVide} onClick={copier}>{copie?"Copié !":"Copier toute la liste"}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))",gap:12}}>
        {noms.map(function(n){
          var liste=groupes[n];
          return (
            <div key={n} style={carteAdmin}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:34,height:34,borderRadius:10,background:DS.color.primarySoft,color:DS.color.primaryDark,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Package size={18} strokeWidth={2}/></div>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:15,color:DS.color.primaryDark}}>{n}</div>
                  <div style={{fontSize:12,color:DS.color.textMuted}}>{liste.length} rapport{liste.length>1?"s":""} · dernier le {formatDateFr(liste[0].date)}</div>
                  {data.prochains&&data.prochains[n]&&<div style={{fontSize:12,fontWeight:700,color:"#b45309",marginTop:2}}>Prochain ménage : {formatDateFr(data.prochains[n])}</div>}
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                {articles(liste).map(function(a){ return <span key={a} style={{fontSize:13,padding:"5px 10px",borderRadius:99,background:DS.color.primaryBg,border:"1px solid "+DS.color.primaryBorder,color:DS.color.primaryDark}}>{a}</span>; })}
              </div>
              <details style={{marginBottom:12}}>
                <summary style={{fontSize:12,color:DS.color.primary,fontWeight:700,cursor:"pointer"}}>Détail des rapports</summary>
                {liste.map(function(r){ return <div key={r.id} style={{fontSize:12,color:DS.color.textMuted,marginTop:6}}><a href={r.url} target="_blank" rel="noopener noreferrer" style={{color:DS.color.primaryDark,fontWeight:600}}>{formatDateFr(r.date)}</a>{r.prestataire?" · "+r.prestataire:""} — {r.texte}</div>; })}
              </details>
              <button disabled={busy===n} style={Object.assign({},btnAdmin,{width:"100%"})} onClick={function(){fait(n);}}><Check size={15} strokeWidth={2.6}/>{busy===n?"…":"Courses faites"}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Suivi du linge au pressing ──────────────────────────────────────── */
var STATUTS_PRESSING=["À déposer","Au pressing","Prêt à récupérer","Récupéré"];
function AdminPressing({pwd}){
  var [data,setData]=useState(null); var [err,setErr]=useState(""); var [logs,setLogs]=useState([]);
  var [form,setForm]=useState({logement:"",articles:"",notes:""}); var [busy,setBusy]=useState(""); var [ouvert,setOuvert]=useState(false);
  function charger(){ setErr(""); apiAdmin(pwd,"vue=pressing").then(setData).catch(function(e){setErr(e.message);}); }
  useEffect(function(){ charger(); apiAdmin(pwd,"vue=logements").then(function(d){setLogs(d.logements||[]);}).catch(function(){}); },[]);
  function preremplir(){
    var l=logs.find(function(x){return x.nom===form.logement;}); if(!l) return;
    setBusy("pre");
    fetch("/api/logement?slug="+encodeURIComponent(l.slug)).then(function(r){return r.json();}).then(function(d){
      var t=plainOf((d.logement||{}).linge); setForm(Object.assign({},form,{articles:t||form.articles}));
      if(!t) alert("Aucun linge renseigné pour ce logement.");
    }).finally(function(){setBusy("");});
  }
  function creer(){
    if(!form.logement||!form.articles.trim()){ alert("Choisissez un logement et indiquez les articles."); return; }
    setBusy("creer");
    apiAdmin(pwd,null,{vue:"pressing_creer",logement:form.logement,articles:form.articles,notes:form.notes}).then(function(){ setForm({logement:"",articles:"",notes:""}); setOuvert(false); charger(); }).catch(function(e){alert(e.message);}).finally(function(){setBusy("");});
  }
  function statut(lot,s){ setBusy(lot.id); apiAdmin(pwd,null,{vue:"pressing_statut",id:lot.id,statut:s}).then(charger).catch(function(e){alert(e.message);}).finally(function(){setBusy("");}); }
  function suppr(lot){ if(!window.confirm("Supprimer ce lot ?")) return; setBusy(lot.id); apiAdmin(pwd,null,{vue:"pressing_suppr",id:lot.id}).then(charger).catch(function(e){alert(e.message);}).finally(function(){setBusy("");}); }
  var champ={width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:DS.radius.sm,border:"1.5px solid "+DS.color.border,fontSize:14,fontFamily:DS.font.body,marginBottom:10,background:"#fff"};
  if(!data) return <Chargement erreur={err}/>;
  var couleurs={"À déposer":"#f59e0b","Au pressing":"#2f80ed","Prêt à récupérer":"#7c5cff","Récupéré":"#16a34a"};
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:10,flexWrap:"wrap"}}>
        <div style={{fontSize:14,color:DS.color.textMuted}}>Suivi des lots de linge envoyés au pressing</div>
        <button style={btnAdmin} onClick={function(){setOuvert(!ouvert);}}>{ouvert?"Fermer":"+ Nouveau lot"}</button>
      </div>
      {ouvert&&(
        <div style={Object.assign({},carteAdmin,{marginBottom:16,maxWidth:560})}>
          <select value={form.logement} onChange={function(e){setForm(Object.assign({},form,{logement:e.target.value}));}} style={champ}>
            <option value="">Logement…</option>
            {logs.map(function(l){return <option key={l.id} value={l.nom}>{l.nom}</option>;})}
          </select>
          <textarea rows={6} value={form.articles} onChange={function(e){setForm(Object.assign({},form,{articles:e.target.value}));}} placeholder={"Articles (un par ligne)\nex. 2 × Drap de bain"} style={Object.assign({},champ,{resize:"vertical"})}/>
          <input value={form.notes} onChange={function(e){setForm(Object.assign({},form,{notes:e.target.value}));}} placeholder="Notes (facultatif)" style={champ}/>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button style={btnAdminVide} disabled={!form.logement||busy==="pre"} onClick={preremplir}>{busy==="pre"?"…":"Reprendre le linge du logement"}</button>
            <button style={btnAdmin} disabled={busy==="creer"} onClick={creer}>{busy==="creer"?"…":"Créer le lot"}</button>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))",gap:12}}>
        {STATUTS_PRESSING.map(function(s,i){
          var lots=data.lots.filter(function(l){return l.statut===s;});
          if(s==="Récupéré") lots=lots.slice(0,10);
          return (
            <div key={s} style={{background:"rgba(255,255,255,0.6)",border:"1px solid "+DS.color.border,borderRadius:14,padding:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,margin:"2px 4px 10px"}}>
                <span style={{width:9,height:9,borderRadius:5,background:couleurs[s]}}/>
                <span style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:13,color:DS.color.primaryDark}}>{s}</span>
                <span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:DS.color.textMuted}}>{lots.length}</span>
              </div>
              {lots.length===0&&<div style={{fontSize:12,color:DS.color.textFaint,padding:"4px 6px 8px"}}>Aucun lot</div>}
              {lots.map(function(l){
                return (
                  <div key={l.id} style={Object.assign({},carteAdmin,{padding:12,marginBottom:8})}>
                    <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:14,color:DS.color.primaryDark}}>{l.logement||l.lot}</div>
                    <div style={{fontSize:11,color:DS.color.textMuted,marginBottom:6}}>{l.depose?"Déposé le "+formatDateFr(l.depose):"Créé le "+formatDateFr(l.cree)}{l.recupere?" · récupéré le "+formatDateFr(l.recupere):""}</div>
                    <div style={{fontSize:12,color:DS.color.primaryDark,whiteSpace:"pre-line",lineHeight:1.45,marginBottom:l.notes?6:10}}>{l.articles}</div>
                    {l.notes&&<div style={{fontSize:12,color:DS.color.textMuted,fontStyle:"italic",marginBottom:10}}>{l.notes}</div>}
                    <div style={{display:"flex",gap:6}}>
                      {i<STATUTS_PRESSING.length-1&&<button disabled={busy===l.id} style={Object.assign({},btnAdmin,{flex:1,height:32,fontSize:12})} onClick={function(){statut(l,STATUTS_PRESSING[i+1]);}}>{busy===l.id?"…":"→ "+STATUTS_PRESSING[i+1]}</button>}
                      <button disabled={busy===l.id} title="Supprimer" style={Object.assign({},btnAdminVide,{height:32,padding:"0 10px",fontSize:12})} onClick={function(){suppr(l);}}><Trash2 size={14}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Logements ───────────────────────────────────────────────────────── */
function AdminLogements({pwd}){
  var [data,setData]=useState(null); var [err,setErr]=useState(""); var [q,setQ]=useState(""); var [filtre,setFiltre]=useState("");
  useEffect(function(){ apiAdmin(pwd,"vue=logements").then(setData).catch(function(e){setErr(e.message);}); },[]);
  if(!data) return <Chargement erreur={err}/>;
  var types=[]; data.logements.forEach(function(l){ if(l.type&&types.indexOf(l.type)===-1) types.push(l.type); });
  var nq=String(q).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
  var liste=data.logements.filter(function(l){
    if(filtre&&l.type!==filtre) return false;
    if(!nq) return true;
    return (l.nom+" "+l.adresse+" "+l.proprietaire).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().indexOf(nq)!==-1;
  });
  var pill=function(t,bg,fg){return <span style={{fontSize:11,fontWeight:700,fontFamily:DS.font.heading,padding:"3px 8px",borderRadius:99,background:bg,color:fg,whiteSpace:"nowrap"}}>{t}</span>;};
  return (
    <div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        <input value={q} onChange={function(e){setQ(e.target.value);}} placeholder="Rechercher un logement, une adresse, un propriétaire…" style={{flex:"1 1 260px",padding:"10px 14px",borderRadius:DS.radius.md,border:"1.5px solid "+DS.color.border,fontSize:14,fontFamily:DS.font.body,background:"#fff"}}/>
        <select value={filtre} onChange={function(e){setFiltre(e.target.value);}} style={{padding:"10px 12px",borderRadius:DS.radius.md,border:"1.5px solid "+DS.color.border,fontSize:14,fontFamily:DS.font.body,background:"#fff"}}>
          <option value="">Tous les types</option>
          {types.map(function(t){return <option key={t} value={t}>{t}</option>;})}
        </select>
      </div>
      <div style={{fontSize:13,color:DS.color.textMuted,marginBottom:10}}>{liste.length} logement{liste.length>1?"s":""}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))",gap:12}}>
        {liste.map(function(l){
          return (
            <div key={l.id} style={Object.assign({},carteAdmin,{padding:0,overflow:"hidden",display:"flex",flexDirection:"column"})}>
              <div style={{height:130,background:DS.color.primarySoft,position:"relative"}}>
                {l.hero
                  ?<img src={l.hero} alt="" loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                  :<img src={"/illustrations/maisons/"+pickMaison({type:l.type,logementNom:l.nom,logement:l.id})+".png"} alt="" style={{height:"100%",display:"block",margin:"0 auto",opacity:.9}}/>}
                {l.type&&<span style={{position:"absolute",top:10,left:10}}>{pill(l.type,"rgba(255,255,255,0.92)",DS.color.primaryDark)}</span>}
              </div>
              <div style={{padding:14,display:"flex",flexDirection:"column",gap:8,flex:1}}>
                <div>
                  <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:16,color:DS.color.primaryDark}}>{l.nom}</div>
                  {l.adresse&&<div style={{fontSize:12,color:DS.color.textMuted,marginTop:2}}>{l.adresse}</div>}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {l.voyageurs!==""&&pill(l.voyageurs+" voyageurs",DS.color.primaryBg,DS.color.primaryDark)}
                  {l.forfait&&pill(l.forfait,DS.color.primaryDark,"#fff")}
                  {pill("Niveau "+l.niveauRequis,DS.color.primaryBg,DS.color.primaryDark)}
                  {pill(l.attribution,DS.color.primaryBg,DS.color.primaryDark)}
                  {l.stockARecuperer&&pill("Consommables à apporter","#fef3c7","#92400e")}
                  {l.lingeLie>0&&pill("Linge : "+l.lingeLie+" articles",DS.color.primaryBg,DS.color.primaryDark)}
                </div>
                {l.proprietaire&&<div style={{fontSize:12,color:DS.color.textMuted}}>Facturation à {l.proprietaire}</div>}
                <div style={{display:"flex",gap:6,marginTop:"auto",paddingTop:4}}>
                  <a href={"/"+l.slug} style={Object.assign({},btnAdmin,{flex:1,textDecoration:"none"})}>Formulaire</a>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" style={Object.assign({},btnAdminVide,{textDecoration:"none"})}>Notion</a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ── Relevé mensuel par prestataire ──────────────────────────────────── */
function AdminReleves({pwd}){
  var [mois,setMois]=useState(function(){ var d=new Date(); return d.toLocaleDateString("sv-SE",{timeZone:"Europe/Paris"}).slice(0,7); });
  var [data,setData]=useState(null); var [err,setErr]=useState("");
  useEffect(function(){ setData(null); setErr(""); apiAdmin(pwd,"vue=releve&mois="+mois).then(setData).catch(function(e){setErr(e.message);}); },[mois]);
  function decaler(n){ var p=mois.split("-").map(Number); var d=new Date(Date.UTC(p[0],p[1]-1+n,1)); setMois(d.toISOString().slice(0,7)); }
  var libMois=new Date(mois+"-15T12:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  var eur=function(n){ return (Math.round(n*100)/100).toLocaleString("fr-FR",{minimumFractionDigits:0,maximumFractionDigits:2})+" €"; };
  var groupes={}; ((data&&data.lignes)||[]).forEach(function(l){ (groupes[l.prestataire]=groupes[l.prestataire]||[]).push(l); });
  var noms=Object.keys(groupes).sort();
  var total=function(ls,avenir){ return ls.filter(function(l){return avenir||!l.aVenir;}).reduce(function(a,l){return a+(l.forfait||0)+(l.prime||0);},0); };
  function csv(ls,nom){
    var rows=[["Prestataire","Date","Logement","Forfait (€)","Prime (€)","Total (€)","Statut"]].concat(ls.map(function(l){return [l.prestataire,l.date,l.logement,l.forfait||0,l.prime||0,(l.forfait||0)+(l.prime||0),l.aVenir?"À venir":"Effectuée"];}));
    var txt="﻿"+rows.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(";");}).join("\n");
    var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([txt],{type:"text/csv;charset=utf-8"})); a.download="releve-"+mois+(nom?"-"+slugify(nom):"")+".csv"; a.click();
  }
  function pdf(nom){
    var ls=groupes[nom].filter(function(l){return !l.aVenir;});
    var w=window.open("","_blank"); if(!w){ alert("Autorisez les fenêtres pop-up pour imprimer."); return; }
    var lignes=ls.map(function(l){return "<tr><td>"+new Date(l.date+"T12:00:00").toLocaleDateString("fr-FR")+"</td><td>"+l.logement+"</td><td class=n>"+eur(l.forfait||0)+"</td><td class=n>"+(l.prime?eur(l.prime):"—")+"</td><td class=n><b>"+eur((l.forfait||0)+(l.prime||0))+"</b></td></tr>";}).join("");
    w.document.write("<!doctype html><html lang=fr><head><meta charset=utf-8><title>Relevé "+nom+" — "+libMois+"</title><style>body{font-family:Arial,sans-serif;color:#0f2e31;margin:40px}h1{font-size:22px;margin:0 0 4px;color:#085157}.s{color:#5b8f93;margin:0 0 24px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px 10px;border-bottom:1px solid #e2ecee;text-align:left}th{background:#f0fafa;color:#085157;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.n{text-align:right}tfoot td{font-weight:700;font-size:15px;border-top:2px solid #085157}.f{margin-top:30px;font-size:11px;color:#94b8bb}</style></head><body>"
      +"<h1>Relevé de missions — "+nom+"</h1><p class=s>izinest · "+libMois+" · "+ls.length+" mission"+(ls.length>1?"s":"")+" effectuée"+(ls.length>1?"s":"")+"</p>"
      +"<table><thead><tr><th>Date</th><th>Logement</th><th class=n>Forfait</th><th class=n>Prime</th><th class=n>Total</th></tr></thead><tbody>"+lignes+"</tbody><tfoot><tr><td colspan=4>Total du mois</td><td class=n>"+eur(total(ls))+"</td></tr></tfoot></table>"
      +"<p class=f>Document généré le "+new Date().toLocaleDateString("fr-FR")+" depuis agents.izinest.fr</p><script>window.onload=function(){window.print();}<\/script></body></html>");
    w.document.close();
  }
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:14}}>
        <button style={btnAdminVide} onClick={function(){decaler(-1);}}>←</button>
        <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:18,color:DS.color.primaryDark,minWidth:150,textAlign:"center",textTransform:"capitalize"}}>{libMois}</div>
        <button style={btnAdminVide} onClick={function(){decaler(1);}}>→</button>
        {data&&data.lignes.length>0&&<button style={Object.assign({},btnAdminVide,{marginLeft:"auto"})} onClick={function(){csv(data.lignes);}}>Tout exporter (CSV)</button>}
      </div>
      {!data?<Chargement erreur={err}/>:noms.length===0?<div style={Object.assign({},carteAdmin,{textAlign:"center",padding:40,color:DS.color.textMuted})}>Aucune mission attribuée sur ce mois.</div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))",gap:12}}>
          {noms.map(function(n){
            var ls=groupes[n]; var faites=ls.filter(function(l){return !l.aVenir;}); var avenir=ls.length-faites.length;
            return (
              <div key={n} style={carteAdmin}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:10}}>
                  <div>
                    <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:16,color:DS.color.primaryDark}}>{n}</div>
                    <div style={{fontSize:12,color:DS.color.textMuted}}>{faites.length} effectuée{faites.length>1?"s":""}{avenir?" · "+avenir+" à venir":""}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:DS.font.heading,fontWeight:700,fontSize:24,color:DS.color.primaryDark,lineHeight:1}}>{eur(total(ls))}</div>
                    {avenir>0&&<div style={{fontSize:11,color:DS.color.textMuted,marginTop:4}}>{eur(total(ls,true))} avec les missions à venir</div>}
                  </div>
                </div>
                <div style={{borderTop:"1px solid "+DS.color.border}}>
                  {ls.map(function(l){ return (
                    <div key={l.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid "+DS.color.border,fontSize:13,opacity:l.aVenir?.55:1}}>
                      <span style={{width:52,flexShrink:0,color:DS.color.textMuted}}>{new Date(l.date+"T12:00:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})}</span>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" style={{flex:1,minWidth:0,color:DS.color.primaryDark,textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.logement}</a>
                      {l.prime>0&&<span style={{fontSize:11,fontWeight:700,color:"#b45309"}}>+{eur(l.prime)}</span>}
                      <span style={{width:62,textAlign:"right",fontWeight:700,color:DS.color.primaryDark}}>{eur((l.forfait||0)+(l.prime||0))}</span>
                    </div>
                  ); })}
                </div>
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button style={Object.assign({},btnAdmin,{flex:1})} onClick={function(){pdf(n);}}>PDF / Imprimer</button>
                  <button style={btnAdminVide} onClick={function(){csv(ls,n);}}>CSV</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function PageIntrouvable(){
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:DS.color.surfaceAlt,fontFamily:DS.font.body,padding:20}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:DS.font.heading,fontSize:22,fontWeight:700,color:DS.color.primaryDark,marginBottom:8}}>Page introuvable</div>
        <a href="/" style={{color:DS.color.primary,fontWeight:700,textDecoration:"none"}}>Retour à l'accueil</a>
      </div>
    </div>
  );
}

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
var PAGES_SPECIALES=["prestataire","admin","logements"];
export default function App(){
  var [step,setStep]=useState(0);
  var [arrivee,setArrivee]=useState(INIT_ARRIVEE);
  var [attention,setAttention]=useState(INIT_ATTENTION);
  var [etatLieux,setEtatLieux]=useState(INIT_ETAT);
  var [consommables,setConsommables]=useState(INIT_CONSO);
  var [photosArrivee,setPhotosArrivee]=useState([]);
  var [photos,setPhotos]=useState([]);
  // photos du brouillon conservées dans le téléphone
  var photosSauvees=useRef({});
  useEffect(function(){
    var actuelles={};
    [["arrivee",photosArrivee],["fin",photos]].forEach(function(pair){
      pair[1].forEach(function(p){
        if(p.traitement) return;
        actuelles[p.id]=1;
        if(photosSauvees.current[p.id]!==p.file){ photosSauvees.current[p.id]=p.file; idbPhotoPut({id:p.id,kind:pair[0],name:p.name,ref:p.ref||"",blob:p.file}); }
      });
    });
    Object.keys(photosSauvees.current).forEach(function(id){ if(!actuelles[id]){ delete photosSauvees.current[id]; idbPhotoSuppr(id); } });
  },[photos,photosArrivee]);
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
    if(!slug||PAGES_SPECIALES.indexOf(slug)!==-1) return;
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
    // préchargement des versions légères dès l'ouverture du formulaire : prêtes à l'étape photos
    if(logement&&logement.photosReference){logement.photosReference.forEach(function(p){var a=new Image();a.src=p.moyen||p.url;var b=new Image();b.src=p.mini||p.url;});}
  },[logement]);

  useEffect(function(){
    var aReprendre=false;
    try{var raw=localStorage.getItem(STORAGE_KEY);if(raw){var draft=JSON.parse(raw);if(draft&&draft.step>0){aReprendre=true;setSavedDraft(draft);setShowResume(true);}}}catch(e){}
    if(!aReprendre) idbPhotosVider();   // pas de brouillon : on repart sans anciennes photos
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

  function handleResume(){
    idbPhotosTout().then(function(recs){
      recs.forEach(function(r){ photosSauvees.current[r.id]=true; });
      var a=recs.filter(function(r){return r.kind==="arrivee";}).map(recVersPhoto), f=recs.filter(function(r){return r.kind==="fin";}).map(recVersPhoto);
      a.forEach(function(p){photosSauvees.current[p.id]=p.file;}); f.forEach(function(p){photosSauvees.current[p.id]=p.file;});
      if(a.length) setPhotosArrivee(a); if(f.length) setPhotos(f);
    });
    setStep(savedDraft.step);setArrivee(savedDraft.arrivee||INIT_ARRIVEE);setAttention(savedDraft.attention||INIT_ATTENTION);setEtatLieux(savedDraft.etatLieux||INIT_ETAT);setConsommables(savedDraft.consommables||INIT_CONSO);setShowResume(false);}
  function handleRestart(){localStorage.removeItem(STORAGE_KEY);idbPhotosVider();photosSauvees.current={};setShowResume(false);}
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
        fetch("/api/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({arrivee:arrivee,etatLieux:etatLieux,consommables:consommables,photosArrivee:vA,photos:vF,photosAttendues:(logement&&logement.photosReference?logement.photosReference.length:0),aApporter:(logement&&logement.consommablesARecuperer&&logement.aApporter)?{items:logement.aApporter.items,rapportIds:(logement.aApporter.rapports||[]).map(function(r){return r.id;})}:null})})
          .then(function(res){return res.json();})
          .then(function(data){setSending(false);if(data.success){localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(PHOTO_ANALYSES_KEY);idbPhotosVider();photosSauvees.current={};setDone(true);}else setSendError("Erreur lors de l'envoi. Réessayez.");})
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

  var pathParts=window.location.pathname.split("/").filter(Boolean);
  var pathSlug=pathParts[pathParts.length-1]||"";
  // agents.izinest.fr = espace prestataire (cartes des missions) ; les logements sont dans /admin
  if(!pathSlug||pathSlug==="prestataire") return <PagePrestataire/>;
  // l'ancienne liste publique des logements n'existe plus : elle est dans l'admin (onglet Logements)
  if(pathSlug==="logements") return <PageIntrouvable/>;
  if(pathSlug==="admin") return <PageAdmin/>;

  return (
    <div style={wrap}>
      {showResume?<ResumeModal saved={savedDraft} onResume={handleResume} onRestart={handleRestart}/>:null}
      <AppHeader nom={logement.nom} step={step} total={TOTAL}/>
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

/* GATE RUSH — runner 3D type "pub fake Last War" (Three.js).
   Le pont défile vers la caméra ; la squad reste à z≈0.
   Soldats humanoïdes instanciés (torse fusionné + jambes animées). */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ---------- Constantes monde ----------
const LANE_HALF = 8;
const SQUAD_Z = 0;
const SPAWN_Z = -240;
const KILL_Z = 14;

// ---------- Difficulté (le cœur du "ça monte vite") ----------
const scrollSpeed = t => 22 + t * 0.42;
const unitHp      = t => 2 + Math.pow(t, 1.6) / 8;
const enemyIv     = t => Math.max(0.4, 1.5 - t * 0.02);
const gateIv      = t => Math.max(2.2, 3.6 - t * 0.022);
const baseDPS     = c => 6 + c * 2.4;

// ---------- Armes ----------
const TIERS = [
  { name: "FUSIL",   dmgMul: 1,   rate: 8,  bullet: 0 },
  { name: "MINIGUN", dmgMul: 1.5, rate: 12, bullet: 1 },
  { name: "BLASTER", dmgMul: 2.4, rate: 14, bullet: 2 },
];

// ---------- Scène ----------
const cvs = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
const SKY = 0x9fd4f5;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 90, 230);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);
const CAM_Y = 9.4, CAM_Z = 16.5, LOOK_Y = 2.1, LOOK_Z = -30;
camera.position.set(0, CAM_Y, CAM_Z);
camera.lookAt(0, LOOK_Y, LOOK_Z);

function resize() {
  const r = cvs.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x8a958e, 1.05));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
sun.position.set(-30, 60, -20);
scene.add(sun);

// ---------- Textures procédurales (grandes dalles, faible contraste : défilement calme) ----------
function canvasTexture(draw, w = 512, h = 512) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const tx = new THREE.CanvasTexture(c);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 8;
  return tx;
}
const stoneTex = canvasTexture((g, w, h) => {
  g.fillStyle = "#85898d"; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const off = (y % 2) * 128;
    const v = 142 + Math.floor(Math.random() * 16);
    g.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    g.fillRect(x * 256 + off + 4, y * 256 + 4, 248, 248);
  }
  g.globalAlpha = 0.06;
  for (let i = 0; i < 80; i++) {
    g.fillStyle = Math.random() < 0.5 ? "#000" : "#fff";
    g.fillRect(Math.random() * w, Math.random() * h, 18, 18);
  }
});
stoneTex.repeat.set(1.2, 26); // une dalle ≈ 16 m : le sol reste lisible à pleine vitesse
const wallTex = canvasTexture((g, w, h) => {
  g.fillStyle = "#84888c"; g.fillRect(0, 0, w, h);
  for (let x = 0; x < 2; x++) {
    const v = 125 + Math.floor(Math.random() * 10);
    g.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    g.fillRect(x * 256 + 3, 4, 250, 504);
  }
});
wallTex.repeat.set(26, 1);

// Mer
const sea = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshLambertMaterial({ color: 0x2f6fae })
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -7;
scene.add(sea);

// Pont
const floor = new THREE.Mesh(
  new THREE.BoxGeometry(LANE_HALF * 2 + 4, 2, 420),
  new THREE.MeshLambertMaterial({ map: stoneTex }));
floor.position.set(0, -1, -170);
scene.add(floor);
const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
for (const side of [-1, 1]) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 420), wallMat);
  wall.position.set(side * (LANE_HALF + 1.4), 0.8, -170);
  scene.add(wall);
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 8, 2.4),
      new THREE.MeshLambertMaterial({ color: 0x6e7276 }));
    p.position.set(side * (LANE_HALF - 0.2), -4.5, -i * 48 - 10);
    scene.add(p);
  }
}

// ---------- Construction des personnages (géométries fusionnées, couleurs par sommet) ----------
const SKIN = 0xd9a584;
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function part(geo, hex, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const g = geo.clone();
  _e.set(r[0], r[1], r[2]);
  _m4.compose(new THREE.Vector3(...p), _q.setFromEuler(_e), new THREE.Vector3(...s));
  g.applyMatrix4(_m4);
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPH = new THREE.SphereGeometry(1, 10, 8);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const CAP = new THREE.CapsuleGeometry(1, 1, 3, 8);

function weaponParts(kind, cloth) {
  const metal = 0x2b2e33;
  const at = [0.17, 1.2, -0.45];
  if (kind === "none") return [];
  if (kind === "pistol") return [part(BOX, metal, at, [0, 0, 0], [0.07, 0.1, 0.3])];
  if (kind === "minigun") return [
    part(CYL, 0x3a3f45, [at[0], at[1], at[2] - 0.1], [Math.PI / 2, 0, 0], [0.11, 0.6, 0.11]),
    part(BOX, metal, [at[0], at[1] - 0.04, at[2] + 0.2], [0, 0, 0], [0.16, 0.18, 0.3]),
  ];
  if (kind === "blaster") return [
    part(BOX, 0x23303d, at, [0, 0, 0], [0.1, 0.13, 0.6]),
    part(BOX, 0x37e6ff, [at[0], at[1], at[2] - 0.36], [0, 0, 0], [0.06, 0.06, 0.14]),
  ];
  // fusil
  return [
    part(BOX, metal, at, [0, 0, 0], [0.08, 0.11, 0.62]),
    part(CYL, 0x404549, [at[0], at[1] + 0.01, at[2] - 0.38], [Math.PI / 2, 0, 0], [0.025, 0.2, 0.025]),
    part(BOX, cloth, [at[0], at[1] - 0.03, at[2] + 0.28], [0, 0, 0], [0.06, 0.13, 0.14]),
  ];
}

/* Humanoïde réaliste low-poly : hanches, torse, gilet tactique, bras tenant
   l'arme, tête + casque, sac à dos. Les jambes sont instanciées à part pour
   être animées (course). */
function soldierGeo({ cloth, vest, helmet, bulk = 1, weapon = "rifle", pack = true, plates = false }) {
  const parts = [
    part(BOX, cloth, [0, 0.74, 0], [0, 0, 0], [0.42 * bulk, 0.16, 0.28]),               // hanches
    part(BOX, cloth, [0, 1.06, 0], [0.06, 0, 0], [0.5 * bulk, 0.52, 0.3]),              // torse
    part(SPH, SKIN, [0, 1.52, 0], [0, 0, 0], [0.18, 0.18, 0.18]),                       // tête
    part(CAP, cloth, [0.3 * bulk, 1.18, -0.2], [-1.15, 0, -0.25], [0.08, 0.13, 0.08]),  // bras droit
    part(CAP, cloth, [-0.3 * bulk, 1.18, -0.2], [-1.15, 0, 0.25], [0.08, 0.13, 0.08]),  // bras gauche
    ...weaponParts(weapon, cloth),
  ];
  if (vest != null) parts.push(part(BOX, vest, [0, 1.08, 0], [0.06, 0, 0], [0.56 * bulk, 0.36, 0.38]));
  if (helmet != null) parts.push(part(SPH, helmet, [0, 1.57, 0], [0, 0, 0], [0.23, 0.18, 0.23]));
  if (pack) parts.push(part(BOX, vest ?? cloth, [0, 1.12, 0.24], [0, 0, 0], [0.3, 0.36, 0.14]));
  if (plates) parts.push(
    part(BOX, 0x55595e, [0.34 * bulk, 1.34, 0], [0, 0, 0.3], [0.2, 0.12, 0.3]),
    part(BOX, 0x55595e, [-0.34 * bulk, 1.34, 0], [0, 0, -0.3], [0.2, 0.12, 0.3]));
  return mergeGeometries(parts);
}

// Jambe : pivot au niveau de la hanche (géométrie décalée vers le bas)
const legGeo = (() => {
  const g = part(CAP, 0xffffff, [0, -0.27, 0], [0, 0, 0], [0.1, 0.17, 0.1]);
  return g;
})();

// ---------- Pools instanciés ----------
function makeInstanced(geo, mat, n) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.count = 0;
  m.frustumCulled = false;
  scene.add(m);
  return m;
}
const dummy = new THREE.Object3D();
const vcMat = () => new THREE.MeshLambertMaterial({ vertexColors: true });

// Squad bleue : un modèle par palier d'arme
const ALLY_STYLE = { cloth: 0x3b82f6, vest: 0x24467e, helmet: 0x5d8be0 };
const allyMeshes = TIERS.map((t, i) => makeInstanced(
  soldierGeo({ ...ALLY_STYLE, weapon: ["rifle", "minigun", "blaster"][i] }), vcMat(), 80));

// Ennemis : éclaireur (rapide, fragile), soldat, brute (lente, blindée)
const FOE_TYPES = {
  runner:  { hpMul: 0.45, spMul: 2.3, scale: 0.85, lossDiv: 5,
             geo: soldierGeo({ cloth: 0xe05548, vest: null, helmet: null, weapon: "pistol", pack: false }) },
  soldier: { hpMul: 1, spMul: 1, scale: 1, lossDiv: 4,
             geo: soldierGeo({ cloth: 0xd84a40, vest: 0x7e2a24, helmet: 0xa04438, weapon: "rifle" }) },
  brute:   { hpMul: 3.6, spMul: 0.5, scale: 1.45, lossDiv: 3.2,
             geo: soldierGeo({ cloth: 0x7e2620, vest: 0x4a4e54, helmet: 0x3a3d42, bulk: 1.5, weapon: "minigun", plates: true }) },
};
for (const k in FOE_TYPES) FOE_TYPES[k].mesh = makeInstanced(FOE_TYPES[k].geo, vcMat(), k === "soldier" ? 150 : 60);

// Jambes partagées (teintées par instance : bleu marine alliés, rouge sombre ennemis)
const legsMesh = makeInstanced(legGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), 800);
legsMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(800 * 3), 3);
const LEG_ALLY = new THREE.Color(0x1c3a6e), LEG_FOE = new THREE.Color(0x5e1d18);

// Balles : un style par palier
const bulletMeshes = [
  makeInstanced(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffd84d }), 400),
  makeInstanced(new THREE.CapsuleGeometry(0.1, 0.55, 2, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff9d2e }), 400),
  makeInstanced(new THREE.CapsuleGeometry(0.11, 0.95, 2, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x47e6ff }), 400),
];

const partMesh = makeInstanced(
  new THREE.BoxGeometry(0.22, 0.22, 0.22),
  new THREE.MeshBasicMaterial({ color: 0xffffff }), 300);
partMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(300 * 3), 3);

// ---------- Obstacles destructibles : caisse bonus, baril explosif, barricade ----------
const crateGeo = mergeGeometries([
  part(BOX, 0x9a6a33, [0, 0.55, 0], [0, 0, 0], [1.1, 1.1, 1.1]),
  part(BOX, 0x6e4a20, [0, 0.55, 0], [0, 0, 0], [1.16, 0.16, 1.16]),
  part(BOX, 0x6e4a20, [0, 0.55, 0], [0, 0, 0], [0.16, 1.16, 1.16]),
]);
const crateMat = vcMat();
const barrelGeo = mergeGeometries([
  part(CYL, 0xc8362c, [0, 0.55, 0], [0, 0, 0], [0.42, 1.1, 0.42]),
  part(CYL, 0xe8e2d2, [0, 0.55, 0], [0, 0, 0], [0.43, 0.3, 0.43]),
]);
const barrelMat = vcMat();
const wallGeo = mergeGeometries([
  part(BOX, 0x6f7479, [0, 1, 0], [0, 0, 0], [1, 2, 0.7]),
  part(BOX, 0x53585d, [0, 2.06, 0], [0, 0, 0], [1.04, 0.16, 0.78]),
  part(BOX, 0xc7b33a, [0, 1.4, 0], [0, 0, 0], [1.02, 0.18, 0.74]),
]);
const wallMatM = vcMat();

// Barres de vie (pool, partagé ennemis/obstacles)
const hpPool = [];
function getHpBar(w = 3) {
  let b = hpPool.find(b => !b.used);
  if (!b) {
    const grp = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.32),
      new THREE.MeshBasicMaterial({ color: 0x16331c, depthTest: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.32),
      new THREE.MeshBasicMaterial({ color: 0x39e75f, depthTest: false }));
    fg.position.z = 0.01;
    grp.add(bg, fg);
    grp.renderOrder = 5;
    scene.add(grp);
    b = { grp, fg, used: false };
    hpPool.push(b);
  }
  b.used = true;
  b.grp.visible = true;
  b.grp.scale.setScalar(w / 3);
  return b;
}
function freeHpBar(b) { if (b) { b.used = false; b.grp.visible = false; } }

// ---------- Sprites texte ----------
function textSprite(str, color, fontPx = 90, outline = true) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 220;
  const g = c.getContext("2d");
  let px = fontPx;
  g.font = `900 ${px}px system-ui, sans-serif`;
  while (g.measureText(str).width > 480 && px > 30) {
    px -= 8;
    g.font = `900 ${px}px system-ui, sans-serif`;
  }
  g.textAlign = "center"; g.textBaseline = "middle";
  if (outline) { g.lineWidth = 14; g.strokeStyle = "rgba(0,0,0,.55)"; g.strokeText(str, 256, 110); }
  g.fillStyle = color;
  g.fillText(str, 256, 110);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false }));
  sp.renderOrder = 10;
  return sp;
}
function disposeSprite(sp) {
  sp.material.map.dispose();
  sp.material.dispose();
  sp.parent && sp.parent.remove(sp);
}

let badge = null, badgeVal = -1;
function updateBadge(count, x) {
  if (badgeVal !== count) {
    if (badge) disposeSprite(badge);
    badge = textSprite(String(count), "#ffffff", 110);
    badge.scale.set(4.2, 1.8, 1);
    scene.add(badge);
    badgeVal = count;
  }
  badge.position.set(x, 3.1, SQUAD_Z + 1.2);
}

// ---------- Audio ----------
let AC = null, masterGain = null;
let muted = localStorage.getItem("gr_mute") === "1";
const muteBtn = document.getElementById("mute");
muteBtn.textContent = muted ? "🔇" : "🔊";
function audioInit() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain();
    masterGain.gain.value = muted ? 0 : 0.5;
    masterGain.connect(AC.destination);
  } catch (e) { /* pas d'audio */ }
}
muteBtn.addEventListener("click", () => {
  muted = !muted;
  localStorage.setItem("gr_mute", muted ? "1" : "0");
  muteBtn.textContent = muted ? "🔇" : "🔊";
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
});
function tone(freq, dur, type = "square", vol = 0.2, delay = 0, slide = 0) {
  if (!AC || muted) return;
  const t0 = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(masterGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function boom() {
  if (!AC || muted) return;
  const n = AC.sampleRate * 0.4;
  const buf = AC.createBuffer(1, n, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
  const src = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
  src.buffer = buf;
  f.type = "lowpass"; f.frequency.value = 420;
  g.gain.value = 0.55;
  src.connect(f); f.connect(g); g.connect(masterGain);
  src.start();
}
const sGateGood = () => { tone(520, 0.09, "square", 0.18); tone(780, 0.12, "square", 0.18, 0.07); };
const sGateBad  = () => tone(300, 0.25, "sawtooth", 0.2, 0, -180);
let lastPop = 0;
const sPop = () => { const n = performance.now(); if (n - lastPop > 70) { lastPop = n; tone(160, 0.07, "triangle", 0.12, 0, -60); } };
const sHit  = () => tone(90, 0.18, "sawtooth", 0.3, 0, -40);
const sCrate = () => { tone(620, 0.07, "triangle", 0.2); tone(930, 0.1, "triangle", 0.2, 0.06); };
const sWeapon = () => { tone(440, 0.1, "square", 0.2); tone(660, 0.1, "square", 0.2, 0.09); tone(880, 0.16, "square", 0.2, 0.18); };
const sOver = () => { tone(440, 0.18, "square", 0.2); tone(330, 0.18, "square", 0.2, 0.16); tone(220, 0.4, "square", 0.2, 0.32, -60); };

// ---------- État ----------
const G = {
  state: "menu", t: 0, meters: 0, count: 1, kills: 0, maxCount: 1,
  squadX: 0, targetX: 0,
  tier: 0, dmgMul: 1, rateMul: 1,
  gates: [], foes: [], bullets: [], parts: [], texts: [], crates: [], walls: [],
  gateTimer: 1.4, foeTimer: 2.2, hordeTimer: 9, bossTimer: 24, crateTimer: 5, wallTimer: 18, volleyTimer: 0,
  shake: 0, pairSeq: 0,
};
const dpsNow = () => baseDPS(G.count) * TIERS[G.tier].dmgMul * G.dmgMul;
const volleyRate = () => Math.min(18, TIERS[G.tier].rate * G.rateMul);

const weaponEl = document.getElementById("weapon");
function refreshWeaponHud() {
  weaponEl.textContent =
    `${TIERS[G.tier].name} · DÉG x${(TIERS[G.tier].dmgMul * G.dmgMul).toFixed(1)} · CAD x${G.rateMul.toFixed(1)}`;
}

// ---------- Entrées ----------
let dragging = false, lastPx = 0;
cvs.addEventListener("pointerdown", e => { dragging = true; lastPx = e.clientX; audioInit(); });
window.addEventListener("pointermove", e => {
  if (!dragging) return;
  const r = cvs.getBoundingClientRect();
  G.targetX += (e.clientX - lastPx) / r.width * LANE_HALF * 3.2;
  lastPx = e.clientX;
});
window.addEventListener("pointerup", () => dragging = false);
const keys = new Set();
window.addEventListener("keydown", e => { if (e.key.startsWith("Arrow")) keys.add(e.key); });
window.addEventListener("keyup", e => keys.delete(e.key));

// ---------- Formation triangle ----------
const SLOTS = [];
for (let r = 0; SLOTS.length < 80; r++)
  for (let i = 0; i <= r && SLOTS.length < 80; i++)
    SLOTS.push({ x: (i - r / 2) * 0.95, z: r * 0.85 });
const squadRadius = () => 0.8 + Math.sqrt(Math.min(G.count, 80)) * 0.34;

// ---------- Portes ----------
const gateMatGood = new THREE.MeshBasicMaterial({ color: 0x2f8bff, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
const gateMatBad  = new THREE.MeshBasicMaterial({ color: 0xff4656, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
const gateMatGold = new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
const gateGeo = new THREE.PlaneGeometry(LANE_HALF - 0.3, 4.6);

const isGood = g => g.op !== "-" && g.op !== "/";
function gateLabel(g) {
  if (g.op === "dmg") return `DÉGÂTS +${g.v}%`;
  if (g.op === "rate") return `CADENCE +${g.v}%`;
  if (g.op === "wpn") return "ARME ↑";
  return (g.op === "/" ? "÷" : g.op) + g.v;
}
function makeGateMesh(g) {
  const grp = new THREE.Group();
  const mat = g.op === "wpn" || g.op === "dmg" || g.op === "rate" ? gateMatGold : isGood(g) ? gateMatGood : gateMatBad;
  const panel = new THREE.Mesh(gateGeo, mat.clone());
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(gateGeo),
    new THREE.LineBasicMaterial({ color: isGood(g) ? 0x9fd0ff : 0xffaab2 }));
  grp.add(panel, frame);
  const label = textSprite(gateLabel(g), "#ffffff", 120);
  label.scale.set(6.5, 2.8, 1);
  label.position.y = 0.2;
  grp.add(label);
  grp.position.set(g.x, 2.3, g.z);
  scene.add(grp);
  g.mesh = grp; g.panel = panel; g.label = label;
}
function refreshGateLabel(g) {
  const old = g.label;
  g.label = textSprite(gateLabel(g), "#ffffff", 120);
  g.label.scale.set(6.5, 2.8, 1);
  g.label.position.y = 0.2;
  g.mesh.add(g.label);
  g.mesh.remove(old);
  disposeSprite(old);
}
function removeGate(g) {
  disposeSprite(g.label);
  g.panel.material.dispose();
  scene.remove(g.mesh);
}

/* Tirage des paires : nombres (+/x contre -/÷) la plupart du temps,
   mais aussi des portes d'amélioration d'arme (dorées) face à un malus :
   le choix devient "grossir l'armée ou améliorer l'arme". */
function spawnGatePair() {
  const t = G.t;
  const base = 3 + t * 0.45;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mkGood = big => {
    const r = Math.random();
    if (r < 0.1 && G.tier < 2 && t > 15) return { op: "wpn" };
    if (r < 0.24) return { op: "dmg", v: 10 + 5 * Math.floor(rnd(0, 4)) };
    if (r < 0.34) return { op: "rate", v: 10 + 5 * Math.floor(rnd(0, 3)) };
    if (r < 0.46) return { op: "x", v: 2 };
    return { op: "+", v: Math.max(1, Math.round(rnd(big ? 0.7 : 0.35, big ? 1.3 : 0.7) * base)) };
  };
  const mkBad = () => Math.random() < 0.25
    ? { op: "/", v: 2 }
    : { op: "-", v: Math.max(2, Math.round(rnd(1.2, 2.2) * base)) };
  let a = mkGood(true);
  let b = t < 12 ? mkGood(false) : (Math.random() < 0.8 ? mkBad() : mkGood(false));
  if (Math.random() < 0.5) [a, b] = [b, a];
  const id = ++G.pairSeq;
  const ga = { ...a, pair: id, x: -LANE_HALF / 2, z: SPAWN_Z, done: false };
  const gb = { ...b, pair: id, x: LANE_HALF / 2, z: SPAWN_Z, done: false };
  makeGateMesh(ga); makeGateMesh(gb);
  G.gates.push(ga, gb);
}

// ---------- Ennemis ----------
function spawnFoe(type, x, n, hpMul = 1, boss = false) {
  const T = FOE_TYPES[type];
  const hpu = unitHp(G.t) * T.hpMul * hpMul;
  const f = {
    type, x, z: SPAWN_Z + Math.random() * 14, n0: n, n,
    hpu, hp: hpu * n, maxHp: hpu * n,
    boss, scale: T.scale * (boss ? 2 : 1),
    sp: (2.5 + G.t * 0.04 + Math.random() * 1.4) * T.spMul * (boss ? 0.6 : 1),
    wob: Math.random() * 6.28,
    bar: getHpBar(boss ? 5 : 3),
  };
  f.radius = (0.9 + Math.sqrt(n) * 0.5) * f.scale;
  G.foes.push(f);
}
function pickFoeType(t) {
  const r = Math.random();
  if (t > 22 && r < 0.16 + t / 400) return "brute";
  if (t > 6 && r < 0.45) return "runner";
  return "soldier";
}
const randX = () => -LANE_HALF + 1.6 + Math.random() * (LANE_HALF * 2 - 3.2);

// ---------- Caisses bonus, barils, barricades ----------
function crateReward(t) {
  const r = Math.random();
  if (r < 0.12 && G.tier < 2) return { op: "wpn" };
  if (r < 0.4) return { op: "dmg", v: 15 + 5 * Math.floor(Math.random() * 4) };
  if (r < 0.6) return { op: "rate", v: 10 + 5 * Math.floor(Math.random() * 3) };
  return { op: "+", v: Math.max(2, Math.round((3 + t * 0.45) * (0.8 + Math.random() * 0.8))) };
}
function spawnCrate(x, kind = "crate") {
  const t = G.t;
  const c = {
    kind, x, z: SPAWN_Z + Math.random() * 10,
    hp: kind === "barrel" ? unitHp(t) * 1.5 : unitHp(t) * 3.5,
    reward: kind === "crate" ? crateReward(t) : null,
  };
  c.maxHp = c.hp;
  c.mesh = new THREE.Mesh(kind === "barrel" ? barrelGeo : crateGeo, kind === "barrel" ? barrelMat : crateMat);
  c.mesh.position.set(x, 0, c.z);
  c.mesh.rotation.y = Math.random() * 0.8;
  scene.add(c.mesh);
  if (kind === "crate") {
    c.label = textSprite("🎁", "#fff", 100);
    c.label.scale.set(2.2, 1, 1);
    c.label.position.set(x, 2.1, c.z);
    scene.add(c.label);
  }
  G.crates.push(c);
}
function spawnWall() {
  const side = Math.random() < 0.5 ? -1 : 1;
  const w = LANE_HALF - 0.4;
  const wl = {
    x: side * LANE_HALF / 2, z: SPAWN_Z, w,
    hp: unitHp(G.t) * 7, bar: getHpBar(5),
  };
  wl.maxHp = wl.hp;
  wl.mesh = new THREE.Mesh(wallGeo, wallMatM);
  wl.mesh.scale.set(w, 1, 1);
  wl.mesh.position.set(wl.x, 0, wl.z);
  scene.add(wl.mesh);
  G.walls.push(wl);
}
function removeCrate(c) {
  scene.remove(c.mesh);
  if (c.label) disposeSprite(c.label);
}
function explodeBarrel(c) {
  burst(c.x, 1, c.z, 0xff7a2e, 30, 18);
  burst(c.x, 1, c.z, 0xffd84d, 20, 12);
  boom();
  G.shake = Math.min(1.4, G.shake + 0.7);
  const dmg = unitHp(G.t) * 14;
  for (let j = G.foes.length - 1; j >= 0; j--) {
    const f = G.foes[j];
    if (Math.abs(f.x - c.x) < 6 && Math.abs(f.z - c.z) < 6) {
      f.hp -= dmg;
      if (f.hp <= 0) {
        G.kills += f.n0;
        burst(f.x, 1.5, f.z, 0xd83a3a, 10, 9);
        freeHpBar(f.bar);
        G.foes.splice(j, 1);
      } else f.n = Math.max(1, Math.ceil(f.hp / f.hpu));
    }
  }
}

// ---------- Particules / textes ----------
const PARTC = new THREE.Color();
function burst(x, y, z, color, n = 10, sp = 9) {
  for (let i = 0; i < n && G.parts.length < 300; i++) {
    const a = Math.random() * 6.28, b = Math.random() * 3.14;
    const v = sp * (0.4 + Math.random());
    G.parts.push({
      x, y, z,
      vx: Math.cos(a) * Math.sin(b) * v, vy: Math.cos(b) * v + 4, vz: Math.sin(a) * Math.sin(b) * v,
      life: 0.5, t: 0.5, color,
    });
  }
}
function ftext(str, color, big = false) {
  const sp = textSprite(str, color, big ? 130 : 100);
  sp.scale.set(big ? 9 : 7, big ? 3.9 : 3, 1);
  sp.position.set(G.squadX, 4.2, SQUAD_Z + 0.5);
  scene.add(sp);
  G.texts.push({ sp, life: 0.9 });
}

// ---------- Application des bonus (portes & caisses) ----------
const flashEl = document.getElementById("flash");
function applyBonus(g) {
  let str = "", good = isGood(g);
  if (g.op === "+") { G.count += g.v; str = "+" + g.v; }
  if (g.op === "x") { G.count *= g.v; str = "x" + g.v; }
  if (g.op === "-") { G.count -= g.v; str = "-" + g.v; }
  if (g.op === "/") { G.count = Math.floor(G.count / g.v); str = "÷" + g.v; }
  if (g.op === "dmg") { G.dmgMul *= 1 + g.v / 100; str = `DÉGÂTS +${g.v}%`; }
  if (g.op === "rate") { G.rateMul = Math.min(2.4, G.rateMul * (1 + g.v / 100)); str = `CADENCE +${g.v}%`; }
  if (g.op === "wpn") { G.tier = Math.min(2, G.tier + 1); str = TIERS[G.tier].name + " !"; sWeapon(); }
  if (G.count > 999) { G.count = 999; str = "MAX"; }
  G.maxCount = Math.max(G.maxCount, G.count);
  ftext(str, g.op === "wpn" ? "#ffd84d" : good ? "#5fb6ff" : "#ff5f6b", good);
  burst(G.squadX, 2, SQUAD_Z, good ? 0x5fb6ff : 0xff5f6b, 16, 11);
  if (g.op !== "wpn") (good ? sGateGood : sGateBad)();
  refreshWeaponHud();
  if (G.count <= 0) gameOver();
}

// ---------- Update ----------
function update(dt) {
  const t = (G.t += dt);
  const scroll = scrollSpeed(t);
  G.meters += scroll * dt * 0.5;
  stoneTex.offset.y -= scroll * dt / 16.15; // synchro : 420 unités / 26 répétitions
  wallTex.offset.x -= scroll * dt / 16.15;

  if (keys.has("ArrowLeft")) G.targetX -= 22 * dt;
  if (keys.has("ArrowRight")) G.targetX += 22 * dt;
  G.targetX = Math.max(-LANE_HALF + 1.2, Math.min(LANE_HALF - 1.2, G.targetX));
  G.squadX += (G.targetX - G.squadX) * Math.min(1, dt * 12);

  // Spawns
  if ((G.gateTimer -= dt) <= 0) { G.gateTimer = gateIv(t); spawnGatePair(); }
  if ((G.foeTimer -= dt) <= 0) {
    G.foeTimer = enemyIv(t);
    const type = pickFoeType(t);
    const n = type === "soldier" ? 1 + Math.floor(Math.random() * (1 + t / 12))
      : type === "runner" ? 1 + Math.floor(Math.random() * 2) : 1;
    spawnFoe(type, randX(), n);
    if (t > 8 && Math.random() < 0.18) spawnCrate(randX(), "barrel");
  }
  if (t > 10 && (G.hordeTimer -= dt) <= 0) {
    G.hordeTimer = Math.max(4.5, 8 - t * 0.04);
    const k = 4 + Math.floor(t / 15);
    for (let i = 0; i < k; i++)
      spawnFoe(Math.random() < 0.3 ? "runner" : "soldier",
        -LANE_HALF + 1.8 + (i + 0.5) * (LANE_HALF * 2 - 3.6) / k, 1 + Math.floor(t / 12), 0.9);
  }
  if (t > 18 && (G.bossTimer -= dt) <= 0) { G.bossTimer = 20; spawnFoe("brute", randX(), 1, 6, true); }
  if ((G.crateTimer -= dt) <= 0) {
    G.crateTimer = 5 + Math.random() * 4;
    spawnCrate(randX(), "crate");
    if (Math.random() < 0.3) spawnCrate(randX(), "crate");
  }
  if (t > 20 && (G.wallTimer -= dt) <= 0) { G.wallTimer = 13 + Math.random() * 5; spawnWall(); }

  // Tir automatique
  if ((G.volleyTimer -= dt) <= 0) {
    G.volleyTimer = 1 / volleyRate();
    const streams = Math.max(1, Math.min(8, Math.ceil(G.count / 4)));
    const dmg = dpsNow() / volleyRate() / streams;
    const spread = Math.min(squadRadius(), 2.6);
    for (let i = 0; i < streams && G.bullets.length < 380; i++) {
      const fx = G.squadX + (streams === 1 ? 0 : (i / (streams - 1) - 0.5) * 2 * spread);
      G.bullets.push({ x: fx, y: 1.4, z: SQUAD_Z - 1.5, dmg, tier: G.tier });
    }
  }

  // Balles
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.z -= (90 + scroll) * dt;
    let dead = b.z < SPAWN_Z;

    // Une balle qui touche une porte la modifie (+1 / -1 vers 0, max 10 fois)
    if (!dead) for (const g of G.gates) {
      if (g.done || Math.abs(b.z - g.z) > 1.4) continue;
      if (Math.abs(b.x - g.x) > (LANE_HALF - 0.3) / 2) continue;
      if ((g.bumps || 0) < 10) {
        if (g.op === "+") { g.bumps = (g.bumps || 0) + 1; g.v++; refreshGateLabel(g); }
        else if (g.op === "-" && g.v > 0) { g.bumps = (g.bumps || 0) + 1; g.v--; refreshGateLabel(g); }
      }
      burst(b.x, 2.3, g.z, 0xffd84d, 2, 5);
      dead = true;
      break;
    }
    // Barricades
    if (!dead) for (let j = G.walls.length - 1; j >= 0; j--) {
      const wl = G.walls[j];
      if (Math.abs(b.z - wl.z) > 1.2 || Math.abs(b.x - wl.x) > wl.w / 2) continue;
      wl.hp -= b.dmg;
      dead = true;
      if (wl.hp <= 0) {
        burst(wl.x, 1.2, wl.z, 0x9aa0a6, 24, 12);
        sPop();
        freeHpBar(wl.bar);
        scene.remove(wl.mesh);
        G.walls.splice(j, 1);
      }
      break;
    }
    // Caisses & barils
    if (!dead) for (let j = G.crates.length - 1; j >= 0; j--) {
      const c = G.crates[j];
      if (Math.abs(b.z - c.z) > 1.1 || Math.abs(b.x - c.x) > 0.9) continue;
      c.hp -= b.dmg;
      dead = true;
      if (c.hp <= 0) {
        removeCrate(c);
        G.crates.splice(j, 1);
        if (c.kind === "barrel") explodeBarrel(c);
        else {
          burst(c.x, 1, c.z, 0xc89a55, 18, 10);
          sCrate();
          applyBonus(c.reward);
          if (G.state !== "playing") return;
        }
      }
      break;
    }
    if (!dead) for (let j = G.foes.length - 1; j >= 0; j--) {
      const f = G.foes[j];
      if (Math.abs(b.x - f.x) < f.radius + 0.4 && Math.abs(b.z - f.z) < f.radius + 0.8) {
        f.hp -= b.dmg;
        dead = true;
        if (f.hp <= 0) {
          G.kills += f.n0;
          burst(f.x, 1.5, f.z, 0xd83a3a, f.boss ? 30 : 12, f.boss ? 16 : 9);
          sPop();
          freeHpBar(f.bar);
          G.foes.splice(j, 1);
        } else {
          f.n = Math.max(1, Math.ceil(f.hp / f.hpu));
        }
        break;
      }
    }
    if (dead) { G.bullets[i] = G.bullets[G.bullets.length - 1]; G.bullets.pop(); }
  }

  // Portes
  for (let i = G.gates.length - 1; i >= 0; i--) {
    const g = G.gates[i];
    g.z += scroll * dt;
    g.mesh.position.z = g.z;
    if (!g.done && g.z >= SQUAD_Z - 1) {
      const mine = G.squadX < 0 === g.x < 0;
      for (const o of G.gates) if (o.pair === g.pair) {
        o.done = true;
        o.panel.material.opacity = 0.12;
      }
      const chosen = mine ? g : G.gates.find(o => o.pair === g.pair && o !== g);
      if (chosen) applyBonus(chosen);
      if (G.state !== "playing") return;
    }
    if (g.z > KILL_Z) { removeGate(g); G.gates.splice(i, 1); }
  }

  // Caisses / barils (fixés au sol)
  for (let i = G.crates.length - 1; i >= 0; i--) {
    const c = G.crates[i];
    c.z += scroll * dt;
    c.mesh.position.z = c.z;
    if (c.label) c.label.position.z = c.z;
    if (c.z > KILL_Z) { removeCrate(c); G.crates.splice(i, 1); }
  }

  // Barricades
  for (let i = G.walls.length - 1; i >= 0; i--) {
    const wl = G.walls[i];
    wl.z += scroll * dt;
    wl.mesh.position.z = wl.z;
    wl.bar.grp.position.set(wl.x, 2.9, wl.z);
    wl.bar.fg.scale.x = Math.max(0.02, wl.hp / wl.maxHp);
    wl.bar.fg.position.x = -(1 - wl.bar.fg.scale.x) * 1.5;
    wl.bar.grp.quaternion.copy(camera.quaternion);
    if (wl.z > SQUAD_Z - 1.2 && Math.abs(wl.x - G.squadX) < wl.w / 2 + squadRadius() * 0.7) {
      const loss = Math.max(1, Math.min(60, Math.round(wl.hp / 4)));
      G.count -= loss;
      G.shake = Math.min(1.4, 0.5 + loss * 0.05);
      flashEl.style.opacity = "1";
      setTimeout(() => flashEl.style.opacity = "0", 130);
      ftext("-" + loss, "#ff5f6b");
      sHit();
      freeHpBar(wl.bar);
      scene.remove(wl.mesh);
      G.walls.splice(i, 1);
      if (G.count <= 0) { gameOver(); return; }
    } else if (wl.z > KILL_Z) {
      freeHpBar(wl.bar);
      scene.remove(wl.mesh);
      G.walls.splice(i, 1);
    }
  }

  // Ennemis
  const sr = squadRadius();
  for (let i = G.foes.length - 1; i >= 0; i--) {
    const f = G.foes[i];
    f.z += (scroll * 0.45 + f.sp) * dt;
    f.x += Math.sin(t * 2.4 + f.wob) * 0.5 * dt;
    f.x = Math.max(-LANE_HALF + 1, Math.min(LANE_HALF - 1, f.x));
    if (f.z > SQUAD_Z - 1.2 && Math.abs(f.x - G.squadX) < f.radius + sr) {
      const loss = Math.max(1, Math.min(60, Math.round(f.hp / FOE_TYPES[f.type].lossDiv)));
      G.count -= loss;
      G.shake = Math.min(1.4, 0.5 + loss * 0.05);
      flashEl.style.opacity = "1";
      setTimeout(() => flashEl.style.opacity = "0", 130);
      ftext("-" + loss, "#ff5f6b");
      burst(G.squadX, 1.5, SQUAD_Z, 0xff5f6b, 14, 10);
      sHit();
      freeHpBar(f.bar);
      G.foes.splice(i, 1);
      if (G.count <= 0) { gameOver(); return; }
    } else if (f.z > KILL_Z) {
      freeHpBar(f.bar);
      G.foes.splice(i, 1);
    }
  }

  // Particules / textes
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vy -= 22 * dt;
    if ((p.life -= dt) <= 0) { G.parts[i] = G.parts[G.parts.length - 1]; G.parts.pop(); }
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const x = G.texts[i];
    x.sp.position.y += 2.6 * dt;
    x.sp.material.opacity = Math.min(1, x.life * 2.2);
    if ((x.life -= dt) <= 0) { disposeSprite(x.sp); G.texts.splice(i, 1); }
  }
  G.shake = Math.max(0, G.shake - dt * 4);

  document.getElementById("meters").textContent = Math.floor(G.meters) + " m";
}

// ---------- Rendu ----------
let legCursor = 0;
function placeHumanoid(mesh, idx, x, z, scale, phase, lean, legColor) {
  const swing = Math.sin(phase);
  const bob = Math.abs(Math.cos(phase)) * 0.07 * scale;
  dummy.position.set(x, bob, z);
  dummy.rotation.set(lean, 0, 0);
  dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  mesh.setMatrixAt(idx, dummy.matrix);
  // Jambes (pivot hanche)
  for (const s of [-1, 1]) {
    if (legCursor >= 800) return;
    dummy.position.set(x + s * 0.13 * scale, 0.72 * scale + bob, z);
    dummy.rotation.set(swing * 0.75 * s, 0, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    legsMesh.setMatrixAt(legCursor, dummy.matrix);
    legsMesh.setColorAt(legCursor, legColor);
    legCursor++;
  }
}

function render(now) {
  legCursor = 0;

  // Squad (seul le mesh du palier d'arme courant est utilisé)
  const visible = Math.min(G.count, 80);
  for (let ti = 0; ti < allyMeshes.length; ti++) allyMeshes[ti].count = ti === G.tier ? visible : 0;
  const am = allyMeshes[G.tier];
  const running = G.state === "playing";
  for (let i = 0; i < visible; i++) {
    const o = SLOTS[i];
    placeHumanoid(am, i, G.squadX + o.x, SQUAD_Z + o.z, 1,
      running ? now * 0.014 + i * 1.3 : 0, 0.08, LEG_ALLY);
  }
  am.instanceMatrix.needsUpdate = true;
  if (G.state === "playing") updateBadge(G.count, G.squadX);

  // Ennemis par type
  const cursors = {};
  for (const k in FOE_TYPES) { FOE_TYPES[k].mesh.count = 0; cursors[k] = 0; }
  for (const f of G.foes) {
    const T = FOE_TYPES[f.type];
    const k = Math.min(f.n, f.boss ? 1 : 12);
    for (let u = 0; u < k && cursors[f.type] < T.mesh.instanceMatrix.count; u++) {
      const a = (u / k) * 6.28 + f.wob;
      const rr = u === 0 ? 0 : 0.55 + (u % 3) * 0.4;
      placeHumanoid(T.mesh, cursors[f.type]++,
        f.x + Math.cos(a) * rr, f.z + Math.sin(a) * rr * 0.7,
        f.scale, now * 0.011 * T.spMul + u * 2.1 + f.wob, -0.06, LEG_FOE);
    }
    f.bar.grp.visible = f.hp < f.maxHp || f.boss;
    f.bar.grp.position.set(f.x, f.boss ? 6.2 : 1.9 + f.radius * 0.4, f.z);
    f.bar.fg.scale.x = Math.max(0.02, f.hp / f.maxHp);
    f.bar.fg.position.x = -(1 - f.bar.fg.scale.x) * 1.5;
    f.bar.grp.quaternion.copy(camera.quaternion);
  }
  for (const k in FOE_TYPES) {
    FOE_TYPES[k].mesh.count = cursors[k];
    FOE_TYPES[k].mesh.instanceMatrix.needsUpdate = true;
  }
  legsMesh.count = legCursor;
  legsMesh.instanceMatrix.needsUpdate = true;
  if (legsMesh.instanceColor) legsMesh.instanceColor.needsUpdate = true;

  // Balles par style
  const bCur = [0, 0, 0];
  for (const b of G.bullets) {
    const m = bulletMeshes[b.tier];
    dummy.position.set(b.x, b.y, b.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    m.setMatrixAt(bCur[b.tier]++, dummy.matrix);
  }
  for (let i = 0; i < 3; i++) {
    bulletMeshes[i].count = bCur[i];
    bulletMeshes[i].instanceMatrix.needsUpdate = true;
  }

  // Particules
  partMesh.count = G.parts.length;
  for (let i = 0; i < G.parts.length; i++) {
    const p = G.parts[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.life * 7, p.life * 9, 0);
    dummy.scale.setScalar(Math.max(0.1, p.life / p.t));
    dummy.updateMatrix();
    partMesh.setMatrixAt(i, dummy.matrix);
    partMesh.setColorAt(i, PARTC.setHex(p.color));
  }
  partMesh.instanceMatrix.needsUpdate = true;
  if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;

  // Caméra
  const shx = (Math.random() - 0.5) * G.shake, shy = (Math.random() - 0.5) * G.shake;
  camera.position.x = G.squadX * 0.55 + shx;
  camera.position.y = CAM_Y + shy;
  camera.lookAt(G.squadX * 0.7, LOOK_Y, LOOK_Z);

  renderer.render(scene, camera);
}

// ---------- Cycle de vie ----------
const el = id => document.getElementById(id);

function clearWorld() {
  for (const g of G.gates) removeGate(g);
  for (const f of G.foes) freeHpBar(f.bar);
  for (const c of G.crates) removeCrate(c);
  for (const w of G.walls) { freeHpBar(w.bar); scene.remove(w.mesh); }
  for (const x of G.texts) disposeSprite(x.sp);
  G.gates = []; G.foes = []; G.bullets = []; G.parts = []; G.texts = []; G.crates = []; G.walls = [];
}

function reset() {
  clearWorld();
  Object.assign(G, {
    t: 0, meters: 0, count: 1, kills: 0, maxCount: 1,
    squadX: 0, targetX: 0,
    tier: 0, dmgMul: 1, rateMul: 1,
    gateTimer: 1.4, foeTimer: 2.2, hordeTimer: 9, bossTimer: 24, crateTimer: 5, wallTimer: 18, volleyTimer: 0,
    shake: 0, pairSeq: 0,
  });
  refreshWeaponHud();
}

function startGame() {
  audioInit();
  reset();
  G.state = "playing";
  el("menu").classList.add("hidden");
  el("over").classList.add("hidden");
  el("hud").classList.remove("hidden");
}

let submitted = false;
function gameOver() {
  G.state = "over";
  sOver();
  submitted = false;
  el("hud").classList.add("hidden");
  el("over").classList.remove("hidden");
  el("final-score").textContent = Math.floor(G.meters) + " m";
  el("final-stats").textContent =
    `☠️ ${G.kills} ennemis · 🪖 armée max : ${G.maxCount} · 🔫 ${TIERS[G.tier].name} · ⏱ ${Math.floor(G.t)} s`;
  el("rank-result").classList.add("hidden");
  el("over-board").classList.add("hidden");
  el("submit-form").classList.remove("hidden");
  el("submit-btn").disabled = false;
  el("submit-btn").textContent = "ENVOYER MON SCORE";
  el("pseudo").value = localStorage.getItem("gr_pseudo") || "";
  const best = +(localStorage.getItem("gr_best") || 0);
  if (G.meters > best) localStorage.setItem("gr_best", String(Math.floor(G.meters)));
}

el("play").addEventListener("click", startGame);
el("replay").addEventListener("click", startGame);

el("submit-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (submitted) return;
  const name = LB.sanitize(el("pseudo").value);
  localStorage.setItem("gr_pseudo", name);
  submitted = true;
  el("submit-btn").disabled = true;
  el("submit-btn").textContent = "ENVOI…";
  try {
    const res = await LB.submit(name, G.meters);
    el("submit-form").classList.add("hidden");
    const rk = el("rank-result");
    rk.classList.remove("hidden");
    const parties = `${res.total} partie${res.total > 1 ? "s" : ""}`;
    rk.innerHTML = res.rank
      ? `<span class="big">#${res.rank}</span> sur ${parties}`
      : `Hors du top 100… sur ${parties}`;
    LB.renderTop(el("over-scores"), res.top, res.entry);
    el("over-board").classList.remove("hidden");
  } catch (err) {
    submitted = false;
    el("submit-btn").disabled = false;
    el("submit-btn").textContent = "RÉESSAYER (réseau ?)";
  }
});

LB.fetchBoard()
  .then(b => LB.renderTop(el("menu-scores"), b.scores.slice(0, 10)))
  .catch(() => { el("menu-scores").innerHTML = '<li class="dim">classement indisponible</li>'; });

// ---------- Boucle principale ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.state === "playing") update(dt);
  render(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Hooks de debug/tuning (utilisés par l'autopilote de test)
window.__G = G;
window.__start = startGame;
window.__step = dt => { if (G.state === "playing") update(dt); };

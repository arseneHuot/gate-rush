/* GATE RUSH — runner 3D type "pub fake Last War" (Three.js).
   Sol fixe en béton uni (comme la vidéo) : la squad marche sur place,
   ennemis / bannières / lampadaires viennent vers elle.
   Ennemis individuels avec barre de vie chacun, armes à ramasser au sol. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ---------- Constantes monde ----------
const LANE_HALF = 8;
const SQUAD_Z = 0;
const SPAWN_Z = -240;
const KILL_Z = 14;

// ---------- Difficulté (relevée : le mur arrive vite) ----------
const scrollSpeed = t => 24 + t * 0.45;                 // vitesse d'approche du décor
const unitHp      = t => 2 + Math.pow(t, 1.6) / 5.5;
const enemyIv     = t => Math.max(0.5, 1.6 - t * 0.025);
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
const SKY = 0xaedcf2;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 100, 235);

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

scene.add(new THREE.HemisphereLight(0xf2f8ff, 0x9a948a, 1.1));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.5);
sun.position.set(-30, 60, -20);
scene.add(sun);

// ---------- Sol : béton uni FIXE (aucun motif qui défile) ----------
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
const concreteTex = canvasTexture((g, w, h) => {
  g.fillStyle = "#cdc6b8"; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.04;
  for (let i = 0; i < 600; i++) {
    g.fillStyle = Math.random() < 0.5 ? "#5a544a" : "#fff";
    const s = 2 + Math.random() * 5;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
});
concreteTex.repeat.set(2, 18);

const sea = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshLambertMaterial({ color: 0x2e7fc4 })
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -7;
scene.add(sea);

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(LANE_HALF * 2 + 4, 2, 420),
  new THREE.MeshLambertMaterial({ map: concreteTex }));
floor.position.set(0, -1, -170);
scene.add(floor);

// Balustrades en pierre claire
const balMat = new THREE.MeshLambertMaterial({ color: 0xb6b9bd });
const balTopMat = new THREE.MeshLambertMaterial({ color: 0xa7abb0 });
for (const side of [-1, 1]) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 420), balMat);
  wall.position.set(side * (LANE_HALF + 1.2), 0.65, -170);
  scene.add(wall);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 420), balTopMat);
  cap.position.set(side * (LANE_HALF + 1.2), 1.4, -170);
  scene.add(cap);
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 8, 2.4),
      new THREE.MeshLambertMaterial({ color: 0x8e9296 }));
    p.position.set(side * (LANE_HALF - 0.2), -4.8, -i * 48 - 10);
    scene.add(p);
  }
}

// Lampadaires : décor qui passe (donne la sensation d'avancer, le sol reste fixe)
const lamps = [];
{
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3c4046 });
  const headMat = new THREE.MeshLambertMaterial({ color: 0xf3eede });
  for (let i = 0; i < 12; i++) {
    const grp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 4.6, 8), poleMat);
    pole.position.y = 2.3;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), headMat);
    head.position.y = 4.7;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), poleMat);
    base.position.y = 0.25;
    grp.add(pole, head, base);
    const side = i % 2 === 0 ? -1 : 1;
    grp.position.set(side * (LANE_HALF - 0.7), 0, -i * 42 - 8);
    scene.add(grp);
    lamps.push(grp);
  }
}

// ---------- Construction des personnages ----------
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
const CONE = new THREE.ConeGeometry(1, 1, 8);

/* Armes bien visibles, tenues à deux mains devant la poitrine. */
function weaponParts(kind, cloth) {
  const metal = 0x2b2e33;
  const at = [0.14, 1.18, -0.5];
  if (kind === "none") return [];
  if (kind === "pistol") return [part(BOX, metal, at, [0, 0, 0], [0.09, 0.13, 0.38])];
  if (kind === "minigun") return [
    part(CYL, 0x44494f, [at[0], at[1], at[2] - 0.15], [Math.PI / 2, 0, 0], [0.15, 0.7, 0.15]),
    part(CYL, 0x2b2e33, [at[0], at[1], at[2] - 0.52], [Math.PI / 2, 0, 0], [0.16, 0.1, 0.16]),
    part(BOX, metal, [at[0], at[1] - 0.05, at[2] + 0.26], [0, 0, 0], [0.2, 0.24, 0.34]),
  ];
  if (kind === "blaster") return [
    part(BOX, 0x23303d, at, [0, 0, 0], [0.13, 0.17, 0.72]),
    part(BOX, 0x37e6ff, [at[0], at[1] + 0.02, at[2] - 0.42], [0, 0, 0], [0.08, 0.08, 0.2]),
    part(BOX, 0x37e6ff, [at[0], at[1] + 0.1, at[2] + 0.1], [0, 0, 0], [0.05, 0.05, 0.3]),
  ];
  // fusil d'assaut : corps, canon, crosse, chargeur, viseur
  return [
    part(BOX, metal, at, [0, 0, 0], [0.1, 0.14, 0.74]),
    part(CYL, 0x484d52, [at[0], at[1] + 0.02, at[2] - 0.46], [Math.PI / 2, 0, 0], [0.035, 0.26, 0.035]),
    part(BOX, cloth, [at[0], at[1] - 0.04, at[2] + 0.34], [0, 0, 0], [0.08, 0.16, 0.18]),
    part(BOX, metal, [at[0], at[1] - 0.14, at[2] - 0.06], [0.25, 0, 0], [0.07, 0.18, 0.1]),
    part(BOX, metal, [at[0], at[1] + 0.1, at[2] + 0.02], [0, 0, 0], [0.05, 0.06, 0.16]),
  ];
}

/* Humanoïde façon vidéo : veste colorée, gilet tactique kaki, casquette/casque,
   pantalon kaki (jambes instanciées), arme à deux mains. */
function soldierGeo({ cloth, vest, cap, bulk = 1, weapon = "rifle", pack = true, plates = false }) {
  const parts = [
    part(BOX, 0x8f8060, [0, 0.74, 0], [0, 0, 0], [0.42 * bulk, 0.16, 0.28]),              // ceinture
    part(BOX, cloth, [0, 1.07, 0], [0.06, 0, 0], [0.52 * bulk, 0.54, 0.32]),              // veste
    part(BOX, cloth, [0.3 * bulk, 1.26, -0.13], [-0.9, 0, -0.2], [0.15, 0.34, 0.15]),     // bras D haut
    part(BOX, cloth, [-0.3 * bulk, 1.26, -0.13], [-0.9, 0, 0.2], [0.15, 0.34, 0.15]),     // bras G haut
    part(BOX, SKIN, [0.22 * bulk, 1.16, -0.38], [-1.2, 0, 0], [0.11, 0.2, 0.11]),         // avant-bras D
    part(BOX, SKIN, [-0.22 * bulk, 1.16, -0.38], [-1.2, 0, 0], [0.11, 0.2, 0.11]),        // avant-bras G
    part(SPH, SKIN, [0, 1.54, 0], [0, 0, 0], [0.18, 0.19, 0.18]),                         // tête
    ...weaponParts(weapon, cloth),
  ];
  if (vest != null) parts.push(
    part(BOX, vest, [0, 1.06, -0.05], [0.06, 0, 0], [0.56 * bulk, 0.4, 0.3]),             // gilet avant
    part(BOX, vest, [0, 1.18, 0.2], [0, 0, 0], [0.5 * bulk, 0.3, 0.14]));                 // dosseret
  if (cap != null) parts.push(
    part(SPH, cap, [0, 1.62, 0], [0, 0, 0], [0.2, 0.13, 0.2]),                            // béret/casque
    part(BOX, cap, [0, 1.56, -0.16], [0.2, 0, 0], [0.3, 0.05, 0.14]));                    // visière
  if (pack) parts.push(part(BOX, vest ?? 0x6e6248, [0, 1.1, 0.3], [0, 0, 0], [0.34, 0.42, 0.18]));
  if (plates) parts.push(
    part(BOX, 0x55595e, [0.36 * bulk, 1.36, 0], [0, 0, 0.3], [0.22, 0.13, 0.32]),
    part(BOX, 0x55595e, [-0.36 * bulk, 1.36, 0], [0, 0, -0.3], [0.22, 0.13, 0.32]));
  return mergeGeometries(parts);
}

// Dinosaure type T-Rex (comme dans la vidéo)
function dinoGeo() {
  const body = 0x9aa05e, belly = 0xb5b878, dark = 0x6f7440;
  return mergeGeometries([
    part(CAP, body, [0, 2.2, 0.2], [Math.PI / 2.6, 0, 0], [1.1, 1.3, 1.1]),    // corps
    part(CAP, body, [0, 3.4, -1.4], [0.9, 0, 0], [0.55, 0.7, 0.55]),           // cou
    part(BOX, body, [0, 3.9, -2.4], [0.15, 0, 0], [0.85, 0.7, 1.5]),           // crâne
    part(BOX, belly, [0, 3.62, -2.7], [0.3, 0, 0], [0.7, 0.3, 1.3]),           // mâchoire
    part(CONE, 0xe8e4d0, [0.2, 3.66, -3.2], [Math.PI, 0, 0], [0.07, 0.18, 0.07]),
    part(CONE, 0xe8e4d0, [-0.2, 3.66, -3.2], [Math.PI, 0, 0], [0.07, 0.18, 0.07]),
    part(SPH, 0x222222, [0.3, 4.05, -2.7], [0, 0, 0], [0.09, 0.09, 0.09]),     // œil
    part(SPH, 0x222222, [-0.3, 4.05, -2.7], [0, 0, 0], [0.09, 0.09, 0.09]),
    part(CONE, body, [0, 2.6, 2.2], [-1.35, 0, 0], [0.5, 2.6, 0.5]),           // queue
    part(BOX, dark, [0.55, 1, 0.3], [0, 0, 0], [0.45, 2, 0.7]),                // jambe D
    part(BOX, dark, [-0.55, 1, 0.3], [0, 0, 0], [0.45, 2, 0.7]),               // jambe G
    part(BOX, dark, [0.5, 2.6, -0.7], [-0.5, 0, 0], [0.2, 0.6, 0.2]),          // petit bras D
    part(BOX, dark, [-0.5, 2.6, -0.7], [-0.5, 0, 0], [0.2, 0.6, 0.2]),         // petit bras G
  ]);
}

const legGeo = part(CAP, 0xffffff, [0, -0.27, 0], [0, 0, 0], [0.1, 0.17, 0.1]);

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

// Squad bleue (veste bleu vif, gilet kaki, casquette bleue — comme la vidéo)
const ALLY_STYLE = { cloth: 0x2e8de0, vest: 0x8a7a55, cap: 0x1f6fd0 };
const allyMeshes = TIERS.map((t, i) => makeInstanced(
  soldierGeo({ ...ALLY_STYLE, weapon: ["rifle", "minigun", "blaster"][i] }), vcMat(), 80));
// Plastron d'armure (upgrade personnage, visible sur chaque soldat)
const plateMesh = makeInstanced(
  part(BOX, 0xffffff, [0, 1.1, -0.26], [0.06, 0, 0], [0.5, 0.44, 0.08]), vcMat(), 80);
plateMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(80 * 3), 3);
const PLATE_COLORS = [null, new THREE.Color(0x9aa2ab), new THREE.Color(0xd5dbe2), new THREE.Color(0xffd34a)];

// Ennemis individuels : éclaireur, soldat, brute, dino
const FOE_TYPES = {
  runner:  { hpMul: 0.5, sp: 2.2, scale: 0.9, loss: h => 2, cap: 50,
             geo: soldierGeo({ cloth: 0xe8554a, vest: null, cap: null, weapon: "pistol", pack: false }) },
  soldier: { hpMul: 1, sp: 1, scale: 1, loss: h => Math.round(h / 4), cap: 80,
             geo: soldierGeo({ cloth: 0xd23b2f, vest: 0x5e3a32, cap: 0x7e2a24, weapon: "rifle" }) },
  brute:   { hpMul: 3.4, sp: 0.55, scale: 1.45, loss: h => Math.round(h / 3), cap: 30,
             geo: soldierGeo({ cloth: 0x8c2b24, vest: 0x4a4e54, cap: 0x3a3d42, bulk: 1.5, weapon: "minigun", plates: true }) },
  dino:    { hpMul: 26, sp: 1.15, scale: 1.2, loss: h => 35, cap: 6, geo: dinoGeo() },
};
for (const k in FOE_TYPES) FOE_TYPES[k].mesh = makeInstanced(FOE_TYPES[k].geo, vcMat(), FOE_TYPES[k].cap);

const legsMesh = makeInstanced(legGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), 800);
legsMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(800 * 3), 3);
const LEG_ALLY = new THREE.Color(0x8f8060), LEG_FOE = new THREE.Color(0x4a4038);

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

// Barres de vie instanciées (mode immédiat : reconstruites chaque frame)
const BAR_CAP = 140;
const barBG = makeInstanced(new THREE.PlaneGeometry(1, 0.2),
  new THREE.MeshBasicMaterial({ color: 0x57606a, depthTest: false, transparent: true }), BAR_CAP);
const barFG = makeInstanced(new THREE.PlaneGeometry(1, 0.2),
  new THREE.MeshBasicMaterial({ color: 0x39e75f, depthTest: false, transparent: true }), BAR_CAP);
barBG.renderOrder = 6; barFG.renderOrder = 7;
let barCursor = 0;
const _right = new THREE.Vector3();
function pushBar(x, y, z, w, ratio) {
  if (barCursor >= BAR_CAP) return;
  dummy.position.set(x, y, z);
  dummy.quaternion.copy(camera.quaternion);
  dummy.scale.set(w, 1, 1);
  dummy.updateMatrix();
  barBG.setMatrixAt(barCursor, dummy.matrix);
  const fw = Math.max(0.02, w * ratio);
  dummy.position.set(x - _right.x * (w - fw) / 2, y - _right.y * (w - fw) / 2, z);
  dummy.scale.set(fw, 1, 1);
  dummy.updateMatrix();
  barFG.setMatrixAt(barCursor, dummy.matrix);
  barCursor++;
}

// ---------- Obstacles : caisse bonus, baril explosif, barricade ----------
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

// Arme à ramasser : fusil doré lumineux qui flotte et tourne (comme la vidéo)
const pickupGeo = mergeGeometries([
  part(BOX, 0xffffff, [0, 0, 0], [0, 0, 0], [0.16, 0.22, 1.2]),
  part(CYL, 0xffffff, [0, 0.03, -0.74], [Math.PI / 2, 0, 0], [0.05, 0.42, 0.05]),
  part(BOX, 0xffffff, [0, -0.06, 0.55], [0, 0, 0], [0.13, 0.26, 0.3]),
  part(BOX, 0xffffff, [0, -0.22, -0.1], [0.25, 0, 0], [0.11, 0.3, 0.16]),
]);
const pickupMat = new THREE.MeshBasicMaterial({ color: 0xffe24a });

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
const sRoar = () => { tone(110, 0.5, "sawtooth", 0.35, 0, -50); tone(75, 0.6, "sawtooth", 0.3, 0.1, -25); };
const sOver = () => { tone(440, 0.18, "square", 0.2); tone(330, 0.18, "square", 0.2, 0.16); tone(220, 0.4, "square", 0.2, 0.32, -60); };

// ---------- État ----------
const G = {
  state: "menu", t: 0, meters: 0, count: 5, kills: 0, maxCount: 5,
  squadX: 0, targetX: 0,
  tier: 0, dmgMul: 1, rateMul: 1, armor: 0,
  gates: [], foes: [], bullets: [], parts: [], texts: [], crates: [], walls: [], pickups: [],
  gateTimer: 1.4, foeTimer: 2.0, hordeTimer: 8, dinoTimer: 25, crateTimer: 5, wallTimer: 16, pickupTimer: 14, volleyTimer: 0,
  shake: 0, pairSeq: 0,
};
const dpsNow = () => baseDPS(G.count) * TIERS[G.tier].dmgMul * G.dmgMul;
const volleyRate = () => Math.min(18, TIERS[G.tier].rate * G.rateMul);
const armorFactor = () => 1 / (1 + G.armor * 0.4);

const weaponEl = document.getElementById("weapon");
function refreshWeaponHud() {
  weaponEl.textContent =
    `${TIERS[G.tier].name} · DÉG x${(TIERS[G.tier].dmgMul * G.dmgMul).toFixed(1)} · CAD x${G.rateMul.toFixed(1)}`
    + (G.armor ? ` · 🛡 ${G.armor}` : "");
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

// ---------- Portes : bannières bleues / panneaux noirs / bannières dorées ----------
const gateGeo = new THREE.PlaneGeometry(LANE_HALF - 1.2, 3.2);
const poleGeoG = new THREE.CylinderGeometry(0.07, 0.09, 4.4, 8);
const barGeoG = new THREE.CylinderGeometry(0.05, 0.05, LANE_HALF - 1, 8);
const poleMatG = new THREE.MeshLambertMaterial({ color: 0x3c4046 });

const isGood = g => g.op !== "-" && g.op !== "/";
const isUpgrade = g => g.op === "dmg" || g.op === "rate" || g.op === "wpn" || g.op === "arm";
function gateLabel(g) {
  if (g.op === "dmg") return `DÉGÂTS +${g.v}%`;
  if (g.op === "rate") return `CADENCE +${g.v}%`;
  if (g.op === "arm") return "ARMURE ↑";
  if (g.op === "wpn") return "ARME ↑";
  return (g.op === "/" ? "÷" : g.op) + g.v;
}
function makeGateMesh(g) {
  const grp = new THREE.Group();
  const color = isUpgrade(g) ? 0xe0a32e : isGood(g) ? 0x2f7fd9 : 0x24262b;
  const panel = new THREE.Mesh(gateGeo,
    new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
  panel.position.y = 2.5;
  // potences : deux poteaux + barre horizontale (bannière suspendue, comme la vidéo)
  const w = LANE_HALF - 1;
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(poleGeoG, poleMatG);
    pole.position.set(s * w / 2, 2.2, 0);
    grp.add(pole);
  }
  const bar = new THREE.Mesh(barGeoG, poleMatG);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 4.25;
  grp.add(bar, panel);
  const label = textSprite(gateLabel(g), "#ffffff", 120);
  label.scale.set(6, 2.6, 1);
  label.position.y = 2.55;
  grp.add(label);
  grp.position.set(g.x, 0, g.z);
  scene.add(grp);
  g.mesh = grp; g.panel = panel; g.label = label;
}
function refreshGateLabel(g) {
  const old = g.label;
  g.label = textSprite(gateLabel(g), "#ffffff", 120);
  g.label.scale.set(6, 2.6, 1);
  g.label.position.y = 2.55;
  g.mesh.add(g.label);
  g.mesh.remove(old);
  disposeSprite(old);
}
function removeGate(g) {
  disposeSprite(g.label);
  g.panel.material.dispose();
  scene.remove(g.mesh);
}

function spawnGatePair() {
  const t = G.t;
  const base = 2.5 + t * 0.35;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mkGood = big => {
    const r = Math.random();
    if (t >= 10) { // les premières portes construisent l'armée, les upgrades ensuite
      if (r < 0.16) return { op: "dmg", v: 10 + 5 * Math.floor(rnd(0, 4)) };
      if (r < 0.28) return { op: "rate", v: 10 + 5 * Math.floor(rnd(0, 3)) };
      if (r < 0.36 && G.armor < 3) return { op: "arm" };
      if (r < 0.44) return { op: "x", v: 2 };
    }
    return { op: "+", v: Math.max(1, Math.round(rnd(big ? 0.7 : 0.35, big ? 1.3 : 0.7) * base)) };
  };
  const mkBad = () => Math.random() < 0.28
    ? { op: "/", v: 2 }
    : { op: "-", v: Math.max(2, Math.round(rnd(1.4, 2.6) * base)) };
  let a = mkGood(true);
  let b = t < 10 ? mkGood(false) : (Math.random() < 0.85 ? mkBad() : mkGood(false));
  if (Math.random() < 0.5) [a, b] = [b, a];
  const id = ++G.pairSeq;
  const ga = { ...a, pair: id, x: -LANE_HALF / 2, z: SPAWN_Z, done: false };
  const gb = { ...b, pair: id, x: LANE_HALF / 2, z: SPAWN_Z, done: false };
  makeGateMesh(ga); makeGateMesh(gb);
  G.gates.push(ga, gb);
}

// ---------- Ennemis individuels ----------
function spawnFoe(type, x, z, hpMul = 1) {
  if (G.foes.length > 90) return;
  const T = FOE_TYPES[type];
  const hp = unitHp(G.t) * T.hpMul * hpMul;
  G.foes.push({
    type, x, z, hp, maxHp: hp,
    scale: T.scale,
    sp: (2.6 + G.t * 0.045 + Math.random() * 1.4) * T.sp,
    wob: Math.random() * 6.28,
    radius: type === "dino" ? 2.4 : 0.75 * T.scale,
    bite: 0,
  });
  if (type === "dino") sRoar();
}
// Colonne de soldats qui marchent vers nous (comme la vidéo)
function spawnColumn(type, x, n) {
  for (let i = 0; i < n; i++)
    spawnFoe(type, x + (Math.random() - 0.5) * 1.4, SPAWN_Z - i * 3 - Math.random() * 1.5);
}
function pickFoeType(t) {
  const r = Math.random();
  if (t > 18 && r < 0.14 + t / 350) return "brute";
  if (t > 5 && r < 0.45) return "runner";
  return "soldier";
}
const randX = () => -LANE_HALF + 1.6 + Math.random() * (LANE_HALF * 2 - 3.2);

// ---------- Caisses, barils, barricades, armes au sol ----------
function crateReward(t) {
  const r = Math.random();
  if (r < 0.3) return { op: "dmg", v: 15 + 5 * Math.floor(Math.random() * 4) };
  if (r < 0.5) return { op: "rate", v: 10 + 5 * Math.floor(Math.random() * 3) };
  if (r < 0.62 && G.armor < 3) return { op: "arm" };
  return { op: "+", v: Math.max(2, Math.round((2.5 + t * 0.35) * (0.8 + Math.random() * 0.8))) };
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
  G.crates.push(c);
}
function spawnWall() {
  const side = Math.random() < 0.5 ? -1 : 1;
  const w = LANE_HALF - 0.4;
  const wl = {
    x: side * LANE_HALF / 2, z: SPAWN_Z, w,
    hp: unitHp(G.t) * 8,
  };
  wl.maxHp = wl.hp;
  wl.mesh = new THREE.Mesh(wallGeo, wallMatM);
  wl.mesh.scale.set(w, 1, 1);
  wl.mesh.position.set(wl.x, 0, wl.z);
  scene.add(wl.mesh);
  G.walls.push(wl);
}
function removeCrate(c) { scene.remove(c.mesh); }
function explodeBarrel(c) {
  burst(c.x, 1, c.z, 0xff7a2e, 30, 18);
  burst(c.x, 1, c.z, 0xffd84d, 20, 12);
  boom();
  G.shake = Math.min(1.4, G.shake + 0.7);
  const dmg = unitHp(G.t) * 12;
  for (let j = G.foes.length - 1; j >= 0; j--) {
    const f = G.foes[j];
    if (Math.abs(f.x - c.x) < 6 && Math.abs(f.z - c.z) < 6) {
      f.hp -= dmg;
      if (f.hp <= 0) {
        G.kills++;
        burst(f.x, 1.5, f.z, 0xd23b2f, 8, 9);
        G.foes.splice(j, 1);
      }
    }
  }
}
// Arme dorée à ramasser (passe dessus pour l'équiper)
function spawnPickup() {
  const p = { x: randX(), z: SPAWN_Z, mesh: new THREE.Mesh(pickupGeo, pickupMat) };
  p.mesh.position.set(p.x, 1.6, p.z);
  p.mesh.scale.setScalar(2);
  scene.add(p.mesh);
  G.pickups.push(p);
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

// ---------- Application des bonus ----------
const flashEl = document.getElementById("flash");
function applyBonus(g) {
  let str = "", good = isGood(g);
  if (g.op === "+") { G.count += g.v; str = "+" + g.v; }
  if (g.op === "x") { G.count *= g.v; str = "x" + g.v; }
  if (g.op === "-") { G.count -= g.v; str = "-" + g.v; }
  if (g.op === "/") { G.count = Math.floor(G.count / g.v); str = "÷" + g.v; }
  if (g.op === "dmg") { G.dmgMul *= 1 + g.v / 100; str = `DÉGÂTS +${g.v}%`; }
  if (g.op === "rate") { G.rateMul = Math.min(2.4, G.rateMul * (1 + g.v / 100)); str = `CADENCE +${g.v}%`; }
  if (g.op === "arm") { G.armor = Math.min(3, G.armor + 1); str = "ARMURE ↑"; }
  if (g.op === "wpn") { G.tier = Math.min(2, G.tier + 1); str = TIERS[G.tier].name + " !"; sWeapon(); }
  if (G.count > 999) { G.count = 999; str = "MAX"; }
  G.maxCount = Math.max(G.maxCount, G.count);
  ftext(str, isUpgrade(g) ? "#ffd84d" : good ? "#5fb6ff" : "#ff5f6b", good);
  burst(G.squadX, 2, SQUAD_Z, good ? 0x5fb6ff : 0xff5f6b, 16, 11);
  if (g.op !== "wpn") (good ? sGateGood : sGateBad)();
  refreshWeaponHud();
  if (G.count <= 0) gameOver();
}

function hitSquad(loss) {
  loss = Math.max(1, Math.round(loss * armorFactor()));
  G.count -= loss;
  G.shake = Math.min(1.4, 0.5 + loss * 0.05);
  flashEl.style.opacity = "1";
  setTimeout(() => flashEl.style.opacity = "0", 130);
  ftext("-" + loss, "#ff5f6b");
  burst(G.squadX, 1.5, SQUAD_Z, 0xff5f6b, 14, 10);
  sHit();
  if (G.count <= 0) gameOver();
}

// ---------- Update ----------
function update(dt) {
  const t = (G.t += dt);
  const scroll = scrollSpeed(t);
  G.meters += scroll * dt * 0.5;

  if (keys.has("ArrowLeft")) G.targetX -= 22 * dt;
  if (keys.has("ArrowRight")) G.targetX += 22 * dt;
  G.targetX = Math.max(-LANE_HALF + 1.2, Math.min(LANE_HALF - 1.2, G.targetX));
  G.squadX += (G.targetX - G.squadX) * Math.min(1, dt * 12);

  // Lampadaires : défilent et bouclent (le sol, lui, ne bouge pas)
  for (const l of lamps) {
    l.position.z += scroll * dt;
    if (l.position.z > KILL_Z) l.position.z -= 12 * 42;
  }

  // Spawns
  if ((G.gateTimer -= dt) <= 0) { G.gateTimer = gateIv(t); spawnGatePair(); }
  if ((G.foeTimer -= dt) <= 0) {
    G.foeTimer = enemyIv(t);
    const type = pickFoeType(t);
    if (type === "soldier") spawnColumn("soldier", randX(), Math.min(10, 2 + Math.floor(t / 9)));
    else if (type === "runner") spawnColumn("runner", randX(), 1 + Math.floor(Math.random() * 3));
    else spawnFoe("brute", randX(), SPAWN_Z);
    if (t > 8 && Math.random() < 0.18) spawnCrate(randX(), "barrel");
  }
  if (t > 10 && (G.hordeTimer -= dt) <= 0) {
    G.hordeTimer = Math.max(4, 7.5 - t * 0.04);
    const k = 5 + Math.floor(t / 12);
    for (let i = 0; i < k; i++)
      spawnFoe(Math.random() < 0.3 ? "runner" : "soldier",
        -LANE_HALF + 1.8 + (i + 0.5) * (LANE_HALF * 2 - 3.6) / k, SPAWN_Z - Math.random() * 6, 0.9);
  }
  if (t > 25 && (G.dinoTimer -= dt) <= 0) { G.dinoTimer = Math.max(11, 16 - t * 0.04); spawnFoe("dino", randX(), SPAWN_Z); }
  if ((G.crateTimer -= dt) <= 0) {
    G.crateTimer = 5 + Math.random() * 4;
    spawnCrate(randX(), "crate");
    if (Math.random() < 0.3) spawnCrate(randX(), "crate");
  }
  if (t > 16 && (G.wallTimer -= dt) <= 0) { G.wallTimer = 12 + Math.random() * 5; spawnWall(); }
  if (G.tier < 2 && (G.pickupTimer -= dt) <= 0) { G.pickupTimer = 18 + Math.random() * 6; spawnPickup(); }

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
    // Flammes de bouche (3 max, comme les gerbes de la vidéo)
    for (let i = 0; i < Math.min(3, streams) && G.parts.length < 260; i++) {
      const fx = G.squadX + (Math.random() - 0.5) * spread * 2;
      G.parts.push({ x: fx, y: 1.5, z: SQUAD_Z - 1.8, vx: 0, vy: 2.5, vz: -16, life: 0.14, t: 0.14, color: 0xffd84d });
    }
  }

  // Balles
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.z -= (90 + scroll) * dt;
    let dead = b.z < SPAWN_Z;

    if (!dead) for (const g of G.gates) {
      if (g.done || Math.abs(b.z - g.z) > 1.4) continue;
      if (Math.abs(b.x - g.x) > (LANE_HALF - 1.2) / 2) continue;
      if ((g.bumps || 0) < 10) {
        if (g.op === "+") { g.bumps = (g.bumps || 0) + 1; g.v++; refreshGateLabel(g); }
        else if (g.op === "-" && g.v > 0) { g.bumps = (g.bumps || 0) + 1; g.v--; refreshGateLabel(g); }
      }
      burst(b.x, 2.5, g.z, 0xffd84d, 2, 5);
      dead = true;
      break;
    }
    if (!dead) for (let j = G.walls.length - 1; j >= 0; j--) {
      const wl = G.walls[j];
      if (Math.abs(b.z - wl.z) > 1.2 || Math.abs(b.x - wl.x) > wl.w / 2) continue;
      wl.hp -= b.dmg;
      dead = true;
      if (wl.hp <= 0) {
        burst(wl.x, 1.2, wl.z, 0x9aa0a6, 24, 12);
        sPop();
        scene.remove(wl.mesh);
        G.walls.splice(j, 1);
      }
      break;
    }
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
      if (Math.abs(b.x - f.x) < f.radius + 0.45 && Math.abs(b.z - f.z) < f.radius + 0.9) {
        f.hp -= b.dmg;
        dead = true;
        if (f.hp <= 0) {
          G.kills++;
          burst(f.x, 1.5, f.z, 0xd23b2f, f.type === "dino" ? 30 : 8, f.type === "dino" ? 16 : 9);
          sPop();
          G.foes.splice(j, 1);
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
        o.panel.material.opacity = 0.15;
      }
      const chosen = mine ? g : G.gates.find(o => o.pair === g.pair && o !== g);
      if (chosen) applyBonus(chosen);
      if (G.state !== "playing") return;
    }
    if (g.z > KILL_Z) { removeGate(g); G.gates.splice(i, 1); }
  }

  // Armes à ramasser
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const p = G.pickups[i];
    p.z += scroll * dt;
    p.mesh.position.z = p.z;
    p.mesh.position.y = 1.6 + Math.sin(t * 3 + i) * 0.25;
    p.mesh.rotation.y += dt * 2.5;
    if (p.z > SQUAD_Z - 1 && Math.abs(p.x - G.squadX) < squadRadius() + 1.2) {
      G.tier = Math.min(2, G.tier + 1);
      ftext(TIERS[G.tier].name + " !", "#ffd84d", true);
      burst(p.x, 1.6, p.z, 0xffe24a, 22, 12);
      sWeapon();
      refreshWeaponHud();
      scene.remove(p.mesh);
      G.pickups.splice(i, 1);
    } else if (p.z > KILL_Z) {
      scene.remove(p.mesh);
      G.pickups.splice(i, 1);
    }
  }

  // Caisses / barils
  for (let i = G.crates.length - 1; i >= 0; i--) {
    const c = G.crates[i];
    c.z += scroll * dt;
    c.mesh.position.z = c.z;
    if (c.z > KILL_Z) { removeCrate(c); G.crates.splice(i, 1); }
  }

  // Barricades
  for (let i = G.walls.length - 1; i >= 0; i--) {
    const wl = G.walls[i];
    wl.z += scroll * dt;
    wl.mesh.position.z = wl.z;
    if (wl.z > SQUAD_Z - 1.2 && Math.abs(wl.x - G.squadX) < wl.w / 2 + squadRadius() * 0.7) {
      scene.remove(wl.mesh);
      G.walls.splice(i, 1);
      hitSquad(wl.hp / 4);
      if (G.state !== "playing") return;
    } else if (wl.z > KILL_Z) {
      scene.remove(wl.mesh);
      G.walls.splice(i, 1);
    }
  }

  // Ennemis : ils MARCHENT vers nous
  const sr = squadRadius();
  for (let i = G.foes.length - 1; i >= 0; i--) {
    const f = G.foes[i];
    f.z += (scroll * 0.5 + f.sp) * dt;
    f.x += Math.sin(t * 2.4 + f.wob) * 0.4 * dt;
    f.x = Math.max(-LANE_HALF + 1, Math.min(LANE_HALF - 1, f.x));
    f.bite -= dt;
    if (f.z > SQUAD_Z - 1.2 && Math.abs(f.x - G.squadX) < f.radius + sr) {
      if (f.type === "dino") {
        // le dino mord par vagues et encaisse la riposte
        if (f.bite <= 0) {
          f.bite = 0.9;
          f.hp -= dpsNow() * 0.5;
          hitSquad(FOE_TYPES.dino.loss(f.hp));
          if (G.state !== "playing") return;
          if (f.hp <= 0) { G.kills++; burst(f.x, 2, f.z, 0x9aa05e, 30, 16); G.foes.splice(i, 1); }
        }
      } else {
        hitSquad(FOE_TYPES[f.type].loss(f.hp));
        G.foes.splice(i, 1);
        if (G.state !== "playing") return;
      }
    } else if (f.z > KILL_Z) {
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
  barCursor = 0;
  _right.set(1, 0, 0).applyQuaternion(camera.quaternion);

  // Squad
  const visible = Math.min(G.count, 80);
  for (let ti = 0; ti < allyMeshes.length; ti++) allyMeshes[ti].count = ti === G.tier ? visible : 0;
  const am = allyMeshes[G.tier];
  const running = G.state === "playing";
  for (let i = 0; i < visible; i++) {
    const o = SLOTS[i];
    placeHumanoid(am, i, G.squadX + o.x, SQUAD_Z + o.z, 1,
      running ? now * 0.014 + i * 1.3 : 0, 0.08, LEG_ALLY);
    if (G.armor > 0 && i < 80) {
      dummy.position.set(G.squadX + o.x, 0, SQUAD_Z + o.z);
      dummy.rotation.set(0.08, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      plateMesh.setMatrixAt(i, dummy.matrix);
      plateMesh.setColorAt(i, PLATE_COLORS[G.armor]);
    }
  }
  am.instanceMatrix.needsUpdate = true;
  plateMesh.count = G.armor > 0 ? visible : 0;
  plateMesh.instanceMatrix.needsUpdate = true;
  if (plateMesh.instanceColor) plateMesh.instanceColor.needsUpdate = true;
  if (G.state === "playing") updateBadge(G.count, G.squadX);

  // Ennemis (chacun sa barre de vie, comme la vidéo)
  const cursors = {};
  for (const k in FOE_TYPES) { FOE_TYPES[k].mesh.count = 0; cursors[k] = 0; }
  for (const f of G.foes) {
    const T = FOE_TYPES[f.type];
    if (cursors[f.type] >= T.cap) continue;
    if (f.type === "dino") {
      dummy.position.set(f.x, Math.abs(Math.sin(now * 0.006 + f.wob)) * 0.15, f.z);
      dummy.rotation.set(0, Math.sin(now * 0.003 + f.wob) * 0.08, Math.sin(now * 0.005 + f.wob) * 0.04);
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      T.mesh.setMatrixAt(cursors[f.type]++, dummy.matrix);
      pushBar(f.x, 5.2 * f.scale, f.z, 4, f.hp / f.maxHp);
    } else {
      placeHumanoid(T.mesh, cursors[f.type]++, f.x, f.z, f.scale,
        now * 0.011 * T.sp + f.wob * 4, -0.06, LEG_FOE);
      pushBar(f.x, 2.1 * f.scale, f.z, 1.5, f.hp / f.maxHp);
    }
  }
  for (const k in FOE_TYPES) {
    FOE_TYPES[k].mesh.count = cursors[k];
    FOE_TYPES[k].mesh.instanceMatrix.needsUpdate = true;
  }
  legsMesh.count = legCursor;
  legsMesh.instanceMatrix.needsUpdate = true;
  if (legsMesh.instanceColor) legsMesh.instanceColor.needsUpdate = true;

  // Barricades : barre de vie
  for (const wl of G.walls) pushBar(wl.x, 2.9, wl.z, 5, wl.hp / wl.maxHp);
  barBG.count = barCursor; barFG.count = barCursor;
  barBG.instanceMatrix.needsUpdate = true;
  barFG.instanceMatrix.needsUpdate = true;

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
  for (const c of G.crates) removeCrate(c);
  for (const w of G.walls) scene.remove(w.mesh);
  for (const p of G.pickups) scene.remove(p.mesh);
  for (const x of G.texts) disposeSprite(x.sp);
  G.gates = []; G.foes = []; G.bullets = []; G.parts = []; G.texts = []; G.crates = []; G.walls = []; G.pickups = [];
}

function reset() {
  clearWorld();
  Object.assign(G, {
    t: 0, meters: 0, count: 5, kills: 0, maxCount: 5,
    squadX: 0, targetX: 0,
    tier: 0, dmgMul: 1, rateMul: 1, armor: 0,
    gateTimer: 1.4, foeTimer: 2.0, hordeTimer: 8, dinoTimer: 25, crateTimer: 5, wallTimer: 16, pickupTimer: 14, volleyTimer: 0,
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

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

// ---------- Difficulté : montée progressive, mur vers 2-3 minutes ----------
const scrollSpeed = t => 24 + Math.min(46, t * 0.3);    // vitesse d'approche du décor
const unitHp      = t => 2 + Math.pow(t, 1.5) / 10.5;
const enemyIv     = t => Math.max(0.28, 1.5 - t * 0.009);
const gateIv      = t => Math.max(2.2, 3.6 - t * 0.022);
const baseDPS     = c => 6 + c * 2.4;

// ---------- Armes ----------
// bsp : vitesse projectile · aoe : {r: rayon, f: fraction des dégâts en zone}
// streamsMax : nb max de tirs simultanés · flash : couleur de la gerbe de bouche
const TIERS = [
  { name: "FUSIL",   dmgMul: 1,   rate: 8,  bullet: 0, bsp: 95,  streamsMax: 8, flash: 0xffd84d },
  { name: "MINIGUN", dmgMul: 1.5, rate: 13, bullet: 1, bsp: 105, streamsMax: 8, flash: 0xff9d2e },
  { name: "BAZOOKA", dmgMul: 2.1, rate: 3,  bullet: 2, bsp: 55,  streamsMax: 2, flash: 0xff7a2e, aoe: { r: 3.6, f: 1 }, homing: true },
  { name: "LASER",   dmgMul: 3,   rate: 16, bullet: 3, bsp: 150, streamsMax: 6, flash: 0xff2e4d },
  { name: "PLASMA",  dmgMul: 4.2, rate: 10, bullet: 4, bsp: 80,  streamsMax: 5, flash: 0x4dff7a, aoe: { r: 2.4, f: 0.5 } },
  { name: "RAILGUN", dmgMul: 5,   rate: 4,  bullet: 6, bsp: 220, streamsMax: 3, flash: 0x9fd9ff, pierce: 6 },
  { name: "TANK",    dmgMul: 6,   rate: 6,  bullet: 5, bsp: 115, streamsMax: 4, flash: 0xffd84d, aoe: { r: 3, f: 0.8 }, tank: true },
  { name: "AVIONS",  dmgMul: 9,   rate: 14, bullet: 7, bsp: 160, streamsMax: 6, flash: 0x6fd9ff, aoe: { r: 2, f: 0.4 }, jet: true },
];
// Les avions de chasse ne se débloquent qu'après 3000 m
const maxTierNow = () => G.meters >= 3000 ? TIERS.length - 1 : TIERS.length - 2;

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
// Béton réaliste : marbrures, taches, fissures et joints de dilatation
const concreteTex = canvasTexture((g, w, h) => {
  g.fillStyle = "#c9c2b4"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    g.globalAlpha = 0.03 + Math.random() * 0.04;
    g.fillStyle = Math.random() < 0.5 ? "#8d8678" : "#efe9da";
    const s = 3 + Math.random() * 14;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  g.globalAlpha = 0.05;
  g.fillStyle = "#6e6657";
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 45, 6 + Math.random() * 25, Math.random() * 3, 0, 6.28);
    g.fill();
  }
  g.globalAlpha = 0.35;
  g.strokeStyle = "#7d7666";
  g.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    let x = Math.random() * w, y = Math.random() * h;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (Math.random() - 0.5) * 60;
      y += Math.random() * 45;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 0.45;
  g.strokeStyle = "#9a937f";
  g.lineWidth = 4;
  for (let y = 0; y <= h; y += 256) {
    g.beginPath(); g.moveTo(0, y + 1); g.lineTo(w, y + 1); g.stroke();
  }
}, 1024, 1024);
concreteTex.repeat.set(1.6, 12); // joints de dilatation tous les ~9 m

// Mer avec reflets de vagues
const seaTex = canvasTexture((g, w, h) => {
  g.fillStyle = "#2e7fc4"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    g.globalAlpha = 0.05 + Math.random() * 0.07;
    g.fillStyle = Math.random() < 0.6 ? "#5da8e0" : "#1d5e9a";
    g.beginPath();
    g.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 30, 1.5 + Math.random() * 3, 0, 0, 6.28);
    g.fill();
  }
});
seaTex.repeat.set(14, 14);
const sea = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshLambertMaterial({ map: seaTex })
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -7;
scene.add(sea);

// Nuages (sprites doux, fixes dans le ciel)
{
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(128, 64, 8, 128, 64, 62);
  grad.addColorStop(0, "rgba(255,255,255,.95)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  for (const [x, y, r] of [[90, 70, 1], [128, 55, 1.3], [170, 72, 0.9]]) {
    g.save(); g.translate(x - 128, y - 64); g.scale(r, r * 0.6); g.fillRect(0, 0, 256, 128); g.restore();
  }
  const tx = new THREE.CanvasTexture(c);
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, opacity: 0.85, depthWrite: false }));
    sp.position.set(-120 + Math.random() * 240, 32 + Math.random() * 30, -200 - Math.random() * 60);
    const s = 28 + Math.random() * 30;
    sp.scale.set(s, s * 0.42, 1);
    scene.add(sp);
  }
}

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(LANE_HALF * 2 + 4, 2, 420),
  new THREE.MeshLambertMaterial({ map: concreteTex }));
floor.position.set(0, -1, -170);
scene.add(floor);

// Vraie balustrade en pierre : muret bas + balustres + main courante (comme la vidéo)
const balMat = new THREE.MeshLambertMaterial({ color: 0xb6b9bd });
const balTopMat = new THREE.MeshLambertMaterial({ color: 0xa7abb0 });
{
  const balusterGeo = new THREE.CylinderGeometry(0.09, 0.13, 0.85, 6);
  const balusters = new THREE.InstancedMesh(balusterGeo, balMat, 240);
  balusters.frustumCulled = false;
  let bi = 0;
  const bd = new THREE.Object3D();
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 420), balMat);
    curb.position.set(side * (LANE_HALF + 1.2), 0.17, -170);
    scene.add(curb);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.2, 420), balTopMat);
    rail.position.set(side * (LANE_HALF + 1.2), 1.28, -170);
    scene.add(rail);
    // pilastres massifs régulièrement espacés
    for (let i = 0; i < 11; i++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.15, 1.25), balTopMat);
      block.position.set(side * (LANE_HALF + 1.2), 0.7, -i * 38 - 4);
      scene.add(block);
    }
    for (let z = 16; z > -404 && bi < 240; z -= 3.4) {
      bd.position.set(side * (LANE_HALF + 1.2), 0.76, z - 16);
      bd.updateMatrix();
      balusters.setMatrixAt(bi++, bd.matrix);
    }
  }
  balusters.count = bi;
  balusters.instanceMatrix.needsUpdate = true;
  scene.add(balusters);
  // piles du pont sous le tablier
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 8, 2.4),
      new THREE.MeshLambertMaterial({ color: 0x8e9296 }));
    p.position.set(side * (LANE_HALF - 0.2), -4.8, -i * 48 - 10);
    scene.add(p);
  }
}

// Lampadaires : décor fixe — on n'avance pas, tout vient vers nous
const lamps = [];
{
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x33373c });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6da });
  for (let i = 0; i < 12; i++) {
    const grp = new THREE.Group();
    const side = i % 2 === 0 ? -1 : 1;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.5, 10), poleMat);
    base.position.y = 0.25;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 4.6, 8), poleMat);
    pole.position.y = 2.55;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 8), poleMat);
    collar.position.y = 1.1;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-side * 0.7, 4.8, 0);
    const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.25, 10), poleMat);
    fixture.position.set(-side * 1.4, 4.68, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), headMat);
    head.position.set(-side * 1.4, 4.52, 0);
    grp.add(base, pole, collar, arm, fixture, head);
    grp.position.set(side * (LANE_HALF - 0.6), 0, -i * 42 - 8);
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
  if (kind === "bazooka") return [
    // tube épais porté sur l'épaule droite
    part(CYL, 0x4a5240, [0.26, 1.52, 0.05], [Math.PI / 2, 0, 0], [0.14, 1.15, 0.14]),
    part(CYL, 0x32382c, [0.26, 1.52, -0.55], [Math.PI / 2, 0, 0], [0.17, 0.14, 0.17]),
    part(CYL, 0x32382c, [0.26, 1.52, 0.6], [Math.PI / 2, 0, 0], [0.16, 0.1, 0.16]),
    part(BOX, 0x2b2e33, [0.26, 1.34, 0.12], [0, 0, 0], [0.07, 0.2, 0.1]),
  ];
  if (kind === "laser") return [
    part(BOX, 0x24303f, at, [0, 0, 0], [0.11, 0.15, 0.7]),
    part(BOX, 0xff2e4d, [at[0], at[1] + 0.09, at[2] - 0.1], [0, 0, 0], [0.05, 0.05, 0.42]),
    part(CONE, 0xff2e4d, [at[0], at[1], at[2] - 0.46], [-Math.PI / 2, 0, 0], [0.06, 0.16, 0.06]),
    part(BOX, cloth, [at[0], at[1] - 0.04, at[2] + 0.3], [0, 0, 0], [0.08, 0.14, 0.16]),
  ];
  if (kind === "plasma") return [
    part(BOX, 0x2c3a2e, at, [0, 0, 0], [0.14, 0.18, 0.62]),
    part(SPH, 0x4dff7a, [at[0] + 0.1, at[1] + 0.04, at[2] + 0.05], [0, 0, 0], [0.07, 0.07, 0.07]),
    part(SPH, 0x4dff7a, [at[0] - 0.1, at[1] + 0.04, at[2] + 0.05], [0, 0, 0], [0.07, 0.07, 0.07]),
    part(CYL, 0x4dff7a, [at[0], at[1], at[2] - 0.4], [Math.PI / 2, 0, 0], [0.05, 0.18, 0.05]),
  ];
  if (kind === "railgun") return [
    // long rail à bobines, lueur bleutée
    part(BOX, 0x1f2933, at, [0, 0, 0], [0.1, 0.14, 0.95]),
    part(CYL, 0x9fd9ff, [at[0], at[1], at[2] - 0.2], [Math.PI / 2, 0, 0], [0.09, 0.08, 0.09]),
    part(CYL, 0x9fd9ff, [at[0], at[1], at[2] - 0.4], [Math.PI / 2, 0, 0], [0.09, 0.08, 0.09]),
    part(CYL, 0x9fd9ff, [at[0], at[1], at[2] - 0.6], [Math.PI / 2, 0, 0], [0.09, 0.08, 0.09]),
    part(BOX, cloth, [at[0], at[1] - 0.05, at[2] + 0.4], [0, 0, 0], [0.08, 0.15, 0.16]),
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

/* Humanoïde détaillé : veste à col, gilet tactique à poches, épaulettes,
   ceinturon à boucle, sac à dos avec rouleau, casquette à visière,
   arme à deux mains. `face` ajoute des yeux (ennemis vus de face). */
function darker(hex, f = 0.6) {
  const c = new THREE.Color(hex).multiplyScalar(f);
  return c.getHex();
}
function soldierGeo({ cloth, vest, cap, bulk = 1, weapon = "rifle", pack = true, plates = false, face = false }) {
  const beltC = 0x4a4438, vestC = vest ?? darker(cloth, 0.55);
  const parts = [
    part(BOX, beltC, [0, 0.76, 0], [0, 0, 0], [0.44 * bulk, 0.13, 0.3]),                  // ceinturon
    part(BOX, 0xc9c2ae, [0, 0.76, -0.16], [0, 0, 0], [0.09, 0.07, 0.03]),                 // boucle
    part(BOX, cloth, [0, 1.07, 0], [0.06, 0, 0], [0.52 * bulk, 0.54, 0.32]),              // veste
    part(BOX, darker(cloth, 0.75), [0, 1.41, 0.02], [0.06, 0, 0], [0.3, 0.09, 0.26]),     // col
    part(BOX, vestC, [0.33 * bulk, 1.37, -0.02], [0, 0, 0.12], [0.18, 0.1, 0.24]),        // épaulette D
    part(BOX, vestC, [-0.33 * bulk, 1.37, -0.02], [0, 0, -0.12], [0.18, 0.1, 0.24]),      // épaulette G
    part(BOX, cloth, [0.3 * bulk, 1.26, -0.13], [-0.9, 0, -0.2], [0.15, 0.34, 0.15]),     // bras D haut
    part(BOX, cloth, [-0.3 * bulk, 1.26, -0.13], [-0.9, 0, 0.2], [0.15, 0.34, 0.15]),     // bras G haut
    part(BOX, SKIN, [0.22 * bulk, 1.16, -0.38], [-1.2, 0, 0], [0.11, 0.2, 0.11]),         // avant-bras D
    part(BOX, SKIN, [-0.22 * bulk, 1.16, -0.38], [-1.2, 0, 0], [0.11, 0.2, 0.11]),        // avant-bras G
    part(SPH, SKIN, [0, 1.54, 0], [0, 0, 0], [0.18, 0.19, 0.18]),                         // tête
    ...weaponParts(weapon, cloth),
  ];
  if (face) parts.push(
    part(SPH, 0x1c1c1c, [0.07, 1.57, -0.16], [0, 0, 0], [0.035, 0.035, 0.035]),           // yeux
    part(SPH, 0x1c1c1c, [-0.07, 1.57, -0.16], [0, 0, 0], [0.035, 0.035, 0.035]));
  if (vest != null) parts.push(
    part(BOX, vest, [0, 1.06, -0.05], [0.06, 0, 0], [0.56 * bulk, 0.4, 0.3]),             // gilet avant
    part(BOX, darker(vest, 0.75), [0.12 * bulk, 0.97, -0.23], [0.06, 0, 0], [0.13, 0.14, 0.07]),  // poches
    part(BOX, darker(vest, 0.75), [-0.12 * bulk, 0.97, -0.23], [0.06, 0, 0], [0.13, 0.14, 0.07]),
    part(BOX, darker(vest, 0.75), [0, 1.16, -0.24], [0.06, 0, 0], [0.16, 0.12, 0.06]),    // poche radio
    part(BOX, vest, [0, 1.18, 0.2], [0, 0, 0], [0.5 * bulk, 0.3, 0.14]));                 // dosseret
  if (cap != null) parts.push(
    part(SPH, cap, [0, 1.62, 0], [0, 0, 0], [0.21, 0.14, 0.21]),                          // casquette
    part(BOX, cap, [0, 1.57, -0.17], [0.2, 0, 0], [0.3, 0.05, 0.15]),                     // visière
    part(BOX, darker(cap, 0.7), [0, 1.55, 0.05], [0, 0, 0], [0.3, 0.07, 0.3]));           // tour de tête
  if (pack) parts.push(
    part(BOX, vestC, [0, 1.06, 0.31], [0, 0, 0], [0.36, 0.4, 0.18]),                      // sac à dos
    part(CYL, darker(vestC, 0.75), [0, 1.32, 0.31], [0, 0, Math.PI / 2], [0.08, 0.3, 0.08]));// rouleau
  if (plates) parts.push(
    part(BOX, 0x55595e, [0.36 * bulk, 1.36, 0], [0, 0, 0.3], [0.22, 0.13, 0.32]),
    part(BOX, 0x55595e, [-0.36 * bulk, 1.36, 0], [0, 0, -0.3], [0.22, 0.13, 0.32]));
  return mergeGeometries(parts);
}

// ---------- Famille de dinosaures ----------
// T-Rex : le boss
function rexGeo() {
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
// Raptor : petit, rapide, chasse en meute
function raptorGeo() {
  const body = 0xa8743e, dark = 0x7a5128;
  return mergeGeometries([
    part(CAP, body, [0, 1.05, 0.1], [Math.PI / 2.2, 0, 0], [0.42, 0.7, 0.42]),  // corps penché
    part(CAP, body, [0, 1.45, -0.75], [1, 0, 0], [0.22, 0.35, 0.22]),           // cou
    part(BOX, body, [0, 1.62, -1.25], [0.2, 0, 0], [0.34, 0.3, 0.75]),          // tête
    part(BOX, 0xc9995e, [0, 1.5, -1.4], [0.3, 0, 0], [0.28, 0.14, 0.6]),        // mâchoire
    part(SPH, 0x222222, [0.13, 1.7, -1.3], [0, 0, 0], [0.05, 0.05, 0.05]),
    part(SPH, 0x222222, [-0.13, 1.7, -1.3], [0, 0, 0], [0.05, 0.05, 0.05]),
    part(CONE, body, [0, 1.15, 1.35], [-1.4, 0, 0], [0.18, 1.6, 0.18]),         // queue
    part(BOX, dark, [0.24, 0.5, 0.15], [0, 0, 0], [0.18, 1, 0.3]),              // jambes
    part(BOX, dark, [-0.24, 0.5, 0.15], [0, 0, 0], [0.18, 1, 0.3]),
    part(BOX, dark, [0.3, 1.15, -0.5], [-0.6, 0, 0], [0.09, 0.3, 0.09]),        // griffes avant
    part(BOX, dark, [-0.3, 1.15, -0.5], [-0.6, 0, 0], [0.09, 0.3, 0.09]),
  ]);
}
// Tricératops : lent, blindé, charge
function trikeGeo() {
  const body = 0x7d8568, dark = 0x5a6048, horn = 0xe8e4d0;
  return mergeGeometries([
    part(CAP, body, [0, 1.5, 0.3], [Math.PI / 2, 0, 0], [1.05, 1.2, 1.05]),     // corps massif
    part(CYL, dark, [0, 2.05, -1.45], [Math.PI / 2.6, 0, 0], [0.95, 0.25, 0.95]), // collerette
    part(BOX, body, [0, 1.7, -1.7], [0.25, 0, 0], [0.75, 0.65, 1]),             // tête
    part(BOX, dark, [0, 1.45, -2.15], [0.4, 0, 0], [0.5, 0.35, 0.5]),           // bec
    part(CONE, horn, [0.3, 2.15, -1.95], [-1.3, 0, 0], [0.09, 0.75, 0.09]),     // corne D
    part(CONE, horn, [-0.3, 2.15, -1.95], [-1.3, 0, 0], [0.09, 0.75, 0.09]),    // corne G
    part(CONE, horn, [0, 1.8, -2.35], [-1.3, 0, 0], [0.08, 0.45, 0.08]),        // corne nasale
    part(SPH, 0x222222, [0.34, 1.95, -1.55], [0, 0, 0], [0.06, 0.06, 0.06]),
    part(SPH, 0x222222, [-0.34, 1.95, -1.55], [0, 0, 0], [0.06, 0.06, 0.06]),
    part(CONE, body, [0, 1.5, 1.9], [-1.45, 0, 0], [0.3, 1.6, 0.3]),            // queue
    part(BOX, dark, [0.55, 0.55, -0.55], [0, 0, 0], [0.36, 1.1, 0.42]),         // pattes
    part(BOX, dark, [-0.55, 0.55, -0.55], [0, 0, 0], [0.36, 1.1, 0.42]),
    part(BOX, dark, [0.55, 0.55, 0.95], [0, 0, 0], [0.36, 1.1, 0.42]),
    part(BOX, dark, [-0.55, 0.55, 0.95], [0, 0, 0], [0.36, 1.1, 0.42]),
  ]);
}

// Jambe : cuisse teintée par instance + botte sombre, pivot à la hanche
const legGeo = mergeGeometries([
  part(CAP, 0xffffff, [0, -0.24, 0], [0, 0, 0], [0.1, 0.15, 0.1]),
  part(BOX, 0x303338, [0, -0.52, -0.04], [0, 0, 0], [0.13, 0.13, 0.22]),
]);

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
const allyMeshes = TIERS.map((t, i) => (t.tank || t.jet) ? null : makeInstanced(
  soldierGeo({ ...ALLY_STYLE, weapon: ["rifle", "minigun", "bazooka", "laser", "plasma", "railgun"][i] }), vcMat(), 80));

// Char d'assaut (palier ultime : la squad se transforme en tanks)
const tankGeo = mergeGeometries([
  part(BOX, 0x23303d, [0.62, 0.34, 0], [0, 0, 0], [0.34, 0.42, 1.7]),     // chenille D
  part(BOX, 0x23303d, [-0.62, 0.34, 0], [0, 0, 0], [0.34, 0.42, 1.7]),    // chenille G
  part(BOX, 0x2e5f9e, [0, 0.62, 0], [0, 0, 0], [1.1, 0.4, 1.6]),          // caisse
  part(BOX, 0x3b82f6, [0, 0.62, -0.62], [0.18, 0, 0], [1, 0.34, 0.5]),    // glacis avant
  part(CYL, 0x2e5f9e, [0, 0.95, 0.12], [0, 0, 0], [0.5, 0.3, 0.5]),       // tourelle
  part(CYL, 0x1d3f7a, [0, 0.98, -0.75], [Math.PI / 2, 0, 0], [0.09, 1.3, 0.09]), // canon
  part(CYL, 0x16305c, [0, 0.98, -1.36], [Math.PI / 2, 0, 0], [0.12, 0.18, 0.12]),// frein de bouche
  part(BOX, 0x1d3f7a, [0.3, 1.12, 0.2], [0, 0, 0], [0.22, 0.1, 0.22]),    // écoutille
]);
const tankMesh = makeInstanced(tankGeo, vcMat(), 40);

// Avion de chasse (palier mythique après 3000 m)
const jetGeo = mergeGeometries([
  part(CAP, 0x2e5f9e, [0, 0, 0.1], [Math.PI / 2, 0, 0], [0.3, 1.5, 0.3]),         // fuselage
  part(CONE, 0x1d3f7a, [0, 0, -1.15], [-Math.PI / 2, 0, 0], [0.28, 0.7, 0.28]),   // nez
  part(SPH, 0xbfe3ff, [0, 0.26, -0.45], [0, 0, 0], [0.18, 0.14, 0.3]),            // verrière
  part(BOX, 0x3b82f6, [0.85, 0, 0.25], [0, -0.45, 0], [1.5, 0.07, 0.6]),          // aile D en flèche
  part(BOX, 0x3b82f6, [-0.85, 0, 0.25], [0, 0.45, 0], [1.5, 0.07, 0.6]),          // aile G
  part(BOX, 0x1d3f7a, [0, 0.32, 0.85], [0.5, 0, 0], [0.07, 0.55, 0.4]),           // dérive
  part(BOX, 0x3b82f6, [0.35, 0, 0.95], [0, -0.3, 0], [0.55, 0.06, 0.3]),          // empennage D
  part(BOX, 0x3b82f6, [-0.35, 0, 0.95], [0, 0.3, 0], [0.55, 0.06, 0.3]),          // empennage G
  part(CYL, 0xff9d2e, [0, 0, 1.02], [Math.PI / 2, 0, 0], [0.14, 0.1, 0.14]),      // tuyère
]);
const jetMesh = makeInstanced(jetGeo, vcMat(), 24);
// Plastron d'armure (upgrade personnage, visible sur chaque soldat)
const plateMesh = makeInstanced(
  part(BOX, 0xffffff, [0, 1.1, -0.26], [0.06, 0, 0], [0.5, 0.44, 0.08]), vcMat(), 80);
plateMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(80 * 3), 3);
const PLATE_COLORS = [null, new THREE.Color(0x9aa2ab), new THREE.Color(0xd5dbe2), new THREE.Color(0xffd34a)];

// Ennemis individuels : humains + dinosaures (beast)
const FOE_TYPES = {
  runner:  { hpMul: 0.5, sp: 2.2, scale: 0.9, loss: h => 2, cap: 70, radius: 0.7,
             geo: soldierGeo({ cloth: 0xe8554a, vest: null, cap: null, weapon: "pistol", pack: false, face: true }) },
  soldier: { hpMul: 1, sp: 1, scale: 1, loss: h => Math.round(h / 4), cap: 100, radius: 0.75,
             geo: soldierGeo({ cloth: 0xd23b2f, vest: 0x5e3a32, cap: 0x7e2a24, weapon: "rifle", face: true }) },
  brute:   { hpMul: 3.4, sp: 0.55, scale: 1.45, loss: h => Math.round(h / 3), cap: 40, radius: 1.1,
             geo: soldierGeo({ cloth: 0x8c2b24, vest: 0x4a4e54, cap: 0x3a3d42, bulk: 1.5, weapon: "minigun", plates: true, face: true }) },
  raptor:  { hpMul: 1.7, sp: 2.6, scale: 1, loss: h => 8, cap: 30, radius: 0.9,
             beast: true, barH: 2.2, color: 0xa8743e, geo: raptorGeo() },
  trike:   { hpMul: 13, sp: 0.8, scale: 1.1, loss: h => 22, cap: 8, radius: 2.1,
             beast: true, chomp: true, barH: 3.3, color: 0x7d8568, geo: trikeGeo() },
  rex:     { hpMul: 30, sp: 1.1, scale: 1.25, loss: h => 35, cap: 6, radius: 2.6,
             beast: true, chomp: true, barH: 5.2, color: 0x9aa05e, geo: rexGeo() },
};
for (const k in FOE_TYPES) FOE_TYPES[k].mesh = makeInstanced(FOE_TYPES[k].geo, vcMat(), FOE_TYPES[k].cap);

const legsMesh = makeInstanced(legGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), 800);
legsMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(800 * 3), 3);
const LEG_ALLY = new THREE.Color(0x8f8060), LEG_FOE = new THREE.Color(0x4a4038);

// Projectiles : un style par arme
// Missile de bazooka : corps, ogive rouge, ailettes — pointe vers -z
const rocketGeo = mergeGeometries([
  part(CYL, 0x6e7560, [0, 0, 0.1], [Math.PI / 2, 0, 0], [0.12, 0.7, 0.12]),
  part(CONE, 0xd23b2f, [0, 0, -0.4], [-Math.PI / 2, 0, 0], [0.12, 0.3, 0.12]),
  part(BOX, 0x3a3f35, [0.16, 0, 0.38], [0, 0, 0], [0.18, 0.04, 0.2]),
  part(BOX, 0x3a3f35, [-0.16, 0, 0.38], [0, 0, 0], [0.18, 0.04, 0.2]),
  part(BOX, 0x3a3f35, [0, 0.16, 0.38], [0, 0, 0], [0.04, 0.18, 0.2]),
  part(CYL, 0xff9d2e, [0, 0, 0.52], [Math.PI / 2, 0, 0], [0.07, 0.1, 0.07]),
]);
const bulletMeshes = [
  // FUSIL : traceur jaune effilé
  makeInstanced(new THREE.CapsuleGeometry(0.08, 0.5, 2, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe24a }), 400),
  // MINIGUN : traceur orange dense
  makeInstanced(new THREE.CapsuleGeometry(0.11, 0.6, 2, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff9d2e }), 400),
  // BAZOOKA : missile détaillé
  makeInstanced(rocketGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), 60),
  // LASER : long faisceau rouge
  makeInstanced(new THREE.CapsuleGeometry(0.06, 2.2, 2, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2e4d }), 400),
  // PLASMA : orbe verte (pulse au rendu)
  makeInstanced(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0x4dff7a }), 400),
  // TANK : obus traçant épais
  makeInstanced(new THREE.CapsuleGeometry(0.16, 0.8, 2, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc24a }), 400),
  // RAILGUN : très long trait perforant bleu-blanc
  makeInstanced(new THREE.CapsuleGeometry(0.05, 3.2, 2, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc9ecff }), 200),
  // AVIONS : traceurs bleus rapides
  makeInstanced(new THREE.CapsuleGeometry(0.09, 0.9, 2, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6fd9ff }), 400),
];

const partMesh = makeInstanced(
  new THREE.BoxGeometry(0.22, 0.22, 0.22),
  new THREE.MeshBasicMaterial({ color: 0xffffff }), 300);
partMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(300 * 3), 3);

// Barres de vie instanciées (mode immédiat : reconstruites chaque frame)
const BAR_CAP = 180;
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
// Drapeau de renfort bleu : passe dessus pour gagner des soldats
const flagGeo = mergeGeometries([
  part(CYL, 0xd8d2c2, [0, 0, 0], [0, 0, 0], [0.05, 2.4, 0.05]),
  part(BOX, 0x2f8bff, [0.55, 0.78, 0], [0, 0, 0], [1.05, 0.7, 0.06]),
  part(SPH, 0xffd84d, [0, 1.26, 0], [0, 0, 0], [0.1, 0.1, 0.1]),
]);
const flagMat = new THREE.MeshBasicMaterial({ vertexColors: true });
// Mine : à faire sauter de loin, sinon elle explose sous la squad
const mineGeo = mergeGeometries([
  part(CYL, 0x2c2f33, [0, 0.12, 0], [0, 0, 0], [0.55, 0.24, 0.55]),
  part(SPH, 0xff3030, [0, 0.3, 0], [0, 0, 0], [0.12, 0.12, 0.12]),
  part(BOX, 0x4a4e54, [0, 0.05, 0], [0, 0, 0], [0.85, 0.1, 0.85]),
]);
const mineMat = new THREE.MeshBasicMaterial({ vertexColors: true });

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
  badge.position.set(x, TIERS[G.tier].jet ? 5.4 : 3.1, SQUAD_Z + 1.2);
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
  squadX: 0, targetX: 0, stepPhase: 0, moveAmt: 0, stepDir: 1,
  tier: 0, dmgMul: 1, rateMul: 1, armor: 0,
  gates: [], foes: [], bullets: [], parts: [], texts: [], crates: [], walls: [], pickups: [],
  gateTimer: 1.4, foeTimer: 2.0, hordeTimer: 8, monsterTimer: 22, crateTimer: 5, wallTimer: 16, flagTimer: 15, mineTimer: 14, volleyTimer: 0,
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

function spawnGatePair(z = SPAWN_Z) {
  const t = G.t;
  const base = 2.5 + t * 0.5; // les portes suivent l'attrition de fin de partie
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
  const ga = { ...a, pair: id, x: -LANE_HALF / 2, z, done: false };
  const gb = { ...b, pair: id, x: LANE_HALF / 2, z, done: false };
  makeGateMesh(ga); makeGateMesh(gb);
  G.gates.push(ga, gb);
}

// ---------- Ennemis individuels ----------
function spawnFoe(type, x, z, hpMul = 1) {
  if (G.foes.length > 130) return;
  const T = FOE_TYPES[type];
  const hp = unitHp(G.t) * T.hpMul * hpMul;
  G.foes.push({
    type, x, z, hp, maxHp: hp,
    scale: T.scale,
    sp: (2.2 + G.t * 0.022 + Math.random() * 1.2) * T.sp,
    wob: Math.random() * 6.28,
    radius: T.radius,
    bite: 0,
  });
  if (T.chomp) sRoar();
}
// Colonne de soldats qui marchent vers nous (comme la vidéo)
function spawnColumn(type, x, n, zBase = SPAWN_Z) {
  for (let i = 0; i < n; i++)
    spawnFoe(type, x + (Math.random() - 0.5) * 1.4, zBase - i * 3 - Math.random() * 1.5);
}
function pickFoeType(t) {
  const r = Math.random();
  if (t > 18 && r < 0.14 + t / 450) return "brute";
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
    hp: kind === "barrel" ? unitHp(t) * 1.5 : kind === "mine" ? unitHp(t) * 1.2 : unitHp(t) * 3.5,
    reward: kind === "crate" ? crateReward(t) : null,
  };
  c.maxHp = c.hp;
  const geos = { barrel: [barrelGeo, barrelMat], mine: [mineGeo, mineMat], crate: [crateGeo, crateMat] };
  c.mesh = new THREE.Mesh(geos[kind][0], geos[kind][1]);
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
// Objets à ramasser : arme dorée (palier suivant) ou drapeau de renfort (+soldats)
function spawnPickup(kind = "weapon") {
  const p = {
    kind, x: randX(), z: SPAWN_Z,
    mesh: kind === "flag" ? new THREE.Mesh(flagGeo, flagMat) : new THREE.Mesh(pickupGeo, pickupMat),
  };
  p.mesh.position.set(p.x, kind === "flag" ? 1.2 : 1.6, p.z);
  p.mesh.scale.setScalar(kind === "flag" ? 1.6 : 2);
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
  if (g.op === "dmg") { G.dmgMul = Math.min(4, G.dmgMul * (1 + g.v / 100)); str = `DÉGÂTS +${g.v}%`; }
  if (g.op === "rate") { G.rateMul = Math.min(2.4, G.rateMul * (1 + g.v / 100)); str = `CADENCE +${g.v}%`; }
  if (g.op === "arm") { G.armor = Math.min(3, G.armor + 1); str = "ARMURE ↑"; }
  if (g.op === "wpn") { G.tier = Math.min(maxTierNow(), G.tier + 1); str = TIERS[G.tier].name + " !"; sWeapon(); }
  if (G.count > 999) { G.count = 999; str = "MAX"; }
  G.maxCount = Math.max(G.maxCount, G.count);
  ftext(str, isUpgrade(g) ? "#ffd84d" : good ? "#5fb6ff" : "#ff5f6b", good);
  burst(G.squadX, 2, SQUAD_Z, good ? 0x5fb6ff : 0xff5f6b, 16, 11);
  if (g.op !== "wpn") (good ? sGateGood : sGateBad)();
  refreshWeaponHud();
  if (G.count <= 0) gameOver();
}

// Explosion de zone (missiles, plasma) : dégâts aux ennemis dans le rayon
let lastBlast = 0;
function blast(x, z, dmg, radius, exclude = null) {
  burst(x, 1.2, z, 0xff7a2e, 12, 11);
  const n = performance.now();
  if (n - lastBlast > 90) { lastBlast = n; tone(70, 0.18, "sawtooth", 0.3, 0, -30); }
  for (let j = G.foes.length - 1; j >= 0; j--) {
    const f = G.foes[j];
    if (f === exclude) continue;
    if (Math.abs(f.x - x) < radius && Math.abs(f.z - z) < radius) {
      f.hp -= dmg;
      if (f.hp <= 0) {
        const T = FOE_TYPES[f.type];
        G.kills++;
        burst(f.x, 1.5, f.z, T.beast ? T.color : 0xd23b2f, 8, 9);
        G.foes.splice(j, 1);
      }
    }
  }
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
  // Après 3000 m, la vitesse s'emballe
  const scroll = scrollSpeed(t) + (G.meters > 3000 ? Math.min(45, (G.meters - 3000) * 0.02) : 0);
  G.meters += scroll * dt * 0.5;

  if (keys.has("ArrowLeft")) G.targetX -= 22 * dt;
  if (keys.has("ArrowRight")) G.targetX += 22 * dt;
  G.targetX = Math.max(-LANE_HALF + 1.2, Math.min(LANE_HALF - 1.2, G.targetX));
  const prevX = G.squadX;
  G.squadX += (G.targetX - G.squadX) * Math.min(1, dt * 12);
  // Pas chassé : intensité et cadence pilotées par la vitesse latérale
  const vx = (G.squadX - prevX) / dt;
  G.stepDir = vx < 0 ? -1 : 1;
  G.stepPhase += Math.abs(vx) * dt * 2.4;
  const moveTarget = Math.min(1, Math.abs(vx) / 7);
  G.moveAmt += (moveTarget - G.moveAmt) * Math.min(1, dt * 10);

  // Spawns
  if ((G.gateTimer -= dt) <= 0) { G.gateTimer = gateIv(t); spawnGatePair(); }
  if ((G.foeTimer -= dt) <= 0) {
    G.foeTimer = enemyIv(t);
    const type = pickFoeType(t);
    if (type === "soldier") spawnColumn("soldier", randX(), Math.min(12, 2 + Math.floor(t / 16)));
    else if (type === "runner") spawnColumn("runner", randX(), 1 + Math.floor(Math.random() * 3));
    else spawnFoe("brute", randX(), SPAWN_Z);
    // colonne d'appoint : densité visuelle
    if (t > 15 && Math.random() < 0.35) spawnColumn("soldier", randX(), 2 + Math.floor(Math.random() * 3));
    if (t > 8 && Math.random() < 0.18) spawnCrate(randX(), "barrel");
  }
  if (t > 10 && (G.hordeTimer -= dt) <= 0) {
    G.hordeTimer = Math.max(3, 7.5 - t * 0.022);
    const k = 4 + Math.floor(t / 24);
    for (let i = 0; i < k; i++)
      spawnFoe(Math.random() < 0.3 ? "runner" : "soldier",
        -LANE_HALF + 1.8 + (i + 0.5) * (LANE_HALF * 2 - 3.6) / k, SPAWN_Z - Math.random() * 6, 0.9);
  }
  // Événements monstres : meute de raptors, tricératops ou T-Rex boss
  if (t > 20 && (G.monsterTimer -= dt) <= 0) {
    G.monsterTimer = Math.max(7, 15 - t * 0.03);
    const r = Math.random();
    if (r < 0.42) {
      const n = 2 + Math.floor(Math.random() * 2 + t / 35);
      for (let i = 0; i < n; i++) spawnFoe("raptor", randX(), SPAWN_Z - Math.random() * 10);
    } else if (r < 0.74) {
      spawnFoe("trike", randX(), SPAWN_Z);
      if (t > 60) spawnFoe("trike", randX(), SPAWN_Z - 14);
    } else {
      spawnFoe("rex", randX(), SPAWN_Z, 1 + t / 120); // le boss grossit avec le temps
    }
  }
  if ((G.crateTimer -= dt) <= 0) {
    G.crateTimer = 5 + Math.random() * 4;
    spawnCrate(randX(), "crate");
    if (Math.random() < 0.3) spawnCrate(randX(), "crate");
  }
  if (t > 16 && (G.wallTimer -= dt) <= 0) { G.wallTimer = 12 + Math.random() * 5; spawnWall(); }
  // Une nouvelle arme tous les 800 m (spawn 150 m en avance pour arriver pile au palier ; réapparaît si ratée)
  if (G.tier < maxTierNow() && G.meters >= (G.tier + 1) * 800 - 150 && !G.pickups.some(p => p.kind === "weapon"))
    spawnPickup("weapon");
  if (t > 12 && (G.flagTimer -= dt) <= 0) { G.flagTimer = 13 + Math.random() * 6; spawnPickup("flag"); }
  if (t > 12 && (G.mineTimer -= dt) <= 0) {
    G.mineTimer = Math.max(6, 11 - t * 0.02);
    spawnCrate(randX(), "mine");
    if (Math.random() < 0.4) spawnCrate(randX(), "mine");
  }

  // Tir automatique
  if ((G.volleyTimer -= dt) <= 0) {
    const W = TIERS[G.tier];
    G.volleyTimer = 1 / volleyRate();
    const streams = Math.max(1, Math.min(W.streamsMax, Math.ceil(G.count / 4)));
    const dmg = dpsNow() / volleyRate() / streams;
    const spread = Math.min(squadRadius(), 2.6);
    const fy = W.jet ? 2.6 : 1.4;
    for (let i = 0; i < streams && G.bullets.length < 380; i++) {
      const fx = G.squadX + (streams === 1 ? 0 : (i / (streams - 1) - 0.5) * 2 * spread);
      G.bullets.push({ x: fx, y: fy, z: SQUAD_Z - 1.5, dmg, tier: G.tier });
    }
    if (W.name === "BAZOOKA") tone(80, 0.2, "sawtooth", 0.22, 0, -40); // départ de missile
    // Gerbes de bouche aux couleurs de l'arme
    for (let i = 0; i < Math.min(3, streams) && G.parts.length < 260; i++) {
      const fx = G.squadX + (Math.random() - 0.5) * spread * 2;
      G.parts.push({ x: fx, y: 1.5, z: SQUAD_Z - 1.8, vx: 0, vy: 2.5, vz: -16, life: 0.14, t: 0.14, color: W.flash });
    }
  }

  // Balles
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    const W = TIERS[b.tier];
    // Roquettes à tête chercheuse : elles courbent vers l'ennemi le plus proche devant
    if (W.homing) {
      let best = null, bd = 1e9;
      for (const f of G.foes) {
        if (f.z > b.z - 1) continue;
        const d = Math.abs(f.x - b.x) + (b.z - f.z) * 0.25;
        if (d < bd) { bd = d; best = f; }
      }
      if (best) {
        const step = 30 * dt;
        b.x += Math.max(-step, Math.min(step, best.x - b.x));
      }
    }
    b.z -= (W.bsp + scroll) * dt;
    let dead = b.z < SPAWN_Z;

    // Traînée de flammes des missiles
    if (W.name === "BAZOOKA" && G.parts.length < 280) {
      G.parts.push({
        x: b.x + (Math.random() - 0.5) * 0.15, y: b.y, z: b.z + 0.7,
        vx: 0, vy: 1.5, vz: 6, life: 0.22, t: 0.22,
        color: Math.random() < 0.5 ? 0xff9d2e : 0xffd84d,
      });
    }

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
      if (W.aoe) blast(b.x, b.z, b.dmg * W.aoe.f, W.aoe.r);
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
      if (W.aoe) blast(b.x, b.z, b.dmg * W.aoe.f, W.aoe.r);
      if (c.hp <= 0) {
        removeCrate(c);
        G.crates.splice(j, 1);
        if (c.kind === "barrel") explodeBarrel(c);
        else if (c.kind === "mine") {
          // mine détruite à distance : elle saute et blesse les ennemis proches
          blast(c.x, c.z, unitHp(t) * 10, 5);
          boom();
        } else {
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
      if (W.pierce && b.hits && b.hits.includes(f)) continue; // déjà transpercé
      if (Math.abs(b.x - f.x) < f.radius + 0.45 && Math.abs(b.z - f.z) < f.radius + 0.9) {
        f.hp -= b.dmg;
        if (W.pierce) {
          // le trait du railgun transperce jusqu'à W.pierce ennemis
          (b.hits = b.hits || []).push(f);
          if (b.hits.length >= W.pierce) dead = true;
        } else {
          dead = true;
        }
        if (W.aoe) blast(b.x, b.z, b.dmg * W.aoe.f, W.aoe.r, f);
        if (f.hp <= 0) {
          const T = FOE_TYPES[f.type];
          G.kills++;
          burst(f.x, 1.5, f.z, T.beast ? T.color : 0xd23b2f, T.chomp ? 30 : 8, T.chomp ? 16 : 9);
          sPop();
          const idx = G.foes.indexOf(f); // le blast peut avoir décalé les indices
          if (idx !== -1) G.foes.splice(idx, 1);
        }
        if (dead) break;
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
      if (p.kind === "flag") {
        const gain = Math.max(5, Math.round((2.5 + t * 0.5) * 1.2));
        G.count = Math.min(999, G.count + gain);
        G.maxCount = Math.max(G.maxCount, G.count);
        ftext("+" + gain, "#5fb6ff");
        burst(p.x, 1.6, p.z, 0x2f8bff, 16, 10);
        sGateGood();
      } else {
        G.tier = Math.min(maxTierNow(), G.tier + 1);
        ftext(TIERS[G.tier].name + " !", "#ffd84d", true);
        burst(p.x, 1.6, p.z, 0xffe24a, 22, 12);
        sWeapon();
        if (TIERS[G.tier].tank || TIERS[G.tier].jet) { boom(); G.shake = 1.2; } // transformation !
        refreshWeaponHud();
      }
      scene.remove(p.mesh);
      G.pickups.splice(i, 1);
    } else if (p.z > KILL_Z) {
      scene.remove(p.mesh);
      G.pickups.splice(i, 1);
    }
  }

  // Caisses / barils / mines
  for (let i = G.crates.length - 1; i >= 0; i--) {
    const c = G.crates[i];
    c.z += scroll * dt;
    c.mesh.position.z = c.z;
    if (c.kind === "mine" && c.z > SQUAD_Z - 1 && Math.abs(c.x - G.squadX) < squadRadius() * 0.7 + 0.8) {
      // marché sur une mine !
      removeCrate(c);
      G.crates.splice(i, 1);
      burst(c.x, 1, c.z, 0xff7a2e, 24, 14);
      boom();
      hitSquad(Math.min(40, 8 + t * 0.15));
      if (G.state !== "playing") return;
    } else if (c.z > KILL_Z) {
      removeCrate(c);
      G.crates.splice(i, 1);
    }
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

  // Ennemis : ils MARCHENT vers nous (un peu moins vite)
  const sr = squadRadius();
  for (let i = G.foes.length - 1; i >= 0; i--) {
    const f = G.foes[i];
    const T = FOE_TYPES[f.type];
    f.z += (scroll * 0.38 + f.sp) * dt;
    f.x += Math.sin(t * 2.4 + f.wob) * 0.4 * dt;
    f.x = Math.max(-LANE_HALF + 1, Math.min(LANE_HALF - 1, f.x));
    f.bite -= dt;
    if (f.z > SQUAD_Z - 1.2 && Math.abs(f.x - G.squadX) < f.radius + sr) {
      if (T.chomp) {
        // les gros dinos mordent par vagues et encaissent la riposte
        if (f.bite <= 0) {
          f.bite = 0.9;
          f.hp -= dpsNow() * 0.5;
          hitSquad(T.loss(f.hp));
          if (G.state !== "playing") return;
          if (f.hp <= 0) { G.kills++; burst(f.x, 2, f.z, T.color, 30, 16); G.foes.splice(i, 1); }
        }
      } else {
        hitSquad(T.loss(f.hp));
        G.foes.splice(i, 1);
        if (G.state !== "playing") return;
      }
    } else if (f.z > SQUAD_Z + 1.6) {
      // Passé derrière sans être tué : il nous attaque dans le dos
      hitSquad(T.loss(f.hp));
      G.foes.splice(i, 1);
      if (G.state !== "playing") return;
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
/* mode "walk" (ennemis) : jambes qui courent vers l'avant.
   mode "side" (squad) : pas chassé latéral, seulement quand on se déplace. */
function placeHumanoid(mesh, idx, x, z, scale, phase, lean, legColor, side = null) {
  const swing = Math.sin(phase);
  const amt = side ? side.amt : 1;
  const bob = Math.abs(Math.cos(phase)) * 0.07 * scale * amt;
  dummy.position.set(x, bob, z);
  dummy.rotation.set(lean, 0, side ? side.lean : 0);
  dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  mesh.setMatrixAt(idx, dummy.matrix);
  for (const s of [-1, 1]) {
    if (legCursor >= 800) return;
    dummy.position.set(x + s * 0.13 * scale, 0.72 * scale + bob, z);
    if (side) dummy.rotation.set(0, 0, swing * 0.55 * s * amt + side.lean);
    else dummy.rotation.set(swing * 0.75 * s, 0, 0);
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

  // Squad : soldats, chars (TANK) ou avions de chasse (AVIONS)
  const isTank = TIERS[G.tier].tank;
  const isJet = TIERS[G.tier].jet;
  const visible = Math.min(G.count, isJet ? 24 : isTank ? 40 : 80);
  for (let ti = 0; ti < allyMeshes.length; ti++) if (allyMeshes[ti]) allyMeshes[ti].count = ti === G.tier ? visible : 0;
  const side = { amt: G.moveAmt || 0, lean: -(G.stepDir || 1) * 0.1 * (G.moveAmt || 0) };
  if (isJet) {
    for (let i = 0; i < visible; i++) {
      const o = SLOTS[i];
      dummy.position.set(
        G.squadX + o.x * 2.6,
        2.6 + Math.sin(now * 0.005 + i * 1.3) * 0.3,
        SQUAD_Z + o.z * 2.4);
      dummy.rotation.set(-0.06, 0, side.lean * 2.2);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      jetMesh.setMatrixAt(i, dummy.matrix);
      // flamme de réacteur sur les premiers avions
      if (i < 6 && Math.random() < 0.4 && G.parts.length < 290) {
        G.parts.push({
          x: G.squadX + o.x * 2.6, y: 2.6 + Math.sin(now * 0.005 + i * 1.3) * 0.3, z: SQUAD_Z + o.z * 2.4 + 1.2,
          vx: 0, vy: 0.5, vz: 9, life: 0.16, t: 0.16, color: 0xff9d2e,
        });
      }
    }
    jetMesh.count = visible;
    tankMesh.count = 0;
  } else if (isTank) {
    for (let i = 0; i < visible; i++) {
      const o = SLOTS[i];
      dummy.position.set(G.squadX + o.x * 2, Math.abs(Math.sin(now * 0.004 + i)) * 0.05, SQUAD_Z + o.z * 2.1);
      dummy.rotation.set(0, 0, side.lean * 0.6);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      tankMesh.setMatrixAt(i, dummy.matrix);
    }
    tankMesh.count = visible;
    jetMesh.count = 0;
  } else {
    const am = allyMeshes[G.tier];
    for (let i = 0; i < visible; i++) {
      const o = SLOTS[i];
      placeHumanoid(am, i, G.squadX + o.x, SQUAD_Z + o.z, 1,
        (G.stepPhase || 0) + i * 0.9, 0.08, LEG_ALLY, side);
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
    tankMesh.count = 0;
    jetMesh.count = 0;
  }
  tankMesh.instanceMatrix.needsUpdate = true;
  jetMesh.instanceMatrix.needsUpdate = true;
  plateMesh.count = !isTank && !isJet && G.armor > 0 ? visible : 0;
  plateMesh.instanceMatrix.needsUpdate = true;
  if (plateMesh.instanceColor) plateMesh.instanceColor.needsUpdate = true;
  if (G.state === "playing") updateBadge(G.count, G.squadX);

  // Ennemis (chacun sa barre de vie, comme la vidéo)
  const cursors = {};
  for (const k in FOE_TYPES) { FOE_TYPES[k].mesh.count = 0; cursors[k] = 0; }
  for (const f of G.foes) {
    const T = FOE_TYPES[f.type];
    if (cursors[f.type] >= T.cap) continue;
    if (T.beast) {
      dummy.position.set(f.x, Math.abs(Math.sin(now * 0.006 + f.wob)) * 0.15, f.z);
      dummy.rotation.set(0, Math.sin(now * 0.003 + f.wob) * 0.08, Math.sin(now * 0.005 + f.wob) * 0.04);
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      T.mesh.setMatrixAt(cursors[f.type]++, dummy.matrix);
      pushBar(f.x, T.barH * f.scale, f.z, T.chomp ? 4 : 2, f.hp / f.maxHp);
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

  // Projectiles par style (l'orbe plasma pulse)
  const bCur = bulletMeshes.map(() => 0);
  for (const b of G.bullets) {
    const m = bulletMeshes[b.tier];
    if (bCur[b.tier] >= m.instanceMatrix.count) continue;
    dummy.position.set(b.x, b.y, b.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(TIERS[b.tier].name === "PLASMA" ? 1 + 0.3 * Math.sin(now * 0.02 + b.x * 3) : 1);
    dummy.updateMatrix();
    m.setMatrixAt(bCur[b.tier]++, dummy.matrix);
  }
  for (let i = 0; i < bulletMeshes.length; i++) {
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
    squadX: 0, targetX: 0, stepPhase: 0, moveAmt: 0, stepDir: 1,
    tier: 0, dmgMul: 1, rateMul: 1, armor: 0,
    gateTimer: 1.4, foeTimer: 2.0, hordeTimer: 8, monsterTimer: 22, crateTimer: 5, wallTimer: 16, flagTimer: 15, mineTimer: 14, volleyTimer: 0,
    shake: 0, pairSeq: 0,
  });
  refreshWeaponHud();
}

function startGame() {
  audioInit();
  reset();
  G.state = "playing";
  // Monde pré-rempli : première porte à ~3 s, premiers ennemis tout de suite visibles
  spawnGatePair(-70);
  spawnGatePair(-150);
  spawnColumn("soldier", randX(), 3, -100);
  spawnColumn("runner", randX(), 2, -60);
  spawnCrate(randX(), "crate");
  G.crates[G.crates.length - 1].z = -120;
  G.crates[G.crates.length - 1].mesh.position.z = -120;
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

/* GATE RUSH — runner 3D type "pub fake Last War" (Three.js).
   Le pont défile vers la caméra ; la squad reste à z≈0. */
import * as THREE from "three";

// ---------- Constantes monde ----------
const LANE_HALF = 8;        // demi-largeur jouable du pont
const SQUAD_Z = 0;
const SPAWN_Z = -240;       // où apparaissent portes/ennemis
const KILL_Z = 14;          // sortie d'écran derrière la caméra

// ---------- Difficulté (le cœur du "ça monte vite") ----------
const scrollSpeed = t => 26 + t * 0.5;                       // unités/s
const unitHp      = t => 2 + Math.pow(t, 1.5) / 10;          // hp par soldat rouge
const enemyIv     = t => Math.max(0.4, 1.5 - t * 0.02);      // s entre spawns
const gateIv      = t => Math.max(2.2, 3.6 - t * 0.022);
const squadDPS    = c => 6 + c * 2.6;

// ---------- Scène ----------
const cvs = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
const SKY = 0x9fd4f5;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 90, 230);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);
camera.position.set(0, 13, 17);
camera.lookAt(0, 0, -26);

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

// ---------- Textures procédurales ----------
function canvasTexture(draw, w = 256, h = 256) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const tx = new THREE.CanvasTexture(c);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
const stoneTex = canvasTexture((g, w, h) => {
  g.fillStyle = "#8e9296"; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const off = (y % 2) * 32;
    const v = 128 + Math.floor(Math.random() * 26);
    g.fillStyle = `rgb(${v},${v + 3},${v + 6})`;
    g.fillRect(x * 64 + off + 2, y * 64 + 2, 60, 60);
  }
});
stoneTex.repeat.set(3, 60);
const wallTex = canvasTexture((g, w, h) => {
  g.fillStyle = "#7c8084"; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) {
    const off = (y % 2) * 32;
    const v = 110 + Math.floor(Math.random() * 24);
    g.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    g.fillRect(x * 64 + off + 2, y * 128 + 4, 60, 120);
  }
});
wallTex.repeat.set(40, 1);

// Mer
const sea = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshLambertMaterial({ color: 0x2f6fae })
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -7;
scene.add(sea);

// Pont
const floorMat = new THREE.MeshLambertMaterial({ map: stoneTex });
const floor = new THREE.Mesh(new THREE.BoxGeometry(LANE_HALF * 2 + 4, 2, 420), floorMat);
floor.position.set(0, -1, -170);
scene.add(floor);
const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
for (const side of [-1, 1]) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 420), wallMat);
  wall.position.set(side * (LANE_HALF + 1.4), 0.8, -170);
  scene.add(wall);
  // Piles du pont
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 8, 2.4),
      new THREE.MeshLambertMaterial({ color: 0x6e7276 }));
    p.position.set(side * (LANE_HALF - 0.2), -4.5, -i * 48 - 10);
    scene.add(p);
  }
}

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

const bodyGeo = new THREE.CapsuleGeometry(0.34, 0.62, 3, 8);
const headGeo = new THREE.SphereGeometry(0.23, 8, 8);
const allyBody = makeInstanced(bodyGeo, new THREE.MeshLambertMaterial({ color: 0x2f7fe0 }), 80);
const allyHead = makeInstanced(headGeo, new THREE.MeshLambertMaterial({ color: 0xdfeaff }), 80);
const foeBody = makeInstanced(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xd83a3a }), 260);
const foeHead = makeInstanced(headGeo, new THREE.MeshLambertMaterial({ color: 0x5e1414 }), 260);
const bulletMesh = makeInstanced(
  new THREE.SphereGeometry(0.24, 6, 6),
  new THREE.MeshBasicMaterial({ color: 0xffd84d }), 400);
const partMesh = makeInstanced(
  new THREE.BoxGeometry(0.22, 0.22, 0.22),
  new THREE.MeshBasicMaterial({ color: 0xffffff }), 300);
partMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(300 * 3), 3);

// Barres de vie ennemies (pool)
const hpPool = [];
function getHpBar() {
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
  return b;
}
function freeHpBar(b) { if (b) { b.used = false; b.grp.visible = false; } }

// ---------- Sprites texte (portes, textes flottants, badge) ----------
function textSprite(str, color, fontPx = 90, outline = true) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 220;
  const g = c.getContext("2d");
  g.font = `900 ${fontPx}px system-ui, sans-serif`;
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
  scene.remove(sp);
}

// Badge du compte de soldats
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
const sGateGood = () => { tone(520, 0.09, "square", 0.18); tone(780, 0.12, "square", 0.18, 0.07); };
const sGateBad  = () => tone(300, 0.25, "sawtooth", 0.2, 0, -180);
let lastPop = 0;
const sPop = () => { const n = performance.now(); if (n - lastPop > 70) { lastPop = n; tone(160, 0.07, "triangle", 0.12, 0, -60); } };
const sHit  = () => tone(90, 0.18, "sawtooth", 0.3, 0, -40);
const sOver = () => { tone(440, 0.18, "square", 0.2); tone(330, 0.18, "square", 0.2, 0.16); tone(220, 0.4, "square", 0.2, 0.32, -60); };

// ---------- État ----------
const G = {
  state: "menu", t: 0, meters: 0, count: 1, kills: 0, maxCount: 1,
  squadX: 0, targetX: 0,
  gates: [], foes: [], bullets: [], parts: [], texts: [],
  gateTimer: 1.4, foeTimer: 2.2, hordeTimer: 9, bossTimer: 24, volleyTimer: 0,
  shake: 0, pairSeq: 0,
};

// ---------- Entrées (drag relatif comme dans les pubs) ----------
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
const gateGeo = new THREE.PlaneGeometry(LANE_HALF - 0.3, 4.6);

function gateLabel(g) { return (g.op === "/" ? "÷" : g.op) + g.v; }

function makeGateMesh(g) {
  const good = g.op === "+" || g.op === "x";
  const grp = new THREE.Group();
  const panel = new THREE.Mesh(gateGeo, (good ? gateMatGood : gateMatBad).clone());
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(gateGeo),
    new THREE.LineBasicMaterial({ color: good ? 0x9fd0ff : 0xffaab2 }));
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
  g.mesh.remove(g.label);
  disposeSprite(g.label);
  g.panel.material.dispose();
  scene.remove(g.mesh);
}

function spawnGatePair() {
  const t = G.t;
  const base = 3 + t * 0.45;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mkGood = big => Math.random() < 0.16
    ? { op: "x", v: 2 }
    : { op: "+", v: Math.max(1, Math.round(rnd(big ? 0.7 : 0.35, big ? 1.3 : 0.7) * base)) };
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

// ---------- Ennemis (squads rouges) ----------
function spawnFoe(x, n, hpMul = 1, boss = false) {
  const hpu = unitHp(G.t) * hpMul;
  const f = {
    x, z: SPAWN_Z + Math.random() * 14, n0: n, n,
    hpu, hp: hpu * n, maxHp: hpu * n,
    boss, scale: boss ? 3.1 : 1,
    sp: boss ? 1.5 : 2.5 + G.t * 0.045 + Math.random() * 1.6,
    wob: Math.random() * 6.28,
    bar: getHpBar(),
  };
  f.radius = boss ? 2.6 : 0.9 + Math.sqrt(n) * 0.5;
  G.foes.push(f);
}
const randX = () => -LANE_HALF + 1.6 + Math.random() * (LANE_HALF * 2 - 3.2);

// ---------- Particules / textes flottants ----------
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

// ---------- Portes : application ----------
const flashEl = document.getElementById("flash");
function applyGate(g) {
  let str = "", good = false;
  if (g.op === "+") { G.count += g.v; str = "+" + g.v; good = true; }
  if (g.op === "x") { G.count *= g.v; str = "x" + g.v; good = true; }
  if (g.op === "-") { G.count -= g.v; str = "-" + g.v; }
  if (g.op === "/") { G.count = Math.floor(G.count / g.v); str = "÷" + g.v; }
  if (G.count > 999) { G.count = 999; str = "MAX"; }
  G.maxCount = Math.max(G.maxCount, G.count);
  ftext(str, good ? "#5fb6ff" : "#ff5f6b", good);
  burst(G.squadX, 2, SQUAD_Z, good ? 0x5fb6ff : 0xff5f6b, 16, 11);
  good ? sGateGood() : sGateBad();
  if (G.count <= 0) gameOver();
}

// ---------- Update ----------
function update(dt) {
  const t = (G.t += dt);
  const scroll = scrollSpeed(t);
  G.meters += scroll * dt * 0.5;
  stoneTex.offset.y -= scroll * dt / 7;
  wallTex.offset.x -= scroll * dt / 10.5;

  if (keys.has("ArrowLeft")) G.targetX -= 22 * dt;
  if (keys.has("ArrowRight")) G.targetX += 22 * dt;
  G.targetX = Math.max(-LANE_HALF + 1.2, Math.min(LANE_HALF - 1.2, G.targetX));
  G.squadX += (G.targetX - G.squadX) * Math.min(1, dt * 12);

  // Spawns
  if ((G.gateTimer -= dt) <= 0) { G.gateTimer = gateIv(t); spawnGatePair(); }
  if ((G.foeTimer -= dt) <= 0) {
    G.foeTimer = enemyIv(t);
    spawnFoe(randX(), 1 + Math.floor(Math.random() * (1 + t / 12)));
  }
  if (t > 10 && (G.hordeTimer -= dt) <= 0) {
    G.hordeTimer = Math.max(4.5, 8 - t * 0.04);
    const k = 4 + Math.floor(t / 15);
    for (let i = 0; i < k; i++)
      spawnFoe(-LANE_HALF + 1.8 + (i + 0.5) * (LANE_HALF * 2 - 3.6) / k, 1 + Math.floor(t / 12), 0.9);
  }
  if (t > 18 && (G.bossTimer -= dt) <= 0) { G.bossTimer = 20; spawnFoe(randX(), 1, 20, true); }

  // Tir automatique
  if ((G.volleyTimer -= dt) <= 0) {
    G.volleyTimer = 1 / 8;
    const streams = Math.max(1, Math.min(8, Math.ceil(G.count / 4)));
    const dmg = squadDPS(G.count) / 8 / streams;
    const spread = Math.min(squadRadius(), 2.6);
    for (let i = 0; i < streams && G.bullets.length < 380; i++) {
      const fx = G.squadX + (streams === 1 ? 0 : (i / (streams - 1) - 0.5) * 2 * spread);
      G.bullets.push({ x: fx, y: 1.4, z: SQUAD_Z - 1.5, dmg });
    }
  }

  // Balles
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.z -= (90 + scroll) * dt;
    let dead = b.z < SPAWN_Z;

    // Une balle qui touche une porte la modifie (+1 / -1 vers 0), dans la limite
    // de 10 améliorations par porte, et est absorbée
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
      const mine = G.squadX < 0 === g.x < 0; // même moitié du pont
      for (const o of G.gates) if (o.pair === g.pair) {
        o.done = true;
        o.panel.material.opacity = 0.12;
      }
      const chosen = mine ? g : G.gates.find(o => o.pair === g.pair && o !== g);
      if (chosen) applyGate(chosen);
      if (G.state !== "playing") return;
    }
    if (g.z > KILL_Z) { removeGate(g); G.gates.splice(i, 1); }
  }

  // Ennemis
  const sr = squadRadius();
  for (let i = G.foes.length - 1; i >= 0; i--) {
    const f = G.foes[i];
    f.z += (scroll * 0.45 + f.sp) * dt;
    f.x += Math.sin(t * 2.4 + f.wob) * 0.5 * dt;
    f.x = Math.max(-LANE_HALF + 1, Math.min(LANE_HALF - 1, f.x));
    if (f.z > SQUAD_Z - 1.2 && Math.abs(f.x - G.squadX) < f.radius + sr) {
      const loss = Math.max(1, Math.min(60, Math.round(f.hp / 4)));
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

  // Particules
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vy -= 22 * dt;
    if ((p.life -= dt) <= 0) { G.parts[i] = G.parts[G.parts.length - 1]; G.parts.pop(); }
  }
  // Textes flottants
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
function render(now) {
  const t = G.t;

  // Squad
  const visible = Math.min(G.count, 80);
  allyBody.count = visible; allyHead.count = visible;
  for (let i = 0; i < visible; i++) {
    const o = SLOTS[i];
    const bob = G.state === "playing" ? Math.abs(Math.sin(now * 0.012 + i * 1.7)) * 0.16 : 0;
    const x = G.squadX + o.x, z = SQUAD_Z + o.z;
    dummy.position.set(x, 0.65 + bob, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    allyBody.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 1.45 + bob;
    dummy.updateMatrix();
    allyHead.setMatrixAt(i, dummy.matrix);
  }
  allyBody.instanceMatrix.needsUpdate = true;
  allyHead.instanceMatrix.needsUpdate = true;
  if (G.state === "playing") updateBadge(G.count, G.squadX);

  // Ennemis
  let fi = 0;
  for (const f of G.foes) {
    const k = Math.min(f.n, f.boss ? 1 : 12);
    for (let u = 0; u < k && fi < 260; u++) {
      const a = (u / k) * 6.28 + f.wob;
      const rr = u === 0 ? 0 : 0.55 + (u % 3) * 0.4;
      const bob = Math.abs(Math.sin(now * 0.011 + u * 2.1 + f.wob)) * 0.14;
      dummy.position.set(f.x + Math.cos(a) * rr, 0.65 * f.scale + bob, f.z + Math.sin(a) * rr * 0.7);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      foeBody.setMatrixAt(fi, dummy.matrix);
      dummy.position.y = 1.45 * f.scale + bob;
      dummy.updateMatrix();
      foeHead.setMatrixAt(fi, dummy.matrix);
      fi++;
    }
    // Barre de vie (seulement une fois l'ennemi touché, comme dans la pub)
    f.bar.grp.visible = f.hp < f.maxHp;
    f.bar.grp.position.set(f.x, f.boss ? 5.6 : 1.9 + f.radius * 0.4, f.z);
    f.bar.fg.scale.x = Math.max(0.02, f.hp / f.maxHp);
    f.bar.fg.position.x = -(1 - f.bar.fg.scale.x) * 1.5;
    f.bar.grp.quaternion.copy(camera.quaternion);
  }
  foeBody.count = fi; foeHead.count = fi;
  foeBody.instanceMatrix.needsUpdate = true;
  foeHead.instanceMatrix.needsUpdate = true;

  // Balles
  bulletMesh.count = G.bullets.length;
  for (let i = 0; i < G.bullets.length; i++) {
    const b = G.bullets[i];
    dummy.position.set(b.x, b.y, b.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    bulletMesh.setMatrixAt(i, dummy.matrix);
  }
  bulletMesh.instanceMatrix.needsUpdate = true;

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

  // Caméra : suit la squad + tremblement
  const shx = (Math.random() - 0.5) * G.shake, shy = (Math.random() - 0.5) * G.shake;
  camera.position.x = G.squadX * 0.55 + shx;
  camera.position.y = 13 + shy;
  camera.lookAt(G.squadX * 0.7, 0, -26);

  renderer.render(scene, camera);
}

// ---------- Cycle de vie ----------
const el = id => document.getElementById(id);

function clearWorld() {
  for (const g of G.gates) removeGate(g);
  for (const f of G.foes) freeHpBar(f.bar);
  for (const x of G.texts) disposeSprite(x.sp);
  G.gates = []; G.foes = []; G.bullets = []; G.parts = []; G.texts = [];
}

function reset() {
  clearWorld();
  Object.assign(G, {
    t: 0, meters: 0, count: 1, kills: 0, maxCount: 1,
    squadX: 0, targetX: 0,
    gateTimer: 1.4, foeTimer: 2.2, hordeTimer: 9, bossTimer: 24, volleyTimer: 0,
    shake: 0, pairSeq: 0,
  });
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
    `☠️ ${G.kills} ennemis · 🪖 armée max : ${G.maxCount} · ⏱ ${Math.floor(G.t)} s`;
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

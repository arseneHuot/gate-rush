/* Classement mondial — stockage JSON partagé (textdb.online, CORS ouvert).
   Pas d'authentification : c'est un classement de jeu casual, on garde le top 100. */
const LB = (() => {
  const KEY = "gaterush_lb_7Gv2c9pQx";
  const READ_URL = "https://textdb.online/" + KEY;
  const WRITE_URL = "https://textdb.online/update";
  const MAX_KEPT = 100;

  async function fetchBoard() {
    const r = await fetch(READ_URL + "?t=" + Date.now());
    if (!r.ok) throw new Error("HTTP " + r.status);
    let data;
    try { data = await r.json(); } catch { data = {}; }
    let scores = Array.isArray(data.scores) ? data.scores : [];
    // n'affiche jamais les scores implausibles injectés directement dans le stockage
    scores = scores.filter(plausible);
    return { scores, played: data.played || scores.length };
  }

  function sanitize(name) {
    return String(name).replace(/[<>&"'\\]/g, "").trim().slice(0, 14) || "Anonyme";
  }

  // Au-delà du plafond physiquement atteignable, c'est de la triche : on rejette.
  // Les scores légitimes sont des entiers (Math.floor) — tout le reste est injecté.
  const MAX_PLAUSIBLE = 12000;
  const plausible = s => s && typeof s.n === "string" && s.n.length <= 20
    && Number.isInteger(s.s) && s.s > 0 && s.s <= MAX_PLAUSIBLE;

  // Soumet un score ; renvoie { rank, total, top } (rank null si hors top 100).
  async function submit(name, score) {
    name = sanitize(name);
    score = Math.max(0, Math.floor(score));
    if (score > MAX_PLAUSIBLE) throw new Error("score implausible");
    const { scores, played } = await fetchBoard(); // fetchBoard filtre déjà les entrées injectées

    const entry = { n: name, s: score, d: new Date().toISOString().slice(0, 10) };
    scores.push(entry);
    scores.sort((a, b) => b.s - a.s);
    const kept = scores.slice(0, MAX_KEPT);

    const idx = kept.indexOf(entry);
    const rank = idx === -1 ? null : idx + 1;
    const total = played + 1;

    const payload = JSON.stringify({ scores: kept, played: total });
    const w = await fetch(WRITE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "key=" + KEY + "&value=" + encodeURIComponent(payload),
    });
    if (!w.ok) throw new Error("HTTP " + w.status);

    return { rank, total, top: kept.slice(0, 10), entry };
  }

  function renderTop(listEl, top, mine) {
    listEl.innerHTML = "";
    if (!top || !top.length) {
      const li = document.createElement("li");
      li.className = "dim";
      li.textContent = "Aucun score — sois le premier !";
      listEl.appendChild(li);
      return;
    }
    for (const e of top) {
      const li = document.createElement("li");
      if (mine && e === mine) li.className = "me";
      const nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = e.n;
      const sc = document.createElement("span");
      sc.className = "sc";
      sc.textContent = e.s.toLocaleString("fr-FR") + " m";
      li.append(nm, sc);
      listEl.appendChild(li);
    }
  }

  return { fetchBoard, submit, renderTop, sanitize };
})();

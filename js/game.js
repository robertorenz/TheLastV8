/* The Last V8 — game core: physics, collisions, rendering, dashboard, modals, speech. */
(function () {
  'use strict';

  const { LEVELS, T, TILE, buildLevel } = window.LastV8Levels;
  const Snd = window.LastV8Sound;
  const V = window.LastV8Vector;

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const canvas = $('#game');
  let ctx = canvas.getContext('2d'); // swapped to an offscreen context while rendering level previews
  const W = 960, H = 540; // logical view; the backing store follows the on-screen size so the picture stays sharp at any scale
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  function resizeCanvas() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    let fw = r.width, fh = r.width * H / W;
    if (fh > r.height) { fh = r.height; fw = r.height * W / H; }
    const bw = Math.min(3840, Math.round(fw * DPR)), bh = Math.round(bw * H / W);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(canvas.parentElement);

  const ui = {
    banner: $('#banner'), modal: $('#modal'), modalKicker: $('#modalKicker'), modalTitle: $('#modalTitle'),
    modalBody: $('#modalBody'), modalActions: $('#modalActions'), sector: $('#sector'),
    speedVal: $('#speedVal'), fuelBar: $('#fuelBar'), fuelVal: $('#fuelVal'), radBar: $('#radBar'), radVal: $('#radVal'),
    timeVal: $('#timeVal'), timerCard: $('#timerCard'), scoreVal: $('#scoreVal'), hiVal: $('#hiVal'), lives: $('#lives'),
    mini: $('#minimap'), btnPause: $('#btnPause'), btnSound: $('#btnSound'), btnHelp: $('#btnHelp'), btnFull: $('#btnFull'), gauge: $('#gauge'),
    touch: $('#touch'),
  };
  const mctx = ui.mini.getContext('2d');

  // ---------- persistence (per-browser conveniences only) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const settings = Object.assign({ sound: true, voice: true }, store.get('lastv8.settings', {}));

  // ---------- constants ----------
  const CAR_L = 26, CAR_W = 14;
  const TOP_SPEED = 410;
  const START_LIVES = 3, MAX_LIVES = 5;
  const PALETTES = {
    meadow: { bg: '#56c956', radGlow: '90,255,58', exit: '#f5a524', label: 'BASE' },
    river: { bg: '#2f4a22', wall: '#3a5a2a', wallDeep: '#2f4a22', wallHi: '#4f7a36', wallLo: '#1f3316', kerb: '#8a8378', road: '#3a3a3e', roadNoise: '#46464b', roadDark: '#2e2e32', rough: '#6f9a3c', roughSpeck: '#5a8030', dirt: '#8a6a3c', dirtSpeck: '#6e5330', dirtHi: '#a58453', water: '#1d5f8a', waterDeep: '#164a6e', waterHi: '#4a9bd0', bridge: '#7a5a34', bridgeDark: '#4e381f', bridgeHi: '#9a7848', rad: '#1f5a1a', radGlow: '90,255,58', exit: '#f5a524', label: 'TUNNEL' },
    sci: { bg: '#3540c4', wall: '#3f4bd6', wallDeep: '#3540c4', wallHi: '#98a6ff', wallLo: '#161c66', kerb: '#98a6ff', road: '#8c8c8c', roadNoise: '#969696', roadDark: '#828282', rough: '#6f6f6f', roughSpeck: '#5c5c5c', rad: '#1f5a1a', radGlow: '90,255,58', exit: '#7fdede', label: 'SCI-BASE' },
    surface: { bg: '#3b2f21', wall: '#5c4832', wallDeep: '#3b2f21', wallHi: '#7d6547', wallLo: '#2a2016', kerb: '#8f7452', road: '#2a2b2f', roadNoise: '#35363b', roadDark: '#232428', rough: '#8f7a4f', roughSpeck: '#6f5c3a', rad: '#1f5a1a', radGlow: '90,255,58', exit: '#f5a524', label: 'BASE' },
    base: { bg: '#0f151c', wall: '#2b3a4b', wallDeep: '#141c25', wallHi: '#46596d', wallLo: '#0d1217', kerb: '#f5c518', road: '#1b2129', roadNoise: '#242c36', roadDark: '#161b22', rough: '#3a4652', roughSpeck: '#2a343e', rad: '#1f5a1a', radGlow: '90,255,58', exit: '#2dd4bf', label: 'GARAGE' },
    core: { bg: '#1a0c0c', wall: '#4a2020', wallDeep: '#241010', wallHi: '#6e3030', wallLo: '#120606', kerb: '#f08a24', road: '#221616', roadNoise: '#2e1c1c', roadDark: '#1a1010', rough: '#5a3a2a', roughSpeck: '#3e2718', rad: '#1f5a1a', radGlow: '90,255,58', exit: '#f5a524', label: 'VAULT' },
  };

  // ---------- state ----------
  const G = {
    state: 'boot', levelIndex: 0, loop: 1, level: null, atlas: null, pal: null, mini: null,
    car: null, timeLeft: 0, score: 0, levelStartScore: 0, lives: START_LIVES, hi: store.get('lastv8.hi', 0),
    particles: [], cam: { x: 0, y: 0 }, shake: 0, t: 0, flash: 0, flashColor: '255,255,255',
    crashTimer: 0, crashReason: '', completeTimer: 0, completeShown: false, bonus: 0,
    said: {}, lastBeep: -1, fuelOutTimer: 0, respawn: null, attract: 0,
  };
  const keys = { up: false, down: false, left: false, right: false };
  let modalPrimary = null;
  let last = performance.now();

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Horizontal wrap-around for levels that loop (x lives in [0, Wpx)); no-ops on ordinary levels.
  const wrapX = (x) => { const L = G.level; return L && L.wrap ? ((x % L.Wpx) + L.Wpx) % L.Wpx : x; };
  const wrapDelta = (dx) => { const L = G.level; if (!L || !L.wrap) return dx; dx = ((dx % L.Wpx) + L.Wpx) % L.Wpx; return dx > L.Wpx / 2 ? dx - L.Wpx : dx; };
  const rx = (x) => (G.level && G.level.wrap) ? G.cam.x + wrapDelta(x - G.cam.x) : x; // world x unwrapped to sit next to the camera
  const buildAny = (def) => (def.kind === 'vector' ? V.buildVectorLevel(def) : buildLevel(def));
  const timeScale = () => Math.max(0.6, 1 - 0.12 * (G.loop - 1));
  const radScale = () => 1 + 0.25 * (G.loop - 1);
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- speech ----------
  let voice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find((v) => /^en[-_]GB/i.test(v.lang) && /male|daniel|george|ryan|arthur/i.test(v.name))
      || vs.find((v) => /^en/i.test(v.lang) && /david|mark|male/i.test(v.name))
      || vs.find((v) => /^en/i.test(v.lang)) || vs[0] || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); }
  function say(text) {
    if (!settings.voice || !settings.sound || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = 0.82; u.pitch = 0.25; u.volume = 1;
      speechSynthesis.speak(u);
    } catch (e) { /* speech unavailable */ }
  }

  function unlockAudio() { Snd.init(); Snd.resume(); Snd.setMuted(!settings.sound); }

  // ---------- tile atlas ----------
  function makeAtlas(theme) {
    const P = PALETTES[theme];
    const rnd = mulberry32(theme.length * 7919 + 17);
    const AR = 2; // tiles are drawn at 2x so they stay crisp when the view is scaled up on big screens
    const mk = (draw) => { const cv = document.createElement('canvas'); cv.width = cv.height = TILE * AR; const g = cv.getContext('2d'); g.scale(AR, AR); draw(g); return cv; };
    const speckle = (g, color, n, s) => { g.fillStyle = color; for (let i = 0; i < n; i++) g.fillRect(Math.floor(rnd() * TILE), Math.floor(rnd() * TILE), s, s); };

    const road = [0, 1, 2].map(() => mk((g) => {
      g.fillStyle = P.road; g.fillRect(0, 0, TILE, TILE);
      if (theme === 'surface') { speckle(g, P.roadNoise, 26, 2); speckle(g, P.roadDark, 14, 2); if (rnd() < 0.5) { g.strokeStyle = P.roadDark; g.lineWidth = 1; g.beginPath(); g.moveTo(rnd() * TILE, 0); g.lineTo(rnd() * TILE, TILE); g.stroke(); } }
      else { g.strokeStyle = P.roadNoise; g.lineWidth = 1; g.strokeRect(0.5, 0.5, TILE - 1, TILE - 1); speckle(g, P.roadDark, 8, 2); g.fillStyle = P.roadNoise; [[3, 3], [TILE - 6, 3], [3, TILE - 6], [TILE - 6, TILE - 6]].forEach(([x, y]) => g.fillRect(x, y, 2, 2)); }
    }));
    const rough = [0, 1].map(() => mk((g) => {
      g.fillStyle = P.rough; g.fillRect(0, 0, TILE, TILE);
      if (theme === 'river') { // grass: blades and a few darker tufts
        g.strokeStyle = P.roughSpeck; g.lineWidth = 1;
        for (let i = 0; i < 22; i++) { const x = rnd() * TILE, y = rnd() * TILE; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 3); g.stroke(); }
        speckle(g, '#86b24a', 10, 1);
      } else { speckle(g, P.roughSpeck, 30, 3); speckle(g, P.wallHi, 8, 2); }
    }));
    const dirtBase = P.dirt || P.rough, dirtSpeck = P.dirtSpeck || P.roughSpeck, dirtHi = P.dirtHi || P.wallHi;
    const dirt = [0, 1].map(() => mk((g) => { g.fillStyle = dirtBase; g.fillRect(0, 0, TILE, TILE); speckle(g, dirtSpeck, 22, 2); speckle(g, dirtHi, 12, 2); speckle(g, '#5a4526', 6, 3); }));
    const waterBase = P.water || '#1d5f8a', waterDeep = P.waterDeep || '#164a6e', waterHi = P.waterHi || '#4a9bd0';
    const glints = []; for (let i = 0; i < 7; i++) glints.push([rnd() * TILE, rnd() * TILE, 4 + rnd() * 6]);
    const water = [0, 1, 2, 3].map((f) => mk((g) => { // four frames of drifting glints, cycled per tile for a live surface
      g.fillStyle = waterBase; g.fillRect(0, 0, TILE, TILE);
      g.fillStyle = waterDeep; for (let i = 0; i < 4; i++) g.fillRect(Math.floor(rnd() * TILE), Math.floor(rnd() * TILE), 6, 2);
      g.fillStyle = waterHi;
      for (const [gx, gy, gl] of glints) { const x = (gx + f * 2.5) % TILE; g.fillRect(x, gy, Math.min(gl, TILE - x), 1.5); }
    }));
    const bridgeBase = P.bridge || '#7a5a34', bridgeDark = P.bridgeDark || '#4e381f', bridgeHi = P.bridgeHi || '#9a7848';
    const plank = (vertical) => mk((g) => { // planks run across the direction of travel
      g.fillStyle = bridgeBase; g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < TILE; i += 5) {
        g.fillStyle = bridgeDark; if (vertical) g.fillRect(i, 0, 1, TILE); else g.fillRect(0, i, TILE, 1);
        g.fillStyle = bridgeHi; if (vertical) g.fillRect(i + 1, 0, 1, TILE); else g.fillRect(0, i + 1, TILE, 1);
      }
      speckle(g, bridgeDark, 6, 1);
    });
    const bridge = { h: plank(true), v: plank(false) };
    const rad = mk((g) => {
      g.fillStyle = P.rad; g.fillRect(0, 0, TILE, TILE);
      g.fillStyle = '#2f8a22'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(rnd() * TILE, rnd() * TILE, 1.5 + rnd() * 3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#7dff5a'; for (let i = 0; i < 4; i++) g.fillRect(Math.floor(rnd() * TILE), Math.floor(rnd() * TILE), 2, 2);
    });
    if (theme === 'sci') {
      // Machinery blocks: flat faces with a light bevel where a block meets the deck to its north or west and a
      // deep shadow face to the south or east, so a run of wall tiles reads as one big block. Three finishes.
      const blockSet = (base, hi, lo, dotCol, dots) => {
        const set = [];
        for (let m = 0; m < 16; m++) set.push(mk((g) => {
          g.fillStyle = base; g.fillRect(0, 0, TILE, TILE);
          if (dots) { g.fillStyle = dotCol; for (let y = 3; y < TILE; y += 6) for (let x = 3; x < TILE; x += 6) g.fillRect(x, y, 2, 2); }
          if (!m) return;
          g.fillStyle = hi; if (m & 1) g.fillRect(0, 0, TILE, 5); if (m & 8) g.fillRect(0, 0, 5, TILE);
          g.fillStyle = lo; if (m & 4) g.fillRect(0, TILE - 7, TILE, 7); if (m & 2) g.fillRect(TILE - 7, 0, 7, TILE);
          g.fillStyle = '#0a0d30';
          if (m & 1) g.fillRect(0, 0, TILE, 1); if (m & 8) g.fillRect(0, 0, 1, TILE); if (m & 4) g.fillRect(0, TILE - 1, TILE, 1); if (m & 2) g.fillRect(TILE - 1, 0, 1, TILE);
        }));
        return set;
      };
      const wallSets = [blockSet(P.wall, P.wallHi, P.wallLo, null, false), blockSet('#c8383a', '#ff9a9a', '#5e1212', '#e57a7a', true), blockSet(P.wall, P.wallHi, P.wallLo, '#6b76f0', true)];
      const grating = [mk((g) => { g.fillStyle = P.rough; g.fillRect(0, 0, TILE, TILE); g.fillStyle = P.roughSpeck; for (let y = 1; y < TILE; y += 4) g.fillRect(0, y, TILE, 1); g.fillStyle = '#7c7c7c'; for (let x = 0; x < TILE; x += 8) g.fillRect(x, 0, 1, TILE); })];
      return { road, rough: grating, dirt, water, bridge, rad, wall: wallSets[0], wallSets };
    }
    const wall = [];
    for (let m = 0; m < 16; m++) {
      wall.push(mk((g) => {
        g.fillStyle = m ? P.wall : P.wallDeep; g.fillRect(0, 0, TILE, TILE);
        if (theme === 'surface') { speckle(g, m ? P.wallHi : P.wall, 18, 2); speckle(g, P.wallLo, 12, 2); }
        else if (theme === 'river') { // scrub: dark ground with bush blobs
          speckle(g, P.wallLo, 10, 2);
          for (let i = 0; i < 5; i++) { const x = rnd() * TILE, y = rnd() * TILE, r = 3 + rnd() * 4; g.fillStyle = P.wallLo; g.beginPath(); g.arc(x + 1, y + 1, r, 0, Math.PI * 2); g.fill(); g.fillStyle = m ? P.wallHi : P.wall; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
        }
        else {
          // steel plating
          g.strokeStyle = P.wallLo; g.lineWidth = 1; g.strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
          g.strokeStyle = m ? P.wallHi : P.wall; g.beginPath(); g.moveTo(1, TILE - 1); g.lineTo(1, 1); g.lineTo(TILE - 1, 1); g.stroke();
          g.fillStyle = P.wallLo; g.fillRect(TILE / 2 - 1, TILE / 2 - 1, 2, 2);
        }
        if (!m) return;
        const kerb = (x, y, w, h) => {
          if (theme === 'surface') { g.fillStyle = P.kerb; g.fillRect(x, y, w, h); }
          else if (theme === 'river') { // a shoulder of boulders along the open edge
            const along = w > h, n = 4;
            for (let i = 0; i < n; i++) {
              const cx = along ? x + (i + 0.5) * (w / n) : x + w / 2, cy = along ? y + h / 2 : y + (i + 0.5) * (h / n), r = 2.5 + rnd() * 1.5;
              g.fillStyle = '#4a4640'; g.beginPath(); g.arc(cx + 1, cy + 1, r, 0, Math.PI * 2); g.fill();
              g.fillStyle = P.kerb; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
              g.fillStyle = '#b5ada0'; g.beginPath(); g.arc(cx - 1, cy - 1, r * 0.4, 0, Math.PI * 2); g.fill();
            }
          }
          else { // hazard stripes along the open edge
            g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
            g.fillStyle = '#1a1a1a'; g.fillRect(x, y, w, h);
            g.fillStyle = P.kerb;
            for (let i = -TILE; i < TILE * 2; i += 8) { g.beginPath(); g.moveTo(i, y - 8); g.lineTo(i + 4, y - 8); g.lineTo(i + 4 - 12, y + 16); g.lineTo(i - 12, y + 16); g.closePath(); g.fill(); }
            g.restore();
          }
        };
        const kw = theme === 'surface' ? 3 : theme === 'river' ? 7 : 4;
        if (m & 1) kerb(0, 0, TILE, kw);
        if (m & 4) kerb(0, TILE - kw, TILE, kw);
        if (m & 8) kerb(0, 0, kw, TILE);
        if (m & 2) kerb(TILE - kw, 0, kw, TILE);
        if (theme === 'river') return; // boulders need no bevel
        // inner shadow line so the wall reads as raised
        g.fillStyle = P.wallLo;
        if (m & 1) g.fillRect(0, kw, TILE, 1);
        if (m & 8) g.fillRect(kw, 0, 1, TILE);
        g.fillStyle = P.wallHi;
        if (m & 4) g.fillRect(0, TILE - kw - 1, TILE, 1);
        if (m & 2) g.fillRect(TILE - kw - 1, 0, 1, TILE);
      }));
    }
    return { road, rough, dirt, water, bridge, rad, wall };
  }

  const MINI_COLORS = (L, t) => t === T.RAD ? '#3fbf2a' : t === T.ROUGH ? (L.kind === 'vector' ? '#3f9a3f' : L.theme === 'river' ? '#4f7a36' : '#6b5a3c')
    : t === T.EXIT ? '#f5a524' : t === T.WATER ? (L.kind === 'vector' ? '#2f5fe0' : '#1d5f8a') : t === T.BRIDGE ? '#a58453' : t === T.DIRT ? '#8a6a3c' : '#8b9bb0';
  function makeMinimap(L) {
    const cv = document.createElement('canvas'); cv.width = ui.mini.width; cv.height = ui.mini.height;
    const g = cv.getContext('2d');
    const s = Math.min(cv.width / L.w, cv.height / L.h), ox = (cv.width - L.w * s) / 2, oy = (cv.height - L.h * s) / 2;
    g.fillStyle = '#05080b'; g.fillRect(0, 0, cv.width, cv.height);
    if (L.kind === 'vector') {
      g.fillStyle = '#2a6f2a'; g.fillRect(ox, oy, L.w * s, L.h * s);
      const step = 0.5;
      for (let y = 0; y < L.h; y += step) for (let x = 0; x < L.w; x += step) {
        const t = L.tileAt((x + step / 2) * TILE, (y + step / 2) * TILE);
        if (t === T.ROUGH) continue;
        g.fillStyle = t === T.WALL ? '#1d4d1d' : MINI_COLORS(L, t);
        g.fillRect(ox + x * s, oy + y * s, step * s + 0.4, step * s + 0.4);
      }
    } else {
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const t = L.grid[y * L.w + x];
        if (t === T.WALL) continue;
        g.fillStyle = MINI_COLORS(L, t);
        g.fillRect(ox + x * s, oy + y * s, s, s);
      }
    }
    return { cv, s, ox, oy };
  }

  const vignette = (() => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 0.9);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H); return cv;
  })();

  // ---------- level setup ----------
  function makeCar(s) {
    return { x: (s.x + 0.5) * TILE, y: (s.y + 0.5) * TILE, angle: s.dir * Math.PI / 180, speed: 0, fuel: 100, rad: 0, throttle: 0, brake: 0, steer: 0, steerAmt: 0, skid: false, visible: true };
  }
  function prepareLevel(i) {
    const def = LEVELS[i];
    G.level = buildAny(def); G.pal = PALETTES[def.theme]; G.atlas = def.kind === 'vector' ? null : makeAtlas(def.theme); G.mini = makeMinimap(G.level);
    G.t = 0; G.particles = []; G.said = {}; G.lastBeep = -1; G.fuelOutTimer = 0; G.shake = 0; G.flash = 0; G.completeShown = false;
    G.timeLeft = Math.round(def.time * timeScale()); G.levelStartScore = G.score;
    G.respawn = { x: def.start.x, y: def.start.y, dir: def.start.dir };
    G.car = makeCar(def.start);
    snapCamera();
    ui.sector.textContent = `Sector ${i + 1} · ${def.name}` + (G.loop > 1 ? ` · Loop ${G.loop}` : '');
  }
  function snapCamera() { G.cam.x = G.car.x; G.cam.y = G.car.y; clampCamera(); }
  function clampCamera() { const L = G.level; G.cam.x = L.wrap ? wrapX(G.cam.x) : clamp(G.cam.x, W / 2, L.w * TILE - W / 2); G.cam.y = clamp(G.cam.y, H / 2, L.h * TILE - H / 2); }

  // ---------- modal ----------
  function showModal({ kicker = '', title, body = '', actions = [], wide = false }) {
    ui.modalKicker.textContent = kicker; ui.modalTitle.textContent = title;
    if (typeof body === 'string') ui.modalBody.innerHTML = body; else { ui.modalBody.innerHTML = ''; ui.modalBody.appendChild(body); }
    ui.modal.firstElementChild.classList.toggle('wide', wide);
    ui.modalActions.innerHTML = ''; modalPrimary = null;
    let first = null;
    actions.forEach((a) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'btn ' + (a.primary ? 'primary' : 'ghost'); b.textContent = a.label;
      b.addEventListener('click', () => { unlockAudio(); a.onClick(); });
      ui.modalActions.appendChild(b);
      if (a.primary) { modalPrimary = a.onClick; first = b; }
    });
    ui.modal.classList.remove('hidden');
    if (first) first.focus({ preventScroll: true });
  }
  function hideModal() { ui.modal.classList.add('hidden'); modalPrimary = null; }
  function statGrid(extra) {
    return `<div class="stat-grid"><div><span class="k">Score</span><b>${G.score.toLocaleString()}</b></div><div><span class="k">Best</span><b>${G.hi.toLocaleString()}</b></div>${extra || `<div><span class="k">Sector</span><b>${G.levelIndex + 1} / ${LEVELS.length}</b></div>`}</div>`;
  }
  function saveHi() { if (G.score > G.hi) { G.hi = G.score; store.set('lastv8.hi', G.hi); } }

  const CONTROLS = `<div class="keys">
    <div><kbd>↑</kbd> / <kbd>W</kbd> accelerate</div><div><kbd>↓</kbd> / <kbd>S</kbd> brake, reverse</div>
    <div><kbd>←</kbd> <kbd>→</kbd> / <kbd>A</kbd> <kbd>D</kbd> steer</div><div><kbd>P</kbd> / <kbd>Esc</kbd> pause</div>
    <div><kbd>M</kbd> sound on / off</div><div><kbd>F</kbd> fullscreen</div><div><kbd>Enter</kbd> confirm</div></div>`;

  // ---------- flow ----------
  function showTitle() {
    G.state = 'title'; Snd.stopMusic(); Snd.setEngine(0, 0, false, false);
    G.loop = 1; prepareLevel(0); G.car.visible = false; G.attract = 0;
    ui.sector.textContent = 'Standby';
    showModal({
      kicker: 'Mastertronic 1985 · Browser remake', title: 'The Last V8',
      body: `<p>The war is over and the surface is glowing. You are driving the last V8 on Earth, and the base is about to seal itself. One road home, a countdown that never stops, and walls that end the run on contact.</p>${CONTROLS}<p class="hi-note">Best run: ${G.hi.toLocaleString()} pts · ${LEVELS.length} sectors · Return to base immediately.</p>`,
      actions: [{ label: 'Choose sector', primary: true, onClick: showLevelSelect }, { label: 'How to play', onClick: () => showHelp(showTitle) }],
    });
  }

  // ---------- sector select ----------
  const previews = [];
  // Renders a real in-game view of the level around its preview point, using the same tile atlas and entity drawing.
  function renderPreview(i) {
    if (previews[i]) return previews[i];
    const def = LEVELS[i], level = buildAny(def), atlas = def.kind === 'vector' ? null : makeAtlas(def.theme), pal = PALETTES[def.theme];
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 270;
    const saved = { ctx, level: G.level, atlas: G.atlas, pal: G.pal, car: G.car, cam: G.cam, state: G.state };
    const p = def.preview || def.start;
    const PS = 0.75, vw = W / PS * 0.5, vh = H / PS * 0.5; // preview shows a closer crop than the game view
    const cam = { x: clamp((p.x + 0.5) * TILE, vw, level.w * TILE - vw), y: clamp((p.y + 0.5) * TILE, vh, level.h * TILE - vh) };
    ctx = cv.getContext('2d'); G.level = level; G.atlas = atlas; G.pal = pal; G.cam = cam; G.car = makeCar(def.start); G.state = 'preview';
    ctx.setTransform(PS, 0, 0, PS, 0, 0);
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
    const ox = Math.round(vw - cam.x), oy = Math.round(vh - cam.y);
    ctx.save(); ctx.translate(ox, oy);
    if (level.kind === 'vector') drawVector(); else drawTiles(ox, oy);
    drawExit(level); drawCheckpoints(level); drawFuel(level); drawWrecks(level); drawDoors(level);
    if (Math.abs(G.car.x - cam.x) < vw && Math.abs(G.car.y - cam.y) < vh) drawCar();
    ctx.restore();
    ctx.setTransform(0.5, 0, 0, 0.5, 0, 0); ctx.drawImage(vignette, 0, 0);
    ctx = saved.ctx; G.level = saved.level; G.atlas = saved.atlas; G.pal = saved.pal; G.car = saved.car; G.cam = saved.cam; G.state = saved.state;
    previews[i] = cv;
    return cv;
  }
  function showLevelSelect() {
    G.state = 'select'; Snd.stopMusic(); Snd.setEngine(0, 0, false, false);
    const cleared = store.get('lastv8.cleared', {});
    const grid = document.createElement('div'); grid.className = 'level-grid';
    LEVELS.forEach((def, i) => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'level-card'; card.dataset.index = i;
      card.setAttribute('aria-label', `Sector ${i + 1}: ${def.name}`);
      const pic = document.createElement('div'); pic.className = 'lc-pic'; pic.appendChild(renderPreview(i));
      const num = document.createElement('span'); num.className = 'lc-num'; num.textContent = `Sector ${i + 1}`; pic.appendChild(num);
      if (cleared[i]) { const b = document.createElement('span'); b.className = 'lc-badge'; b.textContent = 'Cleared'; pic.appendChild(b); }
      const body = document.createElement('div'); body.className = 'lc-body';
      body.innerHTML = `<b class="lc-name"></b><span class="lc-tag"></span><span class="lc-meta"></span>`;
      body.querySelector('.lc-name').textContent = def.name;
      body.querySelector('.lc-tag').textContent = def.tagline || def.subtitle;
      body.querySelector('.lc-meta').textContent = `${def.subtitle} · ${Math.round(def.time * timeScale())}s countdown${def.doors.length ? ` · ${def.doors.length} blast doors` : ''}`;
      card.appendChild(pic); card.appendChild(body);
      card.addEventListener('click', () => { unlockAudio(); startAt(i); });
      grid.appendChild(card);
    });
    showModal({
      kicker: 'Mission select', title: 'Choose a sector', wide: true, body: grid,
      actions: [{ label: 'Back', onClick: showTitle }],
    });
    const first = grid.querySelector('.level-card'); if (first) first.focus({ preventScroll: true });
  }
  function moveCardFocus(dx, dy) {
    const cards = [...ui.modalBody.querySelectorAll('.level-card')]; if (!cards.length) return false;
    const grid = ui.modalBody.querySelector('.level-grid');
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 2;
    let i = cards.indexOf(document.activeElement); if (i < 0) i = 0;
    else i = clamp(i + dx + dy * cols, 0, cards.length - 1);
    cards[i].focus({ preventScroll: true });
    return true;
  }
  function startAt(i) { G.levelIndex = i; G.loop = 1; G.lives = START_LIVES; G.score = 0; prepareLevel(i); showIntro(); }
  function showHelp(back) {
    const prev = G.state;
    showModal({
      kicker: 'Briefing', title: 'How to play',
      body: `<p>Reach the base marker before the countdown hits zero. Checkpoints save your position and add time. Fuel cans top up the tank. Anything solid destroys the car.</p>${CONTROLS}
      <div class="legend">
        <div><i style="background:#2a2b2f;border:1px solid #555"></i>Road — full speed</div>
        <div><i style="background:#8a6a3c"></i>Dirt track — loose, slower</div>
        <div><i style="background:#6f9a3c"></i>Grass verge — slow but safe</div>
        <div><i style="background:#8f7a4f"></i>Rubble — slow and heavy</div>
        <div><i style="background:#1d5f8a"></i>Water — the car sinks</div>
        <div><i style="background:#7a5a34"></i>Bridge — the only way across</div>
        <div><i style="background:#3fbf2a"></i>Radiation — the meter climbs fast</div>
        <div><i style="background:#d8341f"></i>Fuel can — +40%</div>
        <div><i style="background:#2dd4bf"></i>Checkpoint — respawn here, +4s</div>
        <div><i style="background:#f5c518"></i>Blast door — cycles open and shut</div>
      </div>
      <label class="check"><input type="checkbox" id="voiceToggle" ${settings.voice ? 'checked' : ''}> Robotic voice announcements</label>`,
      actions: [{ label: 'Back', primary: true, onClick: () => { G.state = prev; back(); } }],
    });
    $('#voiceToggle').addEventListener('change', (e) => { settings.voice = e.target.checked; store.set('lastv8.settings', settings); });
  }
  function showIntro() {
    G.state = 'intro'; Snd.stopMusic(); G.car.visible = true;
    const def = LEVELS[G.levelIndex];
    showModal({
      kicker: `Sector ${G.levelIndex + 1} of ${LEVELS.length}${G.loop > 1 ? ` · Loop ${G.loop}` : ''} · ${def.subtitle}`, title: def.name,
      body: `<p>${def.briefing}</p>${statGrid(`<div><span class="k">Countdown</span><b>${G.timeLeft}s</b></div>`)}<p class="hi-note" style="margin-top:12px">Lives: ${G.lives} · Enter to go</p>`,
      actions: [{ label: 'Go', primary: true, onClick: beginPlay }],
    });
  }
  function beginPlay() {
    hideModal(); G.state = 'play'; last = performance.now();
    unlockAudio(); Snd.startMusic();
    banner('Return to base immediately'); say('Return to base immediately.');
  }
  function togglePause() {
    if (G.state === 'play') {
      G.state = 'paused'; Snd.setEngine(0, 0, false, false); Snd.stopMusic();
      showModal({ kicker: 'Paused', title: 'Mission on hold', body: '<p>The countdown is frozen. Take a breath.</p>' + statGrid(),
        actions: [{ label: 'Resume', primary: true, onClick: resumePlay }, { label: 'Restart sector', onClick: retryLevel }, { label: 'Sectors', onClick: showLevelSelect }] });
    } else if (G.state === 'paused') resumePlay();
  }
  function resumePlay() { hideModal(); G.state = 'play'; last = performance.now(); Snd.startMusic(); }
  function retryLevel() { G.lives = START_LIVES; G.score = G.levelStartScore; prepareLevel(G.levelIndex); showIntro(); }

  function crash(reason) {
    const c = G.car;
    G.state = 'crash'; G.crashTimer = reason === 'fuel' ? 1.4 : 2.0; G.crashReason = reason; c.speed = 0; c.throttle = 0;
    if (reason === 'water') { c.visible = false; splash(c.x, c.y); G.shake = 6; Snd.splash(); }
    else if (reason !== 'fuel') { c.visible = false; explode(c.x, c.y, reason === 'rad'); G.shake = 22; G.flash = 1; G.flashColor = reason === 'rad' ? '120,255,80' : '255,240,200'; Snd.explosion(); }
    Snd.setEngine(0, 0, false, false);
    banner({ wall: 'Vehicle destroyed', rad: 'Radiation lethal', fuel: 'Out of fuel', water: 'Vehicle sank' }[reason], 'danger');
  }
  function afterCrash() {
    G.lives -= 1;
    if (G.lives <= 0) return gameOver(G.crashReason);
    const r = G.respawn, c = G.car;
    c.x = (r.x + 0.5) * TILE; c.y = (r.y + 0.5) * TILE; c.angle = r.dir * Math.PI / 180; c.speed = 0; c.steerAmt = 0; c.visible = true;
    c.fuel = Math.max(c.fuel, 50); c.rad = Math.min(c.rad, 35); G.fuelOutTimer = 0; G.said.rad = false;
    snapCamera(); G.state = 'play';
    banner(`${G.lives} ${G.lives === 1 ? 'car' : 'cars'} left`, 'warn');
  }
  function gameOver(reason) {
    G.state = 'gameover'; Snd.stopMusic(); Snd.setEngine(0, 0, false, false);
    if (reason === 'detonation') { Snd.detonation(); G.flash = 1.5; G.flashColor = '255,250,220'; G.shake = 40; G.car.visible = false; explode(G.car.x, G.car.y, false); }
    else Snd.fail();
    say(reason === 'detonation' ? 'Detonation. You are too late.' : 'Mission failed.');
    saveHi();
    const msg = {
      detonation: 'The countdown hit zero. The base sealed itself and the surface is gone.',
      wall: 'The last V8 is a wreck, and there is no other car.',
      rad: 'Radiation reached a lethal dose before the base came into view.',
      fuel: 'The tank ran dry with the base still out of reach.',
      water: 'The last V8 is at the bottom of the lake. Bridges only.',
    }[reason];
    setTimeout(() => showModal({
      kicker: 'Mission failed', title: reason === 'detonation' ? 'Detonation' : 'Game over',
      body: `<p>${msg}</p>${statGrid()}`,
      actions: [{ label: 'Retry sector', primary: true, onClick: retryLevel }, { label: 'Sectors', onClick: showLevelSelect }],
    }), reason === 'detonation' ? 1400 : 500);
  }
  function completeLevel() {
    const c = G.car;
    G.state = 'levelcomplete'; G.completeTimer = 1.7; G.completeShown = false;
    G.bonus = Math.round(G.timeLeft) * 50; G.score += 1000 + G.bonus;
    if (G.lives < MAX_LIVES) G.lives += 1;
    const cleared = store.get('lastv8.cleared', {}); cleared[G.levelIndex] = true; store.set('lastv8.cleared', cleared);
    c.throttle = 0; Snd.fanfare(); Snd.setEngine(0, 0, false, false); say('Vehicle secured.'); banner('Base reached', 'ok');
    saveHi();
  }
  function showLevelComplete() {
    G.completeShown = true; Snd.stopMusic();
    const lastSector = G.levelIndex === LEVELS.length - 1;
    const def = LEVELS[G.levelIndex];
    showModal({
      kicker: lastSector ? 'Mission complete' : 'Sector clear', title: lastSector ? 'The Last V8 is home' : `${def.name} cleared`,
      body: `<p>${lastSector ? 'The vault doors close behind the only V8 left on Earth. Nothing on the surface will ever run again — but this one does. Run it again and the countdown gets shorter.' : 'The road ahead is sealed behind you. Next sector loads with the clock reset and one more car in the bay.'}</p>${statGrid(`<div><span class="k">Time bonus</span><b>+${G.bonus.toLocaleString()}</b></div>`)}`,
      actions: [{ label: lastSector ? 'Run it again, harder' : 'Next sector', primary: true, onClick: () => {
        if (lastSector) { G.loop += 1; G.levelIndex = 0; } else G.levelIndex += 1;
        prepareLevel(G.levelIndex); showIntro();
      } }, { label: 'Sectors', onClick: showLevelSelect }],
    });
  }

  function banner(text, kind) {
    const b = ui.banner; b.textContent = text; b.className = 'banner ' + (kind || '');
    void b.offsetWidth; b.classList.add('show');
  }

  // ---------- input ----------
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (G.state === 'select' && KEYMAP[e.code]) { const k = KEYMAP[e.code]; if (moveCardFocus(k === 'right' ? 1 : k === 'left' ? -1 : 0, k === 'down' ? 1 : k === 'up' ? -1 : 0)) { e.preventDefault(); return; } }
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); if (G.state === 'play') unlockAudio(); }
    if (e.repeat) return;
    if ((e.code === 'Enter' || e.code === 'Space') && modalPrimary) {
      if (e.target && e.target.tagName === 'BUTTON') return; // a focused button activates itself natively
      e.preventDefault(); const fn = modalPrimary; unlockAudio(); fn(); return;
    }
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'KeyM') toggleSound();
    if (e.code === 'KeyF') toggleFullscreen();
  });
  window.addEventListener('keyup', (e) => { if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = false; e.preventDefault(); } });
  window.addEventListener('blur', () => { keys.up = keys.down = keys.left = keys.right = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') togglePause(); });
  window.addEventListener('pointerdown', unlockAudio, { once: true });

  ui.touch.querySelectorAll('button[data-key]').forEach((b) => {
    const k = b.dataset.key;
    const on = (e) => { e.preventDefault(); keys[k] = true; b.classList.add('on'); unlockAudio(); };
    const off = (e) => { e.preventDefault(); keys[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  });

  function toggleSound() {
    settings.sound = !settings.sound; store.set('lastv8.settings', settings);
    unlockAudio(); Snd.setMuted(!settings.sound);
    if (!settings.sound && 'speechSynthesis' in window) speechSynthesis.cancel();
    ui.btnSound.textContent = settings.sound ? 'Sound: on' : 'Sound: off';
  }
  ui.btnSound.textContent = settings.sound ? 'Sound: on' : 'Sound: off';
  ui.btnSound.addEventListener('click', toggleSound);

  function toggleFullscreen() {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }
  if (!document.fullscreenEnabled) ui.btnFull.hidden = true;
  ui.btnFull.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => { ui.btnFull.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; resizeCanvas(); });
  ui.btnPause.addEventListener('click', () => { if (G.state === 'play' || G.state === 'paused') togglePause(); });
  ui.btnHelp.addEventListener('click', () => {
    if (G.state === 'play') { togglePause(); showHelp(() => { hideModal(); togglePause(); }); }
    else if (G.state === 'title') showHelp(showTitle);
    else if (G.state === 'intro') showHelp(showIntro);
    else if (G.state === 'select') showHelp(showLevelSelect);
  });

  // ---------- update ----------
  function update(dt) {
    const L = G.level, c = G.car;
    G.t += dt;
    updateDoors(L, dt);

    if (G.state === 'play') {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) { G.timeLeft = 0; return gameOver('detonation'); }
      if (G.timeLeft <= 20 && !G.said.t20) { G.said.t20 = true; say('Warning. Time is running out.'); banner('Warning · time running out', 'warn'); }
      if (G.timeLeft <= 10) { const s = Math.ceil(G.timeLeft); if (s !== G.lastBeep) { G.lastBeep = s; Snd.beep(); } }
      c.rad = Math.min(100, c.rad + L.def.ambientRad * radScale() * dt);
      updateCar(dt);
    } else if (G.state === 'crash') {
      G.crashTimer -= dt;
      if (G.crashTimer <= 0) afterCrash();
    } else if (G.state === 'levelcomplete') {
      c.speed -= c.speed * 4 * dt; c.x = wrapX(c.x + Math.cos(c.angle) * c.speed * dt); c.y += Math.sin(c.angle) * c.speed * dt;
      G.completeTimer -= dt;
      if (G.completeTimer <= 0 && !G.completeShown) showLevelComplete();
    } else if (G.state === 'title') {
      // attract mode: the camera drifts along the level 1 checkpoints
      G.attract += dt;
      const pts = [L.start, ...L.checkpoints, { x: (L.exit[0] + L.exit[2]) / 2, y: (L.exit[1] + L.exit[3]) / 2 }];
      const seg = 7, i = ((Math.floor(G.attract / seg) % pts.length) + pts.length) % pts.length, f = (G.attract % seg) / seg;
      const a = pts[i], b = pts[(i + 1) % pts.length], e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      G.cam.x = (a.x + (b.x - a.x) * e + 0.5) * TILE; G.cam.y = (a.y + (b.y - a.y) * e + 0.5) * TILE; clampCamera();
    }
    updateWreckSmoke(dt);
    updateParticles(dt);
    if (G.state !== 'title') updateCamera(dt);
    G.shake = Math.max(0, G.shake - 45 * dt);
    G.flash = Math.max(0, G.flash - 2.2 * dt);
    const on = (G.state === 'play' || G.state === 'levelcomplete') && c.visible;
    Snd.setEngine(Math.abs(c.speed) / TOP_SPEED, c.throttle, on, c.skid);
  }

  function updateCar(dt) {
    const c = G.car, L = G.level;
    const throttle = keys.up && c.fuel > 0 ? 1 : 0;
    const brake = keys.down ? 1 : 0;
    const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const under = L.tileAt(c.x, c.y);
    const rough = under === T.ROUGH, dirt = under === T.DIRT;

    if (throttle) c.speed += (rough ? 260 : dirt ? 340 : 400) * dt;
    if (brake) c.speed -= (c.speed > 0 ? 560 : 220) * dt;
    c.speed -= c.speed * (rough ? 2.4 : dirt ? 0.85 : 0.55) * dt;
    if (!throttle && !brake && Math.abs(c.speed) < 3) c.speed = 0;
    c.speed = clamp(c.speed, -150, rough ? 190 : dirt ? 340 : TOP_SPEED);

    // Steering ramps in over ~0.1s so a tap nudges and a held key swings the car round.
    c.steerAmt += (steer - c.steerAmt) * Math.min(1, dt * 12);
    const sfac = Math.min(1, 0.3 + Math.abs(c.speed) / 200);
    c.angle += c.steerAmt * 2.7 * sfac * dt * (c.speed < 0 ? -1 : 1);
    c.x = wrapX(c.x + Math.cos(c.angle) * c.speed * dt);
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.fuel = Math.max(0, c.fuel - (0.35 + throttle * 1.45) * dt);
    c.throttle = throttle; c.brake = brake; c.steer = steer; c.skid = steer !== 0 && Math.abs(c.speed) > 250;

    if (c.fuel <= 0 && Math.abs(c.speed) < 5) { G.fuelOutTimer += dt; if (G.fuelOutTimer > 2) return crash('fuel'); }
    else G.fuelOutTimer = 0;
    if (c.fuel <= 0 && !G.said.fuel) { G.said.fuel = true; banner('Fuel exhausted', 'danger'); }
    if (c.fuel > 0) G.said.fuel = false;

    if (under === T.RAD) { c.rad = Math.min(100, c.rad + 28 * dt); if (Math.random() < 0.5) spawnRadSpark(c); }
    if (c.rad >= 100) return crash('rad');
    if (c.rad >= 70 && !G.said.rad) { G.said.rad = true; say('Radiation critical.'); banner('Radiation critical', 'danger'); }

    const hit = hitsGround(c);
    if (hit) return crash(hit);
    if (hitsDoor(c) || hitsWreck(c)) return crash('wall');

    if (throttle && Math.random() < 0.7) spawnExhaust(c);
    if ((dirt || rough) && Math.abs(c.speed) > 60 && Math.random() < 0.5) spawnDust(c, dirt);
    if (c.skid && Math.random() < 0.6) spawnSkidDust(c);

    const tx = Math.floor(c.x / TILE), ty = Math.floor(c.y / TILE);
    for (const cp of L.checkpoints) {
      if (cp.taken) continue;
      let hitCp;
      if (cp.seg) { // vector levels: a line across the road; count it when the car centre is within 16px of it
        const ax = c.x + wrapDelta(cp.seg.ax - c.x), bx = c.x + wrapDelta(cp.seg.bx - c.x), ay = cp.seg.ay, by = cp.seg.by;
        const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy || 1, t = clamp(((c.x - ax) * vx + (c.y - ay) * vy) / len2, 0, 1);
        hitCp = Math.hypot(c.x - (ax + vx * t), c.y - (ay + vy * t)) < 16;
      } else hitCp = tx >= cp.bounds.x0 && tx <= cp.bounds.x1 && ty >= cp.bounds.y0 && ty <= cp.bounds.y1;
      if (hitCp) {
        cp.taken = true; G.respawn = { x: cp.x, y: cp.y, dir: cp.dir }; G.score += 250; G.timeLeft += 4; Snd.checkpoint(); banner('Checkpoint · +4s', 'ok');
      }
    }
    for (const f of L.fuel) {
      if (!f.taken && Math.hypot(wrapDelta(c.x - f.x), c.y - f.y) < 24) { f.taken = true; c.fuel = Math.min(100, c.fuel + 40); G.score += 100; Snd.pickup(); banner('Fuel +40%'); }
    }
    if (under === T.EXIT) completeLevel();
  }

  function carPoints(c) {
    const cs = Math.cos(c.angle), sn = Math.sin(c.angle), hl = CAR_L / 2, hw = CAR_W / 2;
    return [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [0, hw], [0, -hw], [hl, 0], [-hl, 0]]
      .map(([lx, ly]) => [c.x + lx * cs - ly * sn, c.y + lx * sn + ly * cs]);
  }
  // Returns the crash reason if any part of the car is on rock or in water, otherwise null.
  function hitsGround(c) {
    const L = G.level;
    for (const [x, y] of carPoints(c)) { const t = L.tileAt(x, y); if (t === T.WALL) return 'wall'; if (t === T.WATER) return 'water'; }
    return null;
  }
  function doorPanels(d) {
    // Closed doors are two panels that meet in the middle of the corridor; the barrier is a 12px band in the tile's centre.
    const closed = 1 - d.openAmt;
    if (d.axis === 'v') {
      const len = d.ph * closed / 2;
      return [{ x: d.px + 10, y: d.py, w: 12, h: len }, { x: d.px + 10, y: d.py + d.ph - len, w: 12, h: len }];
    }
    const len = d.pw * closed / 2;
    return [{ x: d.px, y: d.py + 10, w: len, h: 12 }, { x: d.px + d.pw - len, y: d.py + 10, w: len, h: 12 }];
  }
  function hitsDoor(c) {
    const pts = carPoints(c);
    for (const d of G.level.doors) {
      if (d.openAmt > 0.98) continue;
      if (Math.abs(d.px + d.pw / 2 - c.x) > 120 || Math.abs(d.py + d.ph / 2 - c.y) > 120) continue;
      for (const p of doorPanels(d)) for (const [x, y] of pts) if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
    }
    return false;
  }
  function hitsWreck(c) {
    const cs = Math.cos(c.angle), sn = Math.sin(c.angle);
    for (const wk of G.level.wrecks) {
      const dx = wrapDelta(wk.x - c.x), dy = wk.y - c.y;
      if (dx * dx + dy * dy > 40 * 40) continue;
      const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
      const qx = clamp(lx, -CAR_L / 2, CAR_L / 2), qy = clamp(ly, -CAR_W / 2, CAR_W / 2);
      if ((lx - qx) ** 2 + (ly - qy) ** 2 < wk.r * wk.r) return true;
    }
    return false;
  }
  function updateDoors(L, dt) {
    const c = G.car;
    for (const d of L.doors) {
      const p = ((G.t + d.phase) % d.period + d.period) % d.period;
      const target = p < d.open ? 1 : 0;
      if (target !== d.target) {
        d.target = target;
        if (G.state === 'play' && Math.hypot(d.px + d.pw / 2 - c.x, d.py + d.ph / 2 - c.y) < 640) Snd.door();
      }
      d.openAmt = clamp(d.openAmt + (target ? 1 : -1) * dt / 0.35, 0, 1);
    }
  }
  function updateCamera(dt) {
    const c = G.car;
    const tx = c.x + Math.cos(c.angle) * c.speed * 0.32, ty = c.y + Math.sin(c.angle) * c.speed * 0.32;
    const k = 1 - Math.pow(0.002, dt);
    G.cam.x += wrapDelta(tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
    clampCamera();
  }

  // ---------- particles ----------
  function spawnExhaust(c) {
    const bx = c.x - Math.cos(c.angle) * 13, by = c.y - Math.sin(c.angle) * 13;
    G.particles.push({ type: 'smoke', x: bx, y: by, vx: -Math.cos(c.angle) * 30 + (Math.random() - 0.5) * 24, vy: -Math.sin(c.angle) * 30 + (Math.random() - 0.5) * 24, life: 0.55, max: 0.55, size: 2 + Math.random() * 2, grow: 10, color: '170,170,170', alpha: 0.35 });
  }
  function spawnSkidDust(c) {
    const s = Math.sign(c.steer), bx = c.x - Math.cos(c.angle) * 10 - Math.sin(c.angle) * 7 * s, by = c.y - Math.sin(c.angle) * 10 + Math.cos(c.angle) * 7 * s;
    G.particles.push({ type: 'smoke', x: bx, y: by, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0.4, max: 0.4, size: 3, grow: 14, color: '200,190,170', alpha: 0.3 });
  }
  function spawnDust(c, dirt) {
    const bx = c.x - Math.cos(c.angle) * 8 + (Math.random() - 0.5) * 10, by = c.y - Math.sin(c.angle) * 8 + (Math.random() - 0.5) * 10;
    G.particles.push({ type: 'smoke', x: bx, y: by, vx: -Math.cos(c.angle) * 20 + (Math.random() - 0.5) * 30, vy: -Math.sin(c.angle) * 20 + (Math.random() - 0.5) * 30, life: 0.7, max: 0.7, size: 3, grow: 16, color: dirt ? '170,140,95' : '120,150,80', alpha: 0.4 });
  }
  function splash(x, y) {
    for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 160; G.particles.push({ type: 'fire', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.4 + Math.random() * 0.5, max: 0.9, size: 2 + Math.random() * 3, color: i % 2 ? '200,230,255' : '120,180,230' }); }
    for (let i = 0; i < 6; i++) G.particles.push({ type: 'smoke', x, y, vx: 0, vy: 0, life: 0.9 + i * 0.15, max: 1.5, size: 6 + i * 5, grow: 30, color: '190,225,255', alpha: 0.35 });
  }
  function spawnRadSpark(c) {
    G.particles.push({ type: 'fire', x: c.x + (Math.random() - 0.5) * 20, y: c.y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40, life: 0.5, max: 0.5, size: 2, color: '120,255,80' });
  }
  function explode(x, y, green) {
    const fire = green ? ['140,255,90', '60,220,60', '220,255,120'] : ['255,210,70', '255,130,30', '255,70,20'];
    for (let i = 0; i < 56; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 230; G.particles.push({ type: 'fire', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.45 + Math.random() * 0.7, max: 1, size: 2 + Math.random() * 4, color: fire[i % 3] }); }
    for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 90; G.particles.push({ type: 'smoke', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 + Math.random() * 1.2, max: 2, size: 6 + Math.random() * 6, grow: 28, color: '70,70,70', alpha: 0.6 }); }
    for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 220; G.particles.push({ type: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7 + Math.random() * 0.8, max: 1.5, size: 2 + Math.random() * 4, rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 20, color: i % 3 ? '#8a1e12' : '#222' }); }
  }
  function updateParticles(dt) {
    const ps = G.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.life -= dt;
      if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const damp = p.type === 'smoke' ? 0.92 : 0.96;
      p.vx *= Math.pow(damp, dt * 60); p.vy *= Math.pow(damp, dt * 60);
      if (p.rot !== undefined) p.rot += p.vrot * dt;
    }
  }
  function updateWreckSmoke(dt) {
    for (const wk of G.level.wrecks) {
      if (Math.abs(wrapDelta(wk.x - G.cam.x)) > W / 2 + 40 || Math.abs(wk.y - G.cam.y) > H / 2 + 40) continue;
      wk.smoke -= dt;
      if (wk.smoke <= 0) { wk.smoke = 0.35 + Math.random() * 0.4; G.particles.push({ type: 'smoke', x: wk.x + (Math.random() - 0.5) * 10, y: wk.y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 8, vy: -12 - Math.random() * 10, life: 1.6, max: 1.6, size: 3, grow: 14, color: '90,90,90', alpha: 0.35 }); }
    }
  }

  // ---------- render ----------
  function render() {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    const L = G.level, P = G.pal;
    const sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
    const ox = Math.round(W / 2 - G.cam.x + sx), oy = Math.round(H / 2 - G.cam.y + sy);
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(ox, oy);
    if (L.kind === 'vector') drawVector(); else drawTiles(ox, oy);
    drawExit(L);
    drawCheckpoints(L);
    drawFuel(L);
    drawWrecks(L);
    drawDoors(L);
    drawCar();
    drawParticles();
    ctx.restore();
    drawOverlays();
    updateDash();
  }

  function drawTiles(ox, oy) {
    const L = G.level, A = G.atlas, P = G.pal;
    const x0 = Math.max(0, Math.floor(-ox / TILE)), y0 = Math.max(0, Math.floor(-oy / TILE));
    const x1 = Math.min(L.w - 1, Math.floor((W - ox) / TILE)), y1 = Math.min(L.h - 1, Math.floor((H - oy) / TILE));
    const radTiles = [], bridgeTiles = [], shoreTiles = [];
    const frame = Math.floor(G.t * 5);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * L.w + x, t = L.grid[i];
        let img;
        if (t === T.WALL) { if (A.wallSets) { const hsh = (((x >> 3) * 73856093) ^ ((y >> 3) * 19349663)) >>> 0; img = A.wallSets[hsh % 11 === 0 ? 1 : hsh % 11 < 4 ? 2 : 0][L.mask[i]]; } else img = A.wall[L.mask[i]]; }
        else if (t === T.ROUGH) img = A.rough[(x * 3 + y * 5) % A.rough.length];
        else if (t === T.DIRT) img = A.dirt[(x * 5 + y * 3) % A.dirt.length];
        else if (t === T.WATER) { img = A.water[(x + y + frame) & 3]; if (L.mask[i]) shoreTiles.push(x, y, L.mask[i]); }
        else if (t === T.BRIDGE) { img = (L.get(x, y - 1) === T.WATER || L.get(x, y + 1) === T.WATER) ? A.bridge.h : A.bridge.v; bridgeTiles.push(x, y); }
        else if (t === T.RAD) { img = A.rad; radTiles.push(x, y); }
        else img = A.road[(x * 7 + y * 13) % A.road.length];
        ctx.drawImage(img, x * TILE, y * TILE, TILE, TILE);
      }
    }
    // foam where water meets land, rails where a bridge runs beside water
    if (shoreTiles.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (let i = 0; i < shoreTiles.length; i += 3) {
        const x = shoreTiles[i] * TILE, y = shoreTiles[i + 1] * TILE, m = shoreTiles[i + 2];
        if (m & 1) ctx.fillRect(x, y, TILE, 2);
        if (m & 4) ctx.fillRect(x, y + TILE - 2, TILE, 2);
        if (m & 8) ctx.fillRect(x, y, 2, TILE);
        if (m & 2) ctx.fillRect(x + TILE - 2, y, 2, TILE);
      }
    }
    if (L.def.labels) drawFloorMarks(L, x0, y0, x1, y1);
    for (let i = 0; i < bridgeTiles.length; i += 2) {
      const tx = bridgeTiles[i], ty = bridgeTiles[i + 1], x = tx * TILE, y = ty * TILE;
      const rail = (rx, ry, rw, rh) => { ctx.fillStyle = '#3a2a16'; ctx.fillRect(rx, ry, rw, rh); ctx.fillStyle = '#a58453'; ctx.fillRect(rx, ry, rw > rh ? rw : 1.5, rw > rh ? 1.5 : rh); };
      if (L.get(tx, ty - 1) === T.WATER) rail(x, y, TILE, 4);
      if (L.get(tx, ty + 1) === T.WATER) rail(x, y + TILE - 4, TILE, 4);
      if (L.get(tx - 1, ty) === T.WATER) rail(x, y, 4, TILE);
      if (L.get(tx + 1, ty) === T.WATER) rail(x + TILE - 4, y, 4, TILE);
    }
    // pulsing glow over radiation pools
    if (radTiles.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < radTiles.length; i += 2) {
        const x = radTiles[i], y = radTiles[i + 1];
        const a = 0.12 + 0.1 * Math.sin(G.t * 4 + x * 1.3 + y * 0.7);
        ctx.fillStyle = `rgba(${P.radGlow},${a})`; ctx.fillRect(x * TILE - 2, y * TILE - 2, TILE + 4, TILE + 4);
      }
      ctx.restore();
    }
  }

  // Vector levels: blit cached map chunks; the chunk index wraps so the view can straddle the world seam.
  function drawVector() {
    const L = G.level, CH = L.CH;
    const vx0 = G.cam.x - W / 2, vx1 = G.cam.x + W / 2;
    const y0 = Math.max(0, Math.floor((G.cam.y - H / 2) / CH)), y1 = Math.min(L.chunksY - 1, Math.floor((G.cam.y + H / 2) / CH));
    for (const off of (L.wrap ? [-L.Wpx, 0, L.Wpx] : [0])) {
      const cx0 = Math.max(0, Math.floor((vx0 - off) / CH)), cx1 = Math.min(L.chunksX - 1, Math.floor((vx1 - off) / CH));
      for (let cy = y0; cy <= y1; cy++) for (let cx = cx0; cx <= cx1; cx++) ctx.drawImage(L.getChunk(cx, cy), cx * CH + off, cy * CH);
    }
  }

  // Text and arrows painted on the deck (Sci-Base zone names and the way up).
  function drawFloorMarks(L, x0, y0, x1, y1) {
    ctx.save();
    ctx.font = '700 15px Orbitron, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const lb of L.def.labels) {
      if (lb.x > x1 + 8 || lb.x < x0 - 8 || lb.y > y1 + 1 || lb.y < y0 - 1) continue;
      const px = lb.x * TILE, py = lb.y * TILE;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(lb.text, px + 1.5, py + 1.5);
      ctx.fillStyle = '#f4f4f4'; ctx.fillText(lb.text, px, py);
    }
    for (const ar of L.def.arrows || []) {
      if (ar.x > x1 + 2 || ar.x < x0 - 2 || ar.y > y1 + 2 || ar.y < y0 - 2) continue;
      ctx.save(); ctx.translate((ar.x + 0.5) * TILE, ar.y * TILE); ctx.rotate(ar.dir * Math.PI / 180);
      ctx.fillStyle = '#f5e14a'; ctx.beginPath(); ctx.moveTo(-16, -4); ctx.lineTo(4, -4); ctx.lineTo(4, -10); ctx.lineTo(18, 0); ctx.lineTo(4, 10); ctx.lineTo(4, 4); ctx.lineTo(-16, 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawExit(L) {
    const P = G.pal, e = L.exit, x = rx(e[0] * TILE), y = e[1] * TILE, w = (e[2] - e[0] + 1) * TILE, h = (e[3] - e[1] + 1) * TILE;
    const pulse = 0.5 + 0.5 * Math.sin(G.t * 3);
    ctx.save();
    ctx.fillStyle = `rgba(245,165,36,${0.08 + pulse * 0.1})`; ctx.fillRect(x, y, w, h);
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = -h; i < w + h; i += 16) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + 8, y); ctx.lineTo(x + i + 8 - h, y + h); ctx.lineTo(x + i - h, y + h); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = P.exit; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.fillStyle = '#0b0f14'; ctx.fillRect(x + w / 2 - 34, y + h / 2 - 10, 68, 20);
    ctx.fillStyle = P.exit; ctx.font = '700 12px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(P.label, x + w / 2, y + h / 2 + 1);
  }

  function drawCheckpoints(L) {
    for (const cp of L.checkpoints) {
      const col = cp.taken ? 'rgba(139,155,176,0.35)' : 'rgba(45,212,191,0.9)';
      if (cp.seg) { // a chevroned line across the road
        const ax = rx(cp.seg.ax), bx = ax + (cp.seg.bx - cp.seg.ax);
        ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ax, cp.seg.ay); ctx.lineTo(bx, cp.seg.by); ctx.stroke();
        ctx.setLineDash([6, 6]); ctx.strokeStyle = cp.taken ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ax, cp.seg.ay); ctx.lineTo(bx, cp.seg.by); ctx.stroke(); ctx.setLineDash([]);
        continue;
      }
      for (const [tx, ty] of cp.tiles) {
        const x = tx * TILE, y = ty * TILE;
        ctx.fillStyle = col;
        if (cp.axis === 'v') { ctx.fillRect(x + 14, y, 4, TILE); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + 8, y + k * 8); ctx.lineTo(x + 24, y + k * 8); ctx.lineTo(x + 16, y + k * 8 + 5); ctx.closePath(); ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; } }
        else { ctx.fillRect(x, y + 14, TILE, 4); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + k * 8, y + 8); ctx.lineTo(x + k * 8, y + 24); ctx.lineTo(x + k * 8 + 5, y + 16); ctx.closePath(); ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; } }
      }
    }
  }

  function drawFuel(L) {
    for (const f of L.fuel) {
      if (f.taken) continue;
      const bob = Math.sin(G.t * 3 + f.x) * 2;
      ctx.save(); ctx.translate(rx(f.x), f.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 10 - bob, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8341f'; roundRect(-8, -9, 16, 18, 3); ctx.fill();
      ctx.fillStyle = '#f5c518'; ctx.fillRect(-3, -12, 6, 4);
      ctx.fillStyle = '#7a1a10'; ctx.fillRect(-8, -1, 16, 2);
      ctx.fillStyle = '#fff'; ctx.font = '700 9px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('F', 0, 4.5);
      ctx.restore();
    }
  }

  function drawWrecks(L) {
    for (const wk of L.wrecks) {
      if (Math.abs(wrapDelta(wk.x - G.cam.x)) > W / 2 + 40 || Math.abs(wk.y - G.cam.y) > H / 2 + 40) continue;
      if (L.theme === 'sci') { // a round support column
        ctx.save(); ctx.translate(rx(wk.x), wk.y);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(3, 3, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2b3480'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8f9bff'; ctx.beginPath(); ctx.arc(-2, -2, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8dcff'; ctx.beginPath(); ctx.arc(-4, -4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f5e14a'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore(); continue;
      }
      ctx.save(); ctx.translate(rx(wk.x), wk.y); ctx.rotate(wk.a);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(-11, -5, 24, 14, 3); ctx.fill();
      ctx.fillStyle = '#2a2a2a'; roundRect(-12, -7, 24, 14, 3); ctx.fill();
      ctx.fillStyle = '#6b3a1f'; ctx.fillRect(-9, -6, 6, 5); ctx.fillRect(3, 1, 7, 5);
      ctx.fillStyle = '#111'; ctx.fillRect(-4, -5, 6, 10);
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(4, -9, 5, 2); ctx.fillRect(-10, 7, 5, 2);
      ctx.restore();
    }
  }

  function drawDoors(L) {
    for (const d of L.doors) {
      if (Math.abs(d.px + d.pw / 2 - G.cam.x) > W / 2 + 80 || Math.abs(d.py + d.ph / 2 - G.cam.y) > H / 2 + 80) continue;
      const open = d.openAmt > 0.98, closing = d.target === 0;
      // frame posts embedded in the walls at either end
      ctx.fillStyle = '#0b0f14';
      if (d.axis === 'v') { ctx.fillRect(d.px + 6, d.py - 6, 20, 6); ctx.fillRect(d.px + 6, d.py + d.ph, 20, 6); }
      else { ctx.fillRect(d.px - 6, d.py + 6, 6, 20); ctx.fillRect(d.px + d.pw, d.py + 6, 6, 20); }
      // rail
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      if (d.axis === 'v') ctx.fillRect(d.px + 14, d.py, 4, d.ph); else ctx.fillRect(d.px, d.py + 14, d.pw, 4);
      // panels
      for (const p of doorPanels(d)) {
        if (p.w <= 0 || p.h <= 0) continue;
        ctx.fillStyle = '#5a6b7d'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#8496a8'; if (d.axis === 'v') ctx.fillRect(p.x, p.y, 3, p.h); else ctx.fillRect(p.x, p.y, p.w, 3);
        ctx.fillStyle = '#f5c518';
        if (d.axis === 'v') { const ey = p.y === d.py ? p.y + p.h - 4 : p.y; ctx.fillRect(p.x, ey, p.w, 4); }
        else { const ex = p.x === d.px ? p.x + p.w - 4 : p.x; ctx.fillRect(ex, p.y, 4, p.h); }
      }
      // status lamp
      const lx = d.axis === 'v' ? d.px + 16 : d.px - 3, ly = d.axis === 'v' ? d.py - 3 : d.py + 16;
      ctx.fillStyle = open && !closing ? '#22c55e' : closing || !open ? '#ef4444' : '#f5c518';
      ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawCar() {
    const c = G.car; if (!c.visible) return;
    ctx.save(); ctx.translate(rx(c.x), c.y); ctx.rotate(c.angle);
    // headlight cone
    if (G.state !== 'title') {
      const gr = ctx.createLinearGradient(13, 0, 90, 0); gr.addColorStop(0, 'rgba(255,244,200,0.28)'); gr.addColorStop(1, 'rgba(255,244,200,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(92, -30); ctx.lineTo(92, 30); ctx.lineTo(12, 6); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; roundRect(-11, -4, 26, 14, 4); ctx.fill();
    // wheels (front pair turns with the steering)
    ctx.fillStyle = '#111';
    ctx.fillRect(-11, -8.5, 5, 2.5); ctx.fillRect(-11, 6, 5, 2.5);
    [[8.5, -7.25], [8.5, 7.25]].forEach(([wx, wy]) => { ctx.save(); ctx.translate(wx, wy); ctx.rotate(c.steerAmt * 0.35); ctx.fillRect(-2.5, -1.25, 5, 2.5); ctx.restore(); });
    // body
    ctx.fillStyle = '#d8341f'; roundRect(-13, -7, 26, 14, 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(-13, -7, 7, 14); ctx.fillRect(9, -7, 4, 14);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-13, -1.5, 26, 3);
    ctx.fillStyle = '#8fd3ff'; roundRect(1, -5, 5, 10, 1.5); ctx.fill();
    ctx.fillStyle = '#6fb0d8'; roundRect(-7, -5, 3, 10, 1); ctx.fill();
    ctx.fillStyle = '#fff4c2'; ctx.fillRect(12, -6, 1.5, 3); ctx.fillRect(12, 3, 1.5, 3);
    ctx.fillStyle = c.brake ? '#ff5a3c' : '#8a1e12'; ctx.fillRect(-13.5, -6, 1.5, 3); ctx.fillRect(-13.5, 3, 1.5, 3);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of G.particles) {
      const f = Math.max(0, p.life / p.max);
      const px = rx(p.x);
      if (p.type === 'smoke') { ctx.fillStyle = `rgba(${p.color},${f * p.alpha})`; ctx.beginPath(); ctx.arc(px, p.y, p.size + (1 - f) * p.grow, 0, Math.PI * 2); ctx.fill(); }
      else if (p.type === 'fire') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${p.color},${f})`; ctx.beginPath(); ctx.arc(px, p.y, p.size * (0.4 + f), 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      else { ctx.save(); ctx.translate(px, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, f * 2); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6); ctx.restore(); }
    }
  }

  function drawOverlays() {
    const c = G.car;
    ctx.drawImage(vignette, 0, 0);
    const radA = Math.pow(c.rad / 100, 2) * 0.28;
    if (radA > 0.01) { ctx.fillStyle = `rgba(80,255,60,${radA})`; ctx.fillRect(0, 0, W, H); }
    if (G.state === 'play' && G.timeLeft < 10) { const a = 0.18 + 0.12 * Math.sin(G.t * 10); ctx.strokeStyle = `rgba(239,68,68,${a})`; ctx.lineWidth = 14; ctx.strokeRect(0, 0, W, H); }
    if (G.flash > 0) { ctx.fillStyle = `rgba(${G.flashColor},${Math.min(1, G.flash) * 0.85})`; ctx.fillRect(0, 0, W, H); }
    if (G.state === 'title') { ctx.fillStyle = 'rgba(5,8,11,0.35)'; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- dashboard ----------
  const dash = {};
  function setText(el, v) { if (dash[el.id] !== v) { dash[el.id] = v; el.textContent = v; } }
  function buildGauge() {
    const cx = 60, cy = 64, r = 46;
    const pt = (deg, rr) => [cx + rr * Math.sin(deg * Math.PI / 180), cy - rr * Math.cos(deg * Math.PI / 180)];
    const arc = (a0, a1) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    let s = `<path class="arc" d="${arc(-120, 120)}"/><path class="arc ok" d="${arc(-120, 30)}"/><path class="arc warn" d="${arc(34, 84)}"/><path class="arc hot" d="${arc(88, 120)}"/>`;
    for (let i = 0; i <= 7; i++) { const a = -120 + i * (240 / 7); const [x0, y0] = pt(a, r - 9), [x1, y1] = pt(a, r - 14); s += `<line class="tick" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`; }
    s += `<line id="needle" class="needle" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 40}" transform="rotate(-120 ${cx} ${cy})"/><circle class="hub" cx="${cx}" cy="${cy}" r="4"/>`;
    ui.gauge.innerHTML = s;
    ui.needle = ui.gauge.querySelector('#needle');
  }
  buildGauge();

  function updateDash() {
    const c = G.car;
    const mph = Math.abs(c.speed) * 0.34;
    ui.needle.setAttribute('transform', `rotate(${(-120 + 240 * Math.min(1, mph / 140)).toFixed(1)} 60 64)`);
    setText(ui.speedVal, String(Math.round(mph)));
    const fuelW = c.fuel.toFixed(0) + '%';
    if (dash.fuelW !== fuelW) { dash.fuelW = fuelW; ui.fuelBar.style.width = fuelW; setText(ui.fuelVal, fuelW); ui.fuelBar.classList.toggle('low', c.fuel < 20); }
    const radW = c.rad.toFixed(0) + '%';
    if (dash.radW !== radW) { dash.radW = radW; ui.radBar.style.width = radW; setText(ui.radVal, radW); ui.radBar.classList.toggle('high', c.rad >= 50 && c.rad < 80); ui.radBar.classList.toggle('crit', c.rad >= 80); }
    setText(ui.timeVal, Math.max(0, G.timeLeft).toFixed(1));
    const urgent = G.state === 'play' && G.timeLeft < 15;
    if (dash.urgent !== urgent) { dash.urgent = urgent; ui.timerCard.classList.toggle('urgent', urgent); }
    setText(ui.scoreVal, G.score.toLocaleString());
    setText(ui.hiVal, G.hi.toLocaleString());
    if (dash.lives !== G.lives) { dash.lives = G.lives; ui.lives.innerHTML = '<i></i>'.repeat(Math.max(0, G.lives)); }
    drawMinimap();
  }

  function drawMinimap() {
    const L = G.level, { cv, s, ox, oy } = G.mini;
    const mx = (px) => ox + (px / TILE) * s, my = (py) => oy + (py / TILE) * s;
    mctx.drawImage(cv, 0, 0);
    const blink = Math.sin(G.t * 6) > 0;
    const e = L.exit; if (blink) { mctx.fillStyle = '#ffd27a'; mctx.fillRect(ox + e[0] * s - 1, oy + e[1] * s - 1, (e[2] - e[0] + 1) * s + 2, (e[3] - e[1] + 1) * s + 2); }
    for (const cp of L.checkpoints) { mctx.fillStyle = cp.taken ? '#2dd4bf' : '#e6edf3'; mctx.fillRect(ox + cp.x * s - 1, oy + cp.y * s - 1, s + 2, s + 2); }
    for (const f of L.fuel) if (!f.taken) { mctx.fillStyle = '#f5a524'; mctx.fillRect(ox + f.tx * s - 0.5, oy + f.ty * s - 0.5, s + 1, s + 1); }
    for (const d of L.doors) { mctx.fillStyle = d.openAmt > 0.98 ? '#22c55e' : '#ef4444'; mctx.fillRect(mx(d.px), my(d.py), d.pw / TILE * s, d.ph / TILE * s); }
    if (G.state !== 'title') {
      mctx.strokeStyle = 'rgba(230,237,243,0.35)'; mctx.lineWidth = 1;
      const vx = G.cam.x - W / 2, vw = W / TILE * s, vh = H / TILE * s;
      mctx.strokeRect(mx(vx) + 0.5, my(G.cam.y - H / 2) + 0.5, vw, vh);
      if (L.wrap && vx < 0) mctx.strokeRect(mx(vx + L.Wpx) + 0.5, my(G.cam.y - H / 2) + 0.5, vw, vh);
      if (L.wrap && vx + W > L.Wpx) mctx.strokeRect(mx(vx - L.Wpx) + 0.5, my(G.cam.y - H / 2) + 0.5, vw, vh);
      const c = G.car; mctx.fillStyle = '#ff3b1f'; mctx.beginPath(); mctx.arc(mx(wrapX(c.x)), my(c.y), 3, 0, Math.PI * 2); mctx.fill();
    }
  }

  // ---------- main loop ----------
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; // never negative: the first rAF stamp can predate `last`
    if (G.state === 'play' || G.state === 'crash' || G.state === 'levelcomplete' || G.state === 'title' || G.state === 'gameover') update(dt);
    render();
    requestAnimationFrame(frame);
  }

  showTitle();
  // Dev hook: ?sector=N&at=x,y[&dir=deg] jumps straight into a sector with the car at a tile position.
  const qs = new URLSearchParams(location.search);
  if (qs.has("sector")) {
    const i = clamp((parseInt(qs.get("sector"), 10) || 1) - 1, 0, LEVELS.length - 1);
    G.levelIndex = i; G.loop = 1; G.lives = START_LIVES; G.score = 0; prepareLevel(i);
    if (qs.has("at")) { const [ax, ay] = qs.get("at").split(",").map(Number); G.car.x = (ax + 0.5) * TILE; G.car.y = (ay + 0.5) * TILE; }
    if (qs.has("dir")) G.car.angle = Number(qs.get("dir")) * Math.PI / 180;
    snapCamera(); hideModal(); G.state = "play"; last = performance.now();
  }
  requestAnimationFrame(frame);
})();

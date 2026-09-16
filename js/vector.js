/* The Last V8 — vector levels.
   Smooth geometry (spline roads, lakes, a river, buildings, trees) is rasterised into a fine collision grid and
   painted into cached map chunks. The same painting code produces both, so what you see is what kills you. */
(function (root) {
  'use strict';

  const { T, TILE, smoothPath, smoothLoop } = root.LastV8Levels;
  const CH = 384; // chunk size in px

  const MEADOW = {
    grass: '#56c956', grassDark: '#45b045', grassLight: '#74dd74',
    road: '#8e8e8e', roadEdge: '#7b7b7b', dash: '#f4f4f4',
    water: '#2f5fe0', waterDeep: '#2448b8', shore: '#7fa8f2',
    hedge: '#1e6a2a', hedgeLight: '#2f8f3c',
    bush: '#3aa63a', bushLight: '#7de37d', tree: '#237a23', treeLight: '#3d9c3d',
    rock: '#d9d9d9', rockShade: '#8f8f8f',
    wallWhite: '#efefef', roofA: '#d94040', roofB: '#a52828', ridge: '#7a1a1a', door: '#3a2a1a', chimney: '#6e6e6e',
    field: '#e5e560', fieldDot: '#a9a92f', fence: '#c9b27a',
    base: '#f2f2f2', baseRoof: '#7fdede', baseRoofDark: '#4fb8b8',
    rail: '#f0f0f0', railDark: '#3a3a3a',
    flowers: ['#e04848', '#f6f0f0', '#f2d94a'],
  };

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const trace = (g, pts, close) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); if (close) g.closePath(); };
  const inBounds = (b, x, y, m) => !b || (x + m >= b.x0 && x - m <= b.x1 && y + m >= b.y0 && y - m <= b.y1);

  // Geometry in the level's own tile unit (px per tile); the game's TILE is only used for its tile-space fields.
  function prepareGeometry(def, unit) {
    const s = (v) => v * unit;
    return {
      unit,
      roads: (def.roads || []).map((r) => ({ w: s(r.w), dashed: !!r.dashed, pts: smoothPath(r.pts, r.loop, def.w, unit) })),
      river: def.river ? { w: s(def.river.w), pts: smoothPath(def.river.pts, true, def.w, unit) } : null,
      lakes: (def.lakes || []).map((l) => smoothLoop(l, unit)),
      bridges: (def.bridges || []).map((b) => ({ w: s(b.w), a: [s(b.pts[0][0]), s(b.pts[0][1])], b: [s(b.pts[1][0]), s(b.pts[1][1])] })),
      hedges: (def.hedges || []).map((h) => ({ w: unit * 0.6, pts: smoothPath(h, false, undefined, unit) })),
      buildings: (def.buildings || []).map((b) => ({ kind: b.kind, x: s(b.x), y: s(b.y), w: s(b.w), h: s(b.h) })),
    };
  }

  // ---- painting ----
  function paintRoadEdges(g, geo, P) {
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = P.roadEdge;
    for (const r of geo.roads) { trace(g, r.pts); g.lineWidth = r.w + 5; g.stroke(); }
  }
  function paintRoadFills(g, geo, P) {
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = P ? P.road : '#000';
    for (const r of geo.roads) { trace(g, r.pts); g.lineWidth = r.w; g.stroke(); }
  }
  function paintRoadDashes(g, geo, P) {
    g.lineCap = 'butt'; g.setLineDash([26, 22]); g.strokeStyle = P.dash; g.lineWidth = 3;
    for (const r of geo.roads) if (r.dashed) { trace(g, r.pts); g.stroke(); }
    g.setLineDash([]);
  }
  function paintShores(g, geo, P) {
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = P.shore;
    for (const l of geo.lakes) { trace(g, l, true); g.lineWidth = 5; g.stroke(); }
    if (geo.river) { trace(g, geo.river.pts); g.lineWidth = geo.river.w + 5; g.stroke(); }
  }
  function paintWaterFills(g, geo, P) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.fillStyle = g.strokeStyle = P ? P.water : '#000';
    for (const l of geo.lakes) { trace(g, l, true); g.fill(); }
    if (geo.river) { trace(g, geo.river.pts); g.lineWidth = geo.river.w; g.stroke(); }
  }
  function paintRiverThread(g, geo, P) {
    if (!geo.river) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = P.waterDeep; g.lineWidth = geo.river.w * 0.35; trace(g, geo.river.pts); g.stroke();
  }
  // classification-only helpers (black, no edges)
  function paintRoads(g, geo) { paintRoadFills(g, geo, null); }
  function paintWater(g, geo) { paintWaterFills(g, geo, null); }
  function paintBridges(g, geo, P) {
    g.lineCap = 'butt';
    for (const b of geo.bridges) {
      g.strokeStyle = P ? P.road : '#000'; g.lineWidth = b.w;
      g.beginPath(); g.moveTo(b.a[0], b.a[1]); g.lineTo(b.b[0], b.b[1]); g.stroke();
      if (!P) continue;
      const dx = b.b[0] - b.a[0], dy = b.b[1] - b.a[1], len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, off = b.w / 2 - 3;
      for (const sgn of [-1, 1]) {
        const ax = b.a[0] + nx * off * sgn, ay = b.a[1] + ny * off * sgn, bx = b.b[0] + nx * off * sgn, by = b.b[1] + ny * off * sgn;
        g.strokeStyle = P.railDark; g.lineWidth = 5; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        g.strokeStyle = P.rail; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        g.fillStyle = P.railDark;
        for (let d = 6; d < len; d += 20) circle(g, ax + dx / len * d, ay + dy / len * d, 2.6);
      }
    }
  }
  function paintHedges(g, geo, P) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = P ? P.hedge : '#000';
    for (const h of geo.hedges) { trace(g, h.pts); g.lineWidth = h.w; g.stroke(); }
    if (!P) return;
    g.fillStyle = P.hedgeLight;
    for (const h of geo.hedges) { const r = h.w * 0.22, o = h.w * 0.16; for (let i = 0; i < h.pts.length; i += 2) circle(g, h.pts[i][0] + ((i >> 1) % 2 ? o : -o), h.pts[i][1] + ((i >> 1) % 3 - 1) * o, r); }
  }
  function paintBuilding(g, b, P, k) { // k: detail scale (1 at 32px tiles)
    const { x, y, w, h } = b;
    if (!P) { g.fillStyle = '#000'; g.fillRect(x, y, w, h); return; }
    g.save(); g.translate(x, y); g.scale(k, k); paintBuildingDetail(g, { x: 0, y: 0, w: w / k, h: h / k, kind: b.kind }, P); g.restore();
  }
  function paintBuildingDetail(g, b, P) {
    const { x, y, w, h } = b;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 5, y + 5, w, h);
    if (b.kind === 'house') {
      g.fillStyle = P.wallWhite; g.fillRect(x, y, w, h);
      const ix = x + 4, iy = y + 4, iw = w - 8, ih = h - 8;
      g.fillStyle = P.roofA; g.fillRect(ix, iy, iw, ih / 2);
      g.fillStyle = P.roofB; g.fillRect(ix, iy + ih / 2, iw, ih / 2);
      g.fillStyle = P.ridge; g.fillRect(ix, iy + ih / 2 - 1, iw, 2);
      g.fillStyle = P.chimney; g.fillRect(ix + iw - 18, iy + 6, 9, 9);
      g.fillStyle = P.door; g.fillRect(x + w / 2 - 6, y + h - 5, 12, 5);
    } else if (b.kind === 'pool') { // cyan-walled pool with a white deck
      g.fillStyle = P.baseRoof; g.fillRect(x, y, w, h);
      g.fillStyle = P.wallWhite; g.fillRect(x + 5, y + 5, w - 10, h - 10);
      g.fillStyle = P.baseRoofDark; for (let xx = x + 12; xx < x + w - 10; xx += 12) for (let yy = y + 12; yy < y + h - 10; yy += 12) g.fillRect(xx, yy, 4, 4);
    } else if (b.kind === 'shed') { // long white shed with a grey roof
      g.fillStyle = P.wallWhite; g.fillRect(x, y, w, h);
      g.fillStyle = '#c9c9c9'; g.fillRect(x + 4, y + 4, w - 8, h - 8);
      g.fillStyle = '#a8a8a8'; g.fillRect(x + 4, y + h / 2 - 1, w - 8, 2);
      g.fillStyle = P.door; g.fillRect(x + w - 16, y + h - 5, 10, 5);
    } else if (b.kind === 'field') {
      g.fillStyle = P.field; g.fillRect(x, y, w, h);
      g.fillStyle = P.fieldDot;
      for (let yy = y + 7; yy < y + h - 4; yy += 12) for (let xx = x + 6; xx < x + w - 4; xx += 10) g.fillRect(xx, yy, 3, 3);
      g.strokeStyle = P.fence; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    } else { // base
      g.fillStyle = P.base; g.fillRect(x, y, w, h);
      g.fillStyle = P.baseRoof; g.fillRect(x + 8, y + 8, w - 16, h - 16);
      g.fillStyle = P.baseRoofDark; for (let xx = x + 14; xx < x + w - 12; xx += 16) g.fillRect(xx, y + 8, 4, h - 16);
      g.fillStyle = '#1c1c1c'; g.fillRect(x + w - 30, y - 14, 4, 14); g.fillRect(x + w - 40, y - 14, 24, 3);
      g.fillStyle = '#f5a524'; for (let xx = x; xx < x + w; xx += 16) g.fillRect(xx, y, 8, 4);
    }
  }
  function paintTree(g, t, P) {
    if (t.kind === 2) {
      g.fillStyle = P.rockShade; circle(g, t.x + 2, t.y + 2, t.r);
      g.fillStyle = P.rock; circle(g, t.x, t.y, t.r);
      g.fillStyle = '#ffffff'; circle(g, t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.35);
      return;
    }
    const dark = t.kind === 1 ? P.tree : P.bush, light = t.kind === 1 ? P.treeLight : P.bushLight;
    g.fillStyle = 'rgba(0,0,0,0.25)'; circle(g, t.x + 3, t.y + 3, t.r);
    g.fillStyle = dark; circle(g, t.x, t.y, t.r);
    g.fillStyle = light; circle(g, t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.5);
    if (t.kind === 1) { g.fillStyle = 'rgba(0,0,0,0.18)'; circle(g, t.x + t.r * 0.35, t.y + t.r * 0.3, t.r * 0.3); }
  }
  function paintDecor(g, d, P) {
    if (d.k === 3) { g.strokeStyle = P.grassDark; g.lineWidth = 1.5; g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - 2, d.y - 5); g.moveTo(d.x + 2, d.y); g.lineTo(d.x + 3, d.y - 5); g.stroke(); return; }
    g.fillStyle = P.flowers[d.k]; circle(g, d.x, d.y, 2.2);
    g.fillStyle = '#5a3a1a'; circle(g, d.x, d.y, 0.8);
  }

  // Full display paint of the scene (in world px) within bounds; P is the palette.
  const DISPLAY_LAYERS = [
    (g, L) => paintRoadEdges(g, L.geo, L.palette),
    (g, L) => paintRoadFills(g, L.geo, L.palette),
    (g, L) => paintRoadDashes(g, L.geo, L.palette),
    (g, L) => paintShores(g, L.geo, L.palette),
    (g, L) => paintWaterFills(g, L.geo, L.palette),
    (g, L) => paintRiverThread(g, L.geo, L.palette),
    (g, L) => paintBridges(g, L.geo, L.palette),
    (g, L) => paintHedges(g, L.geo, L.palette),
    (g, L, b) => { for (const bd of L.geo.buildings) if (inBounds(b, bd.x + bd.w / 2, bd.y + bd.h / 2, Math.max(bd.w, bd.h))) paintBuilding(g, bd, L.palette, L.unit / TILE); },
    (g, L, b) => { for (const d of L.decor) if (inBounds(b, d.x, d.y, 6)) paintDecor(g, d, L.palette); },
    (g, L, b) => { for (const t of L.trees) if (inBounds(b, t.x, t.y, t.r + 4)) paintTree(g, t, L.palette); },
  ];

  function overhangOf(geo, Wpx) {
    let over = 0;
    const pts = (list) => { for (const [x] of list) over = Math.max(over, x - Wpx, -x); };
    for (const r of geo.roads) pts(r.pts);
    if (geo.river) pts(geo.river.pts);
    for (const l of geo.lakes) pts(l);
    for (const h of geo.hedges) pts(h.pts);
    for (const b of geo.bridges) { pts([b.a, b.b]); }
    for (const b of geo.buildings) over = Math.max(over, b.x + b.w - Wpx, -b.x);
    return over + 2 * geo.unit;
  }

  function buildVectorLevel(def) {
    const unit = def.unit || TILE, gs = unit / TILE; // gs converts level tiles to the game's 32px tile space
    const w = def.w, h = def.h, cell = def.cell || 8, Wpx = w * unit, Hpx = h * unit;
    const gw = Math.ceil(Wpx / cell), gh = Math.ceil(Hpx / cell);
    const grid = new Uint8Array(gw * gh).fill(T.ROUGH);
    const geo = prepareGeometry(def, unit);
    const offsets = def.wrap ? [-Wpx, 0, Wpx] : [0];
    const P = MEADOW;

    // Classification passes: paint one layer in black at 1/cell scale, read the alpha back into the grid.
    const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const pass = (paint, value) => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, gw, gh);
      for (const off of offsets) { g.setTransform(1 / cell, 0, 0, 1 / cell, off / cell, 0); paint(g); }
      const d = g.getImageData(0, 0, gw, gh).data;
      for (let i = 0; i < gw * gh; i++) if (d[i * 4 + 3] > 100) grid[i] = value;
    };
    pass((c) => paintRoads(c, geo), T.ROAD);
    pass((c) => paintWater(c, geo), T.WATER);
    pass((c) => paintBridges(c, geo, null), T.BRIDGE);
    pass((c) => { paintHedges(c, geo, null); for (const b of geo.buildings) paintBuilding(c, b, null); }, T.WALL);
    const e = def.exit;
    for (let y = Math.floor(e[1] * unit / cell); y < Math.ceil((e[3] + 1) * unit / cell); y++) for (let x = Math.floor(e[0] * unit / cell); x < Math.ceil((e[2] + 1) * unit / cell); x++) if (x >= 0 && y >= 0 && x < gw && y < gh) grid[y * gw + x] = T.EXIT;

    const wrapX = (px) => def.wrap ? ((px % Wpx) + Wpx) % Wpx : px;
    const wrapDelta = (dx) => { if (!def.wrap) return dx; dx = ((dx % Wpx) + Wpx) % Wpx; return dx > Wpx / 2 ? dx - Wpx : dx; };
    const tileAt = (px, py) => {
      const cx = Math.floor(wrapX(px) / cell), cy = Math.floor(py / cell);
      if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) return T.WALL;
      return grid[cy * gw + cx];
    };

    // Trees and rocks: scattered on open grass, kept clear of roads, then stamped into the grid as solid.
    const rnd = mulberry32((def.trees && def.trees.seed) || 1), trees = [], want = (def.trees && def.trees.count) || 250;
    const clear = (x, y, r) => { for (let yy = y - r; yy <= y + r; yy += cell) for (let xx = x - r; xx <= x + r; xx += cell) if (tileAt(xx, yy) !== T.ROUGH) return false; return true; };
    for (let n = 0; n < want * 8 && trees.length < want; n++) {
      const x = rnd() * Wpx, y = 12 + rnd() * (Hpx - 24), k = rnd(), kind = k < 0.5 ? 0 : k < 0.8 ? 1 : 2;
      const rk = Math.max(0.55, gs), r = (kind === 0 ? 8 + rnd() * 4 : kind === 1 ? 11 + rnd() * 5 : 5 + rnd() * 3) * rk;
      if (!clear(x, y, r + 10)) continue;
      if (trees.some((t) => Math.hypot(wrapDelta(t.x - x), t.y - y) < t.r + r + 6)) continue;
      trees.push({ x, y, r, kind });
      for (let yy = Math.floor((y - r) / cell); yy <= Math.floor((y + r) / cell); yy++) for (let xx = Math.floor((x - r) / cell); xx <= Math.floor((x + r) / cell); xx++) {
        if (yy < 0 || yy >= gh) continue;
        const cxp = (xx + 0.5) * cell, cyp = (yy + 0.5) * cell;
        if (Math.hypot(cxp - x, cyp - y) <= r) grid[yy * gw + ((xx % gw) + gw) % gw] = T.WALL;
      }
    }
    const decor = [];
    for (let n = 0; n < Math.round(900 * gs * gs); n++) { const x = rnd() * Wpx, y = rnd() * Hpx; if (tileAt(x, y) !== T.ROUGH) continue; decor.push({ x, y, k: Math.floor(rnd() * 4) }); }

    // Tile-space fields for the game (it multiplies by TILE and adds half a tile): x/32 - 0.5 lands exactly on px x.
    const tileOf = (px) => px / TILE - 0.5;
    const checkpoints = def.checkpoints.map((c, i) => {
      const half = ((c.len || 3.4) * unit) / 2, d = c.dir * Math.PI / 180, nx = -Math.sin(d), ny = Math.cos(d), cx = c.x * unit, cy = c.y * unit;
      return { id: i, x: tileOf(cx), y: tileOf(cy), dir: c.dir, seg: { ax: cx - nx * half, ay: cy - ny * half, bx: cx + nx * half, by: cy + ny * half }, tiles: [], taken: false };
    });
    const fuel = def.fuel.map(([x, y]) => ({ x: x * unit, y: y * unit, tx: x * gs, ty: y * gs, taken: false }));
    const wrecks = def.wrecks.map(([x, y, a]) => ({ x: x * unit, y: y * unit, a, r: 11, smoke: Math.random() }));
    // exit as a game tile rect: the game draws (e2 - e0 + 1) tiles wide, so encode the far edge minus one tile
    const exit = [e[0] * gs, e[1] * gs, (e[2] + 1) * gs - 1, (e[3] + 1) * gs - 1];

    const L = {
      def, kind: 'vector', wrap: !!def.wrap, unit, w: w * gs, h: h * gs, Wpx, Hpx, cell, gw, gh, grid, geo, trees, decor, palette: P,
      tileAt, get: (tx, ty) => tileAt((tx + 0.5) * TILE, (ty + 0.5) * TILE),
      checkpoints, doors: [], fuel, wrecks, exit, start: { x: tileOf(def.start.x * unit), y: tileOf(def.start.y * unit), dir: def.start.dir }, theme: def.theme,
      chunksX: Math.ceil(Wpx / CH), chunksY: Math.ceil(Hpx / CH), CH, chunks: new Map(), overhang: overhangOf(geo, Wpx),
    };
    L.getChunk = (cx, cy) => {
      const key = cx + ',' + cy;
      let c = L.chunks.get(key);
      if (c) return c;
      c = paintChunk(L, cx, cy); L.chunks.set(key, c);
      if (L.chunks.size > 40) L.chunks.delete(L.chunks.keys().next().value);
      return c;
    };
    return L;
  }

  function paintChunk(L, cx, cy) {
    const P = L.palette, cv = document.createElement('canvas'); cv.width = cv.height = CH;
    const g = cv.getContext('2d'), wx = cx * CH, wy = cy * CH;
    g.fillStyle = P.grass; g.fillRect(0, 0, CH, CH);
    const r = mulberry32(cx * 131 + cy * 7 + 1);
    g.fillStyle = P.grassDark; for (let i = 0; i < 240; i++) g.fillRect((r() * CH) | 0, (r() * CH) | 0, 2, 2);
    g.fillStyle = P.grassLight; for (let i = 0; i < 90; i++) g.fillRect((r() * CH) | 0, (r() * CH) | 0, 2, 1);
    // Only the copies of the world that actually reach this chunk (roads may be authored past the seam).
    const offsets = (L.wrap ? [-L.Wpx, 0, L.Wpx] : [0]).filter((off) => !(wx + CH < off - L.overhang || wx > off + L.Wpx + L.overhang));
    for (const layer of DISPLAY_LAYERS) {
      for (const off of offsets) {
        g.setTransform(1, 0, 0, 1, off - wx, -wy);
        layer(g, L, { x0: wx - off - 48, y0: wy - 48, x1: wx - off + CH + 48, y1: wy + CH + 48 });
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    return cv;
  }

  root.LastV8Vector = { buildVectorLevel, CH };
})(window);

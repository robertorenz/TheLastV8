/* The Last V8 — level data and grid builder.
   Maps are authored as axis-aligned road paths carved into solid rock, then decorated.
   Coordinates are tiles. Headings are degrees in screen space: 0 = east, 90 = south, 180 = west, 270 = north. */
(function (root) {
  'use strict';

  const TILE = 32;
  const T = { WALL: 0, ROAD: 1, ROUGH: 2, RAD: 3, EXIT: 4, WATER: 5, BRIDGE: 6, DIRT: 7 };

  const LEVELS = [
    {
      // Modelled on the original surface map: bright grass, winding grey roads, two dashed highways along the top,
      // a river with plank bridges, lakes, farmhouses and a crop field. The world wraps horizontally: drive off the
      // right edge and you arrive from the left. Geometry is in tiles (floats allowed); x may run past w for wrap joins.
      kind: 'vector',
      wrap: true,
      cell: 8,
      name: 'Riverlands',
      subtitle: 'Surface run',
      tagline: 'Winding roads, a river, and a world that loops',
      preview: { x: 84, y: 48 },
      theme: 'meadow',
      w: 160, h: 64,
      time: 80,
      ambientRad: 0.4,
      briefing: 'The last V8 is parked on the highway with the tank full. The base is a tunnel mouth on the far side of the river, and the road network loops the whole valley: keep driving east and you come back round from the west. Grass is slow but survivable; trees, hedges, houses and water are not.',
      start: { x: 148, y: 12, dir: 0 },
      exit: [85, 59, 90, 61],
      roads: [
        { w: 3.2, dashed: true, pts: [[40, 12], [70, 12], [100, 12], [130, 12], [160, 12], [166, 12.5], [171, 15], [175, 20], [178, 26], [180, 29]] },
        { w: 3.2, dashed: true, pts: [[84, 19], [110, 19], [140, 19], [160, 19], [166, 19.5], [171, 22], [175, 26], [178, 29.5]] },
        { w: 3, loop: true, pts: [[0, 28], [10, 29], [20, 29], [30, 26], [42, 23], [54, 25], [64, 30], [74, 32], [86, 27], [98, 23], [110, 25], [122, 30], [134, 31], [146, 27], [154, 26], [160, 28]] },
        { w: 3, loop: true, pts: [[0, 43], [12, 45], [24, 42], [36, 39], [48, 41], [60, 45], [72, 44], [84, 40], [96, 37], [108, 40], [120, 44], [132, 45], [144, 42], [152, 41], [160, 43]] },
        { w: 2.6, pts: [[30, 26], [28, 32], [27, 37], [24, 42]] },
        { w: 2.6, pts: [[64, 30], [62, 36], [60, 45]] },
        { w: 2.6, pts: [[98, 23], [100, 30], [96, 37]] },
        { w: 2.6, pts: [[134, 31], [136, 37], [132, 45]] },
        { w: 2.4, pts: [[24, 42], [22, 47], [22, 52], [24, 57]] },
        { w: 2.4, pts: [[84, 40], [82, 46], [82, 52], [84, 57]] },
        { w: 2.4, pts: [[132, 45], [134, 50], [134, 57]] },
        { w: 2.8, loop: true, pts: [[0, 58], [14, 57], [24, 57], [40, 59], [56, 58], [70, 57], [84, 57], [100, 59], [116, 58], [134, 57], [148, 58], [160, 58]] },
        { w: 2.6, pts: [[110, 25], [116, 20], [124, 22], [126, 27], [122, 30]] },
        // dead ends: a washed-out road that runs into the river, and a spur that peters out below the highway
        { w: 2.4, pts: [[48, 41], [46, 46], [44, 52]] },
        { w: 2.4, pts: [[146, 27], [150, 24], [155, 23]] },
      ],
      river: { w: 3.4, pts: [[0, 50], [14, 49.5], [28, 51], [42, 49], [56, 52], [70, 54], [82, 50], [94, 47], [108, 49], [122, 52], [136, 51], [150, 49.5], [160, 50]] },
      lakes: [
        [[40, 0], [56, -1], [66, 3], [62, 8], [50, 9], [42, 6]],
        [[8, 32], [18, 31], [22, 35], [18, 39], [10, 39], [6, 36]],
        [[110, 4], [122, 3], [128, 6], [123, 9], [113, 9]],
      ],
      bridges: [{ w: 2.4, pts: [[22, 46.5], [22, 53]] }, { w: 2.4, pts: [[82, 46.5], [82, 53]] }, { w: 2.4, pts: [[134, 47], [134, 54]] }],
      hedges: [[[46, 15], [80, 15]], [[100, 15], [130, 15.5]], [[3, 54], [16, 53.5]]],
      buildings: [
        { kind: 'house', x: 32, y: 33, w: 6, h: 4 }, { kind: 'house', x: 104, y: 29, w: 6, h: 4 }, { kind: 'house', x: 140, y: 33, w: 5, h: 4 },
        { kind: 'house', x: 56, y: 61, w: 6, h: 3.5 }, { kind: 'house', x: 8, y: 60, w: 5, h: 3.5 }, { kind: 'house', x: 100, y: 4, w: 7, h: 4 },
        { kind: 'field', x: 134, y: 1.5, w: 22, h: 7 },
        { kind: 'base', x: 80, y: 60.5, w: 16, h: 5 },
      ],
      fuel: [[60, 12], [36, 39], [120, 44], [116, 58]],
      checkpoints: [
        { x: 156, y: 12, dir: 0 }, { x: 20, y: 29, dir: 0 }, { x: 27, y: 36, dir: 100 }, { x: 36, y: 39, dir: 0 }, { x: 22, y: 45, dir: 90 },
        { x: 62, y: 36, dir: 100 }, { x: 100, y: 30, dir: 90 }, { x: 82, y: 45, dir: 90 }, { x: 136, y: 37, dir: 95 }, { x: 134, y: 49, dir: 90 },
        { x: 60, y: 58, dir: 0 }, { x: 110, y: 58, dir: 180 },
      ],
      wrecks: [[90, 11.2, 0.3], [118, 12.8, 1.9], [72, 44, 0.7], [40, 59, 2.4]],
      doors: [],
      trees: { count: 320, seed: 7 },
    },
    {
      name: 'The Wasteland',
      subtitle: 'Badlands',
      tagline: 'Ruins, rubble and radiation pools',
      preview: { x: 34, y: 47 },
      theme: 'surface',
      w: 96, h: 72,
      time: 80,
      ambientRad: 0.9,
      briefing: 'Nuclear war has left the surface hot and the roads in ruins. You are driving the last V8 still running. Follow the road through the wasteland to the base entrance before the countdown ends. Touch a wall and the car is gone. Not every road leads somewhere.',
      start: { x: 5, y: 66, dir: 0 },
      exit: [86, 17, 90, 19],
      path: [
        { w: 3, pts: [[5, 66], [34, 66], [34, 56], [14, 56], [14, 44], [46, 44], [46, 60], [70, 60], [70, 34]] },
        { w: 2, pts: [[70, 34], [56, 34], [56, 22]] },
        { w: 3, pts: [[56, 22], [26, 22], [26, 8], [88, 8], [88, 18]] },
        // dead ends
        { w: 3, pts: [[46, 44], [60, 44]] },
        { w: 3, pts: [[70, 34], [70, 20], [62, 20]] },
      ],
      rough: [[20, 43, 27, 45], [38, 59, 44, 61], [70, 44, 71, 52], [32, 21, 36, 23]],
      rad: [[36, 44, 37, 45], [57, 43, 60, 45], [62, 19, 66, 21], [69, 20, 71, 26], [60, 7, 61, 8]],
      fuel: [[14, 48], [60, 60], [26, 14], [72, 8]],
      checkpoints: [
        { x: 14, y: 50, dir: 270 }, { x: 46, y: 52, dir: 90 }, { x: 70, y: 46, dir: 270 },
        { x: 40, y: 22, dir: 180 }, { x: 52, y: 8, dir: 0 },
      ],
      wrecks: [[36, 9, 0.3], [46, 7, 1.2], [56, 9, 2.1], [66, 7, 0.6], [76, 9, 1.7]],
      doors: [],
    },
    {
      name: 'The Base',
      subtitle: 'Underground',
      tagline: 'Steel corridors and blast doors on timers',
      preview: { x: 27, y: 19 },
      theme: 'base',
      w: 96, h: 72,
      time: 80,
      ambientRad: 0,
      briefing: 'You made it underground. The corridors are sealed by blast doors on automatic cycles: time your run or wait for the gap, because a closed door is as hard as rock. Coolant leaks have flooded some sections with radiation.',
      start: { x: 4, y: 4, dir: 0 },
      exit: [87, 65, 90, 67],
      path: [
        { w: 3, pts: [[4, 4], [40, 4]] },
        { w: 2, pts: [[40, 4], [40, 16], [12, 16], [12, 30]] },
        { w: 3, pts: [[12, 30], [50, 30]] },
        { w: 2, pts: [[50, 30], [50, 20], [78, 20]] },
        { w: 3, pts: [[78, 20], [78, 44]] },
        { w: 2, pts: [[78, 44], [30, 44]] },
        { w: 3, pts: [[30, 44], [30, 58], [64, 58]] },
        { w: 2, pts: [[64, 58], [64, 66], [88, 66]] },
        // dead ends
        { w: 2, pts: [[40, 16], [52, 16]] },
        { w: 3, pts: [[78, 44], [78, 54]] },
      ],
      rough: [[20, 29, 24, 31], [58, 57, 62, 59], [70, 43, 72, 44]],
      rad: [[48, 15, 52, 16], [77, 52, 79, 54], [77, 30, 78, 31], [48, 43, 50, 44]],
      fuel: [[12, 24], [78, 26], [30, 52]],
      checkpoints: [
        { x: 12, y: 22, dir: 90 }, { x: 64, y: 20, dir: 0 }, { x: 78, y: 36, dir: 90 },
        { x: 40, y: 44, dir: 180 }, { x: 48, y: 58, dir: 0 },
      ],
      wrecks: [[24, 30, 0.5], [36, 29, 1.0], [44, 31, 2.2], [40, 58, 0.4], [52, 57, 1.7]],
      doors: [
        { x: 30, y: 16, axis: 'v', period: 6, open: 3.6, phase: 0 },
        { x: 50, y: 25, axis: 'h', period: 5.5, open: 3.2, phase: 2 },
        { x: 56, y: 44, axis: 'v', period: 6, open: 3.4, phase: 1 },
        { x: 42, y: 44, axis: 'v', period: 6, open: 3.4, phase: 4 },
        { x: 64, y: 62, axis: 'h', period: 5, open: 3, phase: 0.5 },
      ],
    },
    {
      name: 'Reactor Core',
      subtitle: 'Containment',
      tagline: 'Passages barely wider than the car',
      preview: { x: 66, y: 20 },
      theme: 'core',
      w: 96, h: 72,
      time: 75,
      ambientRad: 0.5,
      briefing: 'Final stretch. The reactor core is failing, the passages are barely wider than the car, and the doors cycle faster. Get the V8 into the vault and this is over.',
      start: { x: 5, y: 36, dir: 0 },
      exit: [3, 61, 7, 63],
      path: [
        { w: 3, pts: [[5, 36], [20, 36]] },
        { w: 2, pts: [[20, 36], [20, 10], [36, 10], [36, 30], [52, 30], [52, 8], [68, 8], [68, 40]] },
        { w: 3, pts: [[68, 40], [84, 40]] },
        { w: 2, pts: [[84, 40], [84, 64], [46, 64], [46, 50], [20, 50]] },
        { w: 3, pts: [[20, 50], [20, 62], [6, 62]] },
        // dead ends
        { w: 2, pts: [[36, 30], [36, 40]] },
        { w: 2, pts: [[84, 64], [92, 64]] },
      ],
      rough: [[26, 9, 30, 10], [68, 20, 68, 24], [60, 63, 64, 64]],
      rad: [[44, 29, 45, 30], [35, 37, 36, 40], [57, 63, 58, 64], [90, 63, 92, 64], [68, 30, 68, 31], [84, 56, 84, 57]],
      fuel: [[20, 24], [52, 18], [84, 48]],
      checkpoints: [
        { x: 20, y: 20, dir: 270 }, { x: 36, y: 22, dir: 90 }, { x: 56, y: 8, dir: 0 }, { x: 68, y: 28, dir: 90 },
        { x: 84, y: 50, dir: 90 }, { x: 60, y: 64, dir: 180 }, { x: 30, y: 50, dir: 180 },
      ],
      wrecks: [[68, 14, 0.3], [67, 20, 1.0], [68, 26, 2.0], [76, 40, 0.7], [74, 64, 1.4]],
      doors: [
        { x: 36, y: 20, axis: 'h', period: 5, open: 2.8, phase: 0 },
        { x: 60, y: 8, axis: 'v', period: 5, open: 2.8, phase: 2 },
        { x: 84, y: 52, axis: 'h', period: 4.5, open: 2.6, phase: 1 },
        { x: 32, y: 50, axis: 'v', period: 5, open: 2.8, phase: 3 },
        { x: 46, y: 58, axis: 'h', period: 5, open: 2.8, phase: 0.5 },
      ],
    },
  ];

  // ---- Sci-Base: modelled on the original's underground map. Eleven stacked corridor "zones" (A at the bottom,
  // K at the top) joined by short vertical links; some corridors are cut by machinery so the link is only reachable
  // from one side, and the other side becomes a blind alley. Labels and arrows are painted on the floor. ----
  function sciBase() {
    const W = 112, H = 80, ROW0 = 74, STEP = 7;
    // per zone: link x up to the next zone, optional cut [x0, x1], optional dead-end link down from the zone above
    const zones = [
      { up: 106 }, { up: 52, cut: [44, 48], spur: 20 }, { up: 8 }, { up: 56, cut: [60, 64], spur: 100 }, { up: 104 },
      { up: 36, cut: [30, 34], spur: 12 }, { up: 8 }, { up: 68, cut: [70, 74], spur: 100 }, { up: 104 }, { up: 58, cut: [50, 54], spur: 20 }, {},
    ];
    const path = [], rad = [], rough = [], labels = [], arrows = [], checkpoints = [], fuel = [], wrecks = [];
    const letters = 'ABCDEFGHIJK';
    zones.forEach((z, i) => {
      const y = ROW0 - i * STEP;
      if (z.cut) { path.push({ w: 3, pts: [[4, y], [z.cut[0] - 1, y]] }); path.push({ w: 3, pts: [[z.cut[1] + 1, y], [108, y]] }); }
      else path.push({ w: 3, pts: [[4, y], [108, y]] });
      labels.push({ x: 7, y: y - 0.55, text: 'ZONE ' + letters[i] });
      if (z.up !== undefined) {
        path.push({ w: 2, pts: [[z.up, y], [z.up, y - STEP]] });
        arrows.push({ x: z.up, y: y + 1.0, dir: 270 });
        checkpoints.push({ x: z.up, y: y - STEP + 2, dir: 270 });
      }
      if (z.spur !== undefined) { path.push({ w: 2, pts: [[z.spur, y], [z.spur, y - STEP]] }); }
    });
    // blind alleys get a lure or a leak
    rad.push([4, 66, 8, 68], [100, 52, 106, 54], [4, 38, 7, 40], [104, 24, 108, 26]);
    fuel.push([20, 67], [90, 60], [12, 39], [60, 25], [30, 11]);
    rough.push([20, 73, 26, 75], [70, 45, 76, 47], [40, 31, 46, 33], [80, 17, 86, 19]);
    // columns standing in the corridors, offset to one lane so there is always a way past
    wrecks.push([40, 73, 0], [64, 75, 0], [80, 66, 0], [30, 61, 0], [24, 52, 0], [40, 54, 0], [60, 47, 0], [84, 45, 0], [50, 40, 0], [70, 33, 0], [20, 31, 0], [40, 24, 0], [56, 26, 0], [80, 19, 0], [90, 17, 0], [80, 12, 0], [70, 5, 0], [90, 3, 0]);
    labels.push({ x: 84, y: 3.45, text: 'SCI-BASE' });
    arrows.push({ x: 96, y: 4, dir: 0 }, { x: 100, y: 4, dir: 0 });
    return {
      name: 'Sci-Base', subtitle: 'Underground', tagline: 'Eleven zones of machinery between you and the lab', preview: { x: 100, y: 70 },
      theme: 'sci', w: W, h: H, time: 120, ambientRad: 0,
      briefing: 'The tunnel drops you into Zone A at the bottom of the base. The science wing is eleven zones up, each a corridor of grey deck between machinery blocks, and the way up is never where you left the last one. Follow the floor arrows. The blind alleys hold fuel, or a coolant leak.',
      start: { x: 5, y: ROW0, dir: 0 }, exit: [103, 3, 107, 5],
      path, rough, rad, fuel, checkpoints, wrecks, doors: [], labels, arrows,
    };
  }

  // ---- Seeded random sectors in the authored styles: a winding main road from one side of the map to the
  // other, blind spurs, rubble, leaks, fuel, columns/wrecks, and (underground) blast doors. ----
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function generateLevel(o) {
    let best = null;
    for (let variant = 0; variant < 24; variant++) {
      const r = generateAttempt(o, o.seed + variant * 7919);
      if (!best || r.acc > best.acc) best = r;
      if (r.acc >= 190 && r.def.path.length >= 9) break;
    }
    return best.def;
  }
  function generateAttempt(o, seed) {
    const rnd = mulberry32(seed), W = 96, H = 72, M = 4, narrow = o.narrow || 0;
    const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    const occ = new Uint8Array(W * H);
    const rectOf = (a, b, w) => { const half = Math.floor(w / 2), lo = -half, hi = w - 1 - half; return { x0: Math.min(a[0], b[0]) + lo, y0: Math.min(a[1], b[1]) + lo, x1: Math.max(a[0], b[0]) + hi, y1: Math.max(a[1], b[1]) + hi }; };
    const mark = (r) => { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (x >= 0 && y >= 0 && x < W && y < H) occ[y * W + x] = 1; };
    // A candidate segment is fine when its rectangle (plus a 2-tile margin) touches nothing already carved,
    // ignoring a short joint at its start where it meets the previous segment.
    const clear = (a, b, w) => {
      const r = rectOf(a, b, w), horiz = a[1] === b[1], fwd = horiz ? Math.sign(b[0] - a[0]) : Math.sign(b[1] - a[1]);
      for (let y = r.y0 - 2; y <= r.y1 + 2; y++) for (let x = r.x0 - 2; x <= r.x1 + 2; x++) {
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return false;
        const along = horiz ? (x - a[0]) * fwd : (y - a[1]) * fwd;
        if (along <= 3) continue; // the joint
        if (occ[y * W + x]) return false;
      }
      return true;
    };
    const sx = 5, sy = ri(12, 60), tx = 88, ty = ri(8, 64);
    const pts = [[sx, sy]], widths = [];
    let x = sx, y = sy, horizontal = true;
    mark(rectOf([sx - 1, sy], [sx + 3, sy], 3));
    for (let step = 0; step < 26; step++) {
      if (Math.abs(x - tx) <= 6 && Math.abs(y - ty) <= 6 && step >= 8) break;
      let placed = false;
      for (let attempt = 0; attempt < 40 && !placed; attempt++) {
        const w = rnd() < narrow ? 2 : 3;
        let nx = x, ny = y;
        if (horizontal) { const dir = rnd() < 0.72 ? (Math.sign(tx - x) || 1) : -(Math.sign(tx - x) || 1); nx = x + dir * ri(8, 24); }
        else { const dir = rnd() < 0.65 ? (Math.sign(ty - y) || 1) : -(Math.sign(ty - y) || 1); ny = y + dir * ri(6, 20); }
        if (nx < M || nx > W - M || ny < M || ny > H - M) continue;
        if (!clear([x, y], [nx, ny], w)) continue;
        mark(rectOf([x, y], [nx, ny], w)); pts.push([nx, ny]); widths.push(w); x = nx; y = ny; placed = true;
      }
      horizontal = !horizontal;
      if (!placed && step > 6) break;
    }
    const path = [];
    for (let i = 0; i < pts.length - 1; i++) path.push({ w: widths[i], pts: [pts[i], pts[i + 1]] });
    // blind spurs off the middle of a few segments, kept clear of everything else
    const spurs = [];
    for (let n = 0; n < 5 && spurs.length < 3; n++) {
      const i = ri(1, pts.length - 2), a = pts[i], b = pts[i + 1];
      const mx = Math.round((a[0] + b[0]) / 2), my = Math.round((a[1] + b[1]) / 2), vertical = a[1] === b[1];
      const dir = rnd() < 0.5 ? -1 : 1, len = ri(6, 12);
      const e = vertical ? [mx, my + dir * len] : [mx + dir * len, my];
      if (e[0] < M || e[0] > W - M || e[1] < M || e[1] > H - M || !clear([mx, my], e, 3)) continue;
      mark(rectOf([mx, my], e, 3)); path.push({ w: 3, pts: [[mx, my], e] }); spurs.push({ e, vertical });
    }
    const rad = spurs.slice(0, 2).map(({ e, vertical }) => (vertical ? [e[0] - 1, e[1] - 1, e[0] + 1, e[1]] : [e[0] - 1, e[1] - 1, e[0], e[1] + 1]));
    const fuel = spurs.length > 2 ? [[spurs[2].e[0], spurs[2].e[1]]] : [];
    // decorations along the main road
    const rough = [], checkpoints = [], wrecks = [], doors = [];
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], w = widths[i], horiz = a[1] === b[1], len = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
      const dirDeg = horiz ? (b[0] > a[0] ? 0 : 180) : (b[1] > a[1] ? 90 : 270);
      const at = (f) => [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f)];
      acc += len;
      if (i > 0 && i % 2 === 0 && len >= 8) {
        const stripe = (cx, cy) => { let n = 0; for (let k = -6; k <= 6; k++) { const xx = horiz ? cx : cx + k, yy = horiz ? cy + k : cy; if (occ[yy * W + xx]) n++; } return n; };
        for (const f of [0.3, 0.2, 0.4, 0.5, 0.15, 0.6]) { const [cx, cy] = at(f); if (stripe(cx, cy) <= w) { checkpoints.push({ x: cx, y: cy, dir: dirDeg }); break; } }
      }
      if (len >= 12 && rnd() < 0.55) { const [px, py] = at(0.6); rough.push(horiz ? [px - 2, py - 1, px + 2, py + 1] : [px - 1, py - 2, px + 1, py + 2]); }
      if (w === 3 && len >= 10 && rnd() < 0.55) { const [px, py] = at(0.8); const side = rnd() < 0.5 ? -1 : 1; wrecks.push([px + (horiz ? 0 : side), py + (horiz ? side : 0), rnd() * 3]); }
      if (w === 3 && len >= 10 && rnd() < 0.35) { const [px, py] = at(0.45); rad.push(horiz ? [px, py - 1, px + 1, py] : [px - 1, py, px, py + 1]); }
      if (o.doors && len >= 10 && rnd() < 0.5) { const [px, py] = at(0.5); doors.push({ x: px, y: py, axis: horiz ? "v" : "h", period: 5 + rnd() * 2, open: 2.8 + rnd() * 1.2, phase: rnd() * 5 }); }
      if (i % 3 === 1 && fuel.length < 4) { const [fx, fy] = at(0.5); fuel.push([fx, fy]); }
    }
    const last = pts[pts.length - 1], prev = pts[pts.length - 2], horizEnd = last[1] === prev[1];
    const exit = horizEnd ? [last[0] - 2, last[1] - 1, last[0] + 2, last[1] + 1] : [last[0] - 1, last[1] - 2, last[0] + 1, last[1] + 2];
    const time = Math.max(60, Math.min(120, Math.round(acc * 0.3 + 25)));
    return { acc, def: {
      name: o.name, subtitle: "Generated sector", tagline: o.tagline, preview: { x: pts[1][0], y: pts[1][1] },
      theme: o.theme, w: W, h: H, time, ambientRad: o.theme === "surface" ? 0.8 : o.theme === "core" ? 0.5 : 0,
      briefing: o.briefing, start: { x: sx, y: sy, dir: 0 }, exit,
      path, rough, rad, fuel, checkpoints, wrecks, doors, generated: true,
    } };
  }

  LEVELS.splice(1, 0, sciBase());
  LEVELS.push(
    generateLevel({ seed: 1101, theme: 'surface', name: 'Ash Highway', tagline: 'A surface road laid out by the fallout', briefing: 'Survey drones mapped this road from orbit and nobody has driven it since. Rubble, leaks and burnt-out cars, and a base entrance at the far end.' }),
    generateLevel({ seed: 2207, theme: 'base', name: 'Coolant Deck', tagline: 'Underground service tunnels with doors on timers', doors: true, briefing: 'A maintenance level below the base. The service tunnels are narrow, the blast doors were never taken off their cycle, and the coolant lines have started to leak.' }),
    generateLevel({ seed: 3313, theme: 'surface', name: 'Cinder Run', tagline: 'Narrow canyon roads through the burn zone', narrow: 0.45, briefing: 'The fire went through here first. What is left of the road threads between cinder banks that will take the car apart on contact.' }),
    generateLevel({ seed: 4419, theme: 'core', name: 'Vault Nine', tagline: 'Containment passages, fast doors, hot floors', doors: true, narrow: 0.5, briefing: 'A containment vault under the reactor. The passages were built for maintenance carts, not a V8, and the doors cycle whether you are in them or not.' }),
    generateLevel({ seed: 5525, theme: 'base', name: 'Outpost Delta', tagline: 'The long way round the perimeter tunnels', doors: true, narrow: 0.3, briefing: 'The perimeter outpost has one working tunnel to the base and it does not go the direct way. Keep the tank full and watch the doors.' }),
  );

  // Catmull-Rom sampling of a control polyline (tile units) into a dense polyline in pixels.
  // loop + period: the first and last points coincide modulo period (a road that wraps round the world).
  function smoothPath(pts, loop, period) {
    const n = pts.length;
    if (n < 2) return pts.map((p) => [p[0] * TILE, p[1] * TILE]);
    const ext = loop && period
      ? [[pts[n - 2][0] - period, pts[n - 2][1]], ...pts, [pts[1][0] + period, pts[1][1]]]
      : [pts[0], ...pts, pts[n - 1]];
    return sampleCatmull(ext, false);
  }
  function smoothLoop(pts) {
    const n = pts.length;
    return sampleCatmull([pts[n - 1], ...pts, pts[0], pts[1]], true);
  }
  function sampleCatmull(ext, closed) {
    const out = [], steps = 8;
    for (let i = 1; i < ext.length - 2; i++) {
      const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1], p3 = ext[i + 2];
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push([x * TILE, y * TILE]);
      }
    }
    if (!closed) { const last = ext[ext.length - 2]; out.push([last[0] * TILE, last[1] * TILE]); }
    return out;
  }

  function buildLevel(def) {
    if (def.kind === 'vector') throw new Error('vector levels are rasterised by the game (needs a canvas)');
    const { w, h } = def;
    const grid = new Uint8Array(w * h); // all WALL

    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    const get = (x, y) => (inside(x, y) ? grid[y * w + x] : T.WALL);
    const set = (x, y, v) => { if (inside(x, y)) grid[y * w + x] = v; };
    const fillRect = (x1, y1, x2, y2, v, onlyDrivable) => {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
          if (onlyDrivable && get(x, y) === T.WALL) continue;
          set(x, y, v);
        }
      }
    };

    // Carve each path segment as a rectangle w tiles across; consecutive rectangles overlap at corners.
    for (const seg of def.path) {
      const half = Math.floor(seg.w / 2), lo = -half, hi = seg.w - 1 - half;
      const tile = seg.t === 'dirt' ? T.DIRT : T.ROAD;
      for (let i = 0; i < seg.pts.length - 1; i++) {
        const [ax, ay] = seg.pts[i], [bx, by] = seg.pts[i + 1];
        fillRect(Math.min(ax, bx) + lo, Math.min(ay, by) + lo, Math.max(ax, bx) + hi, Math.max(ay, by) + hi, tile);
      }
    }
    // Grass verges: slow but survivable ground laid over rock beside the road. Tracked so checkpoint stripes stop at them.
    const verge = new Uint8Array(w * h);
    for (const r of def.grass || []) {
      for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) if (get(x, y) === T.WALL) { set(x, y, T.ROUGH); verge[y * w + x] = 1; }
    }
    for (const r of def.rough || []) fillRect(r[0], r[1], r[2], r[3], T.ROUGH, true);
    for (const r of def.water || []) fillRect(r[0], r[1], r[2], r[3], T.WATER);
    for (const r of def.bridges || []) fillRect(r[0], r[1], r[2], r[3], T.BRIDGE);
    for (const r of def.rad || []) fillRect(r[0], r[1], r[2], r[3], T.RAD, true);
    fillRect(def.exit[0], def.exit[1], def.exit[2], def.exit[3], T.EXIT);

    const drivable = (x, y) => { const t = get(x, y); return t !== T.WALL && t !== T.WATER; };
    const open = (x, y) => get(x, y) !== T.WALL;

    // Edge masks (N=1, E=2, S=4, W=8): for walls, which sides face open ground; for water, which sides touch land.
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = grid[y * w + x];
        if (t === T.WALL) mask[y * w + x] = (open(x, y - 1) ? 1 : 0) | (open(x + 1, y) ? 2 : 0) | (open(x, y + 1) ? 4 : 0) | (open(x - 1, y) ? 8 : 0);
        else if (t === T.WATER) { const land = (px, py) => inside(px, py) && get(px, py) !== T.WATER; mask[y * w + x] = (land(x, y - 1) ? 1 : 0) | (land(x + 1, y) ? 2 : 0) | (land(x, y + 1) ? 4 : 0) | (land(x - 1, y) ? 8 : 0); }
      }
    }

    // Walk across the corridor from (x, y) along one axis and collect the road tiles (verges and water end the walk).
    const stripe = (x, y, axis) => {
      const tiles = [];
      const road = (px, py) => drivable(px, py) && !verge[py * w + px];
      if (!road(x, y)) return tiles;
      const dx = axis === 'h' ? 1 : 0, dy = axis === 'v' ? 1 : 0;
      let cx = x, cy = y;
      while (road(cx - dx, cy - dy)) { cx -= dx; cy -= dy; }
      while (road(cx, cy)) { tiles.push([cx, cy]); cx += dx; cy += dy; }
      return tiles;
    };
    const boundsOf = (tiles) => {
      const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const [x, y] of tiles) { b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y); }
      return b;
    };

    const checkpoints = def.checkpoints.map((c, i) => {
      const axis = (c.dir === 0 || c.dir === 180) ? 'v' : 'h'; // road runs horizontally -> stripe is vertical
      const tiles = stripe(c.x, c.y, axis);
      return { id: i, x: c.x, y: c.y, dir: c.dir, axis, tiles, bounds: boundsOf(tiles), taken: false };
    });
    const doors = def.doors.map((d, i) => {
      const tiles = stripe(d.x, d.y, d.axis);
      const b = boundsOf(tiles);
      return {
        id: i, axis: d.axis, period: d.period, open: d.open, phase: d.phase, tiles,
        px: b.x0 * TILE, py: b.y0 * TILE, pw: (b.x1 - b.x0 + 1) * TILE, ph: (b.y1 - b.y0 + 1) * TILE,
        openAmt: 1, target: 1,
      };
    });
    const fuel = def.fuel.map(([x, y]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, tx: x, ty: y, taken: false }));
    const wrecks = def.wrecks.map(([x, y, a]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, a, r: 11, smoke: Math.random() }));

    const tileAt = (px, py) => get(Math.floor(px / TILE), Math.floor(py / TILE));

    return { def, w, h, grid, mask, get, tileAt, checkpoints, doors, fuel, wrecks, exit: def.exit, start: def.start, theme: def.theme };
  }

  root.LastV8Levels = { LEVELS, T, TILE, buildLevel, smoothPath, smoothLoop };
})(typeof window !== 'undefined' ? window : module.exports);

/* The Last V8 — level data and grid builder.
   Maps are authored as axis-aligned road paths carved into solid rock, then decorated.
   Coordinates are tiles. Headings are degrees in screen space: 0 = east, 90 = south, 180 = west, 270 = north. */
(function (root) {
  'use strict';

  const TILE = 32;
  const T = { WALL: 0, ROAD: 1, ROUGH: 2, RAD: 3, EXIT: 4 };

  const LEVELS = [
    {
      name: 'The Wasteland',
      subtitle: 'Surface run',
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

  function buildLevel(def) {
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
      for (let i = 0; i < seg.pts.length - 1; i++) {
        const [ax, ay] = seg.pts[i], [bx, by] = seg.pts[i + 1];
        fillRect(Math.min(ax, bx) + lo, Math.min(ay, by) + lo, Math.max(ax, bx) + hi, Math.max(ay, by) + hi, T.ROAD);
      }
    }
    for (const r of def.rough || []) fillRect(r[0], r[1], r[2], r[3], T.ROUGH, true);
    for (const r of def.rad || []) fillRect(r[0], r[1], r[2], r[3], T.RAD, true);
    fillRect(def.exit[0], def.exit[1], def.exit[2], def.exit[3], T.EXIT);

    const drivable = (x, y) => get(x, y) !== T.WALL;

    // Wall edge mask: which sides face open road (N=1, E=2, S=4, W=8).
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y * w + x] !== T.WALL) continue;
        mask[y * w + x] = (drivable(x, y - 1) ? 1 : 0) | (drivable(x + 1, y) ? 2 : 0) | (drivable(x, y + 1) ? 4 : 0) | (drivable(x - 1, y) ? 8 : 0);
      }
    }

    // Walk across the corridor from (x, y) along one axis and collect the drivable tiles.
    const stripe = (x, y, axis) => {
      const tiles = [];
      if (!drivable(x, y)) return tiles;
      const dx = axis === 'h' ? 1 : 0, dy = axis === 'v' ? 1 : 0;
      let cx = x, cy = y;
      while (drivable(cx - dx, cy - dy)) { cx -= dx; cy -= dy; }
      while (drivable(cx, cy)) { tiles.push([cx, cy]); cx += dx; cy += dy; }
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

  root.LastV8Levels = { LEVELS, T, TILE, buildLevel };
})(typeof window !== 'undefined' ? window : module.exports);

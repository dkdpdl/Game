// 섬 지도 생성 (고정 시드라서 매번 같은 섬이 만들어진다)
window.IQ = window.IQ || {};
(function () {
  'use strict';
  const IQ = window.IQ;
  const W = 56, H = 56, TS = 16;
  const T = { WATER: 0, SAND: 1, GRASS: 2, FOREST: 3, FLOOR: 4, WALL: 5, PATH: 6 };
  IQ.W = W; IQ.H = H; IQ.TS = TS; IQ.T = T;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  IQ.rng = mulberry32;

  function makeNoise(rand, cell) {
    const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
    const g = [];
    for (let i = 0; i < gw * gh; i++) g.push(rand());
    return function (x, y) {
      const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
      let tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
  }

  // 오브젝트 종류: block = 지나갈 수 없음
  IQ.OBJ = {
    tree: { block: 1, name: '나무' },
    stump: { block: 0, name: '그루터기' },
    palm: { block: 1, name: '야자나무' },
    rock: { block: 1, name: '바위' },
    bush: { block: 1, name: '산딸기 덤불' },
    grass: { block: 0, name: '풀' },
    statue: { block: 1, name: '석상' },
    tablet: { block: 1, name: '비석' },
    inscr: { block: 1, name: '벽의 글귀' },
    gate: { block: 1, name: '돌문' },
    chest: { block: 1, name: '상자' },
    altar: { block: 1, name: '제단' },
    campfire: { block: 1, name: '모닥불' },
    dig: { block: 0, name: '파낸 흔적' },
    wreck: { block: 1, name: '난파선' },
    bottle: { block: 0, name: '유리병' },
  };

  IQ.buildWorld = function () {
    const rand = mulberry32(90417);
    const n1 = makeNoise(rand, 7), n2 = makeNoise(rand, 3);
    const tiles = new Uint8Array(W * H);
    const reserved = new Uint8Array(W * H);
    const idx = (x, y) => y * W + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const set = (x, y, t) => { if (inb(x, y)) tiles[idx(x, y)] = t; };
    const get = (x, y) => inb(x, y) ? tiles[idx(x, y)] : T.WATER;

    // 1) 섬 모양
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - 28) / 23, dy = (y - 28.5) / 23;
      let e = 1 - Math.sqrt(dx * dx + dy * dy) + (n1(x, y) - 0.5) * 0.4 + (n2(x, y) - 0.5) * 0.12;
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) e = -1;
      let t = e < 0.12 ? T.WATER : T.GRASS;
      if (t === T.GRASS && Math.hypot(x - 16, y - 17) < 8 + n2(x, y) * 5) t = T.FOREST;
      tiles[idx(x, y)] = t;
    }

    const rect = (x0, y0, x1, y1, t) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { set(x, y, t); reserved[idx(x, y)] = 1; }
    };

    // 2) 특수 지역
    rect(32, 7, 46, 20, T.GRASS);                 // 유적 주변
    for (let y = 9; y <= 18; y++) for (let x = 34; x <= 44; x++) {
      const edge = x === 34 || x === 44 || y === 9 || y === 18;
      set(x, y, edge ? T.WALL : T.FLOOR);
    }
    set(39, 18, T.FLOOR);                           // 문 자리
    for (let y = 12; y <= 20; y++) for (let x = 12; x <= 20; x++) {
      if (Math.hypot(x - 16, y - 16) <= 2.6) { set(x, y, T.GRASS); reserved[idx(x, y)] = 1; }
    }
    rect(6, 29, 12, 35, T.SAND);                    // 난파선 해변
    rect(45, 32, 51, 38, T.SAND);                   // 동쪽 해변(세 개의 돌)
    rect(26, 43, 30, 47, T.GRASS);                  // 시작 지점

    // 3) 흙길: (x0,y0)에서 가로로 x1까지, 다시 세로로 y1까지
    const path = (x0, y0, x1, y1) => {
      const put = (x, y) => {
        const t = get(x, y);
        if (t === T.WALL || t === T.FLOOR) return;
        set(x, y, T.PATH); reserved[idx(x, y)] = 1;
      };
      const sx = x1 >= x0 ? 1 : -1, sy = y1 >= y0 ? 1 : -1;
      for (let x = x0; ; x += sx) { put(x, y0); if (x === x1) break; }
      for (let y = y0; ; y += sy) { put(x1, y); if (y === y1) break; }
    };
    path(28, 45, 28, 28);
    path(28, 28, 39, 19);
    path(28, 28, 16, 19);
    path(16, 28, 11, 32);
    path(39, 28, 47, 33);

    // 4) 해변: 물과 닿은 풀밭은 모래가 된다
    const shore = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = get(x, y);
      if (t !== T.GRASS && t !== T.FOREST) continue;
      if (get(x - 1, y) === T.WATER || get(x + 1, y) === T.WATER || get(x, y - 1) === T.WATER || get(x, y + 1) === T.WATER) shore.push([x, y]);
    }
    shore.forEach(([x, y]) => set(x, y, T.SAND));
    const shore2 = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = get(x, y);
      if (t !== T.GRASS && t !== T.FOREST) continue;
      const near = get(x - 1, y) === T.SAND || get(x + 1, y) === T.SAND || get(x, y - 1) === T.SAND || get(x, y + 1) === T.SAND;
      if (near && n2(x * 1.7, y * 1.7) > 0.45 && !reserved[idx(x, y)]) shore2.push([x, y]);
    }
    shore2.forEach(([x, y]) => set(x, y, T.SAND));

    // 5) 고정 오브젝트
    const objs = [];
    const add = (t, x, y, extra) => {
      const o = Object.assign({ t, x, y }, extra || {});
      objs.push(o); reserved[idx(x, y)] = 1;
      return o;
    };
    add('gate', 39, 18);
    add('tablet', 41, 19, { kind: 'gate' });
    add('inscr', 39, 10);
    add('altar', 39, 12);
    [['star', 36], ['sun', 38], ['moon', 40], ['wave', 42]].forEach(([sym, x]) => add('statue', x, 15, { sym }));
    add('bottle', 30, 47);
    add('wreck', 8, 31, { part: 0 });
    add('wreck', 9, 31, { part: 1 });
    add('tablet', 10, 33, { kind: 'star' });
    add('rock', 47, 34, { keep: 1 });
    add('rock', 49, 34, { keep: 1 });
    add('rock', 48, 36, { keep: 1 });
    add('dig', 48, 35, { loot: 'frag_moon', hidden: 1 });
    add('rock', 14, 14, { keep: 1 });
    add('rock', 18, 14, { keep: 1 });

    // 6) 자연 오브젝트
    const free = (x, y) => !reserved[idx(x, y)];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!free(x, y)) continue;
      const t = get(x, y), r = rand();
      const east = x > 40 && y > 22;
      if (t === T.FOREST) {
        if (r < 0.34) add('tree', x, y);
        else if (r < 0.39) add('bush', x, y);
        else if (r < 0.46) add('grass', x, y);
        else if (r < 0.48) add('rock', x, y);
      } else if (t === T.GRASS) {
        if (r < 0.06) add('tree', x, y);
        else if (r < 0.09) add('bush', x, y);
        else if (r < 0.17) add('grass', x, y);
        else if (r < (east ? 0.27 : 0.20)) add('rock', x, y);
      } else if (t === T.SAND) {
        if (r < 0.06) add('palm', x, y);
        else if (r < 0.08) add('rock', x, y);
      }
    }

    // 7) 숨겨진 보물 자리 (늑대만 냄새로 찾을 수 있다)
    const loots = ['coin', 'coin', 'stone', 'berry'];
    let placed = 0, guard = 0;
    while (placed < loots.length && guard++ < 2000) {
      const x = 4 + Math.floor(rand() * (W - 8)), y = 4 + Math.floor(rand() * (H - 8));
      const t = get(x, y);
      if (!free(x, y) || (t !== T.GRASS && t !== T.FOREST && t !== T.SAND)) continue;
      if (Math.hypot(x - 28, y - 45) < 6) continue;
      add('dig', x, y, { loot: loots[placed], hidden: 1 });
      placed++;
    }

    // 8) 멧돼지 출현 지점
    const boarSpawns = [];
    guard = 0;
    while (boarSpawns.length < 8 && guard++ < 3000) {
      const x = 4 + Math.floor(rand() * (W - 8)), y = 4 + Math.floor(rand() * (H - 8));
      const t = get(x, y);
      if (!free(x, y) || (t !== T.GRASS && t !== T.FOREST)) continue;
      if (Math.hypot(x - 28, y - 45) < 9) continue;
      if (boarSpawns.some(s => Math.hypot(s.x - x, s.y - y) < 6)) continue;
      boarSpawns.push({ x, y });
    }

    return { tiles, objs, boarSpawns, start: { x: 28, y: 45 }, den: { x: 16, y: 16 } };
  };

  // 바닥 타일을 한 장의 큰 캔버스로 미리 그려 둔다
  IQ.paintGround = function (world) {
    const c = document.createElement('canvas');
    c.width = W * TS; c.height = H * TS;
    const x = c.getContext('2d');
    const rand = mulberry32(777);
    const get = (tx, ty) => (tx >= 0 && ty >= 0 && tx < W && ty < H) ? world.tiles[ty * W + tx] : T.WATER;
    const isLand = t => t !== T.WATER;
    const dots = (px, py, n, colors, size) => {
      for (let i = 0; i < n; i++) {
        x.fillStyle = colors[Math.floor(rand() * colors.length)];
        x.fillRect(px + Math.floor(rand() * (TS - (size || 1))), py + Math.floor(rand() * (TS - (size || 1))), size || 1, size || 1);
      }
    };
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const t = get(tx, ty), px = tx * TS, py = ty * TS;
      if (t === T.WATER) {
        let near = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isLand(get(tx + dx, ty + dy))) near = Math.max(near, 3 - Math.max(Math.abs(dx), Math.abs(dy)));
        x.fillStyle = near >= 2 ? '#4fa6ee' : near === 1 ? '#3b8fe2' : '#2f77cc';
        x.fillRect(px, py, TS, TS);
        dots(px, py, 3, near >= 2 ? ['#6cbaf4'] : ['#4a9ae6', '#2a6cbc'], 2);
        x.fillStyle = '#bfe6ff';
        if (isLand(get(tx, ty - 1))) x.fillRect(px, py, TS, 2);
        if (isLand(get(tx, ty + 1))) x.fillRect(px, py + TS - 2, TS, 2);
        if (isLand(get(tx - 1, ty))) x.fillRect(px, py, 2, TS);
        if (isLand(get(tx + 1, ty))) x.fillRect(px + TS - 2, py, 2, TS);
      } else if (t === T.SAND) {
        x.fillStyle = '#ecd9a0'; x.fillRect(px, py, TS, TS);
        dots(px, py, 6, ['#d9c286', '#f6e7bb']);
      } else if (t === T.GRASS) {
        x.fillStyle = '#5cbf4a'; x.fillRect(px, py, TS, TS);
        dots(px, py, 5, ['#4aa83c', '#78d45c']);
        if (rand() < 0.3) { x.fillStyle = '#48a53a'; const gx = px + 3 + Math.floor(rand() * 9), gy = py + 3 + Math.floor(rand() * 9); x.fillRect(gx, gy, 1, 2); x.fillRect(gx + 2, gy - 1, 1, 3); }
      } else if (t === T.FOREST) {
        x.fillStyle = '#3f9a3c'; x.fillRect(px, py, TS, TS);
        dots(px, py, 7, ['#347f31', '#4fae47']);
      } else if (t === T.PATH) {
        x.fillStyle = '#c9a66b'; x.fillRect(px, py, TS, TS);
        dots(px, py, 5, ['#b08c55', '#dcbc84'], 2);
      } else if (t === T.FLOOR) {
        x.fillStyle = '#b3aba0'; x.fillRect(px, py, TS, TS);
        x.fillStyle = '#958d82';
        x.fillRect(px, py, TS, 1); x.fillRect(px, py, 1, TS);
        x.fillRect(px, py + 8, TS, 1); x.fillRect(px + 8, py, 1, 8);
        dots(px, py, 2, ['#c6bfb4']);
      } else if (t === T.WALL) {
        x.fillStyle = '#6d665f'; x.fillRect(px, py, TS, TS);
        x.fillStyle = '#4c4640';
        for (let r = 0; r < 4; r++) {
          x.fillRect(px, py + r * 4 + 3, TS, 1);
          const off = r % 2 ? 4 : 0;
          x.fillRect(px + off, py + r * 4, 1, 3); x.fillRect(px + off + 8, py + r * 4, 1, 3);
        }
        x.fillStyle = '#8c847b'; x.fillRect(px, py, TS, 1);
      }
    }
    return c;
  };
})();

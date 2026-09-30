// 게임 핵심 로직: 상태, 이동, 상호작용, 늑대, 멧돼지, 그리기
window.IQ = window.IQ || {};
(function () {
  'use strict';
  const IQ = window.IQ;
  const TS = 16;
  const SAVE_KEY = 'wolfisland.save.v1';
  const MOVE_SPEED = 6;       // 초당 타일
  const WOLF_SPEED = 7;

  let WD = null;   // 월드(지형, 변하지 않음)
  let S = null;    // 저장되는 상태
  let R = null;    // 실행 중에만 쓰는 상태
  let ground = null;

  const G = IQ.G = {};

  // ---------- 기본 도우미 ----------
  const idx = (x, y) => y * IQ.W + x;
  function tileAt(x, y) {
    if (x < 0 || y < 0 || x >= IQ.W || y >= IQ.H) return IQ.T.WATER;
    return WD.tiles[idx(x, y)];
  }
  function objAt(x, y) {
    const o = R.objMap.get(idx(x, y));
    return o && !o.gone && !o.done ? o : null;
  }
  function isBlocked(x, y) {
    const t = tileAt(x, y);
    if (t === IQ.T.WATER || t === IQ.T.WALL) return true;
    const o = objAt(x, y);
    return !!(o && IQ.OBJ[o.t].block);
  }
  function reindex() {
    R.objMap = new Map();
    S.objs.forEach(o => { if (!o.done) R.objMap.set(idx(o.x, o.y), o); });
  }
  const rnd = () => Math.random();
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  G.maxSt = () => 27 + S.p.lv * 3;
  G.needExp = () => 8 + S.p.lv * 6;
  G.state = () => S;
  G.has = (id, n) => (S.inv[id] || 0) >= (n || 1);
  G.count = id => S.inv[id] || 0;
  G.petLv = () => S.wolf.aff >= 100 ? 3 : S.wolf.aff >= 50 ? 2 : 1;

  // ---------- 새 게임 / 저장 ----------
  G.init = function () {
    WD = IQ.buildWorld();
    ground = IQ.paintGround(WD);
  };

  function freshState() {
    return {
      v: 1, time: 0,
      p: { x: WD.start.x, y: WD.start.y, face: 'down', st: 30, lv: 1, exp: 0 },
      inv: {},
      f: {},
      objs: JSON.parse(JSON.stringify(WD.objs)),
      boars: WD.boarSpawns.slice(0, 5).map(s => ({ x: s.x, y: s.y, hp: 4 })),
      wolf: { x: WD.den.x, y: WD.den.y, tamed: false, name: '하울', aff: 0 },
      statueSeq: [],
    };
  }

  function freshRuntime() {
    return {
      objMap: new Map(),
      p: { rx: S.p.x, ry: S.p.y, move: null, path: null, pending: null, busy: 0, act: null, walkT: 0, tries: 0 },
      w: { rx: S.wolf.x, ry: S.wolf.y, move: null, path: null, face: 'right', walkT: 0, sniffTarget: null },
      boarR: new Map(),
      trail: [],
      keyDir: null,
      floats: [], parts: [], bubbles: [],
      marker: null,
      sniffCd: 0,
      howlT: 3,
      tick: 0,
      zoom: 4, camX: 0, camY: 0, lowW: 0, lowH: 0,
    };
  }

  G.newGame = function () {
    S = freshState();
    R = freshRuntime();
    reindex();
    G.save();
  };

  G.hasSave = function () {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  };

  G.load = function () {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { data = null; }
    if (!data || data.v !== 1) return false;
    S = data;
    R = freshRuntime();
    reindex();
    return true;
  };

  G.save = function () {
    if (!S) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 저장 공간이 없으면 무시 */ }
  };

  G.wipe = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
  };

  // ---------- 인벤토리 / 성장 ----------
  function give(id, n, silent) {
    S.inv[id] = (S.inv[id] || 0) + n;
    if (!silent) floatText(S.p.x, S.p.y, '+' + n + ' ' + IQ.ITEMS[id].name, '#fff6a0');
    IQ.sfx.pick();
  }
  function take(need) {
    for (const k in need) if (!G.has(k, need[k])) return false;
    for (const k in need) { S.inv[k] -= need[k]; if (S.inv[k] <= 0) delete S.inv[k]; }
    return true;
  }
  G.give = give;

  function useSt(n) {
    if (S.p.st < n) {
      IQ.UI.toast('배가 고파서 힘이 나지 않아요… 가방에서 음식을 먹어요.');
      bubble('player', '꼬르륵…');
      return false;
    }
    S.p.st -= n;
    return true;
  }

  function addExp(n) {
    S.p.exp += n;
    while (S.p.exp >= G.needExp()) {
      S.p.exp -= G.needExp();
      S.p.lv++;
      S.p.st = G.maxSt();
      floatText(S.p.x, S.p.y - 0.6, 'LEVEL UP!', '#7cf0ff');
      IQ.sfx.level();
      IQ.UI.toast('레벨 ' + S.p.lv + '! 스태미나가 늘어나고 모두 회복됐어요.');
    }
  }

  // 채집: 늑대 친밀도가 높으면 가끔 하나 더 찾아 준다
  function gather(id, n) {
    give(id, n);
    if (S.wolf.tamed && G.petLv() >= 3 && rnd() < 0.3 && wolfNear(4)) {
      S.inv[id] = (S.inv[id] || 0) + 1;
      floatText(S.wolf.x, S.wolf.y, '+1 (' + S.wolf.name + ')', '#ffd0f0');
    }
  }

  G.craft = function (r) {
    if (r.once && G.has(r.id)) return false;
    if (!take(r.need)) return false;
    give(r.id, 1, true);
    addExp(3);
    IQ.sfx.solve();
    if (r.id === 'axe') S.f.axeMade = 1;
    if (r.id === 'campfire') {
      if (placeCampfire()) S.f.fireMade = 1;
    }
    return true;
  };

  G.cook = function (r) {
    if (!take(r.need)) return false;
    give(r.id, 1, true);
    addExp(1);
    IQ.sfx.pick();
    return true;
  };

  G.eat = function (id) {
    const it = IQ.ITEMS[id];
    if (!it.food || !G.has(id)) return false;
    if (S.p.st >= G.maxSt()) { IQ.UI.toast('지금은 배가 부르지 않아요.'); return false; }
    take({ [id]: 1 });
    S.p.st = Math.min(G.maxSt(), S.p.st + it.food);
    floatText(S.p.x, S.p.y, '스태미나 +' + it.food, '#a8ff9a');
    IQ.sfx.eat();
    return true;
  };

  function faceDelta() {
    return { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[S.p.face];
  }

  function placeCampfire() {
    const d = faceDelta();
    const cands = [[S.p.x + d[0], S.p.y + d[1]], [S.p.x + 1, S.p.y], [S.p.x - 1, S.p.y], [S.p.x, S.p.y + 1], [S.p.x, S.p.y - 1]];
    for (const [x, y] of cands) {
      const t = tileAt(x, y);
      if (t === IQ.T.WATER || t === IQ.T.WALL) continue;
      if (R.objMap.get(idx(x, y)) && !R.objMap.get(idx(x, y)).gone && !R.objMap.get(idx(x, y)).done) continue;
      if (S.wolf.x === x && S.wolf.y === y) continue;
      if (S.boars.some(b => !b.dead && b.x === x && b.y === y)) continue;
      const old = R.objMap.get(idx(x, y));
      if (old) old.done = 1;
      S.objs = S.objs.filter(o => !o.done || o.t === 'dig');
      S.objs.push({ t: 'campfire', x, y });
      reindex();
      take({ campfire: 1 });
      IQ.UI.toast('모닥불을 설치했어요! 모닥불을 누르면 요리할 수 있어요.');
      return true;
    }
    IQ.UI.toast('모닥불을 놓을 자리가 없어요. 빈 땅으로 이동해 주세요.');
    return false;
  }
  G.placeCampfire = function () { if (G.has('campfire') && placeCampfire()) { S.f.fireMade = 1; return true; } return false; };

  // ---------- 목표(퀘스트) ----------
  G.fragCount = () => ['frag_sun', 'frag_moon', 'frag_star'].filter(k => S.f['got_' + k]).length;
  G.objective = function () {
    const f = S.f;
    if (f.cleared) return '챕터 1 클리어! 자유롭게 섬을 탐험해 보세요.';
    if (!f.axeMade) return '나뭇가지·돌·풀줄기를 모아 돌도끼를 만들자 (제작)';
    if (!f.fireMade) return '통나무 3개와 돌 3개로 모닥불을 만들자';
    if (!S.wolf.tamed) {
      if (!f.wolfMet) return '숲에서 늑대 울음소리가 들린다… 북서쪽 숲으로 가 보자';
      return '멧돼지를 잡아 고기를 구운 뒤 늑대에게 주자';
    }
    if (!f.gateOpen) return '북동쪽 유적 앞 비석의 수수께끼를 풀자';
    if (G.fragCount() < 3) return '해·달·별 조각을 모으자 (' + G.fragCount() + '/3)';
    return '유적의 제단에 세 조각을 바치자';
  };

  // ---------- 이펙트 ----------
  function floatText(tx, ty, text, color) {
    R.floats.push({ x: (tx + 0.5) * TS, y: ty * TS, text, color: color || '#fff', t: 0, dur: 1.2 });
  }
  function bubble(who, text, dur) {
    R.bubbles = R.bubbles.filter(b => b.who !== who);
    R.bubbles.push({ who, text, until: S.time + (dur || 1.8) });
  }
  function burst(tx, ty, colors, n) {
    for (let i = 0; i < (n || 8); i++) {
      R.parts.push({
        x: (tx + 0.5) * TS, y: (ty + 0.5) * TS,
        vx: (rnd() - 0.5) * 60, vy: -rnd() * 60 - 10,
        c: colors[Math.floor(rnd() * colors.length)], t: 0, dur: 0.5 + rnd() * 0.3,
      });
    }
  }
  function hearts(tx, ty) {
    for (let i = 0; i < 4; i++) R.parts.push({ x: (tx + 0.5) * TS + (rnd() - 0.5) * 10, y: ty * TS + 4, vx: (rnd() - 0.5) * 10, vy: -20 - rnd() * 10, c: 'heart', t: -i * 0.15, dur: 1.2 });
  }
  G.floatText = (...a) => floatText(...a);
  G.bubble = (...a) => bubble(...a);

  // ---------- 길찾기 ----------
  function findPath(sx, sy, isGoal, blockedFn) {
    const blocked = blockedFn || isBlocked;
    if (isGoal(sx, sy)) return [];
    const N = IQ.W * IQ.H;
    const prev = new Int32Array(N).fill(-1);
    const start = idx(sx, sy);
    prev[start] = start;
    const q = [start];
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      const cx = cur % IQ.W, cy = (cur / IQ.W) | 0;
      const nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= IQ.W || ny >= IQ.H) continue;
        const ni = idx(nx, ny);
        if (prev[ni] !== -1 || blocked(nx, ny)) continue;
        prev[ni] = cur;
        if (isGoal(nx, ny)) {
          const path = [];
          let c = ni;
          while (c !== start) { path.push([c % IQ.W, (c / IQ.W) | 0]); c = prev[c]; }
          return path.reverse();
        }
        q.push(ni);
      }
    }
    return null;
  }

  // ---------- 입력 ----------
  G.setKeyDir = d => { if (R) R.keyDir = d; };

  G.tapScreen = function (sx, sy) {
    if (!R) return;
    const wx = sx / R.zoom + R.camX, wy = sy / R.zoom + R.camY;
    tapTile(Math.floor(wx / TS), Math.floor(wy / TS));
  };

  G.interactFront = function () {
    if (!R || R.p.move) return;
    const d = faceDelta();
    tapTile(S.p.x + d[0], S.p.y + d[1]);
  };

  function wolfAt(x, y) { return S.wolf.x === x && S.wolf.y === y; }

  function tapTile(tx, ty) {
    if (R.p.busy > 0) { R.p.queued = [tx, ty]; return; }
    R.marker = { x: tx, y: ty, t: 0 };
    const b = S.boars.find(b => !b.dead && b.x === tx && b.y === ty);
    if (b) { b.hold = S.time + 5; return goAct({ k: 'boar', b }, tx, ty, false); }
    if (wolfAt(tx, ty) && !(S.p.x === tx && S.p.y === ty)) return goAct({ k: 'wolf' }, tx, ty, false);
    const o = objAt(tx, ty);
    if (o && !(o.t === 'dig' && o.hidden)) return goAct({ k: 'obj', o }, tx, ty, !IQ.OBJ[o.t].block);
    const t = tileAt(tx, ty);
    if (t === IQ.T.WATER) return goAct({ k: 'fish', x: tx, y: ty }, tx, ty, false);
    if (t === IQ.T.WALL) return;
    const path = findPath(S.p.x, S.p.y, (x, y) => x === tx && y === ty);
    if (path) { R.p.path = path; R.p.pending = null; }
    else IQ.UI.toast('그곳으로는 갈 수 없어요.');
  }

  function goAct(a, tx, ty, allowOn) {
    a.tx = tx; a.ty = ty; a.allowOn = allowOn;
    const adj = (x, y) => (Math.abs(x - tx) + Math.abs(y - ty) === 1) || (allowOn && x === tx && y === ty);
    if (adj(S.p.x, S.p.y) && !R.p.move) {
      R.p.path = null; R.p.pending = null;
      faceTo(tx, ty);
      doAction(a);
      return;
    }
    const path = findPath(S.p.x, S.p.y, adj);
    if (!path) {
      IQ.UI.toast(a.k === 'fish' ? '물가로 가야 낚시를 할 수 있어요.' : '그곳으로는 갈 수 없어요.');
      return;
    }
    R.p.path = path;
    R.p.pending = a;
    R.p.tries = 0;
  }

  function faceTo(tx, ty) {
    const dx = tx - S.p.x, dy = ty - S.p.y;
    if (dx === 0 && dy === 0) return;
    if (Math.abs(dx) >= Math.abs(dy)) S.p.face = dx > 0 ? 'right' : 'left';
    else S.p.face = dy > 0 ? 'down' : 'up';
  }

  // ---------- 행동 ----------
  function startAct(kind, dur) {
    R.p.busy = dur || 0.35;
    R.p.act = { kind, t: 0, dur: dur || 0.35 };
  }

  function doAction(a) {
    if (a.k === 'boar') {
      const b = a.b;
      if (b.dead) return;
      if (Math.abs(b.x - S.p.x) + Math.abs(b.y - S.p.y) !== 1) {
        if (R.p.tries++ < 3) goAct(a, b.x, b.y, false);
        return;
      }
      faceTo(b.x, b.y);
      attackBoar(b);
    } else if (a.k === 'wolf') {
      faceTo(S.wolf.x, S.wolf.y);
      wolfInteract();
    } else if (a.k === 'fish') {
      fish();
    } else if (a.k === 'obj') {
      faceTo(a.o.x, a.o.y);
      interact(a.o);
    }
  }

  function toolHint(key, msg) {
    if (S.f[key]) return;
    S.f[key] = 1;
    setTimeout(() => IQ.UI.toast(msg), 900);
  }

  function interact(o) {
    const now = S.time;
    switch (o.t) {
      case 'tree':
        if (G.has('axe')) {
          if (!useSt(2)) return;
          startAct('axe');
          IQ.sfx.chop();
          burst(o.x, o.y, ['#3fa645', '#79d651', '#9a6431']);
          gather('wood', 2);
          if (rnd() < 0.5) give('branch', 1, true);
          o.t = 'stump'; o.back = 'tree'; o.respawn = now + 90;
          addExp(2);
        } else {
          if (o.cd && o.cd > now) { IQ.UI.toast('쓸만한 가지가 없어요. 조금 뒤에 다시 와요.'); return; }
          if (!useSt(1)) return;
          startAct('hand');
          IQ.sfx.chop();
          burst(o.x, o.y, ['#3fa645', '#79d651']);
          gather('branch', 1);
          o.cd = now + 20;
          addExp(1);
          toolHint('hintAxe', '돌도끼가 있으면 나무를 베어 통나무를 얻을 수 있어요.');
        }
        break;
      case 'stump':
        IQ.UI.toast('나무 그루터기예요. 시간이 지나면 다시 자라요.');
        break;
      case 'palm':
        if (o.empty) { IQ.UI.toast('코코넛이 아직 열리지 않았어요.'); return; }
        if (!useSt(1)) return;
        startAct('hand');
        gather('coconut', 1);
        o.empty = 1; o.respawn = now + 60;
        addExp(1);
        break;
      case 'rock':
        if (G.has('pickaxe') && !o.keep) {
          if (!useSt(2)) return;
          startAct('pickaxe');
          IQ.sfx.rock();
          burst(o.x, o.y, ['#a0a0aa', '#cfd0d8', '#676772']);
          gather('stone', ri(2, 3));
          o.gone = 1; o.respawn = now + 100;
          addExp(2);
        } else {
          if (o.keep && G.has('pickaxe') && !S.f.hintKeep) { S.f.hintKeep = 1; IQ.UI.toast('무언가를 지키고 있는 듯한 돌이에요. 부수지 말아요.'); }
          if (o.cd && o.cd > now) { IQ.UI.toast('주울 만한 돌멩이가 없어요. 조금 뒤에 다시 와요.'); return; }
          if (!useSt(1)) return;
          startAct('hand');
          IQ.sfx.rock();
          burst(o.x, o.y, ['#a0a0aa', '#cfd0d8']);
          gather('stone', 1);
          o.cd = now + 20;
          addExp(1);
          if (!o.keep) toolHint('hintPick', '돌곡괭이가 있으면 바위를 부숴 돌을 많이 얻어요.');
        }
        break;
      case 'bush':
        if (o.empty) { IQ.UI.toast('열매를 다 땄어요. 시간이 지나면 다시 열려요.'); return; }
        if (!useSt(1)) return;
        startAct('hand');
        burst(o.x, o.y, ['#e23c3c', '#3fa645']);
        gather('berry', ri(2, 3));
        o.empty = 1; o.respawn = now + 50;
        addExp(1);
        break;
      case 'grass':
        if (!useSt(1)) return;
        startAct('hand');
        burst(o.x, o.y, ['#79d651', '#3fa645']);
        gather('fiber', ri(1, 2));
        o.gone = 1; o.respawn = now + 40;
        addExp(1);
        break;
      case 'dig':
        if (o.hidden) return;
        if (!useSt(2)) return;
        startAct('hand', 0.5);
        IQ.sfx.dig();
        burst(o.x, o.y, ['#c9ae72', '#9a6431']);
        o.done = 1;
        reindex();
        if (o.loot === 'frag_moon') {
          give('frag_moon', 1);
          S.f.got_frag_moon = 1;
          addExp(20);
          IQ.sfx.solve();
          IQ.UI.say(['땅속에서 차가운 빛을 내는 석판 조각이 나왔다!', '【달의 조각】을 손에 넣었다.']);
        } else if (o.loot === 'coin') {
          give('coin', 1); addExp(4);
        } else if (o.loot === 'stone') {
          give('stone', 3); addExp(2);
        } else {
          give('berry', 3); addExp(2);
        }
        break;
      case 'bottle':
        S.f.readBottle = 1;
        IQ.UI.say([
          '모래에 반쯤 묻힌 유리병 안에 누렇게 바랜 쪽지가 들어 있다.',
          '"이 섬에 갇힌 자에게. 북동쪽 유적의 제단에 해·달·별의 조각을 바치면 길이 열린다."',
          '"달의 조각은 세 개의 돌이 지키는 동쪽 해변 아래 잠들어 있다. 코가 좋은 친구라면 찾을 수 있겠지."',
        ]);
        break;
      case 'wreck':
        if (!o.looted) {
          o.looted = 1;
          IQ.UI.say(['부서진 배의 잔해다. 내가 타고 왔던 배일까…', '쓸 만한 나무 조각을 챙겼다.'], () => {
            give('wood', 2); give('branch', 1, true);
          });
        } else {
          IQ.UI.toast('더 이상 쓸 만한 것은 없어요.');
        }
        break;
      case 'tablet':
        if (o.kind === 'gate') gateRiddle();
        else starRiddle();
        break;
      case 'gate':
        IQ.UI.say(['굳게 닫힌 돌문이다. 사람의 힘으로는 꿈쩍도 하지 않는다.', '옆에 있는 비석을 읽어 보자.']);
        break;
      case 'inscr':
        IQ.UI.say([
          '벽에 오래된 글귀가 새겨져 있다.',
          '"해가 떠오르면 물결이 일고, 별이 지면 달이 잠든다."',
          '아래쪽에 네 개의 석상이 서 있다. 석상을 순서대로 만져 보자.',
        ]);
        break;
      case 'statue':
        touchStatue(o);
        break;
      case 'chest':
        if (o.opened) { IQ.UI.toast('빈 상자예요.'); return; }
        o.opened = 1;
        IQ.sfx.solve();
        give('frag_sun', 1);
        S.f.got_frag_sun = 1;
        addExp(20);
        IQ.UI.say(['상자 안에서 따뜻한 빛을 내는 석판 조각이 나왔다!', '【해의 조각】을 손에 넣었다.']);
        break;
      case 'altar':
        altar();
        break;
      case 'campfire':
        IQ.UI.openCook();
        break;
    }
  }

  // ---------- 수수께끼 ----------
  function gateRiddle() {
    if (S.f.gateOpen) { IQ.UI.toast('수수께끼는 이미 풀었어요. 문이 열려 있어요.'); return; }
    const opts = ['시계', '거북이', '사람', '고양이'];
    IQ.UI.choice('유적의 비석',
      '"아침에는 네 발, 점심에는 두 발, 저녁에는 세 발로 걷는 것은 무엇인가?"<br><small>답을 말하면 문이 열릴 것 같다.</small>',
      opts.map(a => ({
        label: a, fn: () => {
          if (a === '사람') {
            S.f.gateOpen = 1;
            const g = S.objs.find(o => o.t === 'gate');
            if (g) g.gone = 1;
            IQ.sfx.solve();
            addExp(20);
            burst(39, 18, ['#cfd0d8', '#a0a0aa', '#fff'], 16);
            IQ.UI.say(['"사람"이라고 답하자 비석이 희미하게 빛났다.', '쿠르르릉… 무거운 돌문이 열렸다!']);
          } else {
            IQ.sfx.fail();
            IQ.UI.say(['…비석은 아무 반응이 없다. 다시 생각해 보자.']);
          }
        },
      })));
  }

  function starRiddle() {
    if (S.f.got_frag_star) { IQ.UI.toast('비석은 조용해요. 이미 별의 조각을 받았어요.'); return; }
    const offers = ['charcoal', 'wood', 'stone', 'coconut', 'cmeat', 'fish'].filter(id => G.has(id));
    const buttons = offers.map(id => ({
      label: IQ.ITEMS[id].name + ' 바치기', fn: () => {
        if (id === 'charcoal') {
          take({ charcoal: 1 });
          S.f.got_frag_star = 1;
          give('frag_star', 1);
          IQ.sfx.solve();
          addExp(20);
          IQ.UI.say(['숯을 비석 앞에 놓자 비석의 별 문양이 반짝였다.', '비석 아래 틈에서 석판 조각이 굴러 나왔다!', '【별의 조각】을 손에 넣었다.']);
        } else {
          IQ.sfx.fail();
          IQ.UI.say(['' + IQ.ITEMS[id].name + '을(를) 놓아 보았지만 아무 일도 일어나지 않았다.']);
        }
      },
    }));
    IQ.UI.choice('난파선 옆 비석',
      '"들어갈 때는 검고, 나올 때는 붉고, 버려질 때는 하얀 것.<br>그것을 바치는 자에게 별의 조각을 주리라."' +
      (offers.length ? '' : '<br><small>(바칠 만한 물건이 없다. 재료를 모아 다시 오자.)</small>'),
      buttons);
  }

  const STATUE_ORDER = ['sun', 'wave', 'star', 'moon'];
  const SYM_NAME = { sun: '해', wave: '물결', star: '별', moon: '달' };
  function touchStatue(o) {
    if (S.f.statues) { IQ.UI.toast('석상들이 은은하게 빛나고 있어요.'); return; }
    const seq = S.statueSeq;
    if (seq.includes(o.sym)) { IQ.UI.toast(SYM_NAME[o.sym] + ' 석상은 이미 빛나고 있어요.'); return; }
    startAct('hand', 0.25);
    if (STATUE_ORDER[seq.length] === o.sym) {
      seq.push(o.sym);
      IQ.sfx.tone(440 + seq.length * 110);
      floatText(o.x, o.y - 1, SYM_NAME[o.sym], IQ.SYM_COLOR[o.sym]);
      if (seq.length === 4) {
        S.f.statues = 1;
        IQ.sfx.solve();
        addExp(20);
        S.objs.push({ t: 'chest', x: 43, y: 10 });
        reindex();
        burst(43, 10, ['#ffd84a', '#fff'], 16);
        IQ.UI.say(['네 개의 석상이 모두 빛나기 시작했다!', '쿠르릉… 유적 구석에 상자가 나타났다.']);
      }
    } else {
      S.statueSeq = [];
      IQ.sfx.fail();
      IQ.UI.toast('석상의 빛이 모두 꺼졌어요. 순서가 틀린 것 같아요.');
    }
  }

  function altar() {
    const frags = ['frag_sun', 'frag_moon', 'frag_star'];
    let placedNow = 0;
    frags.forEach(k => {
      if (G.has(k)) { take({ [k]: 1 }); S.f['altar_' + k] = 1; placedNow++; }
    });
    const n = frags.filter(k => S.f['altar_' + k]).length;
    if (placedNow) IQ.sfx.solve();
    if (n < 3) {
      IQ.UI.say([
        '제단에 해·달·별 모양의 홈이 파여 있다.',
        (placedNow ? '가지고 있던 조각을 홈에 끼웠다. ' : '') + '(' + n + '/3)',
      ]);
      return;
    }
    if (S.f.cleared) { IQ.UI.toast('제단에서 빛기둥이 하늘로 뻗어 있어요.'); return; }
    S.f.cleared = 1;
    addExp(50);
    burst(39, 12, ['#ffd84a', '#b58cff', '#ffffff'], 30);
    IQ.UI.say([
      '마지막 조각을 끼우자 제단이 눈부시게 빛나기 시작했다!',
      '빛기둥이 하늘 높이 솟아올랐다. 마치 거대한 등대 같다.',
      '…멀리 바다 너머에서 뱃고동 소리가 들려온다.',
      S.wolf.name + '이(가) 하늘을 향해 길게 울부짖었다. 아우우우~',
      '【챕터 1 클리어】 플레이해 주셔서 감사합니다! 계속해서 섬을 자유롭게 탐험할 수 있어요.',
    ]);
  }

  // ---------- 낚시 ----------
  function fish() {
    if (!G.has('rod')) { IQ.UI.toast('낚싯대가 있으면 물고기를 잡을 수 있어요.'); return; }
    if (!useSt(2)) return;
    startAct('rod', 0.9);
    IQ.sfx.splash();
    setTimeout(() => {
      if (rnd() < 0.65) { gather('fish', 1); addExp(2); }
      else { IQ.UI.toast('물고기가 도망갔어요…'); }
    }, 700);
  }

  // ---------- 멧돼지 ----------
  function attackBoar(b) {
    if (!useSt(2)) return;
    startAct(G.has('axe') ? 'axe' : 'hand');
    let dmg = G.has('axe') ? 2 : 1;
    if (S.wolf.tamed && G.petLv() >= 2 && wolfNear(3)) {
      dmg += 1;
      bubble('wolf', '으르렁!', 1);
    }
    b.hp -= dmg;
    b.hit = 0.25;
    b.hold = S.time + 3;
    IQ.sfx.hit();
    burst(b.x, b.y, ['#ffffff', '#e23c3c'], 6);
    floatText(b.x, b.y - 0.3, '-' + dmg, '#ff8080');
    if (b.hp <= 0) {
      b.dead = 1;
      b.respawn = S.time + 90;
      gather('meat', rnd() < 0.4 ? 2 : 1);
      addExp(6);
      if (!S.f.firstBoar) {
        S.f.firstBoar = 1;
        setTimeout(() => IQ.UI.toast('날고기는 모닥불에서 구울 수 있어요.'), 1000);
      }
    }
  }

  function updateBoars(dt) {
    S.boars.forEach((b, i) => {
      let r = R.boarR.get(i);
      if (!r) { r = { rx: b.x, ry: b.y, move: null, face: 'right', next: S.time + rnd() * 2 }; R.boarR.set(i, r); }
      if (b.hit) b.hit = Math.max(0, b.hit - dt);
      if (b.dead) {
        if (S.time >= b.respawn) {
          const spots = WD.boarSpawns.filter(s => Math.hypot(s.x - S.p.x, s.y - S.p.y) > 8 && !isBlocked(s.x, s.y));
          const s = spots[Math.floor(rnd() * spots.length)];
          if (s) { b.x = s.x; b.y = s.y; b.hp = 4; b.dead = 0; r.rx = s.x; r.ry = s.y; r.move = null; }
          else b.respawn = S.time + 10;
        }
        return;
      }
      if (r.move) {
        r.move.t += dt * 2.5;
        if (r.move.t >= 1) { r.move = null; r.rx = b.x; r.ry = b.y; }
        else { r.rx = r.move.fx + (b.x - r.move.fx) * r.move.t; r.ry = r.move.fy + (b.y - r.move.fy) * r.move.t; }
        return;
      }
      if (b.hold && S.time < b.hold) return;
      if (S.time < r.next) return;
      r.next = S.time + 1 + rnd() * 2.5;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const [dx, dy] = dirs[Math.floor(rnd() * 4)];
      const nx = b.x + dx, ny = b.y + dy;
      const t = tileAt(nx, ny);
      if (isBlocked(nx, ny) || t === IQ.T.FLOOR) return;
      if ((nx === S.p.x && ny === S.p.y) || wolfAt(nx, ny)) return;
      if (S.boars.some(o => o !== b && !o.dead && o.x === nx && o.y === ny)) return;
      r.move = { fx: b.x, fy: b.y, t: 0 };
      if (dx) r.face = dx > 0 ? 'right' : 'left';
      b.x = nx; b.y = ny;
    });
  }

  // ---------- 늑대 ----------
  function wolfNear(d) { return Math.abs(S.wolf.x - S.p.x) + Math.abs(S.wolf.y - S.p.y) <= d; }

  function wolfInteract() {
    const w = S.wolf;
    if (w.tamed) { IQ.UI.openPet(); return; }
    S.f.wolfMet = 1;
    if (!G.has('cmeat')) {
      bubble('wolf', '으르르…');
      IQ.UI.say([
        '다리를 다친 늑대가 몸을 웅크린 채 경계하며 으르렁거린다.',
        '몹시 배가 고파 보인다… 맛있는 음식을 주면 마음을 열지도 모른다.',
        '(구운 고기가 필요해요. 멧돼지를 잡아 모닥불에 구워 보세요.)',
      ]);
      return;
    }
    IQ.UI.choice('다친 늑대', '늑대가 고기 냄새를 맡고 코를 킁킁거린다. 구운 고기를 줄까요?', [
      {
        label: '구운 고기 주기', fn: () => {
          take({ cmeat: 1 });
          IQ.sfx.bark();
          hearts(w.x, w.y);
          IQ.UI.prompt('늑대가 허겁지겁 고기를 먹고 꼬리를 흔든다! 이 늑대에게 이름을 지어 주세요.', w.name, name => {
            w.name = (name || '').trim().slice(0, 8) || '하울';
            w.tamed = true;
            w.aff = 10;
            S.f.wolfTamed = 1;
            addExp(20);
            R.trail = [];
            IQ.UI.say([
              w.name + '이(가) 동료가 되었다!',
              w.name + '은(는) 코가 아주 좋다. 【킁킁】 버튼을 누르면 땅속에 묻힌 것을 찾아 준다.',
              '먹이를 주면 친밀도가 오르고, 친밀도가 높아지면 새로운 능력이 생긴다.',
            ]);
          });
        },
      },
      { label: '그만두기', fn: () => {} },
    ]);
  }

  G.feedWolf = function (id) {
    const it = IQ.ITEMS[id];
    if (!it.petFood || !G.has(id)) return false;
    if (S.wolf.aff >= 100) { IQ.UI.toast(S.wolf.name + '은(는) 배가 불러요. 친밀도가 최대예요!'); return false; }
    const before = G.petLv();
    take({ [id]: 1 });
    S.wolf.aff = Math.min(100, S.wolf.aff + it.petFood);
    hearts(S.wolf.x, S.wolf.y);
    IQ.sfx.bark();
    bubble('wolf', '멍!', 1);
    if (G.petLv() > before) {
      IQ.sfx.level();
      IQ.UI.toast(S.wolf.name + '의 레벨이 ' + G.petLv() + '(으)로 올랐어요! 새 능력이 생겼어요.');
    }
    return true;
  };

  G.renameWolf = function (name) {
    S.wolf.name = (name || '').trim().slice(0, 8) || S.wolf.name;
  };

  G.sniffRadius = () => 7 + G.petLv() * 2;

  G.sniff = function () {
    if (!S.wolf.tamed) return;
    if (R.sniffCd > 0) { IQ.UI.toast('킁킁은 ' + Math.ceil(R.sniffCd) + '초 뒤에 다시 쓸 수 있어요.'); return; }
    R.sniffCd = 8;
    const rad = G.sniffRadius();
    let best = null, bd = 1e9;
    S.objs.forEach(o => {
      if (o.t !== 'dig' || !o.hidden || o.done) return;
      const d = Math.hypot(o.x - S.wolf.x, o.y - S.wolf.y);
      if (d <= rad && d < bd) { best = o; bd = d; }
    });
    IQ.sfx.sniff();
    if (!best) {
      bubble('wolf', '킁킁…');
      IQ.UI.toast('근처에서는 아무 냄새도 나지 않아요. 다른 곳으로 가 봐요.');
      return;
    }
    bubble('wolf', '킁킁… 멍!');
    const path = findPath(S.wolf.x, S.wolf.y, (x, y) => Math.abs(x - best.x) + Math.abs(y - best.y) <= 1);
    R.w.path = path || [];
    R.w.sniffTarget = best;
    if (!path) revealDig(best);
  };

  function revealDig(o) {
    o.hidden = 0;
    R.w.sniffTarget = null;
    S.wolf.aff = Math.min(100, S.wolf.aff + 1);
    bubble('wolf', '여기야! 멍멍!', 2.2);
    IQ.sfx.bark();
    burst(o.x, o.y, ['#ffd84a', '#ffffff'], 10);
    IQ.UI.toast(S.wolf.name + '이(가) 무언가를 찾았어요! 반짝이는 곳을 파 보세요.');
  }

  function updateWolf(dt) {
    const w = S.wolf, r = R.w;
    if (!w.tamed) {
      r.rx = w.x; r.ry = w.y;
      const d = Math.hypot(S.p.x - w.x, S.p.y - w.y);
      if (d < 5) S.f.wolfMet = 1;
      R.howlT -= dt;
      if (R.howlT <= 0 && d < 16) { R.howlT = 7; bubble('wolf', d < 5 ? '으르르…' : '아우우~', 2.2); }
      return;
    }
    if (r.move) {
      r.move.t += dt * WOLF_SPEED;
      r.walkT += dt;
      if (r.move.t >= 1) { r.move = null; r.rx = w.x; r.ry = w.y; }
      else { r.rx = r.move.fx + (w.x - r.move.fx) * r.move.t; r.ry = r.move.fy + (w.y - r.move.fy) * r.move.t; return; }
    }
    // 멀리 떨어지면 순간이동
    if (Math.abs(w.x - S.p.x) + Math.abs(w.y - S.p.y) > 14 && !r.sniffTarget) {
      const spot = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => [S.p.x + dx, S.p.y + dy]).find(([x, y]) => !isBlocked(x, y));
      if (spot) { w.x = spot[0]; w.y = spot[1]; r.rx = w.x; r.ry = w.y; r.path = null; }
      return;
    }
    if (r.sniffTarget) {
      if (r.path && r.path.length) { stepWolf(r.path.shift()); return; }
      revealDig(r.sniffTarget);
      r.path = null;
      return;
    }
    // 플레이어를 따라간다
    const goal = R.trail.length ? R.trail[R.trail.length - 1] : null;
    if (!goal) return;
    if (w.x === goal[0] && w.y === goal[1]) return;
    if (Math.abs(w.x - S.p.x) + Math.abs(w.y - S.p.y) <= 1 && !R.p.move) return;
    const path = findPath(w.x, w.y, (x, y) => x === goal[0] && y === goal[1]);
    if (path && path.length) stepWolf(path[0]);
  }

  function stepWolf(nxt) {
    const w = S.wolf, r = R.w;
    if (!nxt) return;
    if (nxt[0] !== w.x) r.face = nxt[0] > w.x ? 'right' : 'left';
    r.move = { fx: w.x, fy: w.y, t: 0 };
    w.x = nxt[0]; w.y = nxt[1];
  }

  // ---------- 플레이어 이동 ----------
  function updatePlayer(dt) {
    const P = R.p;
    if (P.busy > 0) P.busy -= dt;
    if (P.act) { P.act.t += dt; if (P.act.t >= P.act.dur) P.act = null; }
    if (P.move) {
      P.move.t += dt * MOVE_SPEED;
      P.walkT += dt;
      if (P.move.t >= 1) { P.move = null; P.rx = S.p.x; P.ry = S.p.y; }
      else { P.rx = P.move.fx + (S.p.x - P.move.fx) * P.move.t; P.ry = P.move.fy + (S.p.y - P.move.fy) * P.move.t; return; }
    }
    if (P.busy > 0) return;
    if (P.queued) { const q = P.queued; P.queued = null; tapTile(q[0], q[1]); return; }
    if (P.path && P.path.length) {
      const [nx, ny] = P.path.shift();
      if (isBlocked(nx, ny)) { P.path = null; P.pending = null; return; }
      startMove(nx, ny);
      return;
    }
    P.path = null;
    if (P.pending) {
      const a = P.pending;
      P.pending = null;
      doAction(a);
      return;
    }
    if (R.keyDir) {
      const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[R.keyDir];
      S.p.face = R.keyDir;
      const nx = S.p.x + d[0], ny = S.p.y + d[1];
      if (!isBlocked(nx, ny)) startMove(nx, ny);
    }
  }

  function startMove(nx, ny) {
    faceTo(nx, ny);
    R.p.move = { fx: S.p.x, fy: S.p.y, t: 0 };
    R.trail.push([S.p.x, S.p.y]);
    if (R.trail.length > 4) R.trail.shift();
    S.p.x = nx; S.p.y = ny;
  }

  // ---------- 매 프레임 갱신 ----------
  G.update = function (dt, paused) {
    if (!S) return;
    updateEffects(dt);
    if (paused) return;
    S.time += dt;
    R.sniffCd = Math.max(0, R.sniffCd - dt);
    updatePlayer(dt);
    updateWolf(dt);
    updateBoars(dt);
    R.tick += dt;
    if (R.tick >= 1) {
      R.tick = 0;
      respawnObjs();
      S.p.regen = (S.p.regen || 0) + 1;
      if (S.p.regen >= 8) { S.p.regen = 0; if (S.p.st < G.maxSt()) S.p.st++; }
    }
  };

  function occupied(x, y) {
    return (S.p.x === x && S.p.y === y) || wolfAt(x, y) || S.boars.some(b => !b.dead && b.x === x && b.y === y);
  }

  function respawnObjs() {
    S.objs.forEach(o => {
      if (!o.respawn || S.time < o.respawn) return;
      if (occupied(o.x, o.y)) { o.respawn = S.time + 5; return; }
      delete o.respawn;
      if (o.back) { o.t = o.back; delete o.back; }
      delete o.gone; delete o.empty;
    });
  }

  function updateEffects(dt) {
    R.floats = R.floats.filter(f => (f.t += dt) < f.dur);
    R.parts = R.parts.filter(p => {
      p.t += dt;
      if (p.t < 0) return true;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.c !== 'heart') p.vy += 160 * dt;
      return p.t < p.dur;
    });
    if (R.marker) { R.marker.t += dt; if (R.marker.t > 0.6) R.marker = null; }
    if (S) R.bubbles = R.bubbles.filter(b => b.until > S.time);
  }

  // 테스트용 내부 접근
  G._dbg = () => ({ S, R, WD, findPath, isBlocked, tapTile, objAt });

  // ---------- 그리기 ----------
  const low = document.createElement('canvas');
  const lctx = low.getContext('2d');

  G.render = function (canvas) {
    if (!S) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width, ch = canvas.height;
    const zoom = Math.max(1, Math.round(Math.min(cw, ch) / (TS * 10)));
    R.zoom = zoom;
    const lw = Math.ceil(cw / zoom), lh = Math.ceil(ch / zoom);
    if (low.width !== lw || low.height !== lh) { low.width = lw; low.height = lh; }
    R.lowW = lw; R.lowH = lh;
    lctx.imageSmoothingEnabled = false;

    // 카메라
    const mapW = IQ.W * TS, mapH = IQ.H * TS;
    let cx = Math.round((R.p.rx + 0.5) * TS - lw / 2);
    let cy = Math.round((R.p.ry + 0.5) * TS - lh / 2);
    cx = lw >= mapW ? Math.round((mapW - lw) / 2) : Math.max(0, Math.min(mapW - lw, cx));
    cy = lh >= mapH ? Math.round((mapH - lh) / 2) : Math.max(0, Math.min(mapH - lh, cy));
    R.camX = cx; R.camY = cy;

    lctx.fillStyle = '#2f77cc';
    lctx.fillRect(0, 0, lw, lh);
    lctx.drawImage(ground, -cx, -cy);

    const tx0 = Math.floor(cx / TS) - 1, ty0 = Math.floor(cy / TS) - 1;
    const tx1 = Math.ceil((cx + lw) / TS) + 1, ty1 = Math.ceil((cy + lh) / TS) + 2;

    // 물결 반짝임
    const phase = Math.floor(S.time * 2);
    lctx.fillStyle = '#d6f0ff';
    for (let y = Math.max(0, ty0); y < Math.min(IQ.H, ty1); y++) for (let x = Math.max(0, tx0); x < Math.min(IQ.W, tx1); x++) {
      if (WD.tiles[idx(x, y)] !== IQ.T.WATER) continue;
      if (((x * 7 + y * 13 + phase * 5) % 19) === 0) lctx.fillRect(x * TS + 4 - cx, y * TS + 7 - cy, 4, 1);
    }

    // 목표 표시
    if (R.marker) {
      lctx.strokeStyle = 'rgba(255,255,255,' + (1 - R.marker.t / 0.6) + ')';
      lctx.strokeRect(R.marker.x * TS + 1.5 - cx, R.marker.y * TS + 1.5 - cy, TS - 3, TS - 3);
    }

    // 깊이 정렬 그리기
    const list = [];
    S.objs.forEach(o => {
      if (o.done || o.gone) return;
      if (o.x < tx0 || o.x > tx1 || o.y < ty0 || o.y > ty1) return;
      const spr = objSprite(o);
      if (!spr) return;
      list.push({ y: o.y + (IQ.OBJ[o.t].block ? 0 : -0.3), fn: () => drawAt(spr, o.x, o.y, o) });
    });
    S.boars.forEach((b, i) => {
      if (b.dead) return;
      const r = R.boarR.get(i);
      if (!r) return;
      const set = b.hit ? IQ.SPR.boarHit : IQ.SPR.boar;
      list.push({ y: r.ry + 0.01, fn: () => { shadow(r.rx, r.ry); drawAt(set[r.face], r.rx, r.ry); } });
    });
    const w = S.wolf, wr = R.w;
    list.push({
      y: wr.ry + 0.02, fn: () => {
        if (!w.tamed) { shadow(wr.rx, wr.ry); drawAt(IQ.SPR.wolfLie, wr.rx, wr.ry); return; }
        const fr = wr.move ? Math.floor(wr.walkT * 8) % 2 : 0;
        shadow(wr.rx, wr.ry);
        drawAt(IQ.SPR.wolf[wr.face][fr], wr.rx, wr.ry);
      },
    });
    list.push({ y: R.p.ry + 0.03, fn: drawPlayer });
    list.sort((a, b) => a.y - b.y);
    list.forEach(d => d.fn());

    // 파티클
    R.parts.forEach(p => {
      if (p.t < 0) return;
      const px = Math.round(p.x - cx), py = Math.round(p.y - cy);
      if (p.c === 'heart') {
        lctx.fillStyle = '#ff5c8a';
        lctx.fillRect(px - 2, py, 2, 2); lctx.fillRect(px + 1, py, 2, 2);
        lctx.fillRect(px - 2, py + 1, 5, 2); lctx.fillRect(px - 1, py + 3, 3, 1); lctx.fillRect(px, py + 4, 1, 1);
      } else {
        lctx.fillStyle = p.c;
        lctx.fillRect(px, py, 2, 2);
      }
    });

    // 밤처럼 보이지 않도록 가장자리만 살짝 어둡게
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, lw, lh, 0, 0, lw * zoom, lh * zoom);

    // 글자(선명하게 큰 캔버스에)
    const fs = Math.max(12, Math.round(zoom * 4.5));
    ctx.font = 'bold ' + fs + 'px "Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    R.floats.forEach(f => {
      const k = f.t / f.dur;
      const x = (f.x - cx) * zoom, y = (f.y - cy - k * 14) * zoom;
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      ctx.lineWidth = Math.max(3, zoom);
      ctx.strokeStyle = '#1a1208';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
    });
    ctx.globalAlpha = 1;
    R.bubbles.forEach(b => {
      let bx, by;
      if (b.who === 'wolf') { bx = R.w.rx; by = R.w.ry; } else { bx = R.p.rx; by = R.p.ry; }
      const x = (bx * TS + 8 - cx) * zoom, y = (by * TS - 6 - cy) * zoom;
      const tw = ctx.measureText(b.text).width + fs;
      const th = fs * 1.6;
      ctx.fillStyle = '#fffdf2';
      ctx.strokeStyle = '#2a1a10';
      ctx.lineWidth = Math.max(2, zoom / 2);
      roundRect(ctx, x - tw / 2, y - th, tw, th, fs * 0.4);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - fs * 0.3, y - 1); ctx.lineTo(x, y + fs * 0.4); ctx.lineTo(x + fs * 0.3, y - 1);
      ctx.fill();
      ctx.fillStyle = '#2a1a10';
      ctx.fillText(b.text, x, y - th / 2);
    });
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function objSprite(o) {
    const SP = IQ.SPR;
    switch (o.t) {
      case 'tree': return SP.tree;
      case 'stump': return SP.stump;
      case 'palm': return o.empty ? SP.palm_e : SP.palm;
      case 'rock': return o.keep ? SP.rock_moss : SP.rock;
      case 'bush': return o.empty ? SP.bush_e : SP.bush;
      case 'grass': return SP.grass;
      case 'statue': {
        const lit = S.f.statues || S.statueSeq.includes(o.sym);
        return SP['statue_' + o.sym + (lit ? '_lit' : '')];
      }
      case 'tablet': case 'inscr': return SP.tablet;
      case 'gate': return SP.gate;
      case 'chest': return o.opened ? SP.chest_o : SP.chest;
      case 'altar': return IQ.altarSprite(S.f.altar_frag_sun, S.f.altar_frag_moon, S.f.altar_frag_star);
      case 'campfire': return Math.floor(S.time * 6) % 2 ? SP.fire1 : SP.fire0;
      case 'dig': return o.hidden ? null : SP.dig;
      case 'wreck': return SP['wreck' + o.part];
      case 'bottle': return SP.bottle;
    }
    return null;
  }

  function drawAt(spr, tx, ty, o) {
    const x = Math.round(tx * TS + (TS - spr.width) / 2 - R.camX);
    const y = Math.round((ty + 1) * TS - spr.height - R.camY);
    lctx.drawImage(spr, x, y);
    if (o && o.t === 'dig' && !o.hidden && Math.floor(S.time * 3) % 2) {
      lctx.fillStyle = '#ffffff';
      lctx.fillRect(x + 11, y + 7, 1, 1);
    }
    if (o && o.t === 'altar' && S.f.cleared) {
      lctx.fillStyle = 'rgba(255,240,170,' + (0.35 + 0.15 * Math.sin(S.time * 4)) + ')';
      lctx.fillRect(x + 5, 0, 6, y + 6);
    }
  }

  function shadow(tx, ty) {
    lctx.fillStyle = 'rgba(0,0,0,0.22)';
    const x = Math.round(tx * TS - R.camX), y = Math.round((ty + 1) * TS - R.camY);
    lctx.fillRect(x + 4, y - 2, 8, 2);
    lctx.fillRect(x + 3, y - 1, 10, 1);
  }

  function drawPlayer() {
    const P = R.p;
    const set = IQ.SPR.player[S.p.face];
    const walking = !!P.move;
    const fr = walking ? Math.floor(P.walkT * 8) % 2 : 0;
    shadow(P.rx, P.ry);
    const bob = walking && fr ? -1 : 0;
    drawAt(set[fr], P.rx, P.ry + bob / TS);
    if (P.act) {
      const icon = P.act.kind === 'hand' ? null : IQ.SPR.icons[P.act.kind];
      if (!icon) return;
      const k = P.act.t / P.act.dur;
      const d = faceDelta();
      const px = (P.rx + 0.5 + d[0] * 0.55) * TS - R.camX;
      const py = (P.ry + 0.45 + d[1] * 0.4) * TS - R.camY;
      lctx.save();
      lctx.translate(Math.round(px), Math.round(py));
      if (P.act.kind === 'rod') {
        if (S.p.face === 'left') lctx.scale(-1, 1);
        lctx.rotate(-0.3 + Math.min(1, k * 2) * 0.6);
      } else {
        if (S.p.face === 'left') lctx.scale(-1, 1);
        lctx.rotate(-1.2 + k * 1.8);
      }
      lctx.drawImage(icon, -8, -12);
      lctx.restore();
    }
  }
})();

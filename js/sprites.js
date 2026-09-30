// 도트 스프라이트 정의: 문자열 한 글자 = 픽셀 1개, 팔레트로 색을 지정한다.
window.IQ = window.IQ || {};
(function () {
  'use strict';
  const IQ = window.IQ;

  const PAL = {
    k: '#2a1a10', K: '#1c1c24',
    s: '#f2c28e', S: '#cf9462',
    h: '#7a4420', H: '#522a10',
    b: '#3b6fe0', B: '#26479e',
    w: '#ffffff',
    g: '#3fa645', G: '#27732e', l: '#79d651',
    t: '#9a6431', T: '#653e1c',
    r: '#a0a0aa', R: '#676772', q: '#cfd0d8',
    e: '#e23c3c', E: '#a8222a',
    y: '#ffd84a', o: '#f39a2b', O: '#d8601c', x: '#ff5a3a',
    f: '#8e97a6', F: '#5d6472', W: '#e2e6ee',
    p: '#8a5530', P: '#56331b', n: '#eba7a7',
    c: '#7d4c1c',
    u: '#3b8fe2', U: '#8fd0ff',
    m: '#a978ec', M: '#6d44b8',
    z: '#ead7a0', Z: '#c9ae72',
    a: '#d4ae6a',
  };
  const OUTLINE = '#24160c';

  function build(rows, pal, outline) {
    const h = rows.length;
    const w = Math.max.apply(null, rows.map(r => r.length));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const on = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) {
      const r = rows[j];
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (ch === '.') continue;
        const col = (pal && pal[ch]) || PAL[ch];
        if (!col) continue;
        x.fillStyle = col;
        x.fillRect(i, j, 1, 1);
        on[j * w + i] = 1;
      }
    }
    if (outline) {
      x.fillStyle = OUTLINE;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        if (on[j * w + i]) continue;
        if ((i > 0 && on[j * w + i - 1]) || (i < w - 1 && on[j * w + i + 1]) ||
            (j > 0 && on[(j - 1) * w + i]) || (j < h - 1 && on[(j + 1) * w + i])) {
          x.fillRect(i, j, 1, 1);
        }
      }
    }
    return c;
  }

  function flipH(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const x = c.getContext('2d');
    x.translate(src.width, 0); x.scale(-1, 1);
    x.drawImage(src, 0, 0);
    return c;
  }

  // ---------- 캐릭터 ----------
  const PLAYER_DOWN = [
    '................',
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '...hhssssssHh...',
    '...hsskssksSh...',
    '....ssssssss....',
    '....sssSSsss....',
    '.....ssssss.....',
    '....SssssssS....',
    '...ss.ssss.ss...',
    '...s..ssss..s...',
    '.....bbbbbb.....',
    '.....bbBBbb.....',
    '.....ss..ss.....',
    '.....kk..kk.....',
  ];
  const PLAYER_UP = [
    '................',
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '...hhhhhhhhhh...',
    '...hhhhhhhhhh...',
    '....hhhhhhhh....',
    '....Shhhhhhs....',
    '.....ssssss.....',
    '....SssssssS....',
    '...ss.ssss.ss...',
    '...s..ssss..s...',
    '.....bbbbbb.....',
    '.....bbbbbb.....',
    '.....ss..ss.....',
    '.....kk..kk.....',
  ];
  const PLAYER_RIGHT = [
    '................',
    '.....hhhhh......',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '...hhhhhsssss...',
    '...hhhhsssks....',
    '...Hhhssssssss..',
    '....hsssssSS....',
    '.....ssssss.....',
    '.....Sssssss....',
    '.....ssssss.....',
    '.....Sssssss....',
    '.....bbbbbb.....',
    '.....bbbBbb.....',
    '.....ss..ss.....',
    '.....kk..kkk....',
  ];
  function walkFrame(rows) {
    const r = rows.slice();
    r[13] = '.....bb..bb.....';
    r[14] = '....ss....ss....';
    r[15] = '....kk....kk....';
    return r;
  }

  const WOLF_R = [
    '................',
    '................',
    '................',
    '...........F.F..',
    '..........FfFfF.',
    '..........fffff.',
    '..........ffkfW.',
    'F........fffffWK',
    'fF......fffffWW.',
    '.fF.fffffffffW..',
    '..fffffffffffF..',
    '..FfffWWWWffF...',
    '...fF.fF.fF.fF..',
    '...fF.fF.fF.fF..',
    '...FF.FF.FF.FF..',
    '................',
  ];
  const WOLF_R2 = WOLF_R.slice(0, 12).concat([
    '..fF..fFfF..fF..',
    '..fF..fFfF..fF..',
    '..FF..FFFF..FF..',
    '................',
  ]);
  const WOLF_LIE = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...........F.F..',
    '..........FfFfF.',
    '..........ffkfW.',
    'FF.......fffffWK',
    '.fffffffffffWWW.',
    '..fffffffffffF..',
    '..FfffWWWWWffF..',
    '...FFFFFFFFFF...',
    '................',
  ];
  const BOAR_R = [
    '................',
    '................',
    '................',
    '........P.......',
    '.......PpP......',
    '...PPPPppppPP...',
    '..PppppppppppP..',
    '.PpppppppppkppP.',
    'PPppppppppppppnn',
    '.PppppppppppwnnP',
    '..Pppppppppppp..',
    '...PpppppppppP..',
    '...pP.pP..pP.pP.',
    '...PP.PP..PP.PP.',
    '................',
    '................',
  ];

  // ---------- 오브젝트 ----------
  const TREE = [
    '......GGGG......',
    '....GGggggGG....',
    '...GgglllgggG...',
    '..GgglllllgggG..',
    '.GggllllggggggG.',
    '.GggllgggggggggG',
    'GggggggggggggggG',
    'GgggggggggggGggG',
    'GggGgggggggGgggG',
    '.GggggGgggggggG.',
    '.GGgggggggGgggG.',
    '..GGgggGggggGG..',
    '...GGGgggGGGG...',
    '.....GGtTGG.....',
    '......ttT.......',
    '......ttT.......',
    '......ttT.......',
    '.....tttTT......',
    '....Tt.tT.T.....',
  ];
  const STUMP = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....TTTTT......',
    '....TzzZzzT.....',
    '....TtzzztT.....',
    '....TtttttT.....',
    '...TTtTtttTT....',
    '..T.TTTTTT..T...',
    '................',
  ];
  const PALM = [
    '...g.....g......',
    '..ggg...ggg.....',
    '.gglgg.gglgg....',
    'gg...ggggg..gg..',
    '...ggGccGgg.....',
    '..gg..ccc.gg....',
    '.g.....tT...g...',
    '.......tT.......',
    '........tT......',
    '........tT......',
    '........tT......',
    '.........tT.....',
    '.........tT.....',
    '.........tT.....',
    '........ttTT....',
  ];
  const ROCK = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....RRRRR......',
    '...RRrrqqrRR....',
    '..RrrqqqrrrrR...',
    '.RrrrqrrrrrrrR..',
    '.RrrrrrrrrrRrR..',
    '.RRrrrrrrRRrrR..',
    '..RRRRRRRRRRR...',
    '................',
    '................',
    '................',
  ];
  const BUSH = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....GGGGG......',
    '...GGgglggGG....',
    '..GggelggegggG..',
    '.GgggggggggeggG.',
    '.GgegglgggggggG.',
    '.GgggggegglgggG.',
    '..GGgggggggggG..',
    '...GGGGGGGGGG...',
    '................',
    '................',
    '................',
  ];
  const GRASS = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....l...l..l....',
    '...lg..lg.lg....',
    '...gG.lgG.gG.l..',
    '..lgG.gGG.gGlg..',
    '..gGG.gGGgGGgG..',
    '..GGGGGGGGGGGG..',
    '................',
    '................',
  ];
  const STATUE = [
    '....RRRRRRRR....',
    '...RqqqqqqqqR...',
    '...RqLLLLLLqR...',
    '...RqL1234LqR...',
    '...RqL5678LqR...',
    '...RqL9abcLqR...',
    '...RqLdefgLqR...',
    '...RqLLLLLLqR...',
    '...RqqqqqqqqR...',
    '....RrrrrrrR....',
    '....RrqrrrrR....',
    '....RrrrrrrR....',
    '....RrrrrqrR....',
    '...RRRRRRRRRR...',
    '..RqqqqqqqqqqR..',
    '..RRRRRRRRRRRR..',
  ];
  const SYMBOLS = {
    sun:  ['.XX.', 'XXXX', 'XXXX', '.XX.'],
    moon: ['.XX.', 'XX..', 'XX..', '.XX.'],
    star: ['..X.', 'XXXX', '.XX.', 'X..X'],
    wave: ['X...', '.X.X', 'X.X.', '...X'],
  };
  const SYM_COLOR = { sun: '#ffcf2a', moon: '#b58cff', star: '#ffffff', wave: '#56b8ff' };
  const TABLET = [
    '................',
    '................',
    '................',
    '.....RRRRRR.....',
    '....RqqqqqqR....',
    '....RqRRRRqR....',
    '....RqqqqqqR....',
    '....RqRRRqqR....',
    '....RqqqqqqR....',
    '....RqRRRRqR....',
    '....RqqqqqqR....',
    '...RRRRRRRRRR...',
    '..RrrrrrrrrrrR..',
    '..RRRRRRRRRRRR..',
    '................',
    '................',
  ];
  const GATE = (function () {
    const r = ['RRRRRRRRRRRRRRRR'];
    for (let i = 0; i < 14; i++) {
      r.push(i === 3 || i === 10 ? 'RKKKKKKKKKKKKKKR' : 'RTttTttTttTttTtR');
    }
    r.push('RRRRRRRRRRRRRRRR');
    return r;
  })();
  const CHEST = [
    '................',
    '................',
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kttttttttttk..',
    '..kTTTTTTTTTTk..',
    '..kkkkkyykkkkk..',
    '..kttttyyttttk..',
    '..ktttttttttTk..',
    '..kTTTTTTTTTTk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ];
  const CHEST_OPEN = [
    '................',
    '................',
    '...kkkkkkkkkk...',
    '..kTTTTTTTTTTk..',
    '..kttttttttttk..',
    '..kkkkkkkkkkkk..',
    '..kKKKKKKKKKKk..',
    '..kkkkkkkkkkkk..',
    '..kttttttttttk..',
    '..ktttttttttTk..',
    '..kTTTTTTTTTTk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
  ];
  const ALTAR = [
    '................',
    '................',
    '................',
    '..RRRRRRRRRRRR..',
    '.RqqqqqqqqqqqqR.',
    '.RqAAqqBBqqCCqR.',
    '.RqAAqqBBqqCCqR.',
    '.RRRRRRRRRRRRRR.',
    '...RrrrrrrrrR...',
    '...RrqrrrrqrR...',
    '...RrrrrrrrrR...',
    '..RRRRRRRRRRRR..',
    '.RqqqqqqqqqqqqR.',
    '.RRRRRRRRRRRRRR.',
    '................',
    '................',
  ];
  const FIRE = [
    '................',
    '................',
    '................',
    '................',
    '.......x........',
    '......xo........',
    '......oyx.......',
    '.....xoyox......',
    '.....oyyyo......',
    '....xoywyox.....',
    '....ToyyyoT.....',
    '...TtTooOtTt....',
    '..tTt.TTTtTtT...',
    '...RR.....RR....',
    '................',
    '................',
  ];
  const DIG = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......y........',
    '......yWy.......',
    '.......y...y....',
    '....ZTTTTZ......',
    '...ZTttttTZ.....',
    '...TttTTttT.....',
    '....TTTTTT......',
    '................',
    '................',
  ];
  const WRECK0 = [
    '................',
    '................',
    '................',
    '..........T.....',
    '.........Tt.....',
    '........Ttt.....',
    '...T...TtttT....',
    '...tT.TttTtt....',
    '...ttTtttttt.TTT',
    '...tttttTtttTttt',
    '....ttTtttttttTt',
    '....TTTTTTTTTTTT',
    '....ZZZZZZZZZZZZ',
    '................',
  ];
  const WRECK1 = [
    '................',
    '................',
    '..T.............',
    '..tT............',
    '..ttT...........',
    '..tt.T..........',
    'TT.t..T.........',
    'ttTt...T........',
    'tttttttt........',
    'tTtttttT........',
    'ttttTtTt........',
    'TTTTTTTT........',
    'ZZZZZZZZ........',
    '................',
  ];
  const BOTTLE = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..........ka....',
    '.........UUk....',
    '.......UUwUU....',
    '......UwUUUU....',
    '.....UUUyUU.....',
    '......UUUU......',
    '................',
    '................',
  ];

  // ---------- 아이템 아이콘 ----------
  const I = {};
  I.branch = [
    '................',
    '................',
    '...........t....',
    '..........tT....',
    '.........tT.g...',
    '........tT.gg...',
    '.......tTt......',
    '......tT........',
    '.....tT.........',
    '....tT..........',
    '...tT...........',
    '..tT............',
  ];
  I.wood = [
    '................',
    '................',
    '................',
    '................',
    '..TTTTTTTTTZZ...',
    '.TttttttttZzzZ..',
    '.TttTtttttZzozZ.',
    '.TttttttTtZzozZ.',
    '.TttttttttZzzZ..',
    '..TTTTTTTTTZZ...',
  ];
  I.stone = [
    '................',
    '................',
    '................',
    '................',
    '......RRRR......',
    '.....RrqqrR.....',
    '....RrqqrrrR....',
    '....RrrrrrrR....',
    '....RRrrrrRR....',
    '......RRRR......',
  ];
  I.fiber = [
    '................',
    '........l.......',
    '.....l..g..l....',
    '......g.g.g.....',
    '......g.g.g.....',
    '.......ggg......',
    '.......ggg......',
    '......aaaaa.....',
    '.......ggg......',
    '......g.g.g.....',
    '.....g..g..g....',
    '....G...G...G...',
  ];
  I.berry = [
    '................',
    '........Gg......',
    '.......G.gg.....',
    '.....eee.eee....',
    '....ewee.ewee...',
    '....eeeE.eeeE...',
    '....eeEE.eeEE...',
    '.....EE...EE....',
  ];
  I.coconut = [
    '................',
    '................',
    '.....cccccc.....',
    '....ccTccccc....',
    '...cccccTcccc...',
    '...ccTcccccTc...',
    '...cccccccccc...',
    '...ccccTccccc...',
    '....cccccccc....',
    '.....cccccc.....',
  ];
  I.fish = [
    '................',
    '................',
    '................',
    '...........u....',
    '....uuuuu..uu...',
    '...uUUUUuuuuu...',
    '..uUkUUUUUuu....',
    '..uwwwwwwuuuu...',
    '...uwwwwuu..uu..',
    '....uuuuu.......',
  ];
  I.meat = [
    '................',
    '................',
    '.....eeee.......',
    '....eennnee.....',
    '...ennnneeee....',
    '...eneeeeeEe....',
    '...eeeeeEEEe....',
    '....eeeEEEww....',
    '.....EEEE.www...',
    '..........ww....',
  ];
  I.charcoal = [
    '................',
    '................',
    '................',
    '................',
    '......KKK.......',
    '....KKKRKK......',
    '...KKRKKKKKK....',
    '...KKKKKKRKKK...',
    '....KKKKKKKK....',
  ];
  I.axe = [
    '................',
    '................',
    '........RRR.....',
    '.......RqqrR....',
    '......RqrrrR....',
    '.......RrrR.....',
    '......tT.R......',
    '.....tT.........',
    '....tT..........',
    '...tT...........',
    '..tT............',
    '..T.............',
  ];
  I.pickaxe = [
    '................',
    '....RRR.........',
    '...RqqRR........',
    '......RRRR......',
    '.......tRqR.....',
    '......tT..RR....',
    '.....tT....R....',
    '....tT..........',
    '...tT...........',
    '..tT............',
  ];
  I.rope = [
    '................',
    '................',
    '.....aaaaa......',
    '....aZ...Za.....',
    '...aZ.aaa.Za....',
    '...a.aZ.Za.a....',
    '...a.a...a.a....',
    '...a.aZ.Za.a....',
    '...aZ.aaa.Za....',
    '....aZ...Z.a....',
    '.....aaaaa..a...',
    '..............a.',
  ];
  I.rod = [
    '..............t.',
    '.............tU.',
    '............t.U.',
    '...........t..U.',
    '..........t...U.',
    '.........t....U.',
    '........t.....e.',
    '.......t........',
    '......T.........',
    '.....T..........',
    '....TT..........',
    '...TT...........',
  ];
  I.frag = [
    '................',
    '......RR........',
    '.....RqqR.......',
    '....RqqqqRR.....',
    '...RqqXXqqqR....',
    '...RqXXXXqqR....',
    '....RqXXqqR.....',
    '....RqqqqR......',
    '.....RqqR.......',
    '......RR........',
  ];
  I.coin = [
    '................',
    '................',
    '.....oooooo.....',
    '....oyyyyyyo....',
    '...oyywyyyyyo...',
    '...oyyyooyyyo...',
    '...oyyoyyyyyo...',
    '...oyyyooyyyo...',
    '...oyyyyyoyyo...',
    '...oyyyooyyyo...',
    '....oyyyyyyo....',
    '.....oooooo.....',
  ];
  I.sniff = [
    '................',
    '..F.F...........',
    '.FfFfF..........',
    '.fffff..........',
    '.ffkff..........',
    '.fffffWK...U.U..',
    '..ffffWW..U.U...',
    '...ffff....U.U..',
  ];

  const SPR = {};
  const ICON_URL = {};

  function statue(sym, lit) {
    const pat = SYMBOLS[sym];
    const map = '123456789abcdefg';
    const rows = STATUE.map(r => r.replace(/[1-9a-g]/g, ch => {
      const i = map.indexOf(ch);
      return pat[Math.floor(i / 4)][i % 4] === 'X' ? 'X' : 'r';
    }));
    return build(rows, { X: SYM_COLOR[sym], L: lit ? '#ffe45c' : PAL.r }, true);
  }

  IQ.altarSprite = function (a, b, c) {
    const key = 'altar' + (a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0);
    if (!SPR[key]) {
      SPR[key] = build(ALTAR, {
        A: a ? SYM_COLOR.sun : PAL.K,
        B: b ? SYM_COLOR.moon : PAL.K,
        C: c ? SYM_COLOR.star : PAL.K,
      }, true);
    }
    return SPR[key];
  };

  IQ.SYM_COLOR = SYM_COLOR;

  IQ.initSprites = function () {
    const pd = build(PLAYER_DOWN, null, true), pu = build(PLAYER_UP, null, true), pr = build(PLAYER_RIGHT, null, true);
    const pd2 = build(walkFrame(PLAYER_DOWN), null, true), pu2 = build(walkFrame(PLAYER_UP), null, true), pr2 = build(walkFrame(PLAYER_RIGHT), null, true);
    SPR.player = {
      down: [pd, pd2], up: [pu, pu2], right: [pr, pr2], left: [flipH(pr), flipH(pr2)],
    };
    const wr = build(WOLF_R, null, true), wr2 = build(WOLF_R2, null, true);
    SPR.wolf = { right: [wr, wr2], left: [flipH(wr), flipH(wr2)] };
    SPR.wolfLie = build(WOLF_LIE, null, true);
    const br = build(BOAR_R, null, true);
    SPR.boar = { right: br, left: flipH(br) };
    SPR.boarHit = { right: build(BOAR_R, { p: '#ffffff', P: '#ffb0b0' }, true) };
    SPR.boarHit.left = flipH(SPR.boarHit.right);

    SPR.tree = build(TREE, null, true);
    SPR.stump = build(STUMP, null, true);
    SPR.palm = build(PALM, null, true);
    SPR.palm_e = build(PALM, { c: PAL.g }, true);
    SPR.rock = build(ROCK, null, true);
    SPR.rock_moss = build(ROCK, { q: '#8fbf6a' }, true);
    SPR.bush = build(BUSH, null, true);
    SPR.bush_e = build(BUSH, { e: PAL.g }, true);
    SPR.grass = build(GRASS, null, false);
    for (const s of Object.keys(SYMBOLS)) {
      SPR['statue_' + s] = statue(s, false);
      SPR['statue_' + s + '_lit'] = statue(s, true);
    }
    SPR.tablet = build(TABLET, null, true);
    SPR.gate = build(GATE, null, false);
    SPR.chest = build(CHEST, null, false);
    SPR.chest_o = build(CHEST_OPEN, null, false);
    SPR.fire0 = build(FIRE, null, false);
    SPR.fire1 = flipH(SPR.fire0);
    SPR.dig = build(DIG, null, false);
    SPR.wreck0 = build(WRECK0, null, true);
    SPR.wreck1 = build(WRECK1, null, true);
    SPR.bottle = build(BOTTLE, null, true);

    const icons = {
      branch: build(I.branch, null, true),
      wood: build(I.wood, null, true),
      stone: build(I.stone, null, true),
      fiber: build(I.fiber, null, true),
      berry: build(I.berry, null, true),
      coconut: build(I.coconut, null, true),
      fish: build(I.fish, null, true),
      gfish: build(I.fish, { u: '#b0662a', U: '#d8904a', w: '#f0c070' }, true),
      meat: build(I.meat, null, true),
      cmeat: build(I.meat, { e: '#9a4a1e', n: '#c8783a', E: '#6a2e10' }, true),
      charcoal: build(I.charcoal, null, true),
      axe: build(I.axe, null, true),
      pickaxe: build(I.pickaxe, null, true),
      rope: build(I.rope, null, true),
      rod: build(I.rod, null, true),
      campfire: SPR.fire0,
      frag_sun: build(I.frag, { X: SYM_COLOR.sun }, true),
      frag_moon: build(I.frag, { X: SYM_COLOR.moon }, true),
      frag_star: build(I.frag, { X: SYM_COLOR.star }, true),
      coin: build(I.coin, null, true),
      sniff: build(I.sniff, null, true),
      wolf: wr,
      bag: build([
        '................',
        '......TTTT......',
        '.....T....T.....',
        '...aaaaaaaaaa...',
        '..aZZZZZZZZZZa..',
        '..aZaaaaaaaaZa..',
        '..aZaaatTaaaZa..',
        '..aZaaaaaaaaZa..',
        '..aZaaaaaaaaZa..',
        '..aZZZZZZZZZZa..',
        '...aaaaaaaaaa...',
      ], null, true),
      craft: build([
        '................',
        '..RRR.......TT..',
        '.RqqRR.....TtT..',
        '....RRRR..TtT...',
        '.....tRqRTtT....',
        '....tT..RRT.....',
        '...tT...TtR.....',
        '..tT...TtT.R....',
        '.tT...TtT.......',
        '.....TtT........',
      ], null, true),
      menu: build([
        '................',
        '................',
        '...wwwwwwwwww...',
        '...wwwwwwwwww...',
        '................',
        '...wwwwwwwwww...',
        '...wwwwwwwwww...',
        '................',
        '...wwwwwwwwww...',
        '...wwwwwwwwww...',
      ], null, true),
    };
    SPR.icons = icons;
    IQ.SPR = SPR;
  };

  // DOM에서 쓸 아이콘 이미지 주소 (4배 확대해 선명하게)
  IQ.iconURL = function (id) {
    if (ICON_URL[id]) return ICON_URL[id];
    const src = SPR.icons[id];
    if (!src) return '';
    const c = document.createElement('canvas');
    const s = 4;
    c.width = 16 * s; c.height = 16 * s;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const ox = Math.floor((16 - src.width) / 2), oy = Math.floor((16 - src.height) / 2);
    x.drawImage(src, ox * s, oy * s, src.width * s, src.height * s);
    ICON_URL[id] = c.toDataURL();
    return ICON_URL[id];
  };
})();

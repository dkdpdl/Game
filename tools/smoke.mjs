// 스모크 테스트: 게임을 실제 브라우저(모바일 화면)로 열어 오류 없이 돌아가는지,
// 주요 장소에 모두 갈 수 있는지, 핵심 흐름(채집→제작→늑대→수수께끼→클리어)이 되는지 확인한다.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

let failed = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failed++; };

await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.screenshot({ path: path.join(out, '01-title.png') });
await page.click('#btnNew');
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, '02-intro.png') });
// 인트로 대화 넘기기
for (let i = 0; i < 6 && await page.isVisible('#modal'); i++) await page.click('#mBtns .btn');
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, '03-start.png') });

// 1) 주요 장소 도달 가능 여부
const reach = await page.evaluate(() => {
  const { S, findPath, isBlocked } = IQ.G._dbg();
  const gate = S.objs.find(o => o.t === 'gate');
  gate.gone = 1; // 문이 열린 뒤 기준으로 검사
  const targets = {
    '유리병': [30, 47, true], '유적 비석': [41, 19], '난파선 비석': [10, 33], '난파선': [8, 31],
    '늑대 굴': [16, 16], '달의 조각 자리': [48, 35, true], '벽 글귀': [39, 10], '제단': [39, 12],
    '해 석상': [38, 15], '달 석상': [40, 15], '별 석상': [36, 15], '물결 석상': [42, 15], '상자 자리': [43, 10],
  };
  const res = {};
  for (const [k, [x, y, on]] of Object.entries(targets)) {
    const p = findPath(S.p.x, S.p.y, (px, py) => Math.abs(px - x) + Math.abs(py - y) === 1 || (on && px === x && py === y));
    res[k] = !!p;
  }
  // 숨겨진 보물 자리도 모두 닿을 수 있어야 한다
  S.objs.filter(o => o.t === 'dig').forEach((o, i) => {
    res['보물 자리 ' + i + ' (' + o.x + ',' + o.y + ')'] = !!findPath(S.p.x, S.p.y, (px, py) => px === o.x && py === o.y);
  });
  delete gate.gone;
  res._boars = S.boars.length;
  return res;
});
console.log('도달 가능 여부');
for (const [k, v] of Object.entries(reach)) if (k !== '_boars') check(v, k);
check(reach._boars >= 3, '멧돼지 ' + reach._boars + '마리');

// 2) 실제 터치로 채집: 가장 가까운 나무를 터치해 나뭇가지 얻기
console.log('채집·제작');
const tree = await page.evaluate(() => {
  const { S, R } = IQ.G._dbg();
  const t = S.objs.filter(o => o.t === 'tree').sort((a, b) => Math.hypot(a.x - S.p.x, a.y - S.p.y) - Math.hypot(b.x - S.p.x, b.y - S.p.y))[0];
  const dpr = 2;
  return { x: ((t.x + 0.5) * 16 - R.camX) * R.zoom / dpr, y: ((t.y + 0.5) * 16 - R.camY) * R.zoom / dpr, tx: t.x, ty: t.y };
});
await page.mouse.click(tree.x, tree.y);
await page.waitForTimeout(4000);
const branch = await page.evaluate(() => IQ.G.count('branch'));
check(branch >= 1, '나무를 터치해 나뭇가지 획득 (' + branch + '개)');
await page.screenshot({ path: path.join(out, '04-gather.png') });

// 재료를 채워 돌도끼와 모닥불 제작
const crafted = await page.evaluate(() => {
  const S = IQ.G.state();
  Object.assign(S.inv, { branch: 5, stone: 8, fiber: 5, wood: 4 });
  const axe = IQ.G.craft(IQ.RECIPES.find(r => r.id === 'axe'));
  IQ.UI.close();
  const fire = IQ.G.craft(IQ.RECIPES.find(r => r.id === 'campfire'));
  return { axe, fire, hasAxe: IQ.G.has('axe'), fireObj: S.objs.some(o => o.t === 'campfire'), obj: IQ.G.objective() };
});
check(crafted.axe && crafted.hasAxe, '돌도끼 제작');
check(crafted.fire && crafted.fireObj, '모닥불 제작·설치');
check(crafted.obj.includes('늑대'), '목표가 늑대로 바뀜: ' + crafted.obj);

// 요리
const cooked = await page.evaluate(() => {
  const S = IQ.G.state();
  S.inv.meat = 2;
  IQ.G.cook(IQ.COOK.find(r => r.id === 'cmeat'));
  IQ.G.cook(IQ.COOK.find(r => r.id === 'cmeat'));
  S.inv.wood = (S.inv.wood || 0) + 1;
  IQ.G.cook(IQ.COOK.find(r => r.id === 'charcoal'));
  return { cmeat: IQ.G.count('cmeat'), charcoal: IQ.G.count('charcoal') };
});
check(cooked.cmeat === 2 && cooked.charcoal === 1, '구운 고기·숯 만들기');

// 3) 늑대 길들이기: 늑대 옆으로 순간이동 후 실제 UI로 먹이 주기
console.log('늑대');
await page.evaluate(() => {
  const { S, R } = IQ.G._dbg();
  S.p.x = 16; S.p.y = 17; R.p.rx = 16; R.p.ry = 17; R.p.path = null;
  IQ.G._dbg().tapTile(16, 16);
});
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(out, '05-wolf.png') });
await page.click('#mBtns .btn >> text=구운 고기 주기');
await page.fill('#mInput', '루나');
await page.click('#mBtns .btn >> text=확인');
for (let i = 0; i < 5 && await page.isVisible('#modal'); i++) await page.click('#mBtns .btn');
const wolf = await page.evaluate(() => ({ ...IQ.G.state().wolf }));
check(wolf.tamed && wolf.name === '루나', '늑대 길들이기 + 이름 짓기 (' + wolf.name + ')');

// 늑대가 따라오는지: 몇 칸 이동
await page.evaluate(() => IQ.G._dbg().tapTile(16, 22));
await page.waitForTimeout(2500);
const follow = await page.evaluate(() => { const S = IQ.G.state(); return Math.abs(S.wolf.x - S.p.x) + Math.abs(S.wolf.y - S.p.y); });
check(follow <= 2, '늑대가 플레이어를 따라옴 (거리 ' + follow + ')');
await page.screenshot({ path: path.join(out, '06-follow.png') });

// 4) 킁킁으로 달의 조각 찾기
console.log('수수께끼');
await page.evaluate(() => {
  const { S, R } = IQ.G._dbg();
  S.p.x = 47; S.p.y = 35; R.p.rx = 47; R.p.ry = 35; S.wolf.x = 46; S.wolf.y = 35; R.w.rx = 46; R.w.ry = 35; R.trail = [];
});
await page.click('#btnSniff');
await page.waitForTimeout(1500);
const revealed = await page.evaluate(() => !IQ.G.state().objs.find(o => o.loot === 'frag_moon').hidden);
check(revealed, '킁킁으로 달의 조각 자리 발견');
await page.screenshot({ path: path.join(out, '07-sniff.png') });
await page.evaluate(() => IQ.G._dbg().tapTile(48, 35));
await page.waitForTimeout(1200);
for (let i = 0; i < 4 && await page.isVisible('#modal'); i++) await page.click('#mBtns .btn');
check(await page.evaluate(() => IQ.G.has('frag_moon')), '달의 조각 획득');

// 별의 조각: 숯 바치기
await page.evaluate(() => {
  const { S, R } = IQ.G._dbg();
  S.p.x = 10; S.p.y = 34; R.p.rx = 10; R.p.ry = 34; R.p.path = null;
  IQ.G._dbg().tapTile(10, 33);
});
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(out, '08-star-riddle.png') });
await page.click('#mBtns .btn >> text=숯 바치기');
for (let i = 0; i < 4 && await page.isVisible('#modal'); i++) await page.click('#mBtns .btn');
check(await page.evaluate(() => IQ.G.has('frag_star')), '별의 조각 획득 (숯 수수께끼)');

// 유적 문 수수께끼
await page.evaluate(() => {
  const { S, R } = IQ.G._dbg();
  S.p.x = 41; S.p.y = 20; R.p.rx = 41; R.p.ry = 20; R.p.path = null;
  IQ.G._dbg().tapTile(41, 19);
});
await page.waitForTimeout(200);
await page.click('#mBtns .btn >> text=시계');
for (let i = 0; i < 3 && await page.isVisible('#modal'); i++) await page.click('#mBtns .btn');
check(await page.evaluate(() => !IQ.G.state().f.gateOpen), '틀린 답이면 문이 안 열림');
await page.evaluate(() => IQ.G._dbg().tapTile(41, 19));
await page.waitForTimeout(200);
await page.click('#mBtns .btn >> text=사람');
for (let i = 0; i < 3 && await page.isVisible('#modal'); i++) await page.click('#mBtns .btn');
check(await page.evaluate(() => IQ.G.state().f.gateOpen), '정답(사람)으로 문 열림');

// 석상 순서 퍼즐: 실제로 걸어가서 터치
async function tapAndWait(x, y) {
  await page.evaluate(([x, y]) => IQ.G._dbg().tapTile(x, y), [x, y]);
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(100);
    const idle = await page.evaluate(() => { const { R } = IQ.G._dbg(); return !R.p.move && !(R.p.path && R.p.path.length) && !R.p.pending && R.p.busy <= 0; });
    if (idle) break;
  }
}
await tapAndWait(42, 15); // 틀린 첫 석상 → 초기화
check(await page.evaluate(() => IQ.G.state().statueSeq.length === 0), '틀린 순서면 초기화');
for (const [x, y] of [[38, 15], [42, 15], [36, 15], [40, 15]]) await tapAndWait(x, y);
await page.screenshot({ path: path.join(out, '09-statues.png') });
for (let i = 0; i < 3 && await page.isVisible('#modal'); i++) await page.click('#mBtns .btn');
check(await page.evaluate(() => IQ.G.state().f.statues === 1), '석상 순서(해→물결→별→달) 해결');
await tapAndWait(43, 10);
for (let i = 0; i < 3 && await page.isVisible('#modal'); i++) await page.click('#mBtns .btn');
check(await page.evaluate(() => IQ.G.has('frag_sun')), '해의 조각 획득 (상자)');

// 제단
await tapAndWait(39, 12);
for (let i = 0; i < 6 && await page.isVisible('#modal'); i++) await page.click('#mBtns .btn');
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, '10-clear.png') });
check(await page.evaluate(() => IQ.G.state().f.cleared === 1), '제단에 조각 3개 → 챕터 1 클리어');

// 멧돼지 사냥
console.log('사냥·낚시');
const meatBefore = await page.evaluate(() => IQ.G.count('meat'));
const boarPos = await page.evaluate(() => {
  const { S, R, isBlocked } = IQ.G._dbg();
  for (const b of S.boars) {
    if (b.dead) continue;
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [b.x + dx, b.y + dy]).find(([x, y]) => !isBlocked(x, y));
    if (!spot) continue;
    b.hold = S.time + 60;
    S.p.x = spot[0]; S.p.y = spot[1]; R.p.rx = spot[0]; R.p.ry = spot[1]; R.p.path = null;
    return [b.x, b.y];
  }
  return null;
});
for (let i = 0; i < 4; i++) await tapAndWait(boarPos[0], boarPos[1]);
const meatAfter = await page.evaluate(() => IQ.G.count('meat'));
check(meatAfter > meatBefore, '멧돼지 사냥으로 날고기 획득 (' + meatBefore + '→' + meatAfter + ')');

// 낚시: 물가 옆 모래로 이동해 물을 터치
const fishSpot = await page.evaluate(() => {
  const { S, R, WD, isBlocked } = IQ.G._dbg();
  S.inv.rod = 1; S.p.st = 40;
  for (let y = 40; y < 55; y++) for (let x = 20; x < 36; x++) {
    if (WD.tiles[y * IQ.W + x] === IQ.T.WATER && !isBlocked(x, y - 1)) {
      S.p.x = x; S.p.y = y - 1; R.p.rx = x; R.p.ry = y - 1; R.p.path = null;
      return [x, y];
    }
  }
  return null;
});
let fished = false;
for (let i = 0; i < 8 && !fished; i++) {
  await tapAndWait(fishSpot[0], fishSpot[1]);
  await page.waitForTimeout(800);
  fished = await page.evaluate(() => IQ.G.count('fish') > 0);
}
check(fished, '낚시로 생선 획득' + (fished ? '' : ' / ' + JSON.stringify(fishSpot) + ' / ' + await page.evaluate(() => document.getElementById('toast').textContent + ' modal=' + IQ.UI.isOpen())));

// 5) 저장 / 불러오기
await page.evaluate(() => IQ.G.save());
await page.reload();
await page.click('#btnCont');
const loaded = await page.evaluate(() => ({ cleared: IQ.G.state().f.cleared, name: IQ.G.state().wolf.name }));
check(loaded.cleared === 1 && loaded.name === '루나', '저장 후 이어하기');

// 6) 가방·제작·늑대 창 열어 보기
await page.click('#btnBag');
await page.screenshot({ path: path.join(out, '11-bag.png') });
await page.click('#mBtns .btn >> text=닫기');
await page.click('#btnCraft');
await page.screenshot({ path: path.join(out, '12-craft.png') });
await page.click('#mBtns .btn >> text=닫기');
await page.click('#btnPet');
await page.screenshot({ path: path.join(out, '13-pet.png') });
await page.click('#mBtns .btn >> text=닫기');

check(errors.length === 0, '콘솔 오류 없음' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? `\n${failed}개 실패` : '\n모두 통과');
process.exit(failed ? 1 : 0);

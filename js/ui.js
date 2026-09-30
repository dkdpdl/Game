// 화면 UI: HUD, 가방, 제작, 요리, 늑대 창, 대화창, 효과음
window.IQ = window.IQ || {};
(function () {
  'use strict';
  const IQ = window.IQ;
  const $ = id => document.getElementById(id);
  const UI = IQ.UI = {};
  let open = false;
  let toastTimer = null;

  // ---------- 효과음 (파일 없이 WebAudio로 합성) ----------
  let ac = null, muted = false;
  try { muted = localStorage.getItem('wolfisland.mute') === '1'; } catch (e) { /* 무시 */ }
  function audio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function beep(freq, dur, type, vol, slide, delay) {
    if (muted) return;
    const a = audio();
    if (!a) return;
    const t0 = a.currentTime + (delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  IQ.sfx = {
    unlock: () => audio(),
    pick: () => beep(880, 0.08, 'square', 0.05, 1.5),
    chop: () => beep(160, 0.1, 'square', 0.08, 0.5),
    rock: () => beep(220, 0.08, 'triangle', 0.1, 0.4),
    hit: () => beep(120, 0.12, 'sawtooth', 0.07, 0.5),
    dig: () => { beep(140, 0.1, 'triangle', 0.1, 0.6); beep(120, 0.1, 'triangle', 0.1, 0.6, 0.12); },
    eat: () => { beep(500, 0.06, 'square', 0.05); beep(650, 0.08, 'square', 0.05, 1, 0.08); },
    splash: () => beep(300, 0.25, 'sine', 0.08, 0.3),
    sniff: () => { beep(900, 0.05, 'triangle', 0.05); beep(1000, 0.05, 'triangle', 0.05, 1, 0.1); },
    bark: () => { beep(420, 0.09, 'sawtooth', 0.06, 0.7); beep(460, 0.1, 'sawtooth', 0.06, 0.6, 0.14); },
    fail: () => beep(200, 0.25, 'square', 0.06, 0.6),
    tone: f => beep(f, 0.18, 'triangle', 0.08),
    solve: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.14, 'square', 0.05, 1, i * 0.09)),
    level: () => [392, 523, 659, 784, 1047].forEach((f, i) => beep(f, 0.12, 'triangle', 0.08, 1, i * 0.07)),
  };
  UI.isMuted = () => muted;
  UI.toggleMute = () => {
    muted = !muted;
    try { localStorage.setItem('wolfisland.mute', muted ? '1' : '0'); } catch (e) { /* 무시 */ }
  };

  // ---------- 기본 ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function icon(id, cls) {
    return '<img class="' + (cls || 'ico') + '" src="' + IQ.iconURL(id) + '" alt="">';
  }

  UI.isOpen = () => open;

  UI.toast = function (msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  };

  // 모달 창: body는 HTML 문자열, buttons는 [{label, fn, cls, disabled, keep}]
  UI.modal = function (title, body, buttons, onRender) {
    open = true;
    $('mTitle').innerHTML = title || '';
    $('mBody').innerHTML = body || '';
    const bx = $('mBtns');
    bx.innerHTML = '';
    (buttons || []).forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn ' + (b.cls || '');
      el.innerHTML = b.label;
      el.disabled = !!b.disabled;
      el.onclick = () => {
        IQ.sfx.unlock();
        if (!b.keep) UI.close();
        if (b.fn) b.fn();
      };
      bx.appendChild(el);
    });
    $('modal').classList.remove('hidden');
    if (onRender) onRender($('mBody'));
  };

  UI.close = function () {
    open = false;
    $('modal').classList.add('hidden');
  };

  UI.say = function (lines, done) {
    let i = 0;
    const next = () => {
      if (i >= lines.length) { if (done) done(); return; }
      const line = lines[i++];
      UI.modal('', '<p class="talk">' + esc(line) + '</p>', [{ label: i < lines.length ? '다음 ▶' : '확인', fn: next }]);
    };
    next();
  };

  UI.choice = function (title, html, options) {
    const btns = options.map(o => ({ label: esc(o.label), fn: o.fn }));
    if (!options.some(o => o.label === '그만두기')) btns.push({ label: '그만두기', cls: 'ghost' });
    UI.modal(esc(title), '<p class="talk">' + html + '</p>', btns);
  };

  UI.prompt = function (text, def, fn) {
    UI.modal('', '<p class="talk">' + esc(text) + '</p><input id="mInput" maxlength="8" value="' + esc(def) + '">', [
      { label: '확인', fn: () => fn(UI._lastInput) },
    ], body => {
      const inp = body.querySelector('#mInput');
      UI._lastInput = def;
      inp.oninput = () => { UI._lastInput = inp.value; };
    });
  };

  // ---------- HUD ----------
  let lastHud = '';
  UI.updateHUD = function () {
    const G = IQ.G, S = G.state();
    if (!S) return;
    const max = G.maxSt();
    const key = [S.p.lv, S.p.exp, S.p.st, max, JSON.stringify(S.inv), G.objective(), S.wolf.tamed, S.wolf.name].join('|');
    if (key === lastHud) return;
    lastHud = key;
    $('lv').textContent = S.p.lv;
    $('expFill').style.width = Math.min(100, S.p.exp / G.needExp() * 100) + '%';
    $('stFill').style.width = Math.min(100, S.p.st / max * 100) + '%';
    $('stFill').classList.toggle('low', S.p.st <= 5);
    $('stText').textContent = S.p.st + '/' + max;
    $('res').innerHTML = IQ.HUD_ITEMS.map(id => '<span class="chip">' + icon(id) + '<b>' + G.count(id) + '</b></span>').join('');
    $('quest').innerHTML = '<span class="qtag">목표</span> ' + esc(G.objective());
    $('btnPet').classList.toggle('hidden', !S.wolf.tamed);
    $('btnSniff').classList.toggle('hidden', !S.wolf.tamed);
  };
  UI.forceHUD = () => { lastHud = ''; UI.updateHUD(); };

  // ---------- 가방 ----------
  UI.openBag = function (sel) {
    const G = IQ.G, S = G.state();
    const ids = Object.keys(IQ.ITEMS).filter(id => G.count(id) > 0);
    if (!ids.length) {
      UI.modal('가방', '<p class="talk">가방이 비어 있어요. 섬을 돌아다니며 재료를 모아 보세요.</p>', [{ label: '닫기' }]);
      return;
    }
    const cur = sel && G.count(sel) ? sel : ids[0];
    const it = IQ.ITEMS[cur];
    let grid = '<div class="grid">';
    ids.forEach(id => {
      grid += '<button class="slot' + (id === cur ? ' sel' : '') + '" data-id="' + id + '">' + icon(id) + '<span class="cnt">' + G.count(id) + '</span></button>';
    });
    grid += '</div>';
    const info = '<div class="info">' + icon(cur, 'ico big') + '<div><b>' + esc(it.name) + '</b> ×' + G.count(cur) +
      '<br><small>' + esc(it.desc) + (it.food ? ' (스태미나 +' + it.food + ')' : '') + '</small></div></div>';
    const btns = [];
    if (it.food) btns.push({ label: '먹기', keep: true, fn: () => { G.eat(cur); UI.openBag(cur); } });
    if (it.place) btns.push({ label: '설치하기', fn: () => G.placeCampfire() });
    btns.push({ label: '닫기', cls: 'ghost' });
    UI.modal('가방 <small>스태미나 ' + S.p.st + '/' + G.maxSt() + '</small>', grid + info, btns, body => {
      body.querySelectorAll('.slot').forEach(el => { el.onclick = () => UI.openBag(el.dataset.id); });
    });
  };

  // ---------- 제작 / 요리 ----------
  function recipeList(recipes, title, onMake, reopen, sub) {
    const G = IQ.G;
    let html = sub ? '<p class="sub">' + sub + '</p>' : '';
    html += '<div class="recipes">';
    recipes.forEach((r, i) => {
      const it = IQ.ITEMS[r.id];
      const owned = r.once && G.has(r.id);
      const ok = !owned && Object.keys(r.need).every(k => G.has(k, r.need[k]));
      const need = Object.keys(r.need).map(k => {
        const enough = G.has(k, r.need[k]);
        return '<span class="need' + (enough ? '' : ' lack') + '">' + icon(k, 'ico sm') + G.count(k) + '/' + r.need[k] + '</span>';
      }).join('');
      html += '<div class="recipe">' + icon(r.id, 'ico big') +
        '<div class="rinfo"><b>' + esc(it.name) + '</b><div class="needs">' + need + '</div></div>' +
        '<button class="btn mk" data-i="' + i + '"' + (ok ? '' : ' disabled') + '>' + (owned ? '보유' : '만들기') + '</button></div>';
    });
    html += '</div>';
    UI.modal(title, html, [{ label: '닫기', cls: 'ghost' }], body => {
      body.querySelectorAll('.mk').forEach(el => {
        el.onclick = () => {
          const r = recipes[+el.dataset.i];
          if (onMake(r)) {
            if (r.id === 'campfire') { UI.close(); return; }
            IQ.UI.toast(IQ.ITEMS[r.id].name + '을(를) 만들었어요!');
          }
          reopen();
        };
      });
    });
  }
  UI.openCraft = () => recipeList(IQ.RECIPES, '제작', r => IQ.G.craft(r), UI.openCraft, '재료를 모아 도구를 만들어요.');
  UI.openCook = () => recipeList(IQ.COOK, '모닥불', r => IQ.G.cook(r), UI.openCook, '불에 구우면 더 맛있어져요. 통나무를 태우면 숯이 돼요.');

  // ---------- 늑대 ----------
  UI.openPet = function () {
    const G = IQ.G, S = G.state(), w = S.wolf;
    const lv = G.petLv();
    const abil = [
      { lv: 1, name: '킁킁', desc: '반경 ' + (7 + lv * 2) + '칸 안의 묻힌 물건을 찾아요.' },
      { lv: 2, name: '사냥 도움', desc: '멧돼지를 공격할 때 곁에 있으면 피해 +1 (친밀도 50)' },
      { lv: 3, name: '채집 도움', desc: '채집할 때 30% 확률로 하나 더 (친밀도 100)' },
    ];
    let html = '<div class="info">' + icon('wolf', 'ico big') + '<div><b>' + esc(w.name) + '</b> <span class="petlv">Lv ' + lv + '</span>' +
      '<div class="meter aff"><div style="width:' + w.aff + '%"></div><span>친밀도 ' + w.aff + '/100</span></div></div></div>';
    html += '<ul class="abil">' + abil.map(a => '<li class="' + (lv >= a.lv ? '' : 'locked') + '"><b>' + (lv >= a.lv ? '' : '🔒 ') + a.name + '</b> — ' + esc(a.desc) + '</li>').join('') + '</ul>';
    const foods = ['cmeat', 'gfish', 'meat', 'fish'].filter(id => G.has(id));
    html += '<p class="sub">먹이 주기' + (foods.length ? '' : ' — 줄 수 있는 먹이가 없어요 (고기, 생선)') + '</p><div class="feed">';
    foods.forEach(id => {
      html += '<button class="slot" data-id="' + id + '">' + icon(id) + '<span class="cnt">' + G.count(id) + '</span><span class="plus">+' + IQ.ITEMS[id].petFood + '</span></button>';
    });
    html += '</div>';
    UI.modal('동료', html, [
      { label: '이름 바꾸기', fn: () => UI.prompt('새 이름을 입력하세요.', w.name, n => { G.renameWolf(n); UI.forceHUD(); UI.openPet(); }) },
      { label: '닫기', cls: 'ghost' },
    ], body => {
      body.querySelectorAll('.feed .slot').forEach(el => { el.onclick = () => { G.feedWolf(el.dataset.id); UI.openPet(); }; });
    });
  };

  // ---------- 메뉴 ----------
  UI.openMenu = function () {
    UI.modal('메뉴', '<p class="talk">게임은 10초마다 자동 저장돼요.</p>', [
      { label: '지금 저장', fn: () => { IQ.G.save(); UI.toast('저장했어요.'); } },
      { label: '소리 ' + (muted ? '켜기' : '끄기'), fn: () => { UI.toggleMute(); UI.toast(muted ? '소리를 껐어요.' : '소리를 켰어요.'); } },
      { label: '도움말', fn: UI.help },
      {
        label: '처음부터 다시', cls: 'danger', fn: () => UI.modal('정말요?', '<p class="talk">저장된 진행 상황이 모두 지워져요.</p>', [
          { label: '처음부터', cls: 'danger', fn: () => { IQ.G.wipe(); location.reload(); } },
          { label: '취소', cls: 'ghost' },
        ]),
      },
      { label: '닫기', cls: 'ghost' },
    ]);
  };

  UI.help = function () {
    UI.modal('도움말', '<ul class="abil">' +
      '<li><b>이동</b> — 가고 싶은 곳을 터치하세요. (PC: 방향키/WASD)</li>' +
      '<li><b>채집·조사</b> — 나무, 바위, 풀, 비석 등을 터치하면 다가가서 행동해요. (PC: 스페이스)</li>' +
      '<li><b>스태미나</b> — 행동하면 줄어요. 가방에서 음식을 먹으면 회복돼요.</li>' +
      '<li><b>제작</b> — 재료로 도구를 만들어요. 모닥불에서는 요리를 해요.</li>' +
      '<li><b>낚시</b> — 낚싯대를 가지고 물을 터치하세요.</li>' +
      '<li><b>늑대</b> — 동료가 되면 킁킁 버튼으로 묻힌 보물을 찾아 줘요.</li>' +
      '</ul>', [{ label: '닫기' }]);
  };

  UI.init = function () {
    $('btnBag').innerHTML = icon('bag') + '<span>가방</span>';
    $('btnCraft').innerHTML = icon('craft') + '<span>제작</span>';
    $('btnPet').innerHTML = icon('wolf') + '<span>늑대</span>';
    $('btnSniff').innerHTML = icon('sniff') + '<span>킁킁</span>';
    $('btnMenu').innerHTML = icon('menu') + '<span>메뉴</span>';
    const bind = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); IQ.sfx.unlock(); if (!open) fn(); });
    bind('btnBag', () => UI.openBag());
    bind('btnCraft', UI.openCraft);
    bind('btnPet', UI.openPet);
    bind('btnSniff', () => IQ.G.sniff());
    bind('btnMenu', UI.openMenu);
  };
})();

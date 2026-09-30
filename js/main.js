// 시작 화면, 입력, 게임 루프
(function () {
  'use strict';
  const IQ = window.IQ;
  const canvas = document.getElementById('game');
  let running = false;
  let last = 0;
  let saveT = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    canvas._dpr = dpr;
  }

  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    const paused = IQ.UI.isOpen();
    IQ.G.update(dt, paused);
    IQ.G.render(canvas);
    IQ.UI.updateHUD();
    saveT += dt;
    if (saveT > 10) { saveT = 0; IQ.G.save(); }
    requestAnimationFrame(loop);
  }

  function startGame(isNew) {
    document.getElementById('title').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('buttons').classList.remove('hidden');
    IQ.UI.forceHUD();
    if (!running) { running = true; requestAnimationFrame(loop); }
    if (isNew) {
      IQ.UI.say([
        '거센 폭풍우가 몰아치던 밤, 타고 있던 배가 부서졌다…',
        '눈을 떠 보니 낯선 섬의 해변이었다. 주변엔 아무도 없다.',
        '살아남으려면 먼저 도구가 필요하다. 나뭇가지, 돌, 풀줄기를 모아 보자.',
        '(가고 싶은 곳이나 조사하고 싶은 것을 터치하세요. 바로 옆 해변의 유리병도 살펴보세요!)',
      ]);
    }
  }

  function boot() {
    IQ.initSprites();
    IQ.G.init();
    IQ.UI.init();
    resize();
    window.addEventListener('resize', resize);

    // 타이틀 화면 늑대 그림
    const tw = document.getElementById('titleWolf');
    tw.src = IQ.iconURL('wolf');

    const btnNew = document.getElementById('btnNew');
    const btnCont = document.getElementById('btnCont');
    if (IQ.G.hasSave()) btnCont.classList.remove('hidden');
    btnNew.onclick = () => {
      IQ.sfx.unlock();
      if (IQ.G.hasSave()) {
        if (!confirm('저장된 진행 상황을 지우고 새로 시작할까요?')) return;
      }
      IQ.G.newGame();
      startGame(true);
    };
    btnCont.onclick = () => {
      IQ.sfx.unlock();
      if (IQ.G.load()) startGame(false);
      else { IQ.G.newGame(); startGame(true); }
    };

    // 터치 / 클릭
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      IQ.sfx.unlock();
      if (!running || IQ.UI.isOpen()) return;
      const dpr = canvas._dpr || 1;
      IQ.G.tapScreen(e.clientX * dpr, e.clientY * dpr);
    });
    document.addEventListener('gesturestart', e => e.preventDefault());

    // 키보드 (PC)
    const keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
    const held = [];
    window.addEventListener('keydown', e => {
      if (!running) return;
      if (e.target && e.target.tagName === 'INPUT') return;
      if (IQ.UI.isOpen()) {
        if (e.key === ' ' || e.key === 'Enter') {
          const b = document.querySelector('#mBtns .btn:not(:disabled)');
          if (b) { e.preventDefault(); b.click(); }
        } else if (e.key === 'Escape') IQ.UI.close();
        return;
      }
      const d = keyMap[e.key];
      if (d) {
        e.preventDefault();
        if (!held.includes(d)) held.push(d);
        IQ.G.setKeyDir(held[held.length - 1]);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        IQ.G.interactFront();
      } else if (e.key === 'i' || e.key === 'b') IQ.UI.openBag();
      else if (e.key === 'c') IQ.UI.openCraft();
      else if (e.key === 'f') IQ.G.sniff();
    });
    window.addEventListener('keyup', e => {
      const d = keyMap[e.key];
      if (!d) return;
      const i = held.indexOf(d);
      if (i >= 0) held.splice(i, 1);
      IQ.G.setKeyDir(held.length ? held[held.length - 1] : null);
    });
    window.addEventListener('blur', () => { held.length = 0; IQ.G.setKeyDir(null); });

    document.addEventListener('visibilitychange', () => { if (document.hidden && running) IQ.G.save(); });
    window.addEventListener('pagehide', () => { if (running) IQ.G.save(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

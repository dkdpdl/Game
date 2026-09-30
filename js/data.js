// 아이템, 제작법, 요리법 데이터
window.IQ = window.IQ || {};
(function () {
  'use strict';
  const IQ = window.IQ;

  IQ.ITEMS = {
    branch:    { name: '나뭇가지', desc: '나무에서 꺾은 가지. 도구의 손잡이로 쓴다.' },
    wood:      { name: '통나무', desc: '돌도끼로 벤 튼튼한 나무. 모닥불과 숯의 재료.' },
    stone:     { name: '돌', desc: '단단한 돌멩이. 도구와 모닥불의 재료.' },
    fiber:     { name: '풀줄기', desc: '질긴 풀줄기. 엮으면 밧줄이 된다.' },
    berry:     { name: '산딸기', desc: '새콤달콤한 열매.', food: 5 },
    coconut:   { name: '코코넛', desc: '달콤한 즙이 가득하다.', food: 8 },
    fish:      { name: '생선', desc: '갓 잡은 물고기. 구워 먹으면 더 좋다.', food: 3, petFood: 4 },
    gfish:     { name: '구운 생선', desc: '노릇하게 구운 생선.', food: 15, petFood: 10 },
    meat:      { name: '날고기', desc: '멧돼지 고기. 구워서 먹자.', food: 2, petFood: 5 },
    cmeat:     { name: '구운 고기', desc: '육즙이 흐르는 구운 고기. 늑대가 가장 좋아한다.', food: 20, petFood: 15 },
    charcoal:  { name: '숯', desc: '검게 탄 나무. 불을 붙이면 붉게 타오르고, 다 타면 하얀 재가 된다.' },
    axe:       { name: '돌도끼', desc: '나무를 베어 통나무를 얻는다. 멧돼지에게도 효과적.', tool: true },
    pickaxe:   { name: '돌곡괭이', desc: '바위를 부숴 돌을 많이 얻는다.', tool: true },
    rope:      { name: '밧줄', desc: '풀줄기를 꼬아 만든 밧줄.' },
    rod:       { name: '낚싯대', desc: '물가에서 물고기를 낚는다.', tool: true },
    campfire:  { name: '모닥불 키트', desc: '땅에 설치하면 요리를 할 수 있다.', place: true },
    frag_sun:  { name: '해의 조각', desc: '해 문양이 새겨진 고대 석판 조각.', key: true },
    frag_moon: { name: '달의 조각', desc: '달 문양이 새겨진 고대 석판 조각.', key: true },
    frag_star: { name: '별의 조각', desc: '별 문양이 새겨진 고대 석판 조각.', key: true },
    coin:      { name: '오래된 동전', desc: '누군가 묻어 둔 옛날 동전. 이 섬엔 예전에 사람이 살았던 걸까?' },
  };

  IQ.RECIPES = [
    { id: 'axe', need: { branch: 2, stone: 2, fiber: 2 }, once: true },
    { id: 'pickaxe', need: { branch: 2, stone: 3, fiber: 2 }, once: true },
    { id: 'rope', need: { fiber: 3 } },
    { id: 'rod', need: { branch: 2, rope: 1 }, once: true },
    { id: 'campfire', need: { wood: 3, stone: 3 } },
  ];

  IQ.COOK = [
    { id: 'gfish', need: { fish: 1 } },
    { id: 'cmeat', need: { meat: 1 } },
    { id: 'charcoal', need: { wood: 1 } },
  ];

  // HUD 상단에 항상 보여 줄 재료
  IQ.HUD_ITEMS = ['branch', 'stone', 'fiber', 'wood'];
})();

// 📚 하루와 공부 + 🍚 팻 밥 주기 (11-10)
//  · 팻은 시간이 지나면 배가 고파짐(1시간마다 꼬르륵) → 사료·간식을 줘야 함
//  · 사료·간식은 영어 단어 맞히기, 게임 이기기, 명령으로 놀아 주기로 받음
//  · 오래 안 주면 잠만 자고 · 삐지고 · 돌아서 있고 · 배고픈 표정
const FOOD = () => { if (!S.food) S.food = { kibble: 3, snack: 1, hunger: 0, t: Date.now(), cryAt: 0, plays: 0 }; return S.food; };
function hungerNow() { const f = FOOD(), now = Date.now(); f.hunger = Math.min(100, (f.hunger || 0) + Math.max(0, now - (f.t || now)) / 3.6e6 * 25); f.t = now; return f.hunger; }   // 4시간이면 100
function foodGain(k, s, why) {
  const f = FOOD(); f.kibble += k || 0; f.snack += s || 0; save();
  const t = `${why ? why + ' ' : ''}${k ? `🍚 사료 +${k}` : ''}${k && s ? ' · ' : ''}${s ? `🍪 간식 +${s}` : ''}`;
  if (STU.on) stuTop(t); else if (typeof say === 'function') setTimeout(() => say(t, { ms: 3000 }), 1600);
}
window.foodGain = foodGain;
function feedPet(kind) {
  const f = FOOD(); hungerNow();
  if (kind === 'snack' ? f.snack <= 0 : f.kibble <= 0) {
    const m = kind === 'snack' ? '간식이 없어… 🥺' : '사료가 없어… 🥺'; const tip = '영어 단어를 맞히면 받을 수 있어! 📚';
    if (STU.on) { stuTop(m + ' ' + tip); stuPet('sorry'); } else say(`${m}<br>${tip}`, { pose: 'hungry', ms: 6000, buttons: [{ label: '📚 공부하러 가기', act: () => { hideBubble(); openStudy(); } }] });
    return false;
  }
  if (kind === 'snack') { f.snack--; f.hunger = Math.max(0, f.hunger - 25); } else { f.kibble--; f.hunger = Math.max(0, f.hunger - 50); }
  f.cryAt = Date.now(); save();
  const line = kind === 'snack' ? pick(['와~ 간식이다! 냠냠 🍪', '간식 최고! 고마워 💛', '바삭바삭 맛있어~']) : pick(['냠냠냠! 맛있다 🍚', '배불러~ 고마워! 💛', '밥 최고야!']);
  if (STU.on) { stuTop(line); stuPet(kind === 'snack' ? 'snack' : 'meal'); }
  else { say(line, { pose: kind === 'snack' ? 'snack' : 'meal', ms: 5000 }); setTimeout(() => setPose('praise'), 5200); }
  if (typeof cry === 'function') cry(true);
  return true;
}
window.feedPet = feedPet;
// 배고픔 확인 (1분마다): 1시간마다 꼬르륵
function hungerTick() {
  if (document.hidden || STU.on) return;
  const f = FOOD(), h = hungerNow(), now = Date.now(); save();
  if (h >= 25 && now - (f.cryAt || 0) >= 3.6e6) {
    f.cryAt = now; save();
    try { const a = new Audio('sounds/tummy_growl.mp3'); a.volume = Math.max(0.3, S.talk.volume || 0.5); a.play().catch(() => { }); } catch { }
    say(`배고파… 꼬르륵 🍚<br><span class="note small">🍚 사료 ${f.kibble} · 🍪 간식 ${f.snack}</span>`, { pose: 'hungry', ms: 20000, buttons: [{ label: `🍚 사료 주기`, act: () => { hideBubble(); feedPet('kibble'); } }, { label: `🍪 간식 주기`, act: () => { hideBubble(); feedPet('snack'); } }, { label: '📚 공부해서 받기', ghost: true, act: () => { hideBubble(); openStudy(); } }] });
  }
}
setInterval(hungerTick, 60000); setTimeout(hungerTick, 8000);
// 오래 굶으면 기분이 나빠짐 → 혼자 있을 때 잠·삐짐·돌아서기·배고픔
window.moodPose = () => { if (STU.on) return null; const h = hungerNow(); if (h < 75 || Math.random() > 0.75) return null; return pick(['sleep', 'gloomy', 'back', 'hungry', 'angry', 'sorry']); };
// 명령으로 놀아 주면 다섯 번마다 사료 1
window.foodPlay = () => { const f = FOOD(); f.plays = (f.plays || 0) + 1; save(); if (f.plays % 5 === 0) foodGain(1, 0, '놀아 줘서 고마워!'); };

// ── 영어 단어
const WORDS = [
  ['dog', '강아지', '🐶'], ['cat', '고양이', '🐱'], ['pig', '돼지', '🐷'], ['cow', '소', '🐮'], ['horse', '말', '🐴'], ['rabbit', '토끼', '🐰'], ['bear', '곰', '🐻'], ['tiger', '호랑이', '🐯'],
  ['lion', '사자', '🦁'], ['monkey', '원숭이', '🐵'], ['elephant', '코끼리', '🐘'], ['bird', '새', '🐦'], ['fish', '물고기', '🐟'], ['duck', '오리', '🦆'], ['frog', '개구리', '🐸'], ['chicken', '닭', '🐔'],
  ['apple', '사과', '🍎'], ['banana', '바나나', '🍌'], ['grape', '포도', '🍇'], ['orange', '오렌지', '🍊'], ['strawberry', '딸기', '🍓'], ['watermelon', '수박', '🍉'], ['peach', '복숭아', '🍑'], ['lemon', '레몬', '🍋'],
  ['milk', '우유', '🥛'], ['bread', '빵', '🍞'], ['egg', '달걀', '🥚'], ['rice', '밥', '🍚'], ['cake', '케이크', '🍰'], ['candy', '사탕', '🍬'], ['water', '물', '💧'], ['pizza', '피자', '🍕'],
  ['red', '빨간색', '🟥'], ['blue', '파란색', '🟦'], ['yellow', '노란색', '🟨'], ['green', '초록색', '🟩'], ['black', '검은색', '⬛'], ['white', '하얀색', '⬜'], ['purple', '보라색', '🟪'], ['orange', '주황색', '🟧'],
  ['sun', '해', '☀️'], ['moon', '달', '🌙'], ['star', '별', '⭐'], ['rain', '비', '🌧️'], ['snow', '눈', '❄️'], ['cloud', '구름', '☁️'], ['tree', '나무', '🌳'], ['flower', '꽃', '🌸'],
  ['book', '책', '📖'], ['pencil', '연필', '✏️'], ['bag', '가방', '🎒'], ['school', '학교', '🏫'], ['ball', '공', '⚽'], ['car', '자동차', '🚗'], ['bus', '버스', '🚌'], ['house', '집', '🏠'],
  ['eye', '눈', '👁️'], ['ear', '귀', '👂'], ['nose', '코', '👃'], ['mouth', '입', '👄'], ['hand', '손', '✋'], ['foot', '발', '🦶'], ['one', '하나', '1️⃣'], ['two', '둘', '2️⃣'], ['three', '셋', '3️⃣'],
];
const PRAISE = ['맞았어! 잘했어!', '참 잘하네요!', '천재 아니야?', '대단해! 최고야!', '와~ 정답이야!', '우와 멋지다!', '똑똑해!'];
const STU = { on: false, n: 0, ok: 0, streak: 0, q: null, timer: 0, busy: false };
const stuSpeak = (text, lang) => {
  const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
  if (F && F.ttsSpeak) { F.ttsSpeak({ text, id: 'study', lang: lang || 'ko', rate: lang === 'en' ? 0.85 : 1 }).catch(() => { }); return; }
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'en' ? 'en-US' : 'ko-KR'; u.rate = lang === 'en' ? 0.85 : 1; speechSynthesis.speak(u); } catch { }
};
function stuUI() {
  let ui = document.getElementById('studyUI'); if (ui) return ui;
  const st = document.createElement('style'); st.textContent = `#studyUI{position:fixed;inset:0;z-index:60;background:linear-gradient(#fff8e6,#eaf6ff);display:flex;flex-direction:column;align-items:center;overflow:auto;font-family:inherit}
#studyUI .sTop{width:100%;display:flex;align-items:center;gap:8px;padding:10px 12px;box-sizing:border-box}#studyUI .sX{border:0;background:#fff;border-radius:50%;width:40px;height:40px;font-size:18px;box-shadow:0 1px 4px #0002}
#studyUI .sInv{flex:1;text-align:right;font-weight:700;font-size:16px}#studyUI .sFeed{display:flex;gap:8px;padding:0 12px 6px;width:100%;box-sizing:border-box}#studyUI .sFeed button{flex:1;border:0;border-radius:14px;padding:10px;font-size:16px;font-weight:700;background:#ffe2a8}
#studyUI .sMsg{min-height:26px;font-size:16px;font-weight:700;color:#d2691e;text-align:center;padding:0 12px}#studyUI .sPet{height:120px;margin:4px 0}
#studyUI .sQ{background:#fff;border-radius:22px;box-shadow:0 2px 10px #0001;padding:14px;width:calc(100% - 32px);max-width:460px;text-align:center;box-sizing:border-box}
#studyUI .sEmo{font-size:84px;line-height:1.1}#studyUI .sWord{font-size:34px;font-weight:800;margin:6px 0}#studyUI .sAsk{color:#777;font-size:15px}#studyUI .sSpk{border:0;background:#e8f1ff;border-radius:14px;padding:8px 16px;font-size:18px;margin:4px}
#studyUI .sOpts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}#studyUI .sOpt{border:2px solid #e5e5e5;background:#fff;border-radius:16px;padding:14px 6px;font-size:20px;font-weight:700;position:relative}
#studyUI .sOpt.ok{background:#d9f7d0;border-color:#5cb85c}#studyUI .sOpt.no{background:#ffe0e0;border-color:#e57373}#studyUI .sOpt .sm{display:block;font-size:13px;color:#888;font-weight:400}
#studyUI .sProg{margin:10px 0 24px;color:#666;font-size:15px}#studyUI .sBig{border:0;background:#4f8cff;color:#fff;border-radius:16px;padding:14px 22px;font-size:18px;font-weight:700;margin:8px}`;
  document.head.appendChild(st);
  ui = document.createElement('div'); ui.id = 'studyUI'; ui.hidden = true;
  ui.innerHTML = '<div class="sTop"><button class="sX" id="sX">✕</button><b>📚 하루와 공부</b><div class="sInv" id="sInv"></div></div><div class="sFeed"><button id="sKib">🍚 사료 주기</button><button id="sSnk">🍪 간식 주기</button></div><div class="sMsg" id="sMsg"></div><img class="sPet" id="sPet" alt=""><div class="sQ" id="sQ"></div><div class="sProg" id="sProg"></div>';
  document.body.appendChild(ui);
  ui.querySelector('#sX').onclick = () => (window.haruBack ? haruBack() : closeStudy());
  ui.querySelector('#sKib').onclick = () => { feedPet('kibble'); stuInv(); };
  ui.querySelector('#sSnk').onclick = () => { feedPet('snack'); stuInv(); };
  return ui;
}
function stuInv() { const f = FOOD(), h = Math.round(hungerNow()); const el = document.getElementById('sInv'); if (el) el.textContent = `🍚 ${f.kibble} · 🍪 ${f.snack} · ${h >= 75 ? '😫 배고파' : h >= 25 ? '🙂 조금 배고파' : '😊 배불러'}`; }
function stuTop(t) { const el = document.getElementById('sMsg'); if (el) el.textContent = t; stuInv(); }
// 공부 화면 안의 팻 (지금 고른 동물의 동작을 그대로)
function stuPet(pose) {
  const img = document.getElementById('sPet'); if (!img) return; clearInterval(STU.timer);
  const C = (window.CHARS || {})[SP()], A = (C && C.anims) || {}, Sp = (C && C.sprites) || {};
  const n = (POSES[pose] || []).find(k => A[k] && A[k].frames.length > 1) || (POSES[pose] || []).find(k => A[k] || Sp[k]);
  const an = n && A[n];
  if (!an) { img.src = DIR() + ((Sp[n] || Sp['정면'] || {}).file || ''); return; }
  let i = 0; const once = window.ONCE && ONCE.has(n); img.src = DIR() + an.frames[0];
  STU.timer = setInterval(() => { i = i + 1 >= an.frames.length ? (once ? an.frames.length - 1 : 0) : i + 1; img.src = DIR() + an.frames[i]; }, 1000 / (an.fps || 8));
}
function stuNext() {
  STU.busy = false;
  if (STU.n >= 10) return stuDone();
  S.study = S.study || { wrong: [] };
  const wrong = S.study.wrong.map(e => WORDS.find(w => w[0] + w[1] === e)).filter(Boolean);
  const w = wrong.length && Math.random() < 0.5 ? pick(wrong) : pick(WORDS);
  const mode = STU.n % 2;   // 0: 영어 보고 뜻 고르기 · 1: 그림·한글 보고 영어 고르기
  const others = WORDS.filter(x => x[1] !== w[1] && x[0] !== w[0]).sort(() => Math.random() - 0.5).slice(0, 3);
  const opts = [w, ...others].sort(() => Math.random() - 0.5);
  STU.q = { w, mode, opts };
  const q = document.getElementById('sQ'), num = ['①', '②', '③', '④'];
  q.innerHTML = `<div class="sEmo">${w[2]}</div>` + (mode === 0
    ? `<div class="sWord">${w[0]}</div><button class="sSpk" id="sSay">🔊 듣기</button><div class="sAsk">무슨 뜻일까? 번호를 골라 봐!</div>`
    : `<div class="sWord">${w[1]}</div><div class="sAsk">영어로 뭘까? 번호를 골라 봐! (🔊 를 누르면 소리)</div>`)
    + `<div class="sOpts">${opts.map((o, i) => `<button class="sOpt" data-i="${i}">${num[i]} ${mode === 0 ? o[1] : o[0]}${mode === 1 ? `<span class="sm" data-sp="${i}">🔊 듣기</span>` : ''}</button>`).join('')}</div>`;
  if (mode === 0) { q.querySelector('#sSay').onclick = () => stuSpeak(w[0], 'en'); setTimeout(() => stuSpeak(w[0], 'en'), 400); }
  q.querySelectorAll('.sOpt').forEach(b => b.onclick = e => {
    const sp = e.target.closest('[data-sp]'); if (sp) { e.stopPropagation(); stuSpeak(opts[+sp.dataset.sp][0], 'en'); return; }
    stuPick(+b.dataset.i, b);
  });
  document.getElementById('sProg').textContent = `${STU.n + 1} / 10 문제 · 맞은 수 ${STU.ok}`;
  stuPet(hungerNow() >= 75 ? 'hungry' : 'idle');
}
function stuPick(i, btn) {
  if (STU.busy) return; STU.busy = true;
  const { w, opts } = STU.q, ok = opts[i] === w; const key = w[0] + w[1];
  S.study = S.study || { wrong: [] };
  document.querySelectorAll('#sQ .sOpt').forEach((b, k) => { if (opts[k] === w) b.classList.add('ok'); });
  if (ok) {
    STU.ok++; STU.streak++; S.study.wrong = S.study.wrong.filter(x => x !== key);
    const p = pick(PRAISE); stuTop(p); stuSpeak(p, 'ko'); stuPet(pick(['praise', 'hooray', 'joy']));
    foodGain(1, STU.streak % 3 === 0 ? 1 : 0, '');
  } else {
    btn.classList.add('no'); STU.streak = 0; if (!S.study.wrong.includes(key)) S.study.wrong.push(key); S.study.wrong = S.study.wrong.slice(-30);
    stuTop(`아깝다! 정답은 ${w[0]} (${w[1]}) 야`); stuPet('curious'); setTimeout(() => stuSpeak(w[0], 'en'), 300);
  }
  save(); STU.n++;
  document.getElementById('sProg').textContent = `${STU.n} / 10 문제 · 맞은 수 ${STU.ok}`;
  setTimeout(stuNext, ok ? 1800 : 2600);
}
function stuDone() {
  const q = document.getElementById('sQ');
  const msg = STU.ok >= 9 ? '완벽해! 최고야! 🏆' : STU.ok >= 7 ? '정말 잘했어! 🎉' : STU.ok >= 4 ? '좋아! 조금만 더 하면 돼 💪' : '괜찮아! 다시 해 보자 🙂';
  q.innerHTML = `<div class="sEmo">🎓</div><div class="sWord">${STU.ok} / 10 맞혔어!</div><div class="sAsk">${msg}<br>사료·간식으로 ${bn()}에게 밥을 줘!</div><button class="sBig" id="sAgain">한 번 더 하기</button>`;
  q.querySelector('#sAgain').onclick = () => { STU.n = 0; STU.ok = 0; STU.streak = 0; stuTop(''); stuNext(); };
  stuTop(msg); stuSpeak(`${STU.ok}개 맞혔어! ${msg.replace(/[🏆🎉💪🙂]/gu, '')}`, 'ko'); stuPet(STU.ok >= 7 ? 'hooray' : 'joy');
  document.getElementById('sProg').textContent = '';
}
function openStudy() {
  window.wantViewAt = Date.now(); if (typeof hideBubble === 'function') hideBubble();
  const ui = stuUI(); if (STU.on) return;
  ui.hidden = false; STU.on = true; STU.n = 0; STU.ok = 0; STU.streak = 0;
  if (typeof navPush === 'function') navPush(() => closeStudy());
  stuTop(hungerNow() >= 25 ? `${bn()}가 배고파해! 단어를 맞혀서 밥을 주자 🍚` : '영어 단어를 맞히면 🍚 사료를 받아!'); stuNext();
}
function closeStudy() { const ui = document.getElementById('studyUI'); if (ui) ui.hidden = true; STU.on = false; clearInterval(STU.timer); try { speechSynthesis.cancel(); } catch { } }
window.openStudy = openStudy; window.closeStudy = closeStudy;
// 말: "공부하자"·"영어 공부" → 공부 · "사료 줄게"·"간식 줄게" → 밥 주기
window.studyTalk = text => {
  const t = (typeof stripName === 'function' ? stripName(text) : String(text)).replace(/[?!.~]+$/g, '').replace(/\s+/g, ' ').trim();
  if (/^(우리\s*)?(하루(와|랑)\s*)?(영어\s*)?(단어\s*)?공부(\s*(하자|할래|해|시작|하러\s*가자))?$|^영어(\s*(공부|단어))?(\s*(하자|할래))?$/.test(t)) { openStudy(); return true; }
  if (/^(사료|밥|맘마)\s*(줄게|줄까|먹어|먹자|여기\s*있어)$|^사료\s*(줘|주기)$/.test(t)) { feedPet('kibble'); return true; }
  if (/^간식\s*(줄게|줄까|먹어|먹자|여기\s*있어|주기)$/.test(t)) { feedPet('snack'); return true; }
  return false;
};

// 📚 하루와 공부 + 🍚 팻 밥 주기 (11-10)
//  · 팻은 시간이 지나면 배가 고파짐(1시간마다 꼬르륵) → 사료·간식을 줘야 함
//  · 사료·간식은 영어 단어 맞히기, 게임 이기기, 명령으로 놀아 주기로 받음
//  · 오래 안 주면 잠만 자고 · 삐지고 · 돌아서 있고 · 배고픈 표정
const FOOD = () => { if (!S.food) S.food = { kibble: 2, snack: 0, hunger: 0, t: Date.now(), cryAt: 0, plays: 0 }; return S.food; };
function hungerNow() { const f = FOOD(), now = Date.now(); f.hunger = Math.min(100, (f.hunger || 0) + Math.max(0, now - (f.t || now)) / 3.6e6 * 25); f.t = now; return f.hunger; }   // 4시간이면 100
function foodGain(k, s, why) {
  if (!FOOD_ON) return;
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
const FOOD_ON = false;   // 11-10 사용자: 배고픈 소리·밥 주기 없앰 (나중에 다시 쓸 수 있게 코드만 남김)
function hungerTick() {
  if (!FOOD_ON) return;
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
window.moodPose = () => { if (!FOOD_ON || STU.on) return null; const h = hungerNow(); if (h < 75 || Math.random() > 0.75) return null; return pick(['sleep', 'gloomy', 'back', 'hungry', 'angry', 'sorry']); };
// 명령으로 놀아 주면 열 번마다 사료 1
window.foodPlay = () => { if (!FOOD_ON) return; const f = FOOD(); f.plays = (f.plays || 0) + 1; save(); if (f.plays % 10 === 0) foodGain(1, 0, '놀아 줘서 고마워!'); };

// ── 영어 단어
// 11-10: 단계별 단어 (1 쉬움 → 10 어려움). 한 판 8개 이상 = ⭐, ⭐ 2개면 다음 단계, 10단계 끝 = 🗣️ 회화
const LEVELS = [
 ['🐶 동물·색깔·숫자', [['dog','강아지','🐶'],['cat','고양이','🐱'],['pig','돼지','🐷'],['cow','소','🐮'],['bird','새','🐦'],['fish','물고기','🐟'],['duck','오리','🦆'],['frog','개구리','🐸'],['red','빨간색','🟥'],['blue','파란색','🟦'],['yellow','노란색','🟨'],['green','초록색','🟩'],['one','하나','1️⃣'],['two','둘','2️⃣'],['three','셋','3️⃣'],['four','넷','4️⃣'],['five','다섯','5️⃣'],['ball','공','⚽'],['sun','해','☀️'],['star','별','⭐']]],
 ['🍎 과일·음식', [['apple','사과','🍎'],['banana','바나나','🍌'],['grape','포도','🍇'],['orange','오렌지','🍊'],['strawberry','딸기','🍓'],['watermelon','수박','🍉'],['peach','복숭아','🍑'],['lemon','레몬','🍋'],['milk','우유','🥛'],['bread','빵','🍞'],['egg','달걀','🥚'],['rice','밥','🍚'],['cake','케이크','🍰'],['candy','사탕','🍬'],['water','물','💧'],['pizza','피자','🍕'],['cookie','쿠키','🍪'],['juice','주스','🧃'],['carrot','당근','🥕'],['corn','옥수수','🌽']]],
 ['👪 몸·가족', [['eye','눈','👁️'],['ear','귀','👂'],['nose','코','👃'],['mouth','입','👄'],['hand','손','✋'],['foot','발','🦶'],['head','머리','🙆'],['leg','다리','🦵'],['tooth','이','🦷'],['mom','엄마','👩'],['dad','아빠','👨'],['baby','아기','👶'],['brother','남자 형제','👦'],['sister','여자 형제','👧'],['grandma','할머니','👵'],['grandpa','할아버지','👴'],['friend','친구','🧑‍🤝‍🧑'],['boy','소년','🧒'],['girl','소녀','👧'],['family','가족','👨‍👩‍👧']]],
 ['🏫 학교·물건', [['book','책','📖'],['pencil','연필','✏️'],['bag','가방','🎒'],['school','학교','🏫'],['desk','책상','🪑'],['chair','의자','💺'],['eraser','지우개','🧽'],['ruler','자','📏'],['scissors','가위','✂️'],['clock','시계','⏰'],['phone','전화기','📱'],['computer','컴퓨터','💻'],['teacher','선생님','🧑‍🏫'],['student','학생','🧑‍🎓'],['door','문','🚪'],['window','창문','🪟'],['cup','컵','🥤'],['hat','모자','🧢'],['shoes','신발','👟'],['umbrella','우산','☂️']]],
 ['🌳 자연·날씨', [['moon','달','🌙'],['rain','비','🌧️'],['snow','눈','❄️'],['cloud','구름','☁️'],['wind','바람','🌬️'],['tree','나무','🌳'],['flower','꽃','🌸'],['river','강','🏞️'],['mountain','산','⛰️'],['sea','바다','🌊'],['sky','하늘','🌌'],['spring','봄','🌷'],['summer','여름','🏖️'],['fall','가을','🍂'],['winter','겨울','⛄'],['hot','더운','🥵'],['cold','추운','🥶'],['rainbow','무지개','🌈'],['leaf','나뭇잎','🍃'],['rock','바위','🪨']]],
 ['🚌 장소·탈것', [['house','집','🏠'],['park','공원','🏞️'],['hospital','병원','🏥'],['library','도서관','📚'],['store','가게','🏪'],['zoo','동물원','🦒'],['bank','은행','🏦'],['church','교회','⛪'],['kitchen','부엌','🍳'],['bedroom','침실','🛏️'],['car','자동차','🚗'],['bus','버스','🚌'],['train','기차','🚆'],['bike','자전거','🚲'],['ship','배','🚢'],['airplane','비행기','✈️'],['taxi','택시','🚕'],['subway','지하철','🚇'],['road','길','🛣️'],['bridge','다리(건너는)','🌉']]],
 ['🏃 움직임', [['run','달리다','🏃'],['walk','걷다','🚶'],['eat','먹다','🍽️'],['drink','마시다','🥤'],['sleep','자다','😴'],['swim','수영하다','🏊'],['jump','뛰어오르다','🤸'],['sing','노래하다','🎤'],['dance','춤추다','💃'],['read','읽다','📖'],['write','쓰다','✍️'],['draw','그리다','🎨'],['cook','요리하다','🍳'],['play','놀다','🧸'],['sit','앉다','🪑'],['stand','서다','🧍'],['open','열다','📂'],['cry','울다','😢'],['laugh','웃다','😂'],['wash','씻다','🧼']]],
 ['😊 모양·느낌', [['big','큰','🐘'],['small','작은','🐜'],['long','긴','🐍'],['short','짧은','📏'],['tall','키가 큰','🦒'],['happy','행복한','😊'],['sad','슬픈','😢'],['angry','화난','😠'],['tired','피곤한','😫'],['hungry','배고픈','🤤'],['fast','빠른','🐆'],['slow','느린','🐢'],['new','새로운','✨'],['old','오래된','🏚️'],['beautiful','아름다운','🌹'],['clean','깨끗한','🧼'],['dirty','더러운','💩'],['heavy','무거운','🏋️'],['soft','부드러운','🧸'],['strong','힘센','💪']]],
 ['⚽ 직업·운동', [['doctor','의사','🧑‍⚕️'],['nurse','간호사','👩‍⚕️'],['police officer','경찰관','👮'],['firefighter','소방관','🧑‍🚒'],['farmer','농부','🧑‍🌾'],['cook','요리사','🧑‍🍳'],['singer','가수','🧑‍🎤'],['pilot','조종사','🧑‍✈️'],['scientist','과학자','🧑‍🔬'],['artist','화가','🧑‍🎨'],['soccer','축구','⚽'],['baseball','야구','⚾'],['basketball','농구','🏀'],['tennis','테니스','🎾'],['swimming','수영','🏊'],['skating','스케이트','⛸️'],['skiing','스키','⛷️'],['badminton','배드민턴','🏸'],['golf','골프','⛳'],['boxing','권투','🥊']]],
 ['📅 요일·달·반대말', [['Monday','월요일','1️⃣'],['Tuesday','화요일','2️⃣'],['Wednesday','수요일','3️⃣'],['Thursday','목요일','4️⃣'],['Friday','금요일','5️⃣'],['Saturday','토요일','6️⃣'],['Sunday','일요일','☀️'],['January','1월','🎍'],['May','5월','🌹'],['December','12월','🎄'],['morning','아침','🌅'],['night','밤','🌃'],['today','오늘','📅'],['tomorrow','내일','➡️'],['yesterday','어제','⬅️'],['up','위','⬆️'],['down','아래','⬇️'],['left','왼쪽','⬅️'],['right','오른쪽','➡️'],['question','질문','❓']]],
];
const LV = () => { S.study = S.study || { wrong: [] }; const st = S.study; st.level = st.level || 1; st.open = st.open || 1; st.stars = st.stars || {}; st.score = st.score || 0; return st; };
if (window.WORD_LEVELS && WORD_LEVELS.length) LEVELS.splice(0, LEVELS.length, ...WORD_LEVELS, ...(window.WORD_LEVELS_MID || []), ...(window.WORD_LEVELS_HIGH || []));   // lib/words.js 초등 800 + lib/words_mid.js 중학교
let WORDS = LEVELS[0][1];
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
  ui.innerHTML = '<div class="sTop"><button class="sX" id="sX">✕</button><b>📚 하루와 공부</b><div class="sInv" id="sInv"></div></div><div class="sMsg" id="sMsg"></div><div class="sQ" id="sQ"></div><div class="sProg" id="sProg"></div>';
  document.body.appendChild(ui);
  ui.querySelector('#sX').onclick = () => (window.haruBack ? haruBack() : closeStudy());
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
function stuLevels() {
  const st = LV(), q = document.getElementById('sQ'); clearInterval(STU.timer); STU.n = 0; STU.ok = 0; STU.streak = 0;
  const done = st.open > LEVELS.length;
  q.innerHTML = `<div class="sAsk" style="font-size:16px">자기 실력에 맞는 단계를 골라! (1~20 초등 · 21~45 중학교 · 46~70 고등학교) · 점수 ${st.score}</div><div class="sOpts" style="grid-template-columns:1fr">` + LEVELS.map((L, k) => { const n = k + 1, lock = false, sv = st.stars[n] || 0; return `<button class="sOpt" data-lv="${n}" ${lock ? 'disabled style="opacity:.45"' : ''}>${lock ? '🔒' : n + '단계'} ${L[0]} <span class="sm">${'⭐'.repeat(Math.min(2, sv))}${'☆'.repeat(Math.max(0, 2 - sv))}</span></button>`; }).join('') + `<button class="sOpt" data-lv="talk" ${done ? '' : 'disabled style="opacity:.45"'}>${done ? '🗣️' : '🔒'} 회화 <span class="sm">${done ? '곧 열려요!' : `${LEVELS.length}단계를 다 깨면 열려요`}</span></button></div>`;
  q.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { if (b.dataset.lv === 'talk') { stuTop('🗣️ 회화는 곧 만들어 줄게! 조금만 기다려 💛'); return; } st.level = +b.dataset.lv; save(); WORDS = LEVELS[st.level - 1][1]; stuTop(`${st.level}단계 ${LEVELS[st.level - 1][0]} 시작!`); stuNext(); });
  document.getElementById('sProg').textContent = ''; stuPet('idle');
}
// 예문에서 정답 단어를 ____ 로 가리기 (대소문자 무시)
function blankOut(sent, word) { const lo = sent.toLowerCase(), w = word.toLowerCase(); let out = '', at = 0, f; while ((f = lo.indexOf(w, at)) >= 0) { out += sent.slice(at, f) + '_____'; at = f + w.length; } return out + sent.slice(at); }
function stuNext() {
  STU.busy = false;
  if (STU.n >= 10) return stuDone();
  S.study = S.study || { wrong: [] };
  const wrong = S.study.wrong.map(e => WORDS.find(w => w[0] + w[1] === e)).filter(Boolean);   // 지금 단계에서 틀렸던 단어
  const w = wrong.length && Math.random() < 0.5 ? pick(wrong) : pick(WORDS);
  const mode = STU.n % 2;   // 0: 영어 보고 뜻 고르기 · 1: 그림·한글 보고 영어 고르기
  const others = WORDS.filter(x => x[1] !== w[1] && x[0] !== w[0]).sort(() => Math.random() - 0.5).slice(0, 3);
  const opts = [w, ...others].sort(() => Math.random() - 0.5);
  STU.q = { w, mode, opts };
  const q = document.getElementById('sQ'), num = ['①', '②', '③', '④'];
  q.innerHTML = `<div class="sEmo">${w[2]}</div>` + (mode === 0
    ? `<div class="sWord">${w[0]}</div>${w[3] ? `<div class="sAsk" style="font-style:italic;color:#446">“${w[3]}”</div>` : ''}<button class="sSpk" id="sSay">🔊 듣기</button><div class="sAsk">무슨 뜻일까? 번호를 골라 봐!</div>`
    : `<div class="sWord">${w[1]}</div>${w[3] ? `<div class="sAsk" style="font-style:italic;color:#446">“${blankOut(w[3], w[0])}”</div>` : ''}<div class="sAsk">영어로 뭘까? 번호를 골라 봐! (🔊 를 누르면 소리)</div>`)
    + `<div class="sOpts">${opts.map((o, i) => `<button class="sOpt" data-i="${i}">${num[i]} ${mode === 0 ? o[1] : o[0]}${mode === 1 ? `<span class="sm" data-sp="${i}">🔊 듣기</span>` : ''}</button>`).join('')}</div>`;
  if (mode === 0) { q.querySelector('#sSay').onclick = () => stuSpeak(w[0], 'en'); setTimeout(() => stuSpeak(w[0], 'en'), 400); }
  q.querySelectorAll('.sOpt').forEach(b => b.onclick = e => {
    const sp = e.target.closest('[data-sp]'); if (sp) { e.stopPropagation(); stuSpeak(opts[+sp.dataset.sp][0], 'en'); return; }
    stuPick(+b.dataset.i, b);
  });
  document.getElementById('sProg').textContent = `${LV().level}단계 · ${STU.n + 1} / 10 문제 · 맞은 수 ${STU.ok}`;
  stuPet(hungerNow() >= 75 ? 'hungry' : 'idle');
}
function stuPick(i, btn) {
  if (STU.busy) return; STU.busy = true;
  const { w, opts } = STU.q, ok = opts[i] === w; const key = w[0] + w[1];
  S.study = S.study || { wrong: [] };
  document.querySelectorAll('#sQ .sOpt').forEach((b, k) => { if (opts[k] === w) b.classList.add('ok'); });
  if (ok) {
    STU.ok++; STU.streak++; LV().score += 10 * LV().level; S.study.wrong = S.study.wrong.filter(x => x !== key);
    const p = pick(PRAISE); stuPet(pick(['praise', 'hooray', 'joy']));
    stuTop(p);   // 11-10: 문제마다 사료는 없음 — 한 판 끝에 8개 이상이면 사료
  } else {
    btn.classList.add('no'); STU.streak = 0; if (!S.study.wrong.includes(key)) S.study.wrong.push(key); S.study.wrong = S.study.wrong.slice(-30);
    stuTop(`아깝다! 정답은 ${w[0]} (${w[1]}) 야`); stuPet('curious'); setTimeout(() => stuSpeak(w[0], 'en'), 300);
  }
  save(); STU.n++;
  document.getElementById('sProg').textContent = `${STU.n} / 10 문제 · 맞은 수 ${STU.ok}`;
  setTimeout(stuNext, ok ? 1800 : 2600);
}
function stuDone() {
  const st = LV(), q = document.getElementById('sQ'), lv = st.level;
  let extra = '';
  if (STU.ok >= 8) {
    st.stars[lv] = Math.min(2, (st.stars[lv] || 0) + 1);
    foodGain(1, STU.ok >= 10 ? 1 : 0, '');   // 8개 이상 = 사료 1 · 다 맞히면 간식 1
    if (st.stars[lv] >= 2 && st.open === lv) { st.open = lv + 1; extra = lv >= LEVELS.length ? `🎉 ${LEVELS.length}단계를 다 깼어! 🗣️ 회화가 열렸어!` : `🎉 ${lv}단계 통과! ${lv + 1}단계에 도전해 봐!`; foodGain(1, 1, '🎁 단계 선물!'); }
    else extra = `⭐ 별 하나! (${st.stars[lv]}/2)`;
  }
  save();
  const msg = STU.ok >= 9 ? '완벽해! 최고야! 🏆' : STU.ok >= 7 ? '정말 잘했어! 🎉' : STU.ok >= 4 ? '좋아! 조금만 더 하면 돼 💪' : '괜찮아! 다시 해 보자 🙂';
  q.innerHTML = `<div class="sEmo">🎓</div><div class="sWord">${STU.ok} / 10 맞혔어!</div><div class="sAsk">${msg}${extra ? '<br><b>' + extra + '</b>' : '<br>8개 이상 맞히면 ⭐ 를 받아!'}<br>점수 ${st.score} · 사료·간식으로 ${bn()}에게 밥을 줘!</div><button class="sBig" id="sAgain">한 번 더 하기</button><button class="sBig" id="sLv" style="background:#8a6bff">단계 고르기</button>`;
  q.querySelector('#sAgain').onclick = () => { STU.n = 0; STU.ok = 0; STU.streak = 0; stuTop(''); if (st.open > lv && lv < LEVELS.length && STU.ok === 0 && extra.includes('열렸')) { st.level = lv + 1; WORDS = LEVELS[lv][1]; } stuNext(); };
  q.querySelector('#sLv').onclick = () => stuLevels();
  stuTop(extra || msg); stuPet(STU.ok >= 7 ? 'hooray' : 'joy');
  document.getElementById('sProg').textContent = '';
}
function openStudy() {
  window.wantViewAt = Date.now(); if (typeof hideBubble === 'function') hideBubble();
  const ui = stuUI(); if (STU.on) return;
  ui.hidden = false; STU.on = true; STU.n = 0; STU.ok = 0; STU.streak = 0;
  if (typeof navPush === 'function') navPush(Object.assign(() => closeStudy(), { study: 1 }));
  stuTop(hungerNow() >= 25 ? `${bn()}가 배고파해! 단어를 맞혀서 밥을 주자 🍚` : '영어 단어를 맞히면 🍚 사료를 받아!'); stuLevels();
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

// 하루 예보 (휴대폰): 저장소 · 다루 마당 · 말창 · 대화 · 검색 · 시간/알람
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── 저장소 (이 휴대폰 안에만)
const DEF = {
  me: { name: '', buddyName: '다루', size: 100, temper: 'active' },   // temper: active 활발 · normal 평범 · shy 소심   // size: 팻 크기 10~100 (100 = 처음 크기)
  talk: { freq: 'normal', volume: 0.4, cries: true },
  chat: [], alarms: [], chimeLast: {}, birthdays: [], bdayLast: {},
  chimes: [
    { id: 'lunch', hm: '11:50', days: [0, 1, 2, 3, 4, 5, 6], text: '곧 점심시간이야! 밥 먹을 시간이 오고 있어 🍚', on: true },
    { id: 'offwork', hm: '18:00', days: [1, 2, 3, 4, 5], text: '퇴근 시간이야! 오늘도 수고했어. 저녁은 먹어야지? 🍲', on: true },
  ],
  contacts: [], invites: {}, peoplePending: {}, pchats: {}, seen: [],
  guard: { daily: false, guardians: [], sosAuto: false, helloDay: '', scamClip: false },
  mood: { date: '', today: '', askedDate: '' },
  ai: { provider: 'none', key: '', model: 'claude-haiku-5-5' },
  nostr: { sk: '' }, asked: { contacts: false },
};
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function merge(t, s) { for (const k of Object.keys(s || {})) { if (isObj(s[k]) && isObj(t[k])) merge(t[k], s[k]); else t[k] = s[k]; } return t; }
let S = merge(structuredClone(DEF), (() => { try { return JSON.parse(localStorage.getItem('haru') || '{}'); } catch { return {}; } })());
if (!S.sizeV2) { S.me.size = 100; S.sizeV2 = true; }   // 11-05: 크기 기준 바꿈 (지금 크기 = 100)
function save() { try { localStorage.setItem('haru', JSON.stringify(S)); } catch { } }
function patch(p) { merge(S, p); save(); return S; }
const bn = () => S.me.buddyName || '다루';

// ── 화면 바꾸기
let view = 'home';
function go(v) {
  if (view === 'set' && v !== 'set' && typeof setUndo === 'function') setUndo();   // 11-06: 저장 안 하고 나가면 예전 그대로
  view = v;
  $$('.view').forEach(e => e.classList.toggle('on', e.dataset.v === v));
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === v));
  if (v === 'people') drawPeople();
  if (v === 'town') drawTown();
  if (v === 'room') drawRoom();
  if (v === 'safe') drawSafe();
  if (v === 'time') drawTime();
  if (v === 'set') drawSet();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

// ── 다루 마당: 그림·움직임
// 11-06: 강아지·고양이·돼지 — 그림·동작은 PC 에서 관리(build_assets.py 로 복사)
const SP = () => { const v = window.prevSp || S.me.species; return v && (window.CHARS || {})[v] ? v : 'dog'; };   // prevSp = 설정에서 미리 보기
let CH = (window.CHARS || {})[SP()];
const DIR = () => 'chars/' + SP() + '/';
const POSES = {
  angry: ['화남', '놀람'], solo: ['혼자놀기', '혼자놀기2', '물장난'], dance: ['춤', '즐거움'], bang: ['빵'], warn: ['위험'], wink: ['윙크'], crawl: ['기어'], drink: ['물먹기'], meal: ['밥먹기', '밥먹기2'], brush: ['양치'], wash: ['세수'], laugh: ['웃어', '기쁨'], sit: ['앉아', '눈망울_앉기'], roll: ['굴러'], peekaboo: ['숨어', '부끄러움'],
  curious: ['궁금', '생각중'], dizzy: ['헤롱', '놀람'], sick: ['아픔', '엎드림', '슬픔'], hello: ['인사_왼손', '인사_오른손', '인사_꾸벅', '손흔들기', '손흔들기2'], loveyou: ['사랑해', '사랑'], heart: ['하트날리기', '사랑'], cute: ['이쁜짓', '눈망울_앉기'], idle: ['정면'], walk: ['walk'], run: ['run', '네발뛰기', 'dash'], sleep: ['자자', '잠'], hang: ['걸치기', '눈망울_걸치기'],
  stretch: ['기지개'], talk: ['말하기', '정면'], bark: ['소리', '소리2'], joy: ['기쁨'], fun: ['즐거움', '춤'], sad: ['슬픔'], gloomy: ['우울'], hungry: ['배고픔'], think: ['생각중', '궁금'], surprise: ['놀람'], shy: ['부끄러움', '부끄러움2'], love: ['사랑', '사랑해'],
  eat: ['먹기'], letter: ['편지'], magnify: ['돋보기'], wave: ['손흔들기', '인사_왼손'], paw: ['손', '손흔들기'], up: ['올려다보기', '정면'], back: ['뒷모습'], side: ['옆모습'], lie: ['엎드림', '눈망울_엎드림', '자자'],
  jump: ['점프', '점프2'], splash: ['물장난'], flipover: ['발라당'], hooray: ['만세', '기쁨'], gaze: ['눈망울_앉기', '정면'],
};
const pet = $('#pet'), yard = $('#yard');
const P = { x: 0.5, dir: 1, target: null, speed: 0.08, pose: 'idle', frames: null, fi: 0, fps: 8, until: 0, mode: 'idle', lastT: 0 };
function setPose(p) {
  P.pose = p; CH = (window.CHARS || {})[SP()];
  // 강아지 걷기·뛰기: 얼굴·뒤통수가 안 잘린 그림 두 장을 번갈아 (11-05) — 고양이·돼지는 PC 와 같은 움직이는 그림
  const CYC = SP() === 'dog' ? { walk: [['걷기1.webp', '걷기2.webp'], 5], run: [['뛰기1.webp', '뛰기2.webp'], 7] } : {};
  if (CYC[p]) { P.frames = CYC[p][0]; P.fps = CYC[p][1]; P.fi = 0; P.face = -1; P.hk = 1; pet.src = DIR() + P.frames[0]; return; }
  const names = POSES[p] || POSES.idle, R = (CH && CH.refH) || 0;
  for (const n of names) {
    const an = CH && CH.anims && CH.anims[n];
    if (an) { P.frames = an.frames; P.fps = an.fps || 8; P.fi = 0; P.face = an.face || 0; P.hk = R && an.h ? an.h * (an.sc || 1) / R : 1; pet.src = DIR() + P.frames[0]; return; }   // 크기: PC 와 같은 셈(동작 그림 높이 ÷ 기준 높이)
    const sp = CH && CH.sprites && CH.sprites[n];
    if (sp) { P.frames = null; P.face = sp.face || 0; P.hk = R && sp.h ? sp.h / R : 1; pet.src = DIR() + sp.file; return; }
  }
  if (p !== 'idle') setPose('idle');
}
function setSpecies(sp) { S.me.species = sp; save(); CH = (window.CHARS || {})[SP()]; setPose('joy'); const f = $('#tFace'); if (f) { f.onerror = () => { f.onerror = null; f.src = DIR() + CH.sprites['정면'].file; }; f.src = DIR() + '말창얼굴.webp'; } if (window.Native && Native.floatConfig) Native.floatConfig(); }
function fx(cls) { pet.classList.remove(cls); void pet.offsetWidth; pet.classList.add(cls); setTimeout(() => pet.classList.remove(cls), 1000); }
const MOVE = { often: 1.4, normal: 1, rare: 0.5, quiet: 0 };
// 움직이는 정도 0~4 (0 가만히 · 4 아주 활발) — 화면 위 팻과 앱 안 팻이 같이 씀
function petAct() { const f = S.talk.freq, m = S.me.temper || 'normal'; if (f === 'quiet') return 0; if (m === 'active') return f === 'rare' ? 2 : 4; if (m === 'shy') return 1; return { often: 3, normal: 2, rare: 1 }[f] ?? 2; }
// 팻 크기: 10 = 예전 30 크기, 100 = 예전 130 크기 (11-05 사용자) — 바탕화면 팻과 같은 셈
function petPx(n) { return Math.round(1.2 * (30 + (Math.max(10, Math.min(100, n)) - 10) * 100 / 90)); }
function decide() {
  const q = S.talk.freq === 'quiet', h = new Date().getHours(), night = h >= 23 || h < 6;
  const r = Math.random();
  if (q || (night && r < 0.7)) { setPose(pick(['sit', 'lie', 'sleep', 'gaze'])); P.mode = 'rest'; P.until = performance.now() + rnd(20000, 50000); return; }
  const a = petAct(), mv = [0, 0.5, 1, 1.5, 2.1][a];
  if (r < Math.min(0.93, 0.45 * mv)) { P.target = rnd(0.08, 0.92); P.speed = r < (a >= 4 ? 0.6 : 0.12 * mv) ? 0.32 : 0.1; P.mode = P.speed > 0.2 ? 'run' : 'walk'; setPose(P.mode); P.until = performance.now() + 15000; return; }
  setPose(pick(['idle', 'gaze', 'sit', 'joy', 'up', 'lie', 'stretch', 'wink', 'laugh']));
  if (!night && Math.random() < [0, 0.04, 0.08, 0.14, 0.22][a] && Date.now() - (window._lastBark || 0) > 40000) { window._lastBark = Date.now(); setPose('bark'); fx('shake'); cry(Math.random() < 0.5); }   // 가끔 혼자 짖기
  P.mode = 'idle'; P.until = performance.now() + (a >= 4 ? rnd(600, 1800) : a === 3 ? rnd(1500, 4000) : rnd(3000, 8000));
}
let frameT = 0;
function tick(now) {
  const dt = Math.min(0.1, (now - (P.lastT || now)) / 1000); P.lastT = now;
  if (P.target != null) {
    const d = P.target - P.x;
    if (Math.abs(d) < 0.01) { P.target = null; setPose(pick(['idle', 'sit', 'joy', 'gaze', 'jump', 'laugh'])); if (petAct() >= 4) fx('hop'); P.until = now + (petAct() >= 4 ? rnd(500, 1500) : rnd(2500, 6000)); }
    else { P.dir = d > 0 ? 1 : -1; P.x += Math.sign(d) * Math.min(Math.abs(d), P.speed * dt); }
  } else if (now > P.until) decide();
  if (P.frames && now - frameT > 1000 / P.fps) { frameT = now; P.fi = (P.fi + 1) % P.frames.length; pet.src = DIR() + P.frames[P.fi]; }
  const hh = petPx(window.prevSize || S.me.size || 100);   // 크기 단계 → 화면 크기
  const hp = Math.round(hh * (P.hk || 1)); if (pet._h !== hp) { pet._h = hp; pet.style.height = hp + 'px'; }
  const w = pet.getBoundingClientRect().width || 100, W = yard.clientWidth;
  pet.style.left = Math.round(P.x * W - w / 2) + 'px';
  const flip = P.face ? (P.dir !== P.face) : P.dir < 0 && P.target != null;
  pet.classList.toggle('flip', !!flip);
  requestAnimationFrame(tick);
}
// 짖는 소리
const SOUNDS = { dog: [['dog_bark1', 'dog_bark2', 'dog_bark3', 'dog_bark4'], ['dog_happy1', 'dog_happy2', 'dog_happy3']], cat: [['cat_meow1', 'cat_meow2', 'cat_meow3', 'cat_meow4'], ['cat_meow1', 'cat_meow3']], pig: [['pig_oink1', 'pig_oink2', 'pig_oink3', 'pig_oink4', 'pig_oink5'], ['pig_oink1', 'pig_oink3', 'pig_oink4']] };
let quietUntil = 0;
function cry(happy, loud, force) {
  if (S.talk.mute && !force) return;   // ⏰ 알람(force)은 음소거여도 울림   // 11-06: 🔇 음소거면 어떤 소리도 안 냄
  if (!loud && (S.talk.cries === false || Date.now() < quietUntil)) return;
  const L = SOUNDS[SP()] || SOUNDS.dog; const a = new Audio(`sounds/${pick(happy ? L[1] : L[0])}.mp3`);
  a.volume = Math.max(0, Math.min(1, loud ? Math.max(0.8, S.talk.volume) : S.talk.volume));
  a.play().catch(() => {});
}
function quitApp() {   // 11-06: 조용히 끝내기 — 팻도 화면에서 사라짐(하루 예보를 다시 누르면 다시 나옴)
  say(pick(['잘 자~ 또 불러 줘 🐾', '응, 조용히 있을게. 또 봐! 💛', '오늘도 고마웠어. 안녕~']), { pose: 'wave', ms: 1500 });
  setTimeout(() => { if (window.Native && Native.quit) Native.quit(); else { hideBubble(); petOnly(true); } }, 1200);
}
// 📞 전화 걸기 (11-07): 앱 파일이면 안드로이드가 바로 걸고, 아니면 전화 화면
function dialNum(num) {
  const n = String(num || '').replace(/[^0-9+*#]/g, ''); if (!n) return;
  const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
  if (F && F.call) F.call({ num: n }).then(r => { say('전화 화면을 열었어. 초록 단추를 누르면 걸려 📞', { ms: 4000 }); }).catch(() => { location.href = 'tel:' + n; });
  else location.href = 'tel:' + n;
}
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="tel:"]'); if (a) { e.preventDefault(); dialNum(a.getAttribute('href').slice(4)); } }, true);
function petMenu() {
  setPose(pick(['joy', 'love', 'wave', 'laugh'])); fx('hop'); cry(true); P.until = performance.now() + 3000; P.target = null; markSign();
  const b = [['🏘️ 동네 날씨', () => openView('town')], ['🎨 내 방', () => openView('room')], ['📒 주소록', () => openView('people')], ['🛡️ 지킴이', () => openView('safe')], ['⏰ 시간·알람', () => openView('time')], ['⚙️ 설정', () => openView('set'), 'setb'], ['📖 안내소식', () => openGuide()], ['🌙 끝내기', quitApp]];
  clearTimeout(bubbleT);
  bubble.querySelector('.text').innerHTML = animalize(pick([`멍! 뭐 할까? 🐾`, `불렀어? 헤헤 🐶`, `${S.me.name ? esc(S.me.name) + '! ' : ''}뭐 도와줄까?`]));
  const box = bubble.querySelector('.btns'); box.innerHTML = '<div class="petmenu"></div>';
  for (const [label, act, cls] of b) { const el = document.createElement('button'); el.textContent = label; if (cls) el.className = cls; if (cls === 'setb' && window.Native && Native.upd) el.innerHTML = label + ' <i class="badge">1</i>'; el.onclick = ev => { ev.stopPropagation(); act(); }; box.firstChild.appendChild(el); }
  bubble.hidden = false; bubbleT = setTimeout(hideBubble, 15000);
}
pet.addEventListener('click', petMenu);
// 팻만 보기 ↔ 말창·메뉴
function petOnly(on) { document.body.classList.toggle('petonly', on); $('#backPet').hidden = on; if (on) { go('home'); if (!smode) setSmode(true); } }
function openView(v) { hideBubble(); petOnly(false); go(v); }
$('#backPet').onclick = () => { petOnly(true); hideBubble(); };
document.addEventListener('click', e => { const b = e.target.closest('#tabs [data-go="home"]'); if (b) setTimeout(() => petOnly(true), 0); });

// ── 말풍선
const bubble = $('#bubble'); let bubbleT = 0;
function animalize(t) {   // PC 와 같음
  const sp = SP(); if (sp === 'dog' || typeof t !== 'string') return t;
  const cat = sp === 'cat', w = cat ? '야옹' : '꿀꿀';
  return t.replace(/멍멍멍/g, w + w).replace(/멍멍/g, w).replace(/멍!/g, w + '!').replace(/멍~/g, w + '~').replace(/왈왈/g, w + w)
    .replace(/🐶/g, cat ? '🐱' : '🐷').replace(/안 짖을게/g, cat ? '안 울게' : '조용히 할게').replace(/짖을 수/g, cat ? '울 수' : '꿀꿀할 수')
    .replace(/짖어/g, cat ? '울어' : '꿀꿀해').replace(/짖자/g, cat ? '울자' : '꿀꿀하자').replace(/짖는/g, cat ? '우는' : '꿀꿀하는');
}
function say(text, opt = {}) {
  text = animalize(text);
  clearTimeout(bubbleT);
  bubble.querySelector('.text').innerHTML = text; bubble._tap = opt.tap || null;   // 11-07: 말풍선을 누르면 할 일(예: 전화 화면)
  const box = bubble.querySelector('.btns'); box.innerHTML = '';
  for (const b of opt.buttons || []) {
    const el = document.createElement('button'); el.textContent = b.label; if (b.ghost) el.className = 'ghost';
    el.onclick = ev => { ev.stopPropagation(); if (b.url) window.open(b.url, '_blank'); else if (b.tel) dialNum(b.tel); else if (b.act) b.act(); else hideBubble(); };
    box.appendChild(el);
  }
  bubble.hidden = false;
  if (opt.pose) { setPose(opt.pose); P.target = null; P.until = performance.now() + Math.min(opt.ms || 5000, 8000); }
  bubbleT = setTimeout(hideBubble, opt.ms || (opt.buttons && opt.buttons.length ? 20000 : Math.min(12000, 4000 + text.length * 80)));
  if (view !== 'home' && opt.important) go('home');
}
function hideBubble() { bubble.hidden = true; }
bubble.addEventListener('click', e => { if (e.target.closest('button')) return; const f = bubble._tap; bubble._tap = null; hideBubble(); if (f) f(); });

// ── 명령 (PC 와 같은 말)
function doCommand(id) {
  if (['home', 'free', 'run'].includes(id) && window.Native && Native.petAction) Native.petAction(id);   // 바탕화면 팻: 홈 = 말창 위로, 놀아·자유·뛰어 = 내려오기
  const now = performance.now(); P.target = null; P.until = now + 5000;
  const c = COMMANDS.find(x => x.id === id), line = c ? pick(c.say) : '';
  const map = { sleep: 'sleep', sit: 'sit', lie: 'lie', playdead: 'bang', stand: 'joy', wait: 'sit', no: 'sad', quiet: 'shy', jump: 'jump', down: 'joy', climb: 'jump', paw: 'paw', spin: 'fun',
    stretch: 'stretch', drink: 'drink', meal: 'meal', snack: 'eat', dance: 'fun', cute: 'cute', heart: 'heart', loveyou: 'loveyou', magnify: 'magnify', walk: 'walk', hello: 'hello', hungry: 'hungry', peekaboo: 'peekaboo', curious: 'curious', dizzy: 'dizzy', sick: 'sick', gloomy: 'gloomy', hang: 'hang', brush: 'brush', wash: 'wash', laugh: 'laugh', wink: 'wink', good: 'love', bark: 'bark', speak: 'up', call: 'up', hide: 'shy', back: 'walk', slow: 'walk', home: 'joy', free: 'run', hooray: 'hooray', flipover: 'flipover', splash: 'splash', turnback: 'back', angry: 'angry', surprise: 'surprise', warn: 'warn', letter: 'letter', joy: 'joy', sad: 'sad', solo: 'solo', gallop: 'run' };
  if (id === 'run' || id === 'free' || id === 'follow' || id === 'come' || id === 'roll' || id === 'crawl') {
    P.target = id === 'come' || id === 'follow' ? 0.5 : (P.x > 0.5 ? 0.12 : 0.88); P.speed = id === 'crawl' ? 0.05 : id === 'roll' ? 0.12 : 0.3;
    setPose(id === 'roll' ? 'roll' : id === 'crawl' ? 'crawl' : 'run'); P.until = now + 15000;
  } else setPose(map[id] || 'joy');
  if (id === 'quiet') quietUntil = Date.now() + 24 * 3600e3;
  if ((id === 'quiet' || id === 'bark' || id === 'speak' || id === 'call') && window.Native && Native.floatConfig) setTimeout(() => Native.floatConfig(), 100);
  if (id === 'bark' || id === 'speak' || id === 'call') { quietUntil = 0; cry(false); setTimeout(() => cry(false), 900); }
  if (['jump', 'joy', 'good'].includes(id)) fx('hop');
  if (id === 'sleep') P.until = now + 25000;
  if (id === 'dance') { P.until = now + 7000; cry(true); }
  if (id === 'snack') { P.until = now + 6000; cry(true); setTimeout(() => setPose('love'), 3500); }
  if (line) say(esc(line), { ms: 2600 });
}

// ── 말창
const t = $('#t'), modeBtn = $('#modeBtn'); let smode = true, busy = false, lastUser = '', lastSearch = '';
function setSmode(on) { smode = on; document.body.classList.toggle('smode', on); modeBtn.textContent = on ? '🔎' : '♥'; t.placeholder = on ? '무엇이든 찾아볼게…' : `${bn()}에게 말 걸기…`; }
modeBtn.onclick = () => { setSmode(!smode); say(smode ? '🔎 검색창이야! 궁금한 걸 쓰면 찾아서 알려 줄게' : '다시 나랑 이야기하자 🐶', { ms: 2200 }); };
setSmode(true);   // 11-06: 팻방 말창은 처음부터 검색창
t.addEventListener('focus', () => hideBubble());   // 11-06: 말창을 누르면 = 말하려는 것 → 노란 메뉴 바로 닫기
t.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(t.value); } });
function markSign() { patch({ guard: { lastSign: new Date().toISOString() } }); }

function isSearch(text) {
  if (/^(검색|찾아)\s+\S{2,}/.test(text) || /(검색해|찾아\s*(줘|봐|줄래)|날씨|뉴스|가격|맛집|환율|주가|영화|일정|요금|주소|전화번호)/.test(text)) return true;
  if (/^(잘|안녕|좋은|반가|보고|있었|오늘\s*어땠|괜찮|아파|피곤|졸려|배고|사랑|고마|미안|축하)/.test(text)) return false;
  if (/(너|니가|네가|기분|어때|뭐\s*해|뭐하|좋아해|심심|놀자|힘들|슬퍼|행복)/.test(text)) return false;
  return /(알려\s*(줘|줄래)|(이|가|은|는)\s*뭐야|뜻이\s*뭐|누구야|누군지|어디(에|야|있|인)|언제(야|였|예|인|부터|까지|태어)|얼마(야|예|나|에|인)|방법|어떻게\s*(하|해|돼|되)는)/.test(text);
}
async function send(text, opt = {}) {   // opt.talk = 바탕화면 팻에게 한 말(검색 말고 대화)
  text = String(text || '').trim(); if (!text) return;
  t.value = ''; markSign();
  if (view !== 'home') go('home');   // 대답은 다루 마당에서
  if (window.sosHear && sosHear(text)) return;   // 🚨 도와주세요 (지킴이)
  const em = stripName(text).match(/^(119|112|1394|일일구|일일이|구급차|소방서|경찰)\s*(에|로|번|을|를|좀)?\s*(전화|신고|불러)/);
  if (em && window.sosCall) { sosCall(/^(119|일일구|구급차|소방서)/.test(em[1]) ? '119' : /^(112|일일이|경찰)/.test(em[1]) ? '112' : '1394'); return; }
  if (busy) { say('잠깐만, 아직 생각 중이야 💭', { ms: 2000 }); return; }
  if (smode && !opt.talk) {   // 팻방 말창 = 검색. 단, 알람·시간·전화·명령은 먼저 알아들음 (11-07)
    if (window.peopleTalk && await peopleTalk(text)) return;
    if (await timeTalk(text)) return;
    if (window.musicTalk && await musicTalk(text)) return;
    const c0 = findCommand(stripName(text) || text); if (c0) { doCommand(c0.id); return; }
    lastSearch = text; return doSearch(text);
  }   // 팻방 말창 = 검색 (명령은 그대로)
  if (window.pmode && pmode) return pmodeSend(text);
  if (/^(아니[,\s]*)?(너|다루)?(한테|에게)?\s*(한|하는)\s*말이(야|었어|라고)/.test(text) && lastSearch) { const q = lastSearch; lastSearch = ''; return chatWith(q, true); }
  if (/^(그거\s*)?(찾아\s*봐|찾아\s*줘|검색해\s*줘|검색)[!~.?\s]*$/.test(text) && lastUser) { lastSearch = lastUser; return doSearch(lastUser); }
  if (window.peopleTalk && await peopleTalk(text)) return;
  if (await timeTalk(text)) return;
  if (window.musicTalk && await musicTalk(text)) return;
  if (!stripName(text).replace(/[!~?.\s]/g, '') ) { doCommand('call'); return; }
  const cmd = findCommand(stripName(text) || text);
  if (cmd) { doCommand(cmd.id); return; }
  if (isSearch(text)) { lastSearch = text; return doSearch(text); }
  return chatWith(text);
}

// ── 대화 두뇌: AI(내 Claude 열쇠)가 있으면 그걸로, 없으면 기본 말
const SYSTEM = `너는 사용자의 휴대폰 속에 사는 작고 귀여운 반려동물 친구야. 앱 이름은 "하루 예보". 다정한 반말로 1~3문장만. #, **, -, 표 같은 기호는 쓰지 마.
사용자의 마음이 분명히 느껴지면 답 끝에 <mood>맑음</mood>(맑음·구름조금·흐림·비·천둥 중 하나)를 붙인다.
최신 정보나 네가 확실히 모르는 사실을 물으면 "잠깐, 찾아볼게!"라고만 답하고 끝에 <search>검색어</search>를 붙인다. 인사·감정·잡담에는 붙이지 않는다.
스스로를 해치고 싶다는 말이 나오면 공감하고 109(자살예방상담)·112에 바로 연락하라고 꼭 말한다. 비밀번호·계좌·인증번호는 묻지도 받지도 않는다.`;
let Anthropic = null;
async function askAI(messages, system, maxTokens = 600) {
  if (S.ai.provider !== 'claude' || !S.ai.key) return null;
  if (!Anthropic) Anthropic = (await import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.4.0/+esm')).default;
  const client = new Anthropic({ apiKey: S.ai.key, dangerouslyAllowBrowser: true });
  const res = await client.messages.create({ model: S.ai.model || 'claude-haiku-5-5', max_tokens: maxTokens, system, messages });
  return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
}
const COMFORT = ['많이 힘들었구나… 내가 옆에 있을게 🐾', '그럴 땐 잠깐 쉬어도 괜찮아. 오늘 고생했어 💛', '속상했겠다. 말해 줘서 고마워 🫂'];
function offline(t) {
  if (/죽고\s*싶|자살|사라지고\s*싶|살기\s*싫/.test(t)) return { text: '그렇게까지 힘들었구나… 넌 혼자가 아니야. 지금 바로 109(자살예방상담, 24시간)에 전화해 줘. 급하면 112야 💛', danger: true };
  if (window.scamCheck && t.length > 25 && /(http|택배|미납|검찰|경찰|대출|인증번호|엄마|아빠|당첨|환급|국외발신)/.test(t)) { const r = scamCheck(t); return { text: `문자 살펴봤어: ${r.level}. ${r.advice}` }; }
  if (/힘들|우울|슬퍼|지쳐|외로|속상|짜증|불안|걱정|무서/.test(t)) return { text: pick(COMFORT), mood: '흐림' };
  if (/좋아|신나|행복|기뻐|최고|설레/.test(t)) return { text: '와, 좋다! 그 기분 나한테도 옮았어 ☀️', mood: '맑음' };
  if (/안녕|하이|반가|잘\s*있었/.test(t)) return { text: pick(['안녕! 보고 싶었어 🐶', '응! 잘 있었어~ 너는?', '헤헤 왔구나! 오늘 마음 날씨는 어때?']) };
  if (/고마|땡큐|사랑해/.test(t)) return { text: '헤헤, 나도 고마워! 💛', mood: '맑음' };
  if (/심심|놀아/.test(t)) return { text: '그럼 나랑 놀자! "굴러", "점프", "손" 해 봐 🐾' };
  return { text: pick(['응응, 듣고 있어! (설정에서 AI를 연결하면 더 똑똑하게 이야기할 수 있어)', '그렇구나~ 더 말해 줘 🐾', '헤헤, 나는 아직 간단한 말만 알아들어. 궁금한 건 ♥를 눌러 🔎 검색창에서 물어봐!']) };
}
async function chatWith(text, corrected) {
  lastUser = text; busy = true; setPose('think');
  const history = [...S.chat, { role: 'user', content: text }].slice(-20);
  let r = null;
  try {
    const raw = await Promise.race([askAI(history, SYSTEM + `\n너는 ${({ dog: '강아지', cat: '고양이', pig: '아기 돼지' })[SP()]}야. 지금: ${new Date().toLocaleString('ko-KR')}. 너의 이름: ${bn()}. 사용자 이름: ${S.me.name || '(모름)'}`), new Promise((_, j) => setTimeout(() => j(new Error('timeout')), 40000))]);
    if (raw) { const tag = n => (raw.match(new RegExp(`<${n}>\\s*([^<]+?)\\s*</${n}>`)) || [])[1]; r = { text: raw.replace(/<(mood|search)>[^<]*<\/\1>/g, '').replace(/[#*]/g, '').trim(), mood: tag('mood'), search: tag('search') }; }
  } catch (e) { r = { text: '앗, AI 연결이 안 돼서 간단히 답할게. ' + offline(text).text }; }
  if (!r) r = offline(text);
  busy = false;
  patch({ chat: [...history, { role: 'assistant', content: r.text }].slice(-30) });
  if (r.mood) patch({ mood: { date: today(), today: r.mood } });
  if (r.search && !corrected) { say(esc(r.text), { ms: 2000, pose: 'magnify' }); lastSearch = text; return doSearch(r.search); }
  say(esc(r.text), { pose: r.danger ? 'sad' : 'talk', buttons: r.danger ? [{ label: '📞 109 전화', tel: '109' }] : [] });
}

// ── 검색: 위키백과 + DuckDuckGo 간단 답 (휴대폰에서 바로, 열쇠 없이). AI 가 있으면 짧게 정리
async function webSearch(q) {
  const out = [];
  // 질문 말끝 떼기: "이순신은 언제 태어났어" → "이순신 출생"
  const kq = q.replace(/[?？!.~]/g, ' ').replace(/(은|는|이|가|을|를|의)\s/g, ' ').replace(/(언제\s*태어났어|언제\s*태어났지|태어난\s*날)/, ' 출생').replace(/\s*(뭐야|뭐지|누구야|누구지|어디야|어디지|언제야|알려\s*줘|알려줘|좀|있어|해\s*줘|인가요|일까)\s*/g, ' ').replace(/\s+/g, ' ').trim() || q;
  try {
    const s = await (await fetch('https://ko.wikipedia.org/w/api.php?action=query&list=search&srlimit=2&format=json&origin=*&srsearch=' + encodeURIComponent(kq))).json();
    for (const title of ((s.query || {}).search || []).map(x => x.title).slice(0, 2)) {
      const j = await (await fetch('https://ko.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title))).json();
      if (j.extract) out.push({ title: '위키백과: ' + j.title, url: j.content_urls?.mobile?.page || j.content_urls?.desktop?.page, snippet: j.extract.slice(0, 400) });
    }
  } catch { }
  try {
    const j = await (await fetch('https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&kl=kr-kr&q=' + encodeURIComponent(q))).json();
    if (j.AbstractText) out.push({ title: j.Heading || q, url: j.AbstractURL, snippet: j.AbstractText.slice(0, 400) });
    for (const r of (j.RelatedTopics || []).slice(0, 2)) if (r.Text && r.FirstURL) out.push({ title: r.Text.slice(0, 30), url: r.FirstURL, snippet: r.Text });
  } catch { }
  return out;
}
async function doSearch(text) {
  const q = text.replace(/^(검색|찾아)\s*/, '').replace(/\s*(검색해\s*줘|검색해|검색|찾아\s*줘|찾아\s*봐|알려\s*줘)\s*[?!.~]*$/, '').trim() || text;
  busy = true; say(`🔎 "${esc(q)}" 찾아보는 중…`, { pose: 'magnify', ms: 30000 });
  const list = await webSearch(q);
  const web = { label: '🌐 인터넷에서 더 보기', url: 'https://www.google.com/search?q=' + encodeURIComponent(q) };
  if (!list.length) { busy = false; return say(`"${esc(q)}"는 내가 바로 답을 못 찾았어. 인터넷에서 볼래?`, { buttons: [web, { label: '괜찮아', ghost: true }] }); }
  let ans = list[0].snippet.slice(0, 180);
  try { const a = await askAI([{ role: 'user', content: `질문: ${q}\n\n검색 결과:\n${list.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}`).join('\n\n')}` }], '너는 사용자의 반려동물이야. 검색 결과만 근거로 반말 2~4문장으로 쉽게 답해. 기호(#,*,-)는 쓰지 마. 결과에 없으면 모른다고 해.', 500); if (a) ans = a.replace(/[#*]/g, ''); } catch { }
  busy = false;
  say(esc(ans), { pose: 'talk', ms: 30000, buttons: [...list.slice(0, 2).filter(r => r.url).map((r, i) => ({ label: `${i + 1}. ${r.title.slice(0, 16)}`, url: r.url })), web] });
}

// ── 시간·알람 (앱이 열려 있을 때 울림 — 앱 파일(APK)에서는 닫혀 있어도 알림)
async function timeTalk(text) {
  const clean = stripName(text);
  if (HA.ALARM_STOP.test(clean) && ringing) { stopRing('알았어! 그만 짖을게 🐶'); return true; }
  const ta = HA.timeAnswer(clean); if (ta) { say(ta, { pose: 'talk', ms: 5000 }); return true; }
  if (HA.ALARM_CANCEL.test(clean)) { const n = S.alarms.length; patch({ alarms: [] }); say(n ? `알람 ${n}개 다 지웠어! 🧹` : '맞춰 둔 알람이 없어 🐶'); return true; }
  if (HA.ALARM_LIST.test(clean)) { say(S.alarms.length ? '맞춰 둔 알람이야<br>' + S.alarms.slice().sort((a, b) => a.at - b.at).map(a => `⏰ ${a.daily ? '매일 ' + HA.fmtTime(new Date(a.at)) : HA.fmtWhen(new Date(a.at))}${a.label ? ' · ' + esc(a.label) : ''}`).join('<br>') : '맞춰 둔 알람이 없어. "내일 7시에 깨워 줘" 해 봐! ⏰', { ms: 12000 }); return true; }
  const bd = clean.match(/^(.{1,12}?)\s*(의\s*)?생일(은|이)?\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (bd) { const name = bd[1].trim(); patch({ birthdays: [...S.birthdays.filter(b => b.name !== name), { id: uid(), name, m: +bd[4], d: +bd[5] }] }); say(`알겠어! ${esc(name)} 생일은 ${+bd[4]}월 ${+bd[5]}일 🎂 3일 전·하루 전·당일에 알려 줄게!`, { pose: 'joy' }); return true; }
  const al = HA.parseAlarm(clean); if (!al) return false;
  const a = { id: uid(), ...al }; patch({ alarms: [...S.alarms, a] });
  const hm = HA.fmtTime(new Date(a.at)), what = al.kind === 'wake' ? '크게 짖어서 깨워 줄게' : al.label ? `"${esc(al.label)}" 크게 짖어서 알려 줄게` : '크게 짖어서 알려 줄게';
  if (al.daily || /(뒤|후|있다가)/.test(clean)) say(`알겠어! ${al.daily ? '매일 ' : ''}${hm}에 ${what} ⏰`, { pose: 'joy' });
  else say(`알겠어! ${HA.fmtWhen(new Date(a.at))}에 ${what} ⏰<br>매일 이 시간에 해 줄까?`, { pose: 'joy', buttons: [{ label: '매일 해 줘 🔁', act: () => { patch({ alarms: S.alarms.map(x => x.id === a.id ? { ...x, daily: true } : x) }); say(`좋아! 매일 ${hm}에 짖을게 🐶`); } }, { label: '이번 한 번만', ghost: true }] });
  schedNotify();
  return true;
}
let ringing = null, ringingId = '';
function ring(a) {
  window._rung = window._rung || {}; const rk = a.id + '@' + a.at; if (window._rung[rk] && ringing) return; window._rung[rk] = 1;   // 같은 알람 두 번 안 울림
  stopRing(); let n = 0; ringingId = a.id;
  const tickR = () => { n++; setPose('bark'); fx('shake'); cry(false, true, true); if (navigator.vibrate) navigator.vibrate([300, 150, 300]); };
  ringing = { t: setInterval(tickR, 2300), end: setTimeout(() => stopRing(), 90e3) }; tickR();
  say(HA.alarmLine(a), { pose: 'bark', ms: 90e3, important: true, buttons: [{ label: '알았어! 그만 ✋', act: () => stopRing(pick(['헤헤 잘했어! 🐶', '좋아, 오늘도 화이팅! 💛'])) }, { label: '5분 뒤 다시 ⏰', act: () => { stopRing('알겠어, 5분 뒤에 또 짖을게!'); patch({ alarms: [...S.alarms, { id: uid(), at: Date.now() + 5 * 60e3, label: a.label, kind: a.kind }] }); } }] });
  try { if (Notification.permission === 'granted') new Notification('⏰ 하루 예보', { body: HA.alarmLine(a).replace(/<[^>]+>/g, ''), icon: 'icon-192.png' }); } catch { }
}
function stopRing(msg) { if (!ringing) return; { const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet; if (F && F.alarmStop && ringingId) F.alarmStop({ id: ringingId }).catch(() => {}); } clearInterval(ringing.t); clearTimeout(ringing.end); ringing = null; if (msg) say(msg, { ms: 3000, pose: 'joy' }); else hideBubble(); }
function checkTimes() {
  const now = Date.now(), d = new Date(), ymd = today(d), mins = d.getHours() * 60 + d.getMinutes();
  let changed = false;
  for (const a of S.alarms) { if (a.at > now) continue; if (now - a.at < 30 * 60e3 && !(window._rung || {})[a.id + '@' + a.at]) ring(a); if (a.daily) { while (a.at <= now) a.at += 864e5; } else a.done = true; changed = true; }
  if (changed) { S.alarms = S.alarms.filter(a => !a.done); save(); }
  for (const c of S.chimes) {
    if (!c.on || !(c.days || []).includes(d.getDay()) || S.chimeLast[c.id] === ymd) continue;
    const [h, m] = c.hm.split(':').map(Number), at = h * 60 + m;
    if (mins >= at && mins - at <= 2) { S.chimeLast[c.id] = ymd; save(); say(esc(c.text), { pose: 'joy', ms: 9000 }); cry(true); }
  }
  if (d.getHours() >= 9) {
    const t0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const list = [...S.birthdays, ...S.contacts.filter(c => c.bday).map(c => ({ id: 'c' + c.id, name: c.name, m: c.bday.m, d: c.bday.d, tel: (c.phones[0] || {}).num }))];
    for (const b of list) {
      let tt = new Date(d.getFullYear(), b.m - 1, b.d); if (tt < t0) tt = new Date(d.getFullYear() + 1, b.m - 1, b.d);
      const n = Math.round((tt - t0) / 864e5), k = `${b.id}:${n}:${tt.getFullYear()}`;
      if (![0, 1, 3].includes(n) || S.bdayLast[k]) continue;
      S.bdayLast[k] = true; save();
      say(n === 0 ? `🎂 오늘은 ${esc(b.name)} 생일이야! 축하 한마디 해 주자 🎉` : n === 1 ? `🎁 내일은 ${esc(b.name)} 생일이야! 준비했어?` : `🎈 3일 뒤(${b.m}월 ${b.d}일)가 ${esc(b.name)} 생일이야`, { pose: 'joy', ms: 15000, buttons: b.tel && n <= 1 ? [{ label: '📞 전화하기', tel: b.tel }, { label: '나중에', ghost: true }] : [] });
      break;
    }
  }
  // 하루 한 번 마음 날씨
  if (d.getHours() >= 8 && S.mood.date !== ymd && S.mood.askedDate !== ymd && bubble.hidden && view === 'home') {
    patch({ mood: { askedDate: ymd } });
    say('오늘 마음 날씨는 어때?', { pose: 'gaze', ms: 30000, buttons: [['☀️ 맑음', '맑음'], ['⛅ 구름조금', '구름조금'], ['☁️ 흐림', '흐림'], ['🌧️ 비', '비']].map(([l, v]) => ({ label: l, act: () => { patch({ mood: { date: ymd, today: v } }); say(v === '맑음' ? '좋다! 나도 신나 ☀️' : v === '비' ? '오늘은 내가 옆에 꼭 붙어 있을게 🫂' : '알겠어, 기억해 둘게 🐾', { pose: v === '맑음' ? 'joy' : 'gaze' }); } })) });
  }
}
// (앱 파일에서는 닫혀 있어도 알림 — 웹앱일 때는 아무 일 안 함)
function schedNotify() { if (window.Native && Native.schedule) Native.schedule(S.alarms); }

// ── 말로 하기 (휴대폰 음성 인식)
const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null;
function setMute(on) {   // 11-06: 팻 소리 끄기/켜기 (말창 팻 얼굴 · 설정 🔇)
  patch({ talk: { mute: !!on } }); quietUntil = 0;
  $('#talk').classList.toggle('muted', !!on); const mb = $('#s_mute'); if (mb) { mb.textContent = on ? '🔇 소리 꺼짐' : '🔊 소리 켜짐'; mb.classList.toggle('on', !!on); }
  if (window.Native && Native.floatConfig) Native.floatConfig();
  say(on ? '쉿… 이제 조용히 할게 🤫 (내 얼굴을 다시 누르면 소리 켜져)' : '다시 소리 낼게! 🔊', { ms: 2600 });
  if (!on) setTimeout(() => cry(true), 300);
}
$('#tFace').onclick = () => setMute(!S.talk.mute);
$('#talk').classList.toggle('muted', !!S.talk.mute);
{ const f = $('#tFace'); if (f && CH && CH.sprites) f.onerror = () => { f.onerror = null; f.src = DIR() + CH.sprites['정면'].file; }; f.src = DIR() + '말창얼굴.webp'; }   // 말창 얼굴도 고른 동물로
$('#micBtn').onclick = async () => {
  if (window.Native && Native.listen) { $('#micBtn').classList.add('rec'); say('👂 듣고 있어… 말해 줘!', { pose: 'up', ms: 6000 }); try { const txt = await Native.listen(); if (txt) { say(`👂 "${esc(txt)}"`, { ms: 1500 }); send(txt); } } catch { say('잘 못 들었어 🥲 다시 해 볼래?', { ms: 3000 }); } $('#micBtn').classList.remove('rec'); return; }
  if (!SR) { say('이 휴대폰 브라우저는 말 알아듣기를 못 해 🥲 크롬에서 열어 줘!', { ms: 4000 }); return; }
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = 'ko-KR'; rec.interimResults = false; rec.maxAlternatives = 1;
  $('#micBtn').classList.add('rec'); $('#talk').classList.add('rec'); say('👂 듣고 있어… 말해 줘!', { pose: 'up', ms: 6000 });
  rec.onresult = e => { const txt = e.results[0][0].transcript; say(`👂 "${esc(txt)}"`, { ms: 1500 }); send(txt); };
  rec.onend = () => { $('#micBtn').classList.remove('rec'); $('#talk').classList.remove('rec'); rec = null; };
  rec.onerror = () => { $('#micBtn').classList.remove('rec'); rec = null; };
  rec.start();
};

// ── 친구·가족에게 하루 예보 알려 주기 (카톡 등으로 받기 주소 보내기)
const GET_URL = 'https://yje0807111-eng.github.io/haru-yebo/get/';
async function shareText(title, text, url) {
  const Sh = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Share;
  try { if (Sh) { await Sh.share({ title, text, url, dialogTitle: '어디로 보낼까?' }); return true; } } catch { return false; }
  if (navigator.share) { try { await navigator.share({ title, text, url }); return true; } catch { return false; } }
  try { await navigator.clipboard.writeText(text + (url ? '\n' + url : '')); say('📋 복사했어! 카카오톡에 붙여 넣어 보내 줘', { ms: 4000 }); return true; } catch { return false; }
}
function shareApp() { return shareText('하루 예보', '🐾 하루 예보 — 내 휴대폰 속 반려동물 (무료)\n가족 안부·119 지킴이·알람·생일 챙기기\n여기서 받아요 👉', GET_URL); }

// ── 시작
function homeInfo() { const g = S.mood.date === today() ? `오늘 마음: ${S.mood.today}` : ''; $('#homeInfo').textContent = g; $('#sky').textContent = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) + (window.APPVER ? ' · ' + window.APPVER : ''); }
// 지금 몇 판인지 날짜 옆에 (앱 파일이면 "11판", 인터넷 웹앱이면 "웹")
fetch('version.json').then(r => r.json()).then(v => { window.APPVER = (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) ? '버전(' + v.build + ')' : '버전(웹)'; homeInfo(); }).catch(() => {});
function boot() {
  setBuddyName(bn()); $('#tabPet').textContent = bn(); setSmode(true);
  setPose('idle'); requestAnimationFrame(tick);
  homeInfo(); setInterval(homeInfo, 60e3);
  setInterval(checkTimes, 10e3); setTimeout(checkTimes, 3000);
  setTimeout(() => say(pick([`${S.me.name ? esc(S.me.name) + '! ' : ''}왔구나! 보고 싶었어 🐶`, '멍! 반가워~', '헤헤 오늘도 같이 놀자!']), { pose: 'joy', ms: 3500 }), 600);
  setTimeout(() => cry(true), 700);
  // 웹앱에서만 저장 기능 (휴대폰 앱 안에서는 끄고, 예전에 켜진 것도 지움)
  if ('serviceWorker' in navigator) {
    if (location.hostname === 'localhost') navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    else navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  markSign();
}
window.addEventListener('load', boot);

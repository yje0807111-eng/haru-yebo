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
  view = v;
  $$('.view').forEach(e => e.classList.toggle('on', e.dataset.v === v));
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === v));
  if (v === 'people') drawPeople();
  if (v === 'safe') drawSafe();
  if (v === 'time') drawTime();
  if (v === 'set') drawSet();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

// ── 다루 마당: 그림·움직임
const CH = (window.CHARS || {}).dog;
const POSES = {
  bang: ['빵'], warn: ['위험'], wink: ['윙크'], crawl: ['기어'], drink: ['물먹기'], meal: ['밥먹기'], brush: ['양치'], wash: ['세수'], laugh: ['웃어', '기쁨'],
  sit: ['앉아', '눈망울_앉기'], roll: ['굴러'], idle: ['정면'], walk: ['walk'], run: ['run'], sleep: ['자자', '잠'], stretch: ['기지개'], talk: ['말하기'],
  bark: ['소리', '소리2'], joy: ['기쁨'], fun: ['즐거움'], sad: ['슬픔'], think: ['생각중'], surprise: ['놀람'], shy: ['부끄러움'], love: ['사랑'],
  letter: ['편지'], magnify: ['돋보기'], wave: ['손흔들기'], paw: ['손'], up: ['올려다보기'], lie: ['엎드림', '눈망울_엎드림'], jump: ['점프'], gaze: ['눈망울_앉기'],
};
const pet = $('#pet'), yard = $('#yard');
const P = { x: 0.5, dir: 1, target: null, speed: 0.08, pose: 'idle', frames: null, fi: 0, fps: 8, until: 0, mode: 'idle', lastT: 0 };
function setPose(p) {
  P.pose = p;
  const names = POSES[p] || POSES.idle;
  for (const n of names) {
    if (CH && CH.anims && CH.anims[n]) { P.frames = CH.anims[n].frames; P.fps = CH.anims[n].fps || 8; P.fi = 0; P.face = CH.anims[n].face || 0; pet.src = 'chars/dog/' + P.frames[0]; return; }
    if (CH && CH.sprites && CH.sprites[n]) { P.frames = null; P.face = CH.sprites[n].face || 0; pet.src = 'chars/dog/' + CH.sprites[n].file; return; }
  }
  if (p !== 'idle') setPose('idle');
}
function fx(cls) { pet.classList.remove(cls); void pet.offsetWidth; pet.classList.add(cls); setTimeout(() => pet.classList.remove(cls), 1000); }
const MOVE = { often: 1.4, normal: 1, rare: 0.5, quiet: 0 };
// 움직이는 정도 0~4 (0 가만히 · 4 아주 활발) — 화면 위 팻과 앱 안 팻이 같이 씀
function petAct() { const f = S.talk.freq, m = S.me.temper || 'normal'; if (f === 'quiet') return 0; if (m === 'active') return f === 'rare' ? 2 : 4; if (m === 'shy') return 1; return { often: 3, normal: 2, rare: 1 }[f] ?? 2; }
function decide() {
  const q = S.talk.freq === 'quiet', h = new Date().getHours(), night = h >= 23 || h < 6;
  const r = Math.random();
  if (q || (night && r < 0.7)) { setPose(pick(['sit', 'lie', 'sleep', 'gaze'])); P.mode = 'rest'; P.until = performance.now() + rnd(20000, 50000); return; }
  const a = petAct(), mv = [0, 0.5, 1, 1.5, 2.1][a];
  if (r < Math.min(0.93, 0.45 * mv)) { P.target = rnd(0.08, 0.92); P.speed = r < (a >= 4 ? 0.6 : 0.12 * mv) ? 0.32 : 0.1; P.mode = P.speed > 0.2 ? 'run' : 'walk'; setPose(P.mode); P.until = performance.now() + 15000; return; }
  setPose(pick(['idle', 'gaze', 'sit', 'joy', 'up', 'lie', 'stretch', 'wink', 'laugh']));
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
  if (P.frames && now - frameT > 1000 / P.fps) { frameT = now; P.fi = (P.fi + 1) % P.frames.length; pet.src = 'chars/dog/' + P.frames[P.fi]; }
  const hh = Math.max(10, Math.round(120 * (S.me.size || 100) / 100));   // 100 = 120, 10 = 12 (콩알만) if (pet._h !== hh) { pet._h = hh; pet.style.height = hh + 'px'; }
  const w = pet.getBoundingClientRect().width || 100, W = yard.clientWidth;
  pet.style.left = Math.round(P.x * W - w / 2) + 'px';
  const flip = P.face ? (P.dir !== P.face) : P.dir < 0 && P.target != null;
  pet.classList.toggle('flip', !!flip);
  requestAnimationFrame(tick);
}
// 짖는 소리
const BARKS = ['dog_bark1', 'dog_bark2', 'dog_bark3', 'dog_bark4'], HAPPY = ['dog_happy1', 'dog_happy2', 'dog_happy3'];
let quietUntil = 0;
function cry(happy, loud) {
  if (!loud && (S.talk.cries === false || Date.now() < quietUntil)) return;
  const a = new Audio(`sounds/${pick(happy ? HAPPY : BARKS)}.mp3`);
  a.volume = Math.max(0, Math.min(1, loud ? Math.max(0.8, S.talk.volume) : S.talk.volume));
  a.play().catch(() => {});
}
function petMenu() {
  setPose(pick(['joy', 'love', 'wave', 'laugh'])); fx('hop'); cry(true); P.until = performance.now() + 3000; P.target = null; markSign();
  const b = [['💬 나랑 이야기하기', () => { petOnly(false); hideBubble(); t.focus(); }, 'talkb'], ['📒 주소록', () => openView('people')], ['🛡️ 지킴이', () => openView('safe')], ['⏰ 시간·알람', () => openView('time')], ['⚙️ 설정', () => openView('set')]];
  clearTimeout(bubbleT);
  bubble.querySelector('.text').innerHTML = pick([`멍! 뭐 할까? 🐾`, `불렀어? 헤헤 🐶`, `${S.me.name ? esc(S.me.name) + '! ' : ''}뭐 도와줄까?`]);
  const box = bubble.querySelector('.btns'); box.innerHTML = '<div class="petmenu"></div>';
  for (const [label, act, cls] of b) { const el = document.createElement('button'); el.textContent = label; if (cls) el.className = cls; el.onclick = ev => { ev.stopPropagation(); act(); }; box.firstChild.appendChild(el); }
  bubble.hidden = false; bubbleT = setTimeout(hideBubble, 15000);
}
pet.addEventListener('click', petMenu);
// 팻만 보기 ↔ 말창·메뉴
function petOnly(on) { document.body.classList.toggle('petonly', on); $('#backPet').hidden = on; if (on) { go('home'); if (smode) setSmode(false); } }
function openView(v) { hideBubble(); petOnly(false); go(v); }
$('#backPet').onclick = () => { petOnly(true); hideBubble(); };
document.addEventListener('click', e => { const b = e.target.closest('#tabs [data-go="home"]'); if (b) setTimeout(() => petOnly(true), 0); });

// ── 말풍선
const bubble = $('#bubble'); let bubbleT = 0;
function say(text, opt = {}) {
  clearTimeout(bubbleT);
  bubble.querySelector('.text').innerHTML = text;
  const box = bubble.querySelector('.btns'); box.innerHTML = '';
  for (const b of opt.buttons || []) {
    const el = document.createElement('button'); el.textContent = b.label; if (b.ghost) el.className = 'ghost';
    el.onclick = ev => { ev.stopPropagation(); if (b.url) window.open(b.url, '_blank'); else if (b.tel) location.href = 'tel:' + b.tel; else if (b.act) b.act(); else hideBubble(); };
    box.appendChild(el);
  }
  bubble.hidden = false;
  if (opt.pose) { setPose(opt.pose); P.target = null; P.until = performance.now() + Math.min(opt.ms || 5000, 8000); }
  bubbleT = setTimeout(hideBubble, opt.ms || (opt.buttons && opt.buttons.length ? 20000 : Math.min(12000, 4000 + text.length * 80)));
  if (view !== 'home' && opt.important) go('home');
}
function hideBubble() { bubble.hidden = true; }
bubble.addEventListener('click', e => { if (!e.target.closest('button')) hideBubble(); });

// ── 명령 (PC 와 같은 말)
function doCommand(id) {
  const now = performance.now(); P.target = null; P.until = now + 5000;
  const c = COMMANDS.find(x => x.id === id), line = c ? pick(c.say) : '';
  const map = { sleep: 'sleep', sit: 'sit', lie: 'lie', playdead: 'bang', stand: 'joy', wait: 'sit', no: 'sad', quiet: 'shy', jump: 'jump', down: 'joy', climb: 'jump', paw: 'paw', spin: 'fun',
    stretch: 'stretch', drink: 'drink', meal: 'meal', brush: 'brush', wash: 'wash', laugh: 'laugh', wink: 'wink', good: 'love', bark: 'bark', speak: 'up', call: 'up', hide: 'shy', back: 'walk', slow: 'walk', home: 'joy', free: 'run' };
  if (id === 'run' || id === 'free' || id === 'follow' || id === 'come' || id === 'roll' || id === 'crawl') {
    P.target = id === 'come' || id === 'follow' ? 0.5 : (P.x > 0.5 ? 0.12 : 0.88); P.speed = id === 'crawl' ? 0.05 : id === 'roll' ? 0.12 : 0.3;
    setPose(id === 'roll' ? 'roll' : id === 'crawl' ? 'crawl' : 'run'); P.until = now + 15000;
  } else setPose(map[id] || 'joy');
  if (id === 'quiet') quietUntil = Date.now() + 24 * 3600e3;
  if (id === 'bark' || id === 'speak' || id === 'call') { quietUntil = 0; cry(false); setTimeout(() => cry(false), 900); }
  if (['jump', 'joy', 'good'].includes(id)) fx('hop');
  if (id === 'sleep') P.until = now + 25000;
  if (line) say(esc(line), { ms: 2600 });
}

// ── 말창
const t = $('#t'), modeBtn = $('#modeBtn'); let smode = false, busy = false, lastUser = '', lastSearch = '';
function setSmode(on) { smode = on; document.body.classList.toggle('smode', on); modeBtn.textContent = on ? '🔎' : '♥'; t.placeholder = on ? '무엇이든 찾아볼게…' : `${bn()}에게 말 걸기…`; }
modeBtn.onclick = () => { setSmode(!smode); say(smode ? '🔎 검색창이야! 궁금한 걸 쓰면 찾아서 알려 줄게' : '다시 나랑 이야기하자 🐶', { ms: 2200 }); };
t.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(t.value); } });
function markSign() { patch({ guard: { lastSign: new Date().toISOString() } }); }

function isSearch(text) {
  if (/^(검색|찾아)\s+\S{2,}/.test(text) || /(검색해|찾아\s*(줘|봐|줄래)|날씨|뉴스|가격|맛집|환율|주가|영화|일정|요금|주소|전화번호)/.test(text)) return true;
  if (/^(잘|안녕|좋은|반가|보고|있었|오늘\s*어땠|괜찮|아파|피곤|졸려|배고|사랑|고마|미안|축하)/.test(text)) return false;
  if (/(너|니가|네가|기분|어때|뭐\s*해|뭐하|좋아해|심심|놀자|힘들|슬퍼|행복)/.test(text)) return false;
  return /(알려\s*(줘|줄래)|(이|가|은|는)\s*뭐야|뜻이\s*뭐|누구야|누군지|어디(에|야|있|인)|언제(야|였|예|인|부터|까지|태어)|얼마(야|예|나|에|인)|방법|어떻게\s*(하|해|돼|되)는)/.test(text);
}
async function send(text) {
  text = String(text || '').trim(); if (!text) return;
  t.value = ''; markSign();
  if (window.sosHear && sosHear(text)) return;   // 🚨 도와주세요 (지킴이)
  const em = stripName(text).match(/^(119|112|1394|일일구|일일이|구급차|소방서|경찰)\s*(에|로|번|을|를|좀)?\s*(전화|신고|불러)/);
  if (em && window.sosCall) { sosCall(/^(119|일일구|구급차|소방서)/.test(em[1]) ? '119' : /^(112|일일이|경찰)/.test(em[1]) ? '112' : '1394'); return; }
  if (busy) { say('잠깐만, 아직 생각 중이야 💭', { ms: 2000 }); return; }
  if (smode) { lastSearch = text; return doSearch(text); }
  if (window.pmode && pmode) return pmodeSend(text);
  if (/^(아니[,\s]*)?(너|다루)?(한테|에게)?\s*(한|하는)\s*말이(야|었어|라고)/.test(text) && lastSearch) { const q = lastSearch; lastSearch = ''; return chatWith(q, true); }
  if (/^(그거\s*)?(찾아\s*봐|찾아\s*줘|검색해\s*줘|검색)[!~.?\s]*$/.test(text) && lastUser) { lastSearch = lastUser; return doSearch(lastUser); }
  if (window.peopleTalk && await peopleTalk(text)) return;
  if (await timeTalk(text)) return;
  if (!stripName(text).replace(/[!~?.\s]/g, '') ) { doCommand('call'); return; }
  const cmd = findCommand(stripName(text) || text);
  if (cmd) { doCommand(cmd.id); return; }
  if (isSearch(text)) { lastSearch = text; return doSearch(text); }
  return chatWith(text);
}

// ── 대화 두뇌: AI(내 Claude 열쇠)가 있으면 그걸로, 없으면 기본 말
const SYSTEM = `너는 사용자의 휴대폰 속에 사는 작고 귀여운 강아지 친구야. 앱 이름은 "하루 예보". 다정한 반말로 1~3문장만. #, **, -, 표 같은 기호는 쓰지 마.
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
    const raw = await Promise.race([askAI(history, SYSTEM + `\n지금: ${new Date().toLocaleString('ko-KR')}. 너의 이름: ${bn()}. 사용자 이름: ${S.me.name || '(모름)'}`), new Promise((_, j) => setTimeout(() => j(new Error('timeout')), 40000))]);
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
  try { const a = await askAI([{ role: 'user', content: `질문: ${q}\n\n검색 결과:\n${list.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}`).join('\n\n')}` }], '너는 강아지 친구야. 검색 결과만 근거로 반말 2~4문장으로 쉽게 답해. 기호(#,*,-)는 쓰지 마. 결과에 없으면 모른다고 해.', 500); if (a) ans = a.replace(/[#*]/g, ''); } catch { }
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
let ringing = null;
function ring(a) {
  stopRing(); let n = 0;
  const tickR = () => { n++; setPose('bark'); fx('shake'); cry(false, true); if (navigator.vibrate) navigator.vibrate([300, 150, 300]); };
  ringing = { t: setInterval(tickR, 2300), end: setTimeout(() => stopRing(), 90e3) }; tickR();
  say(HA.alarmLine(a), { pose: 'bark', ms: 90e3, important: true, buttons: [{ label: '알았어! 그만 ✋', act: () => stopRing(pick(['헤헤 잘했어! 🐶', '좋아, 오늘도 화이팅! 💛'])) }, { label: '5분 뒤 다시 ⏰', act: () => { stopRing('알겠어, 5분 뒤에 또 짖을게!'); patch({ alarms: [...S.alarms, { id: uid(), at: Date.now() + 5 * 60e3, label: a.label, kind: a.kind }] }); } }] });
  try { if (Notification.permission === 'granted') new Notification('⏰ 하루 예보', { body: HA.alarmLine(a).replace(/<[^>]+>/g, ''), icon: 'icon-192.png' }); } catch { }
}
function stopRing(msg) { if (!ringing) return; clearInterval(ringing.t); clearTimeout(ringing.end); ringing = null; if (msg) say(msg, { ms: 3000, pose: 'joy' }); else hideBubble(); }
function checkTimes() {
  const now = Date.now(), d = new Date(), ymd = today(d), mins = d.getHours() * 60 + d.getMinutes();
  let changed = false;
  for (const a of S.alarms) { if (a.at > now) continue; if (now - a.at < 30 * 60e3) ring(a); if (a.daily) { while (a.at <= now) a.at += 864e5; } else a.done = true; changed = true; }
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
$('#micBtn').onclick = async () => {
  if (window.Native && Native.listen) { $('#micBtn').classList.add('rec'); say('👂 듣고 있어… 말해 줘!', { pose: 'up', ms: 6000 }); try { const txt = await Native.listen(); if (txt) { say(`👂 "${esc(txt)}"`, { ms: 1500 }); send(txt); } } catch { say('잘 못 들었어 🥲 다시 해 볼래?', { ms: 3000 }); } $('#micBtn').classList.remove('rec'); return; }
  if (!SR) { say('이 휴대폰 브라우저는 말 알아듣기를 못 해 🥲 크롬에서 열어 줘!', { ms: 4000 }); return; }
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = 'ko-KR'; rec.interimResults = false; rec.maxAlternatives = 1;
  $('#micBtn').classList.add('rec'); say('👂 듣고 있어… 말해 줘!', { pose: 'up', ms: 6000 });
  rec.onresult = e => { const txt = e.results[0][0].transcript; say(`👂 "${esc(txt)}"`, { ms: 1500 }); send(txt); };
  rec.onend = () => { $('#micBtn').classList.remove('rec'); rec = null; };
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
function shareApp() { return shareText('하루 예보', '🐶 하루 예보 — 내 휴대폰 속 강아지 친구 (무료)\n가족 안부·119 지킴이·알람·생일 챙기기\n여기서 받아요 👉', GET_URL); }

// ── 시작
function homeInfo() { const g = S.mood.date === today() ? `오늘 마음: ${S.mood.today}` : ''; $('#homeInfo').textContent = g; $('#sky').textContent = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }); }
function boot() {
  setBuddyName(bn()); $('#tabPet').textContent = bn(); setSmode(false);
  setPose('idle'); requestAnimationFrame(tick);
  homeInfo(); setInterval(homeInfo, 60e3);
  setInterval(checkTimes, 10e3); setTimeout(checkTimes, 3000);
  setTimeout(() => say(pick([`${S.me.name ? esc(S.me.name) + '! ' : ''}왔구나! 보고 싶었어 🐶`, '멍! 반가워~', '헤헤 오늘도 같이 놀자!']), { pose: 'joy', ms: 3500 }), 600);
  setTimeout(() => cry(true), 700);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  markSign();
}
window.addEventListener('load', boot);

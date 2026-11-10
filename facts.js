// 💡 상식 정보 (11-10) — 앱 화면(팻방)을 보고 있을 때도 1분마다 상식 한 줄 + 팻 동작
//  화면 위 팻(앱을 닫았을 때)은 안드로이드가 같은 창고(facts/)에서 직접 받아 보여 줌
const FACTS_URL = 'https://yje0807111-eng.github.io/haru-yebo/facts/';
const FX = { q: [], loading: false, tick: 0, poseI: 0 };
async function factsLoad() {
  if (FX.loading) return; FX.loading = true;
  try {
    const idx = await fetch(FACTS_URL + 'index.json', { cache: 'no-cache' }).then(r => r.json());
    const n = Math.max(1, idx.files || 1); S.factFile = ((S.factFile || 0) % n); const f = S.factFile + 1; S.factFile++; save();
    const a = await fetch(FACTS_URL + String(f).padStart(4, '0') + '.json').then(r => r.json());
    const age = S.me.age || 0;
    FX.q.push(...a.filter(e => !age || (age >= (e[1] || 10) && age <= (e[2] || 99))).map(e => e[0]).sort(() => Math.random() - 0.5));
  } catch { }
  FX.loading = false;
}
// 나이에 맞는 영어 단어 (초등·중학교·고등학교 2,800개 중에서)
function engPool() {
  const age = S.me.age || 0, L = [...(window.WORD_LEVELS || []), ...(window.WORD_LEVELS_MID || []), ...(window.WORD_LEVELS_HIGH || [])];
  const pick_ = age && age < 20 ? L.slice(0, 35) : L.slice(20);
  return pick_.flatMap(l => l[1]).map(w => `${w[0]} = ${w[1]}`);
}
window.engList = () => engPool().sort(() => Math.random() - 0.5).slice(0, 200).join('\n');
async function wikiOne() {
  for (let k = 0; k < 4; k++) {
    try {
      const j = await fetch('https://ko.wikipedia.org/api/rest_v1/page/random/summary').then(r => r.json());
      const t = j.title || '', d = j.description || '', x = j.extract || '';
      if (x.length < 30 || /[0-9]/.test(t) || /(정치인|배우|가수|선수|기업인|아나운서|마을|고등학교|중학교|초등학교|대학교|방송|프로그램|드라마|앨범|노래|싱글)/.test(d + x)) continue;
      const i = x.indexOf('다.'); let one = i > 0 ? x.slice(0, i + 2) : x; if (one.length > 110) one = one.slice(0, 108) + '…';
      return `📖 ${one} (위키백과)`;
    } catch { }
  }
  return null;
}
function factPose(ms) {   // 팻 동작은 1분에 하나씩 차례로 전부 (상식은 끊임없이)
  const now = performance.now(); if (FX.poseAt && now - FX.poseAt < 60000) return; FX.poseAt = now;
  const keys = Object.keys(POSES).filter(k => !['idle', 'walk', 'run', 'talk', 'up', 'side', 'gaze'].includes(k));
  setPose(keys[FX.poseI++ % keys.length]); P.target = null; P.until = now + 6000;   // 동작 하나 보여 주고 다시 자유롭게
}
async function factTick() {
  return 60000;   // 11-10 사용자: 앱 안(팻방)에서는 상식 안 띄움 — 메뉴 말창이 계속 떠 있어야 함. 상식은 화면 위 팻(앱 닫았을 때)만
  if (S.talk.facts === false || document.hidden || view !== 'home' || (!bubble.hidden && !FX.mine) || (window.PONG && PONG.on) || (window.STU && STU.on)) return 4000;
  if (FX.q.length < 10) factsLoad();
  const k = FX.tick++ % 6, age = S.me.age || 0;
  let text = null;
  const wikiK = [];   // 11-10 사용자: 위키백과는 뺌 — 내가 준비한 상식 + 영어만
  if (k === 2) { const p = engPool(); if (p.length) text = '🇺🇸 오늘의 영어: ' + pick(p); }
  else if (wikiK.includes(k)) text = await wikiOne();
  if (!text) text = FX.q.shift();
  if (!text) return 3000;
  const ms = Math.max(7000, Math.min(14000, 5000 + text.length * 110));   // 읽을 시간만큼 보여 주고 바로 다음 (끊임없이)
  say(esc(text), { ms }); factPose(ms); return ms + 4000;
}
(function loop() { Promise.resolve(factTick()).then(ms => setTimeout(loop, ms || 4000), () => setTimeout(loop, 5000)); })(); setTimeout(() => { factsLoad(); }, 1500);
// 처음엔 팻 소리가 0 → 다섯 번째 열 때 짖는 소리가 있다고 한 번 알려 주기
setTimeout(() => {
  S.opens = (S.opens || 0) + 1; save();
  if (S.opens === 5 && !(S.talk.volume > 0) && !S.volTip) { S.volTip = 1; save(); say('🔊 우리 팻은 짖는 소리도 낼 수 있어요!<br><span class="note small">⚙️ 설정 → 🔊 짖는 소리 크기에서 켜 보세요</span>', { ms: 12000, buttons: [{ label: '⚙️ 설정 열기', act: () => { hideBubble(); openView('set'); } }] }); }
}, 6000);

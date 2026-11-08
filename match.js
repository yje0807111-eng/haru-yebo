// 💞 소개팅 (11-08): 팻과 수다로 나를 소개하고, 찾는 사람(연인·친구)을 말하면 '마음 카드'로 저장
//  서로 찾는 사람끼리 둘 다 좋다고 하면 1:1 로 이어 줌 (이어 주기는 서버를 붙이는 다음 단계)
//  카드는 이 휴대폰 안에만 저장
const MT_HOBBY = ['게임', '게임 만들기', '운동', '헬스', '달리기', '축구', '등산', '자전거', '음악', '노래방', '영화', '드라마', '여행', '맛집', '카페', '독서', '그림', '사진', '요리', '반려동물', '교회'];
const MT_TIME = ['평일 낮', '평일 저녁', '밤늦게도 괜찮아', '주말 낮', '주말 저녁'];
const MT_AGE = ['10대', '20대 초반', '20대 후반', '30대', '40대', '50대 이상'];
const MBTI_ALL = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'];
// 재미로 많이 말하는 '잘 맞는 짝' (과학적인 것은 아니에요)
const MBTI_GOOD = { INFP: ['ENFJ', 'ENTJ'], ENFP: ['INFJ', 'INTJ'], INFJ: ['ENFP', 'ENTP'], ENFJ: ['INFP', 'ISFP'], INTJ: ['ENFP', 'ENTP'], ENTJ: ['INFP', 'INTP'], INTP: ['ENTJ', 'ESTJ'], ENTP: ['INFJ', 'INTJ'], ISFP: ['ENFJ', 'ESFJ'], ESFP: ['ISFJ', 'ISTJ'], ISTP: ['ESFJ', 'ESTJ'], ESTP: ['ISFJ', 'ISTJ'], ISFJ: ['ESFP', 'ESTP'], ESFJ: ['ISFP', 'ISTP'], ISTJ: ['ESFP', 'ESTP'], ESTJ: ['INTP', 'ISTP'] };
// 성격 4글자 알아보기 — 우리가 만든 문답 12개 (축마다 3개)
const MBTI_Q = [
  ['EI', '주말에 쉬는 방법은?', '친구 만나서 놀기', '집에서 혼자 쉬기'],
  ['SN', '영화를 보고 나면 기억나는 건?', '장면과 대사', '숨은 뜻과 상상'],
  ['TF', '친구가 고민을 말하면?', '해결 방법부터 말해 줘', '마음부터 들어 줘'],
  ['JP', '여행 갈 때 나는?', '계획표부터 짜', '가서 정해'],
  ['EI', '처음 만난 사람들 사이에서 나는?', '먼저 말을 거는 편', '듣다가 천천히'],
  ['SN', '새 일을 배울 때?', '해 본 사람 방법대로', '내 방식으로 새롭게'],
  ['TF', '결정할 때 더 중요한 건?', '맞고 틀림', '사람 마음'],
  ['JP', '숙제나 일은?', '미리 끝내', '마감 직전에 몰아서'],
  ['EI', '힘이 충전되는 때는?', '사람들과 있을 때', '혼자 있을 때'],
  ['SN', '이야기할 때 나는?', '있었던 일 그대로', '비유와 아이디어로'],
  ['TF', '들으면 더 기분 좋은 말은?', '잘했다, 똑똑하다', '고마워, 따뜻하다'],
  ['JP', '방 정리는?', '늘 정리돼 있어', '필요할 때 한 번에'],
];
function MS() {
  S.match = S.match || {};
  const m = S.match; m.me = m.me || {}; m.love = m.love || {}; m.friend = m.friend || {}; m.chat = m.chat || []; return m;
}
// 질문들: k = 저장할 곳, t = 질문, c = 고르기, multi = 여러 개, free = 글로만, skip = 건너뛰기 단추, when = 물어볼 때만
const MQ = {
  me: [
    { k: 'age', t: '먼저 너에 대해 알려 줘! 몇 살쯤이야?', c: MT_AGE },
    { k: 'gender', t: '성별은?', c: ['남자', '여자', '말하기 싫어'] },
    { k: 'area', t: '주로 어느 동네에서 지내? (구 정도만, 예: 광진구)', free: true, skip: '말하기 싫어' },
    { k: 'work', t: '요즘 무엇을 하며 지내?', c: ['학생', '회사원', '개발자', '자영업', '쉬는 중'] },
    { k: 'hobby', t: '좋아하는 걸 다 골라 줘! (없으면 글로 써도 돼)', c: MT_HOBBY, multi: true },
    { k: 'temper', t: '성격은 어느 쪽이야?', c: ['활발해', '차분해', '그때그때 달라'] },
    { k: 'mbti', t: 'MBTI 알아? 알면 써 주고, 모르면 내가 알아봐 줄게!', c: ['몰라, 알아봐 줘', ...MBTI_ALL], mbti: true },
    { k: 'time', t: '보통 언제 시간이 돼?', c: MT_TIME, multi: true },
    { k: 'intro', t: '마지막으로 너를 한 줄로 소개해 줘!', free: true, skip: '나중에' },
  ],
  love: [
    { l: '성별', k: 'gender', t: '어떤 사람을 만나고 싶어? 먼저 성별은?', c: ['남자', '여자'] },
    { l: '나이', k: 'age', t: '나이는 어느 쪽이 좋아?', c: MT_AGE.filter(a => a !== '10대').concat(['상관없어']), multi: true },
    { l: '성격', k: 'temper', t: '성격은?', c: ['활발한 사람', '차분한 사람', '상관없어'] },
    { l: '같이 할 것', k: 'hobby', t: '같이 하고 싶은 건?', c: MT_HOBBY, multi: true },
    { l: '중요한 것', k: 'life', t: '만나는 시간이 맞으면 좋겠지? 중요한 걸 골라 줘', c: ['저녁에도 자유롭게 만날 수 있는 사람', '주말에 시간 되는 사람', '가까운 동네', '상관없어'], multi: true },
    { l: 'MBTI', k: 'mbti', t: 'MBTI 바라는 거 있어?', c: ['상관없어', '나랑 잘 맞는 유형', ...MBTI_ALL], multi: true },
    { l: '바라는 것', k: 'more', t: '꼭 바라는 게 있으면 자유롭게 말해 줘!', free: true, skip: '없어' },
  ],
  friend: [
    { l: '찾는 친구', k: 'what', t: '어떤 친구를 찾아?', c: ['게임 같이 만들 사람', '게임 같이 할 사람', '운동 친구', '취미 친구', '공부·스터디', '그냥 말동무'], multi: true },
    { l: '내 역할', k: 'role', t: '게임을 만들 때 너는 어떤 걸 맡고 싶어?', c: ['프로그래밍', '기획', '그림·디자인', '음악·소리', '다 해 볼래'], multi: true, when: a => /게임 같이 만들/.test(a.what || '') },
    { l: '필요한 사람', k: 'need', t: '팀에 어떤 사람이 필요해?', c: ['프로그래밍', '기획', '그림·디자인', '음악·소리', '아직 몰라'], multi: true, when: a => /게임 같이 만들/.test(a.what || '') },
    { l: '나이', k: 'age', t: '친구 나이는?', c: ['비슷한 나이', '상관없어'] },
    { l: '만남', k: 'meet', t: '온라인으로만? 직접 만나도 돼?', c: ['온라인만', '가까우면 만나도 좋아'] },
    { l: '바라는 것', k: 'more', t: '더 바라는 게 있으면 말해 줘!', free: true, skip: '없어' },
  ],
};
let MT = null;   // 지금 대화: { part:'me'|'love'|'friend', i, sel:[], quiz:{i, s:{E:0..}} , after }
function openMatch(quiz) {
  window.wantViewAt = Date.now(); { const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet; if (document.hidden && F && F.front) F.front().catch(() => { }); }
  hideBubble(); petOnly(false); go('match');
  if (quiz) { MT = { part: 'me', i: MQ.me.findIndex(q => q.mbti), sel: [], after: 'card', solo: true }; MS().chat = []; mtQuizStart(); }
}
function drawMatch() {
  const m = MS(), box = $('#matchBox'); if (!box) return;
  const hasMe = m.me.age && m.me.gender;
  if (MT) return mtDrawChat();
  box.innerHTML = `
  <div class="mhero"><b>팻이 이어 주는 소개팅</b><span>나를 소개하고 어떤 사람을 찾는지 말해 주면, 서로 찾는 사람끼리 <b>둘 다 좋다고 할 때만</b> 1:1 대화를 열어 줘요.</span></div>
  <div class="mdoors">
    <button data-mt="love"><i>💛</i><b>연인 찾기</b><small>19세 이상</small></button>
    <button data-mt="friend"><i>🤝</i><b>친구 찾기</b><small>게임 개발 · 운동 · 취미</small></button>
  </div>
  ${hasMe ? mtCardHtml() : ''}
  <div class="card"><h3>🧩 성격 4글자 (MBTI)</h3><p class="note">${m.me.mbti ? `너는 <b>${esc(m.me.mbti)}</b>야. 잘 맞는다고 알려진 유형: <b>${(MBTI_GOOD[m.me.mbti] || []).join(', ') || '-'}</b>` : '모르면 팻이 문답 12개로 알아봐 줘요.'}</p>
    <button class="btn ghost" data-mt="quiz" style="width:100%">${m.me.mbti ? '🔄 다시 알아보기' : '🧩 알아보기'}</button></div>
  <p class="note small" style="text-align:center">카드는 이 휴대폰에만 저장돼요. 찾아 달라고 할 때만 마음 카드를 보여 줘요.</p>`;
}
function mtList(v) { return Array.isArray(v) ? v.join(', ') : (v || ''); }
function mtCardHtml() {
  const m = MS(), me = m.me, row = (k, v) => v ? `<div class="mrow"><span>${k}</span><b>${esc(mtList(v))}</b></div>` : '';
  const want = (part, title) => { const a = m[part]; if (!a || !Object.keys(a).length) return ''; return `<div class="mwant"><h4>${title} <button class="lnk" data-mt="${part}">고치기</button></h4>${MQ[part].map(q => row(q.l, a[q.k])).join('')}</div>`; };
  return `<div class="card mcard"><h3>🪪 나의 마음 카드 <button class="lnk" data-mt="me">고치기</button></h3>
    ${row('나이', me.age)}${row('성별', me.gender)}${row('동네', me.area)}${row('하는 일', me.work)}${row('좋아하는 것', me.hobby)}${row('성격', me.temper)}${row('MBTI', me.mbti)}${row('시간', me.time)}${me.intro ? `<p class="mintro">"${esc(me.intro)}"</p>` : ''}
    ${want('love', '💛 찾는 연인')}${want('friend', '🤝 찾는 친구')}
    <button class="btn" data-mt="seek" style="width:100%;margin-top:10px">${m.seek ? '✅ 찾는 중 · 멈추기' : '🔎 이런 사람 찾아 줘'}</button></div>`;
}
// ── 대화
function mtStart(part) {
  const m = MS();
  if (part !== 'me' && !(m.me.age && m.me.gender)) { MT = { part: 'me', i: 0, sel: [], after: part }; m.chat = [{ who: 'pet', text: part === 'love' ? '좋아, 연인 찾기! 💛 먼저 너에 대해 조금 알려 줘.' : '좋아, 친구 찾기! 🤝 먼저 너에 대해 조금 알려 줘.' }]; }
  else { MT = { part, i: 0, sel: [], after: 'card' }; m.chat = [{ who: 'pet', text: part === 'me' ? '좋아, 다시 알려 줘!' : part === 'love' ? '어떤 사람을 찾는지 들려줘 💛' : '어떤 친구를 찾는지 들려줘 🤝' }]; }
  if (MT.part === 'love' && m.me.age === '10대') { MT = null; say('연인 찾기는 19세 이상만 할 수 있어. 친구 찾기는 돼! 🤝', { ms: 5000 }); drawMatch(); return; }
  mtAsk();
}
function mtQ() { if (!MT) return null; const list = MQ[MT.part]; while (MT.i < list.length && list[MT.i].when && !list[MT.i].when(MS()[MT.part])) MT.i++; return list[MT.i] || null; }
function mtAsk() {
  const q = mtQ();
  if (!q) return mtNextPart();
  MT.sel = [];
  const m = MS(); const prev = m[MT.part][q.k];
  m.chat.push({ who: 'pet', text: q.t }); mtDrawChat();
  if (prev && q.multi) MT.sel = [].concat(prev);
}
function mtNextPart() {
  const m = MS(), after = MT.after;
  if (MT.part === 'me' && (after === 'love' || after === 'friend')) {
    if (after === 'love' && m.me.age === '10대') { MT = null; save(); say('연인 찾기는 19세 이상만 할 수 있어. 친구 찾기는 돼! 🤝', { ms: 5000 }); return drawMatch(); }
    MT = { part: after, i: 0, sel: [], after: 'card' }; m.chat.push({ who: 'pet', text: after === 'love' ? '고마워! 이제 어떤 사람을 찾는지 들려줘 💛' : '고마워! 이제 어떤 친구를 찾는지 들려줘 🤝' }); save(); return mtAsk();
  }
  MT = null; save();
  say('🪪 마음 카드를 만들었어! 아래에서 확인해 봐. "이런 사람 찾아 줘"를 누르면 찾기 시작할게 💞', { pose: 'joy', ms: 7000 });
  drawMatch();
}
function mtAnswer(v) {
  const q = mtQ(); if (!q) return;
  const m = MS(); v = Array.isArray(v) ? v : String(v || '').trim(); if (!v || (Array.isArray(v) && !v.length)) return;
  if (q.mbti && !Array.isArray(v)) {
    const up = v.toUpperCase().replace(/[^A-Z]/g, '');
    if (/몰라|알아봐/.test(v)) { m.chat.push({ who: 'me', text: v }); return mtQuizStart(); }
    if (MBTI_ALL.includes(up)) v = up;
  }
  m[MT.part][q.k] = v; m.chat.push({ who: 'me', text: mtList(v) });
  if (MT.part === 'me' && q.k === 'age' && v === '10대') m.chat.push({ who: 'pet', text: '10대는 친구 찾기만 할 수 있어 🙂' });
  MT.i++; save(); mtAsk();
}
function mtQuizStart() {
  MT.quiz = { i: 0, s: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 } };
  MS().chat.push({ who: 'pet', text: '좋아! 짧은 문답 12개야. 마음에 가까운 쪽을 골라 줘 🧩' });
  mtQuizAsk();
}
function mtQuizAsk() {
  const z = MT.quiz, q = MBTI_Q[z.i];
  if (!q) {
    const s = z.s, r = (s.E >= s.I ? 'E' : 'I') + (s.S >= s.N ? 'S' : 'N') + (s.T >= s.F ? 'T' : 'F') + (s.J >= s.P ? 'J' : 'P');
    MT.quiz = null; MS().me.mbti = r;
    MS().chat.push({ who: 'pet', text: `너는 <b>${r}</b> 쪽이야! 🎉 잘 맞는다고 알려진 유형은 ${(MBTI_GOOD[r] || []).join(', ')}야. (재미로 보는 거야)` });
    save();
    if (MT.solo) { MT = null; say(`🧩 너는 <b>${r}</b>! 잘 맞는다고 알려진 유형: ${(MBTI_GOOD[r] || []).join(', ')}`, { pose: 'joy', ms: 7000 }); return drawMatch(); }
    MT.i++; return mtAsk();
  }
  MS().chat.push({ who: 'pet', text: `(${z.i + 1}/12) ${q[1]}` }); mtDrawChat();
}
function mtQuizPick(a) {
  const z = MT.quiz, q = MBTI_Q[z.i]; if (!q) return;
  z.s[a ? q[0][1] : q[0][0]]++; MS().chat.push({ who: 'me', text: a ? q[3] : q[2] }); z.i++; mtQuizAsk();
}
function mtDrawChat() {
  const box = $('#matchBox'); if (!box) return;
  const m = MS(), q = MT && !MT.quiz ? mtQ() : null, z = MT && MT.quiz, zq = z && MBTI_Q[z.i];
  const msgs = m.chat.slice(-30).map(c => `<div class="mmsg m-${c.who}">${c.who === 'pet' ? c.text : esc(c.text)}</div>`).join('');
  let opts = '';
  if (zq) opts = `<div class="mopts two"><button data-mq="0">${esc(zq[2])}</button><button data-mq="1">${esc(zq[3])}</button></div>`;
  else if (q && q.c) opts = `<div class="mopts">${q.c.map(c => `<button data-mc="${esc(c)}" class="${MT.sel.includes(c) ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>${q.multi ? `<button class="btn" data-mt="done" style="width:100%;margin-top:8px" ${MT.sel.length ? '' : 'disabled'}>다 골랐어 (${MT.sel.length})</button>` : ''}`;
  if (q && q.skip) opts += `<div class="mopts"><button data-mc="${esc(q.skip)}" class="ghost">${esc(q.skip)}</button></div>`;
  box.innerHTML = `<div class="mchat" id="mChat">${msgs}</div>
    <div class="mans">${opts}
      ${zq ? '' : `<div class="mrowin"><input id="mIn" placeholder="${q && q.free ? '여기에 써 줘…' : '글로 써도 돼…'}" enterkeyhint="send" autocomplete="off">${window.Native && Native.listen ? '<button class="mmic" data-mt="mic">🎤</button>' : ''}<button class="btn" data-mt="send">보내기</button></div>`}
      <button class="lnk" data-mt="stop" style="display:block;margin:8px auto 0">그만하기</button></div>`;
  const ch = $('#mChat'); if (ch) ch.scrollTop = ch.scrollHeight;
}
document.addEventListener('click', async e => {
  const t = e.target.closest && e.target.closest('#matchBox [data-mt], #matchBox [data-mc], #matchBox [data-mq]'); if (!t) return;
  const m = MS();
  if (t.dataset.mq != null) return mtQuizPick(t.dataset.mq === '1');
  if (t.dataset.mc != null) {
    const q = mtQ(), v = t.dataset.mc;
    if (q && q.multi && !(q.skip && v === q.skip)) { MT.sel = MT.sel.includes(v) ? MT.sel.filter(x => x !== v) : MT.sel.concat(v); if (v === '상관없어') MT.sel = ['상관없어']; else MT.sel = MT.sel.filter(x => x !== '상관없어'); return mtDrawChat(); }
    return mtAnswer(v);
  }
  const a = t.dataset.mt;
  if (a === 'love' || a === 'friend' || a === 'me') return mtStart(a);
  if (a === 'quiz') { MT = { part: 'me', i: MQ.me.findIndex(q => q.mbti), sel: [], after: 'card', solo: true }; m.chat = []; return mtQuizStart(); }
  if (a === 'done') return mtAnswer(MT.sel.slice());
  if (a === 'send') { const v = $('#mIn').value.trim(); if (!v) return; const q = mtQ(); return mtAnswer(q && q.multi ? v.split(/[,，、]\s*|\s+그리고\s+/).filter(Boolean).concat(MT.sel.filter(x => !v.includes(x))) : v); }
  if (a === 'mic') { t.classList.add('rec'); let v = ''; try { v = await Native.listen(); } catch { } t.classList.remove('rec'); if (v) { const inp = $('#mIn'); if (inp) inp.value = v; } return; }
  if (a === 'stop') { MT = null; save(); return drawMatch(); }
  if (a === 'seek') {
    if (!m.seek && !(Object.keys(m.love).length || Object.keys(m.friend).length)) { say('먼저 💛 연인 찾기나 🤝 친구 찾기로 어떤 사람을 찾는지 알려 줘!', { ms: 4000 }); return; }
    m.seek = !m.seek; save(); drawMatch();
    say(m.seek ? '💞 찾기 시작했어! 마음이 맞는 사람이 있으면 둘 다 좋다고 할 때 1:1 대화를 열어 줄게.' : '찾기를 멈췄어. 다시 누르면 이어서 찾아.', { pose: 'joy', ms: 6000 });
  }
});
document.addEventListener('keydown', e => { if (e.target.id === 'mIn' && e.key === 'Enter') { const b = document.querySelector('#matchBox [data-mt="send"]'); if (b) b.click(); } });
// 말: "소개팅", "친구 찾아 줘", "애인 찾아 줘", "MBTI 알아봐 줘"
function matchTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').trim();
  if (/(MBTI|엠비티아이|성격\s*유형)/i.test(t) && /(알아|검사|테스트|해\s*줘|뭐야|봐\s*줘)/.test(t)) { openMatch(true); return true; }
  if (/^소개팅/.test(t) || /(연인|애인|여자\s*친구|남자\s*친구|여친|남친|이성|친구)\s*(좀\s*)?(찾아|소개|구해|만나고\s*싶)/.test(t)) { openMatch(false); return true; }
  return false;
}
window.matchTalk = matchTalk;

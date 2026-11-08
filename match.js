// 💞 소개팅 (11-08): 처음 한 번 팻에게 나를 소개(MBTI까지) → 팻만 기억(어디에도 안 보임)
//  연인 찾기 · 친구 찾기 · 구인·구직 체크 = 찾는 중 / 끄면 멈춤 · 말로 "연인 찾아 줘", "소개팅 그만"
//  서로 맞는 사람이 생기면 팻이 중매하듯 알려 주고, 둘 다 좋다고 하면 여기 대화방에서 1:1 채팅 (이어 주기 = 다음 단계 서버)
const MT_HOBBY = ['게임', '게임 만들기', '운동', '헬스', '달리기', '축구', '등산', '자전거', '음악', '노래방', '영화', '드라마', '여행', '맛집', '카페', '독서', '그림', '사진', '요리', '반려동물', '교회'];
const MT_TIME = ['평일 낮', '평일 저녁', '밤늦게도 괜찮아', '주말 낮', '주말 저녁'];
const MT_AGE = ['10대', '20대 초반', '20대 후반', '30대', '40대', '50대 이상'];
const MBTI_ALL = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'];
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
const MKIND = { love: ['💛', '연인 찾기', '19세 이상'], friend: ['🤝', '친구 찾기', '게임 개발 · 운동 · 취미'], job: ['💼', '구인 · 구직', '사람 구하기 · 일자리 찾기'] };
function MS() {
  S.match = S.match || {};
  const m = S.match; for (const k of ['me', 'love', 'friend', 'job', 'on']) m[k] = m[k] || {}; m.rooms = m.rooms || []; m.chat = m.chat || []; return m;
}
const meDone = () => !!MS().me.done;
// 질문들: l = 이름, k = 저장할 곳, t = 질문, c = 고르기, multi = 여러 개, free = 글로만, skip = 건너뛰기, when = 이럴 때만
const MQ = {
  me: [
    { l: '나이', k: 'age', t: '몇 살쯤이야?', c: MT_AGE },
    { l: '성별', k: 'gender', t: '성별은?', c: ['남자', '여자', '말하기 싫어'] },
    { l: '동네', k: 'area', t: '주로 어느 동네에서 지내? (구 정도만, 예: 광진구)', free: true, skip: '말하기 싫어' },
    { l: '하는 일', k: 'work', t: '요즘 무엇을 하며 지내?', c: ['학생', '회사원', '개발자', '자영업', '쉬는 중'] },
    { l: '좋아하는 것', k: 'hobby', t: '좋아하는 걸 다 골라 줘! (없으면 글로 써도 돼)', c: MT_HOBBY, multi: true },
    { l: '성격', k: 'temper', t: '성격은 어느 쪽이야?', c: ['활발해', '차분해', '그때그때 달라'] },
    { l: 'MBTI', k: 'mbti', t: 'MBTI 알아? 알면 골라 주고, 모르면 내가 알아봐 줄게!', c: ['몰라, 알아봐 줘', ...MBTI_ALL], mbti: true },
    { l: '시간', k: 'time', t: '보통 언제 시간이 돼?', c: MT_TIME, multi: true },
    { l: '한 줄 소개', k: 'intro', t: '마지막으로 너를 한 줄로 소개해 줘!', free: true, skip: '나중에' },
  ],
  love: [
    { k: 'gender', t: '어떤 사람을 만나고 싶어? 먼저 성별은?', c: ['남자', '여자'] },
    { k: 'age', t: '나이는 어느 쪽이 좋아?', c: MT_AGE.filter(a => a !== '10대').concat(['상관없어']), multi: true },
    { k: 'temper', t: '성격은?', c: ['활발한 사람', '차분한 사람', '상관없어'] },
    { k: 'life', t: '만나는 시간이 맞으면 좋겠지? 중요한 걸 골라 줘', c: ['저녁에도 자유롭게 만날 수 있는 사람', '주말에 시간 되는 사람', '가까운 동네', '상관없어'], multi: true },
    { k: 'more', t: '꼭 바라는 게 있으면 말해 줘!', free: true, skip: '없어' },
  ],
  friend: [
    { k: 'what', t: '어떤 친구를 찾아?', c: ['게임 같이 만들 사람', '게임 같이 할 사람', '운동 친구', '취미 친구', '공부·스터디', '그냥 말동무'], multi: true },
    { k: 'role', t: '게임을 만들 때 너는 어떤 걸 맡고 싶어?', c: ['프로그래밍', '기획', '그림·디자인', '음악·소리', '다 해 볼래'], multi: true, when: a => /게임 같이 만들/.test(a.what || '') },
    { k: 'need', t: '팀에 어떤 사람이 필요해?', c: ['프로그래밍', '기획', '그림·디자인', '음악·소리', '아직 몰라'], multi: true, when: a => /게임 같이 만들/.test(a.what || '') },
    { k: 'meet', t: '온라인으로만? 직접 만나도 돼?', c: ['온라인만', '가까우면 만나도 좋아'] },
  ],
  job: [
    { k: 'type', t: '사람을 구해, 일자리를 찾아?', c: ['사람을 구해요', '일자리를 찾아요'] },
    { k: 'field', t: '어떤 일이야?', c: ['게임 개발', '개발·IT', '디자인', '음악·영상', '가게·서비스', '사무', '배달·운전', '아르바이트'], multi: true },
    { k: 'form', t: '어떤 방식이 좋아?', c: ['정규직', '아르바이트', '프로젝트·외주', '함께 창업'], multi: true },
    { k: 'where', t: '어디서?', c: ['우리 동네 근처', '서울 어디든', '온라인·재택', '상관없어'] },
    { k: 'more', t: '더 알려 줄 게 있으면 말해 줘!', free: true, skip: '없어' },
  ],
};
let MT = null;   // 지금 대화: { part, i, sel:[], then: 켤 찾기(kind)|null, quiz, solo }
function openMatch(quiz) {
  window.wantViewAt = Date.now(); { const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet; if (document.hidden && F && F.front) F.front().catch(() => { }); }
  hideBubble(); petOnly(false); if (view !== 'match') go('match');
  if (quiz) { mtBegin({ part: 'me', i: MQ.me.findIndex(q => q.mbti), sel: [], solo: true }); MS().chat = []; mtQuizStart(); }
}
function mtBegin(o) { MT = o; navPush(() => { if (MT && MT.end) { NAV.push(() => { }); return mtFinOk(); } MT = null; drawMatch(); }); }   // 휴대폰 뒤로 가기 = 대화 그만, 소개팅 첫 화면으로
function drawMatch() {
  const m = MS(), box = $('#matchBox'); if (!box) return;
  if (MT) return mtDrawChat();
  if (!meDone()) {
    box.innerHTML = `<div class="mhero"><b>먼저 너에 대해 알려 줘 💞</b><span>처음 한 번만 물어볼게. 들은 이야기는 <b>나만 기억하고</b> 아무에게도 보여 주지 않아. 그다음엔 네게 맞는 사람을 내가 찾아 줄게.</span></div>
      <button class="btn" data-mt="me" style="width:100%;padding:14px">✍️ 나를 소개하기</button>`;
    return;
  }
  const rows = Object.entries(MKIND).map(([k, [ic, name, sub]]) => `<label class="mchk"><i>${ic}</i><span><b>${name}</b><small>${sub}</small></span><input type="checkbox" data-mk="${k}" ${m.on[k] ? 'checked' : ''}><em></em></label>`).join('');
  const rooms = m.rooms.length ? m.rooms.map((r, i) => `<button class="mroom" data-mr="${i}"><b>${esc(r.name)}</b><small>${esc(r.last || '')}</small></button>`).join('')
    : '<p class="note" style="text-align:center;margin:10px 0">아직 이어진 사람이 없어요.<br>서로 좋다고 하면 여기서 둘이 이야기할 수 있어요.</p>';
  box.innerHTML = `${m.note ? `<div class="mmsg m-pet mnote">${m.note}</div>` : ''}<div class="card"><h3>무엇을 찾아 줄까?</h3>${rows}<p class="note small" style="margin-top:8px">체크하면 찾아 주고, 끄면 멈춰요. 말로 "연인 찾아 줘", "소개팅 그만"도 돼요.</p></div>
    <div class="card"><h3>💬 대화방</h3>${rooms}</div>
    <div style="text-align:center"><button class="lnk" data-mt="me">내 소개 다시 하기</button></div>`;
}
// 팻이 한 말: 소개팅 화면 위에 남기고, 화면 위 팻(앱이 뒤에 있을 때)에도
function mtTell(text, pose) { MS().note = text; save(); if (view === 'match') drawMatch(); say(text, { pose, ms: 8000 }); }
// 찾기 켜기·끄기
function mtSet(kind, on, fromVoice) {
  const m = MS();
  if (on && !meDone()) { if (fromVoice) openMatch(false); mtStart('me', kind); return; }
  if (on && kind === 'love' && m.me.age === '10대') { say('연인 찾기는 19세 이상만 할 수 있어. 친구 찾기는 돼! 🤝', { ms: 5000 }); return drawMatch(); }
  if (on && !Object.keys(m[kind]).length) { if (fromVoice) openMatch(false); mtStart(kind, kind); return; }
  m.on[kind] = !!on;
  const name = MKIND[kind][1];
  mtTell(on ? `💞 ${name} 시작할게! 아직 하루 예보에 사람이 많지 않아서 조금 기다려 줘. 맞는 사람이 생기면 하나씩 알려 줄게.` : `${name}는 멈췄어. 다시 켜면 이어서 찾아 줄게.`, on ? 'joy' : 'talk');
}
// ── 대화로 묻기
function mtStart(part, then) {
  const m = MS();
  mtBegin({ part, i: 0, sel: [], then: then && then !== 'me' ? then : null });
  m.chat = [{ who: 'pet', text: part === 'me' ? '좋아! 너에 대해 알려 줘. 나만 기억하고 있을게 🤫' : part === 'love' ? '어떤 사람을 찾는지 들려줘 💛' : part === 'friend' ? '어떤 친구를 찾는지 들려줘 🤝' : '구인·구직, 어떤 걸 찾아? 💼' }];
  mtAsk();
}
function mtQ() { if (!MT) return null; const list = MQ[MT.part]; while (MT.i < list.length && list[MT.i].when && !list[MT.i].when(MS()[MT.part])) MT.i++; return list[MT.i] || null; }
function mtAsk() {
  const q = mtQ();
  if (!q) return mtPartDone();
  MT.sel = [];
  MS().chat.push({ who: 'pet', text: q.t }); mtDrawChat();
}
function mtPartDone() {
  const m = MS(), part = MT.part, then = MT.then;
  if (part === 'me') {
    m.me.done = true; save();
    if (then && !Object.keys(m[then]).length) { MT = { part: then, i: 0, sel: [], then }; m.chat.push({ who: 'pet', text: '고마워! 🤫 이건 나만 기억하고 있을게.' }); return mtAsk(); }
    if (then) return mtFinish(then);
    return mtFinish(null);
  }
  mtFinish(part);
}
// 🏁 물어보기가 다 끝나면: 끝났다고 분명히 말하고 [알겠어] 로 마무리 (11-08)
function mtFinish(kind) {
  const m = MS();
  if (kind === 'love' && m.me.age === '10대') kind = null;
  const what = kind ? MKIND[kind][1].replace(' 찾기', '').replace(' · ', '·') : '';
  m.chat.push({ who: 'pet', text: kind
    ? `다 들었어! 고마워 💞<br>이제 너에게 맞는 ${kind === 'job' ? '사람이나 일자리' : what === '연인' ? '사람' : '친구'}가 있으면, <b>나를 화면에 켜 두기만 하면</b> 내가 찾아서 알려 줄게.<br>아직 하루 예보에 사람이 많지 않아서 조금 걸릴 수 있어. 기다려 줘 🐾`
    : '고마워! 🤫 이건 나만 기억하고 있을게.<br>이제 <b>연인 찾기 · 친구 찾기 · 구인·구직</b> 중에 켜기만 하면, 나를 화면에 켜 두는 동안 맞는 사람을 찾아서 알려 줄게 💞' });
  MT.end = { kind }; save(); mtDrawChat();
  if (document.hidden) say(m.chat[m.chat.length - 1].text, { ms: 12000 });
}
function mtFinOk() {
  const kind = MT && MT.end && MT.end.kind; MT = null; NAV.pop();
  const m = MS(); if (kind) m.on[kind] = true;
  m.note = kind ? `💞 ${MKIND[kind][1]} 하는 중이야. 맞는 사람이 생기면 알려 줄게!` : '🤫 나만 기억하고 있을게. 찾고 싶은 걸 켜 줘!';
  save(); drawMatch();
}
function mtAnswer(v) {
  const q = mtQ(); if (!q) return;
  const m = MS(); v = Array.isArray(v) ? v : String(v || '').trim(); if (!v || (Array.isArray(v) && !v.length)) return;
  if (q.mbti && !Array.isArray(v)) {
    if (/몰라|알아봐/.test(v)) { m.chat.push({ who: 'me', text: v }); return mtQuizStart(); }
    const up = v.toUpperCase().replace(/[^A-Z]/g, ''); if (MBTI_ALL.includes(up)) v = up;
  }
  m[MT.part][q.k] = v; m.chat.push({ who: 'me', text: Array.isArray(v) ? v.join(', ') : v });
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
    MT.quiz = null; MS().me.mbti = r; save();
    if (MT.solo) { MT = null; NAV.pop(); mtTell(`🧩 너는 <b>${r}</b> 쪽이야! 잘 맞는다고 알려진 유형은 ${(MBTI_GOOD[r] || []).join(', ')}야. (재미로 보는 거야)`, 'joy'); return; }
    MS().chat.push({ who: 'pet', text: `너는 <b>${r}</b> 쪽이야! 🎉 잘 맞는다고 알려진 유형은 ${(MBTI_GOOD[r] || []).join(', ')}야. (재미로 보는 거야)` });
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
  const m = MS(), z = MT && MT.quiz, zq = z && MBTI_Q[z.i], q = MT && !z && !MT.end ? mtQ() : null;
  const msgs = m.chat.slice(-30).map(c => `<div class="mmsg m-${c.who}">${c.who === 'pet' ? c.text : esc(c.text)}</div>`).join('');
  let opts = '';
  if (zq) opts = `<div class="mopts two"><button data-mq="0">${esc(zq[2])}</button><button data-mq="1">${esc(zq[3])}</button></div>`;
  else if (q && q.c) opts = `<div class="mopts">${q.c.map(c => `<button data-mc="${esc(c)}" class="${MT.sel.includes(c) ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>${q.multi ? `<button class="btn" data-mt="done" style="width:100%;margin-top:8px" ${MT.sel.length ? '' : 'disabled'}>다 골랐어 (${MT.sel.length})</button>` : ''}`;
  if (q && q.skip) opts += `<div class="mopts"><button data-mc="${esc(q.skip)}" class="ghost">${esc(q.skip)}</button></div>`;
  if (MT && MT.end) { box.innerHTML = `<div class="mchat" id="mChat">${msgs}</div><div class="mans"><button class="btn" data-mt="fin" style="width:100%;padding:14px">알겠어 👍</button></div>`; const c0 = $('#mChat'); if (c0) c0.scrollTop = c0.scrollHeight; return; }
  box.innerHTML = `<div class="mchat" id="mChat">${msgs}</div>
    <div class="mans">${opts}
      ${zq ? '' : `<div class="mrowin"><input id="mIn" placeholder="${q && q.free ? '여기에 써 줘…' : '글로 써도 돼…'}" enterkeyhint="send" autocomplete="off">${window.Native && Native.listen ? '<button class="mmic" data-mt="mic">🎤</button>' : ''}<button class="btn" data-mt="send">보내기</button></div>`}
      <button class="lnk" data-mt="stop" style="display:block;margin:8px auto 0">그만하기</button></div>`;
  const ch = $('#mChat'); if (ch) ch.scrollTop = ch.scrollHeight;
}
document.addEventListener('change', e => { const c = e.target.closest && e.target.closest('#matchBox [data-mk]'); if (c) mtSet(c.dataset.mk, c.checked); });
document.addEventListener('click', async e => {
  const t = e.target.closest && e.target.closest('#matchBox [data-mt], #matchBox [data-mc], #matchBox [data-mq]'); if (!t) return;
  if (t.dataset.mq != null) return mtQuizPick(t.dataset.mq === '1');
  if (t.dataset.mc != null) {
    const q = mtQ(), v = t.dataset.mc;
    if (q && q.multi && !(q.skip && v === q.skip)) { MT.sel = MT.sel.includes(v) ? MT.sel.filter(x => x !== v) : MT.sel.concat(v); MT.sel = v === '상관없어' && MT.sel.includes(v) ? ['상관없어'] : MT.sel.filter(x => x !== '상관없어' || v === '상관없어'); return mtDrawChat(); }
    return mtAnswer(v);
  }
  const a = t.dataset.mt;
  if (a === 'me') return mtStart('me');
  if (a === 'fin') return mtFinOk();
  if (a === 'done') return mtAnswer(MT.sel.slice());
  if (a === 'send') { const v = $('#mIn').value.trim(); if (!v) return; const q = mtQ(); return mtAnswer(q && q.multi ? MT.sel.concat(v.split(/[,，、]\s*/).filter(Boolean)) : v); }
  if (a === 'mic') { t.classList.add('rec'); let v = ''; try { v = await Native.listen(); } catch { } t.classList.remove('rec'); if (v) { const inp = $('#mIn'); if (inp) inp.value = v; } return; }
  if (a === 'stop') { MT = null; NAV.pop(); save(); return drawMatch(); }
});
document.addEventListener('keydown', e => { if (e.target.id === 'mIn' && e.key === 'Enter') { const b = document.querySelector('#matchBox [data-mt="send"]'); if (b) b.click(); } });
// 말: "연인 찾아 줘" · "친구 찾아 줘" · "일자리 찾아 줘" · "소개팅 그만" · "MBTI 알아봐 줘" · "소개팅"
function matchTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').trim();
  const kindOf = s => /(연인|애인|여친|남친|여자\s*친구|남자\s*친구|이성)/.test(s) ? 'love' : /(구인|구직|일자리|알바|직원|사람\s*구|일\s*찾|취업)/.test(s) ? 'job' : /친구/.test(s) ? 'friend' : null;
  if (/(소개팅|연인\s*찾기|친구\s*찾기|구인|구직|찾기)\s*(은|는)?\s*(그만|거절|끝|멈춰|꺼|안\s*해|하지\s*마|중지)/.test(t)) {
    const k = kindOf(t.replace(/소개팅/, '')); const m = MS();
    for (const x of k ? [k] : Object.keys(MKIND)) m.on[x] = false;
    mtTell(k ? `${MKIND[k][1]}는 멈췄어. 다시 "찾아 줘" 하면 이어서 찾아 줄게.` : '소개팅은 모두 멈췄어. 언제든 "연인 찾아 줘" 하면 다시 찾아 줄게 💞', 'talk');
    return true;
  }
  if (/(MBTI|엠비티아이|성격\s*유형)/i.test(t) && /(알아|검사|테스트|해\s*줘|뭐야|봐\s*줘)/.test(t)) { openMatch(true); return true; }
  const k = kindOf(t);
  if (k && /(찾아|소개|구해|구하|만나고\s*싶)/.test(t)) { mtSet(k, true, true); return true; }
  if (/^소개팅/.test(t)) { openMatch(false); return true; }
  return false;
}
window.matchTalk = matchTalk;

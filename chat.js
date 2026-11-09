// 💬 대화방 + 📞 하루 통화 (11-09)
//  하루 예보끼리(연락처에서 🔗 연결한 사람) 카톡방처럼 1:1 대화 — 말로 해도 글로 남음
//  저장: 이 휴대폰 안에만(IndexedDB), 사람마다 최근 1만 개 · 넘으면 오래된 것부터 지움 · 대화방에서 직접 지우기
//  통화: 휴대폰끼리 인터넷으로 목소리 직접 주고받기(WebRTC) — 신호는 대화와 같은 암호 중계소, 연결이 안 되는 망은 TURN 도우미
const CHAT_MAX = 10000;
const FPc = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
let chatDBp = null;
function cdb() {
  return chatDBp || (chatDBp = new Promise((ok, no) => {
    const r = indexedDB.open('haru-chat', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('rooms');
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
}
async function chatLoad(cid) {
  let arr = [];
  try { const db = await cdb(); arr = await new Promise(ok => { const q = db.transaction('rooms').objectStore('rooms').get(cid); q.onsuccess = () => ok(q.result || []); q.onerror = () => ok([]); }); } catch { }
  if (!arr.length && S.pchats && S.pchats[cid] && S.pchats[cid].length) { arr = S.pchats[cid].slice(); chatSave(cid, arr); }   // 예전(최근 100개) 옮기기
  return arr;
}
async function chatSave(cid, arr) { try { const db = await cdb(); db.transaction('rooms', 'readwrite').objectStore('rooms').put(arr.slice(-CHAT_MAX), cid); } catch { } }
const chatMem = {};
async function chatGet(cid) { return chatMem[cid] || (chatMem[cid] = await chatLoad(cid)); }
async function chatAdd(cid, msg) {
  const a = await chatGet(cid); a.push(msg); if (a.length > CHAT_MAX) a.splice(0, a.length - CHAT_MAX);
  chatSave(cid, a);
  const c = S.contacts.find(x => x.id === cid); if (c) { c.lastChat = { text: msg.text, at: msg.at, who: msg.who }; save(); }
  if (view === 'chat' && CROOM && CROOM.cid === cid) chatDraw();
  if (view === 'talk') drawTalk();
}
// ── 대화방 화면
let CROOM = null;   // { cid }
async function openChat(cid, opt = {}) {
  const c = S.contacts.find(x => x.id === cid); if (!c) return;
  window.wantViewAt = Date.now(); { const F = FPc(); if (document.hidden && F && F.front) F.front().catch(() => { }); }
  hideBubble(); petOnly(false);
  CROOM = { cid }; c.unread = 0; save();
  await chatGet(cid);
  if (view !== 'chat') go('chat'); else chatDraw();
  if (opt.ask) { chatPetLine(`💌 ${c.name}에게 뭐라고 할까? 🎤 를 누르고 말하거나 글로 써 줘`); if (opt.listen && window.Native && Native.listen) setTimeout(chatMic, 600); }
}
function chatPetLine(t) { const e = $('#chPet'); if (e) { e.textContent = t; e.hidden = false; clearTimeout(e._t); e._t = setTimeout(() => { e.hidden = true; }, 9000); } }
const hm = at => { const d = new Date(at); return `${d.getHours() < 12 ? '오전' : '오후'} ${(d.getHours() % 12) || 12}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ymdK = at => { const d = new Date(at); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`; };
function chatDraw() {
  const box = $('#chatBox'); if (!box || !CROOM) return;
  const c = S.contacts.find(x => x.id === CROOM.cid); if (!c) return;
  const arr = chatMem[CROOM.cid] || [];
  let lastDay = '', html = '';
  for (const [i, m] of arr.slice(-300).entries()) {
    const day = ymdK(m.at); if (day !== lastDay) { html += `<div class="chday">${day}</div>`; lastDay = day; }
    if (m.who === 'sys') { html += `<div class="chsys">${esc(m.text)}</div>`; continue; }
    html += `<div class="chm ${m.who === 'me' ? 'me' : 'them'}"><div class="chb">${esc(m.text)}</div><span class="cht">${m.fail ? '<button class="chretry" data-chr="' + (arr.length - Math.min(arr.length, 300) + i) + '">⚠️ 다시 보내기</button>' : hm(m.at)}</span></div>`;
  }
  box.innerHTML = `<div class="chhead"><button class="chback" data-ch="back">‹</button><b>${esc(c.name)}</b><button class="chcall" data-ch="call" title="하루 통화">📞</button><button class="chmore" data-ch="more" title="대화 지우기">🗑️</button></div>
    <div class="chlist" id="chList">${html || '<p class="chempty">아직 나눈 이야기가 없어요.<br>아래에 쓰거나 🎤 를 눌러 말해 보세요.</p>'}</div>
    <div class="chpet" id="chPet" hidden></div>
    <div class="chin"><button class="chmic" data-ch="mic">🎤</button><input id="chIn" placeholder="메시지 쓰기…" enterkeyhint="send" autocomplete="off"><button class="chsend" data-ch="send">보내기</button></div>`;
  const l = $('#chList'); if (l) l.scrollTop = l.scrollHeight;
}
async function chatSend(text) {
  text = String(text || '').trim(); if (!text || !CROOM) return;
  const c = S.contacts.find(x => x.id === CROOM.cid); if (!c || !c.pk) { say('아직 하루 예보로 연결 전이야. 연락처에서 🔗 초대해 줘!', { ms: 5000 }); return; }
  const msg = { who: 'me', text: text.slice(0, 500), at: Date.now() };
  await chatAdd(c.id, msg);
  const r = await nsend(c.pk, 'pmsg', msg.text, { name: nameOf() });
  if (!r.ok) { msg.fail = true; chatSave(c.id, chatMem[c.id]); if (view === 'chat') chatDraw(); }
  c.lastSent = Date.now(); save();
}
async function chatMic() {
  if (!(window.Native && Native.listen)) { const i = $('#chIn'); if (i) i.focus(); return; }
  const b = document.querySelector('[data-ch="mic"]'); if (b) b.classList.add('rec');
  chatPetLine('👂 듣고 있어… 말해 줘');
  let t = ''; try { t = await Native.listen(); } catch { }
  const b2 = document.querySelector('[data-ch="mic"]'); if (b2) b2.classList.remove('rec');
  const e = $('#chPet'); if (e) e.hidden = true;
  if (t) chatSend(t); else chatPetLine('잘 못 들었어 🥲 다시 🎤 를 눌러 줘');
}
document.addEventListener('click', async e => {
  const r = e.target.closest && e.target.closest('[data-chr]');
  if (r && CROOM) { const a = chatMem[CROOM.cid], m = a && a[+r.dataset.chr]; if (m) { a.splice(+r.dataset.chr, 1); chatSave(CROOM.cid, a); chatSend(m.text); } return; }
  const b = e.target.closest && e.target.closest('#chatBox [data-ch]'); if (!b) return;
  const a = b.dataset.ch;
  if (a === 'back') return window.haruBack && haruBack();
  if (a === 'send') { const i = $('#chIn'); const v = i.value; i.value = ''; return chatSend(v); }
  if (a === 'mic') return chatMic();
  if (a === 'call') return callStart(CROOM.cid);
  if (a === 'more') return chatClear(CROOM.cid);
});
document.addEventListener('keydown', e => { if (e.target.id === 'chIn' && e.key === 'Enter') { const v = e.target.value; e.target.value = ''; chatSend(v); } });
async function chatClear(cid) {
  if (!confirm('대화는 이 휴대폰에만 저장돼요 (사람마다 최근 1만 개).\n\n이 사람과 나눈 대화를 모두 지울까요? 되돌릴 수 없어요.')) return;
  chatMem[cid] = []; await chatSave(cid, []); if (S.pchats) delete S.pchats[cid];
  const c = S.contacts.find(x => x.id === cid); if (c) delete c.lastChat; save();
  if (view === 'chat') chatDraw();
}
// 받은 말 (people.js 에서 넘겨줌)
async function chatIncoming(c, text, at) {
  await chatAdd(c.id, { who: 'them', text, at: at || Date.now() });
  const inRoom = view === 'chat' && CROOM && CROOM.cid === c.id && !document.hidden;
  if (!inRoom) { c.unread = (c.unread || 0) + 1; save(); }
  const F = FPc();
  if (document.hidden) {
    if (F && F.say) F.say({ text: `💌 ${c.name}: "${text.slice(0, 60)}"` + (arCfg().on ? '\n🎤 바로 말하면 답장돼요' : '\n👉 누르면 대화방을 열어 줄게'), open: 'chat:' + c.id, ms: 20000 }).catch(() => { });
  } else if (!inRoom) {
    if (['home', 'people', 'match', 'chat', 'talk'].includes(view)) openChat(c.id);
    else say(`💌 ${esc(c.name)}: "${esc(text)}"`, { pose: 'letter', ms: 20000, important: true, buttons: [{ label: '💬 대화방 열기', act: () => openChat(c.id) }, { label: '나중에', ghost: true }] });
  }
  if (!autoReplyStart(c, true, 'reply')) { if (navigator.vibrate) navigator.vibrate(60); if (!document.hidden) cry(true); }
}
// ══ 💬 말로 바로 답장 (11-09): '띠링' → 시작 시간(기본 6초) 안에 말하면 받아 적고, 조용한 시간(기본 3초)이 지나면
//  말이 되면 바로 보냄 · 이상하면 "이게 맞아?" 묻고 "맞아" 할 때만 보냄 · 말이 없으면 안 보내고 숫자 1 만 남김 (터치 없음)
function arCfg() { const a = (S.talk && S.talk.ar) || {}; return { on: a.on !== false, start: a.start || 6, end: a.end || 3 }; }
let AR = null;   // { id, cid, mode: 'reply' | 'confirm', text }
function autoReplyStart(c, ding, mode, text, extra) {
  const F = FPc(), cfg = arCfg();
  if ((!cfg.on && !(extra && extra.force)) || !F || !F.autoReply) return false;
  AR = Object.assign({ id: Math.random().toString(36).slice(2), cid: c.id, mode, text: text || '' }, extra || {});
  F.autoReply({ id: AR.id, startMs: cfg.start * 1000, endMs: cfg.end * 1000, ding: !!ding }).catch(() => { AR = null; });
  return true;
}
function arShow(t, ms) {
  const F = FPc();
  if (document.hidden) { if (F && F.say) F.say({ text: t.replace(/<[^>]+>/g, ''), ms: ms || 6000 }).catch(() => { }); return; }
  if (view === 'chat' && CROOM && AR && CROOM.cid === AR.cid) chatPetLine(t.replace(/<[^>]+>/g, ''));
  else say(t, { ms: ms || 5000 });
}
const AR_OK = /^(응|어|네|예|웅|엉|왜|왜\?|뭐|알았어|알겠어|알겠습니다|고마워|감사해|좋아|그래|싫어|안 ?돼|돼|지금 ?가|곧 ?가|금방 ?가|오케이|ok|ㅇㅋ|사랑해|잘 ?자|잘 ?가|밥 ?먹었어|먹었어|아직|몰라|그래 ?그래|ㅇㅇ)[!~.?\s]*$/i;
function arSensible(t, conf, rms) {
  t = String(t || '').trim(); if (!t) return false;
  if (AR_OK.test(t)) return true;                                   // 흔한 짧은 대답은 바로
  if (typeof rms === 'number' && rms > -2 && rms < 3) return false;  // 멀리서 들린 작은 소리 (TV 등)
  if (typeof conf === 'number' && conf >= 0 && conf < 0.45) return false;   // 받아쓰기가 자신 없음
  const core = t.replace(/[\s.,!?~]/g, '');
  if (core.length <= 3) return false;                                // 세 글자 이하인데 흔한 말이 아님
  if (!/[가-힣a-zA-Z]/.test(core)) return false;
  return true;
}
// 💬 "아들 톡(문자) 보내 줘" → "아들에게 뭐라고 전해?" + 띠링 → 6초 안에 말하면 받아 적고 → 3초 조용하면 하루 톡으로 자동 전송 → 대화창
function talkAsk(c, text) {
  if (text) { arSendTo(c.id, text).then(() => openChat(c.id)); return; }
  const F = FPc();
  if (F && F.autoReply) {
    arShow(`💬 ${c.name}에게 뭐라고 전해? 🎤`, 9000);
    autoReplyStart(c, true, 'reply', '', { force: true, open: true });
    return;
  }
  openChat(c.id, { ask: true, listen: true });   // 웹: 대화방에서 🎤
}
window.talkAsk = talkAsk;
// ✉️ 하루 톡 연결 전인 사람 = 휴대폰 문자로, 같은 방식(묻고 → 6초 → 3초 → 자동 전송)
function smsAsk(c, num, text) {
  const F = FPc(); if (!F || !F.autoReply || !F.msgSend) return false;
  if (text) { smsSendNow(c, num, text); return true; }
  arShow(`✉️ ${c.name}에게 문자로 뭐라고 보낼까? 🎤`, 9000);
  autoReplyStart(c, true, 'reply', '', { force: true, sms: { who: c.name, num } });
  return true;
}
window.smsAsk = smsAsk;
async function smsSendNow(c, num, text) {
  const F = FPc(); const r = await F.msgSend({ kind: 'sms', who: c.name, num, text }).catch(() => ({ how: 'fail' }));
  arShow(r.how === 'sent' ? `✉️ ${c.name}에게 문자 보냈어: "${text}"` : r.how === 'open' ? '✉️ 문자 화면에 글을 채워 뒀어. 보내기만 눌러 줘 (⚙️ 문자 허락을 켜면 바로 보내져)' : '문자를 못 보냈어 🥲', 5000);
  if (r.how === 'sent' && !c.pk && !c.invAsked && window.invite) { c.invAsked = Date.now(); save(); setTimeout(() => arShow(`💡 ${c.name}도 하루 예보를 깔면 하루 톡에 대화가 남고 무료 통화도 돼요`, 6000), 5500); }
}
async function arSendTo(cid, text, open) {
  const c = S.contacts.find(x => x.id === cid); if (!c || !c.pk) return;
  const msg = { who: 'me', text: text.slice(0, 500), at: Date.now(), voice: true };
  await chatAdd(c.id, msg);
  const r = await nsend(c.pk, 'pmsg', msg.text, { name: nameOf() });
  if (!r.ok) { msg.fail = true; chatSave(c.id, chatMem[c.id]); }
  c.lastSent = Date.now(); c.unread = 0; save();
  arShow(r.ok ? `✓ ${c.name}에게 보냈어: "${text}"` : '앗, 못 보냈어. 인터넷을 확인해 줘 🥲', 4000);
  if (view === 'people') drawPeople();
  if (open) openChat(c.id);   // 💬 보낸 뒤 대화창
}
{ const F0 = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
  if (F0 && F0.addListener) F0.addListener('autoReply', d => {
    if (!AR || !d || d.id !== AR.id) return;
    const c = S.contacts.find(x => x.id === AR.cid); if (!c) { AR = null; return; }
    if (d.kind === 'partial') { arShow(`🎤 ${d.text}`, 8000); return; }
    const mode = AR.mode, prev = AR.text, X = { open: AR.open, sms: AR.sms, force: AR.force }; AR = null;
    const sendIt = t2 => X.sms ? smsSendNow(c, X.sms.num, t2) : arSendTo(c.id, t2, X.open);
    if (d.kind === 'skip' || d.kind === 'none') { if (mode === 'confirm') arShow('알겠어, 안 보낼게', 2500); else if (X.force) arShow(d.kind === 'skip' ? '🎤 지금은 들을 수 없어 (화면을 켜고 다시 말해 줘)' : `🎤 못 들었어. 다시 "${c.name} 톡 보내 줘" 해 줘`, 4000); return; }   // 말이 없음 → 안 보냄
    const t = String(d.text || '').trim();
    if (mode === 'reply') {
      if (arSensible(t, d.conf, d.rms)) { sendIt(t); return; }
      arShow(`"${t}" 이게 맞아? (맞아 / 아니)`, 9000);
      autoReplyStart(c, false, 'confirm', t, Object.assign({ force: true }, X));
      return;
    }
    if (/^(맞아|맞어|응|어|네|예|그래|보내|보내 ?줘|ㅇㅇ|웅|엉)/.test(t)) sendIt(prev);
    else arShow('알겠어, 안 보낼게', 2500);
  });
}
window.chatIncoming = chatIncoming;
// 말: "엄마한테 연락해 줘" · "엄마랑 대화하자" · "엄마랑 나눈 대화 보여 줘" · "엄마한테 하루 통화 걸어 줘"
function chatTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').trim();
  let m = t.match(/^(.{1,12}?)\s*(한테|에게|께|랑|이랑|하고|와|과)?\s*(보이스톡|하루\s*통화|하루\s*전화|인터넷\s*전화|무료\s*(통화|전화)|영상\s*없이\s*통화)\s*(좀\s*)?(걸어|해|하자|연결)?/);
  if (m) { const c = findPerson(m[1]); if (c) { if (!c.pk) return chatNotLinked(c); callStart(c.id); return true; } }
  m = t.match(/^(.{1,12}?)\s*(이랑|랑|하고|와|과|한테|에게)?\s*(나눈|한)?\s*(대화|이야기|얘기|톡|채팅)\s*(방)?\s*(좀\s*)?(보여|열어|켜)/);
  if (m) { const c = findPerson(m[1]); if (c) { if (!c.pk) return chatNotLinked(c); openChat(c.id); return true; } }
  m = t.match(/^(.{1,12}?)\s*(한테|에게|께|랑|이랑|하고|와|과)?\s*(연락|대화|이야기|얘기|톡|채팅|연결)\s*(좀\s*)?(해|하자|할래|걸어|해\s*줘|시켜)?\s*(줘|줄래)?$/);
  if (m) { const c = findPerson(m[1]); if (c) { if (!c.pk) return chatNotLinked(c); openChat(c.id, { ask: true, listen: true }); return true; } }
  return false;
}
function chatNotLinked(c) {
  say(`${esc(c.name)}는 아직 하루 예보로 연결 전이야.<br>초대 글을 보내서 ${esc(c.name)}가 받으면 대화하고 통화할 수 있어.`, { ms: 20000, buttons: [{ label: '🔗 초대 보내기', act: () => { hideBubble(); invite(c); } }, { label: '나중에', ghost: true }] });
  return true;
}
window.chatTalk = chatTalk;

// ══ 📞 하루 통화 (WebRTC) ══
const ICE_FREE = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
async function iceServers() {
  const u = (window.HARU_KEYS || {}).turn;
  if (u) { try { const r = await fetch(u, { cache: 'no-store' }); const j = await r.json(); if (j && j.iceServers) return [].concat(j.iceServers); } catch { } }
  return ICE_FREE;
}
let CALL = null;   // { id, cid, pk, dir, state, pc, stream, t0, offer, timer }
const callId = () => Math.random().toString(36).slice(2, 10);
function waitIce(pc, ms) { return new Promise(ok => { if (pc.iceGatheringState === 'complete') return ok(); const t = setTimeout(ok, ms); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } }); }); }
async function callMic() {
  try { return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
  catch (e) { return null; }
}
async function callPeer() {
  const pc = new RTCPeerConnection({ iceServers: await iceServers() });
  pc.ontrack = ev => { const a = $('#callAudio'); if (a) { a.srcObject = ev.streams[0]; a.play().catch(() => { }); } };
  pc.onconnectionstatechange = () => {
    if (!CALL || CALL.pc !== pc) return;
    if (pc.connectionState === 'connected') { CALL.state = 'talk'; CALL.t0 = Date.now(); ringStop(); callUI(); }
    if (pc.connectionState === 'failed') callEnd('연결이 안 됐어 🥲 잠시 뒤에 다시 걸어 봐', true);
  };
  return pc;
}
async function callStart(cid) {
  const c = S.contacts.find(x => x.id === cid); if (!c) return;
  if (!c.pk) return chatNotLinked(c);
  if (CALL) { callUI(); return; }
  window.wantViewAt = Date.now(); { const F = FPc(); if (document.hidden && F && F.front) F.front().catch(() => { }); }
  CALL = { id: callId(), cid, pk: c.pk, dir: 'out', state: 'dial' }; callUI();
  const st = await callMic(); if (!st) { callEnd('마이크를 쓸 수 없어 🥲 마이크를 허락해 줘', false); return; }
  if (!CALL) { st.getTracks().forEach(t => t.stop()); return; }
  CALL.stream = st; callAudioMode(true);
  const pc = CALL.pc = await callPeer(); st.getTracks().forEach(t => pc.addTrack(t, st));
  await pc.setLocalDescription(await pc.createOffer()); await waitIce(pc, 2500);
  if (!CALL) return;
  const r = await nsend(c.pk, 'call', '📞', { call: CALL.id, sdp: pc.localDescription.sdp, name: nameOf() });
  if (!r.ok) return callEnd('인터넷이 불안해서 못 걸었어 🥲', false);
  CALL.state = 'ring'; callUI(); ringStart(false);
  chatAdd(cid, { who: 'sys', text: '📞 하루 통화를 걸었어요', at: Date.now() });
  CALL.timer = setTimeout(() => { if (CALL && CALL.state === 'ring') { nsend(c.pk, 'call-end', '', { call: CALL.id }); callEnd(`${c.name}가 받지 않아요`, true, '📞 받지 않은 통화'); } }, 45000);
}
async function callSignal(c, ev) {
  if (ev.t === 'call') {
    if (Date.now() - (ev.at || 0) > 60000) return;   // 오래된 전화는 무시
    if (CALL) { if (CALL.id !== ev.call) nsend(c.pk, 'call-busy', '', { call: ev.call }); return; }
    CALL = { id: ev.call, cid: c.id, pk: c.pk, dir: 'in', state: 'ring', offer: ev.sdp };
    window.wantViewAt = Date.now(); { const F = FPc(); if (document.hidden && F && F.front) F.front().catch(() => { }); }
    callUI(); ringStart(true);
    CALL.timer = setTimeout(() => { if (CALL && CALL.id === ev.call && CALL.state === 'ring') callEnd('', false, `📞 ${c.name}의 부재중 통화`); }, 45000);
    return;
  }
  if (!CALL || CALL.id !== ev.call || CALL.pk !== c.pk) return;
  if (ev.t === 'call-ok' && CALL.dir === 'out' && CALL.pc) { clearTimeout(CALL.timer); CALL.state = 'connect'; ringStop(); callUI(); try { await CALL.pc.setRemoteDescription({ type: 'answer', sdp: ev.sdp }); } catch { callEnd('연결이 안 됐어 🥲', true); } }
  if (ev.t === 'call-no') callEnd(`${c.name}가 지금은 받을 수 없대요`, false, '📞 거절된 통화');
  if (ev.t === 'call-busy') callEnd(`${c.name}가 다른 통화 중이에요`, false, '📞 통화 중이라 못 받음');
  if (ev.t === 'call-end') callEnd(CALL.state === 'ring' && CALL.dir === 'in' ? '' : '통화가 끝났어요', false, CALL.state === 'ring' && CALL.dir === 'in' ? `📞 ${c.name}의 부재중 통화` : null);
}
window.callSignal = callSignal;
async function callAnswer() {
  if (!CALL || CALL.dir !== 'in' || CALL.state !== 'ring') return;
  clearTimeout(CALL.timer); ringStop(); CALL.state = 'connect'; callUI();
  const st = await callMic(); if (!st) { nsend(CALL.pk, 'call-no', '', { call: CALL.id }); return callEnd('마이크를 쓸 수 없어 🥲 마이크를 허락해 줘', false); }
  CALL.stream = st; callAudioMode(true);
  const pc = CALL.pc = await callPeer(); st.getTracks().forEach(t => pc.addTrack(t, st));
  try {
    await pc.setRemoteDescription({ type: 'offer', sdp: CALL.offer });
    await pc.setLocalDescription(await pc.createAnswer()); await waitIce(pc, 2500);
    if (!CALL) return;
    await nsend(CALL.pk, 'call-ok', '', { call: CALL.id, sdp: pc.localDescription.sdp });
    CALL.timer = setTimeout(() => { if (CALL && CALL.state === 'connect') callEnd('연결이 안 됐어 🥲 잠시 뒤에 다시 걸어 봐', true); }, 25000);
  } catch { callEnd('연결이 안 됐어 🥲', true); }
}
function callReject() { if (!CALL) return; nsend(CALL.pk, 'call-no', '', { call: CALL.id }); callEnd('', false, '📞 받지 않은 통화'); }
function callHang() { if (!CALL) return; nsend(CALL.pk, 'call-end', '', { call: CALL.id }); callEnd('', false); }
function callEnd(msg, tellPeer, log) {
  if (!CALL) return;
  const C = CALL; CALL = null;
  clearTimeout(C.timer); clearInterval(callTick); ringStop();
  if (tellPeer) nsend(C.pk, 'call-end', '', { call: C.id });
  try { C.stream && C.stream.getTracks().forEach(t => t.stop()); } catch { }
  try { C.pc && C.pc.close(); } catch { }
  callAudioMode(false);
  const a = $('#callAudio'); if (a) a.srcObject = null;
  const ui = $('#callUI'); if (ui) ui.hidden = true;
  const sec = C.t0 ? Math.round((Date.now() - C.t0) / 1000) : 0;
  chatAdd(C.cid, { who: 'sys', text: log || (sec ? `📞 통화 ${Math.floor(sec / 60)}분 ${sec % 60}초` : '📞 통화가 끝났어요'), at: Date.now() });
  if (msg) say(esc(msg), { ms: 5000 });
}
function callAudioMode(on) { const F = FPc(); if (F && F.speaker) F.speaker({ call: on, on: on && !!(CALL && CALL.spk) }).catch(() => { }); if (F && F.keepScreen) F.keepScreen({ on }).catch(() => { }); }
let callTick = 0;
function callUI() {
  let ui = $('#callUI');
  if (!ui) { ui = document.createElement('div'); ui.id = 'callUI'; document.body.appendChild(ui); }
  if (!CALL) { ui.hidden = true; return; }
  const c = S.contacts.find(x => x.id === CALL.cid) || { name: '' };
  const st = CALL.state, inRing = CALL.dir === 'in' && st === 'ring';
  const label = st === 'dial' ? '준비 중…' : st === 'ring' ? (CALL.dir === 'in' ? '📞 하루 통화가 왔어요' : '전화 거는 중…') : st === 'connect' ? '연결하는 중…' : '';
  ui.hidden = false;
  ui.innerHTML = `<div class="cav">${esc((c.name || '?').slice(0, 1))}</div><b class="cname">${esc(c.name)}</b><p class="cst" id="callSt">${label}</p>
    <div class="cbtns">${inRing ? `<button class="cno" data-call="no"><i>✕</i>거절</button><button class="cyes" data-call="yes"><i>📞</i>받기</button>`
      : `<button class="csub ${CALL.mute ? 'on' : ''}" data-call="mute"><i>${CALL.mute ? '🔇' : '🎙️'}</i>${CALL.mute ? '소리 켜기' : '음소거'}</button><button class="cno" data-call="end"><i>📞</i>끊기</button><button class="csub ${CALL.spk ? 'on' : ''}" data-call="spk"><i>🔊</i>스피커</button>`}</div>`;
  clearInterval(callTick);
  if (st === 'talk') { const f = () => { const e = $('#callSt'); if (e && CALL && CALL.t0) { const s = Math.round((Date.now() - CALL.t0) / 1000); e.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; } }; f(); callTick = setInterval(f, 1000); }
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#callUI [data-call]'); if (!b || !CALL) return;
  const a = b.dataset.call;
  if (a === 'yes') callAnswer();
  if (a === 'no') callReject();
  if (a === 'end') callHang();
  if (a === 'mute') { CALL.mute = !CALL.mute; if (CALL.stream) CALL.stream.getAudioTracks().forEach(t => t.enabled = !CALL.mute); callUI(); }
  if (a === 'spk') { CALL.spk = !CALL.spk; callAudioMode(true); callUI(); }
});
// 울림: 받는 쪽 = 전화벨 + 진동, 거는 쪽 = 신호음 (휴대폰 소리로 직접 만듦)
let ringCtx = null, ringT = 0;
function ringStart(incoming) {
  ringStop();
  try {
    ringCtx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = (f1, f2, dur, vol) => { const t = ringCtx.currentTime; for (const f of [f1, f2]) { const o = ringCtx.createOscillator(), g = ringCtx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.setValueAtTime(vol, t + dur - 0.05); g.gain.linearRampToValueAtTime(0, t + dur); o.connect(g).connect(ringCtx.destination); o.start(t); o.stop(t + dur); } };
    const once = () => { if (!ringCtx) return; if (incoming) { beep(880, 1108, 0.4, 0.12); setTimeout(() => ringCtx && beep(880, 1108, 0.4, 0.12), 550); if (navigator.vibrate) navigator.vibrate([500, 300, 500]); } else beep(440, 480, 1.2, 0.05); };
    once(); ringT = setInterval(once, incoming ? 2500 : 3500);
  } catch { }
}
function ringStop() { clearInterval(ringT); ringT = 0; if (ringCtx) { try { ringCtx.close(); } catch { } ringCtx = null; } if (navigator.vibrate) navigator.vibrate(0); }

// ══ 💬 톡 (카카오톡처럼 대화방 목록) — 하루 예보로 연결된 사람(🔗)과의 대화, 최근 순 · 안 읽은 숫자
function drawTalk() {
  const box = $('#talkBox'); if (!box) return;
  const list = S.contacts.filter(c => c.pk).sort((a, b) => ((b.lastChat && b.lastChat.at) || 0) - ((a.lastChat && a.lastChat.at) || 0));
  const ago = at => { if (!at) return ''; const d = new Date(at), n = new Date(); return d.toDateString() === n.toDateString() ? hm(at) : `${d.getMonth() + 1}월 ${d.getDate()}일`; };
  box.innerHTML = (list.length ? list.map(c => `<button class="tkrow" data-tk="${c.id}"><span class="tkav">${esc(c.name.slice(0, 1))}</span><span class="tkmid"><b>${esc(c.name)}</b><small>${c.lastChat ? esc((c.lastChat.who === 'me' ? '' : '') + c.lastChat.text) : '아직 나눈 이야기가 없어요'}</small></span><span class="tkend"><small>${ago(c.lastChat && c.lastChat.at)}</small>${c.unread ? `<i>${c.unread}</i>` : ''}</span></button>`).join('')
    : '<div class="card"><p class="note">아직 하루 톡으로 연결된 사람이 없어요.<br>📞 연락처에서 이름을 누르고 <b>🔗 하루 예보로 초대</b>를 보내 주세요. 상대가 받으면 여기서 카톡처럼 이야기하고 무료로 통화할 수 있어요.</p></div>')
    + `<div class="card tkhelp"><p class="note small">💡 말로도 돼요: <b>"아들 톡 보내 줘"</b> → "아들에게 뭐라고 전해?" → 6초 안에 말하면 받아 적고, 3초 조용하면 바로 보내요. 하루 톡에 연결 안 된 사람은 휴대폰 문자로 보내요.</p></div>`;
}
window.drawTalk = drawTalk;
document.addEventListener('click', e => {
  const r = e.target.closest && e.target.closest('[data-tk]'); if (r) { openChat(r.dataset.tk); return; }
  if (e.target.id === 'tkPeople') go('people');
});

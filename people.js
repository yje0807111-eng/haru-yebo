// 📒 주소록 (휴대폰 연락처 허락 한 번) · 🔗 가족 연결 · 팻이 전해 주는 1:1 (PC 하루 예보와 같은 방식)
const NT = window.NostrTools;
const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
const APP = 'haruyebo';
const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = s => new Uint8Array(s.match(/../g).map(h => parseInt(h, 16)));
let SK = null, PK = null, pool = null;
function myKey() {
  if (!S.nostr.sk) patch({ nostr: { sk: hex(NT.generateSecretKey()) } });
  SK = unhex(S.nostr.sk); PK = NT.getPublicKey(SK);
}
async function nsend(to, t, text, extra) {
  const body = JSON.stringify({ app: APP, t, text: String(text || '').slice(0, 500), nick: S.me.name || '', species: 'dog', ...(extra || {}) });
  const ev = NT.nip17.wrapEvent(SK, { publicKey: to }, body);
  try { await Promise.any(pool.publish(RELAYS, ev)); return { ok: true }; } catch { return { ok: false }; }
}
function startNostr() {
  try {
    myKey();
    pool = new NT.SimplePool();
    pool.subscribeMany(RELAYS, { kinds: [1059], '#p': [PK], since: Math.floor(Date.now() / 1000) - 3 * 86400 }, {
      onevent: ev => {
        try {
          const r = NT.nip17.unwrapEvent(ev, SK);
          if (S.seen.includes(r.id)) return;
          S.seen = [...S.seen, r.id].slice(-500); save();
          let m; try { m = JSON.parse(r.content); } catch { return; }
          if (!m || m.app !== APP) return;
          onPeople({ from: r.pubkey, at: r.created_at * 1000, ...m });
        } catch { }
      },
    });
  } catch (e) { console.warn('nostr', e); }
}
const nameOf = () => S.me.name || '';
function onPeople(ev) {
  if (['hi', 'ok', 'msg', 'bye'].includes(ev.t)) { if (window.townDm) townDm(ev); return; }   // 동네 이웃 톡
  const list = S.contacts;
  if (ev.t === 'link') {
    const inv = S.invites[ev.token]; if (!inv) return;
    const c = list.find(x => x.id === inv.cid); if (!c) return;
    c.pk = ev.from; delete S.invites[ev.token]; save();
    nsend(ev.from, 'link-ok', '', { name: nameOf() });
    say(`🔗 ${esc(c.name)}이랑 하루 예보로 연결됐어!<br>"${esc(c.name)}한테 ~라고 전해 줘" 하면 내가 전해 줄게 🐶`, { pose: 'joy', ms: 12000, important: true });
    if (view === 'people') drawPeople();
    return;
  }
  if (ev.t === 'link-ok') {
    if (!S.peoplePending[ev.from]) return; delete S.peoplePending[ev.from];
    const name = String(ev.name || '').slice(0, 20).trim() || '친구';
    let c = list.find(x => x.pk === ev.from) || list.find(x => x.name === name && !x.pk);
    if (!c) { c = { id: uid(), name, phones: [], addr: '', bday: null, memo: '' }; list.push(c); }
    c.pk = ev.from; save();
    say(`🔗 ${esc(c.name)}이랑 연결됐어! 연락처에 넣어 뒀어 🐶`, { pose: 'joy', ms: 10000, important: true });
    if (view === 'people') drawPeople();
    return;
  }
  const c = list.find(x => x.pk === ev.from); if (!c) return;   // 연결된 사람 것만 받음
  const tel = (c.phones[0] || {}).num;
  if (ev.t === 'pmsg') {
    const text = String(ev.text || '').slice(0, 500);
    S.pchats[c.id] = [...(S.pchats[c.id] || []), { who: 'them', text, at: ev.at }].slice(-100); save();
    say(`💌 ${esc(c.name)}한테 연락 왔어~<br>"${esc(text)}"`, { pose: 'letter', ms: 30000, important: true, buttons: [{ label: '✍️ 답장하기', act: () => startPmode(c) }, { label: '나중에', ghost: true }] });
    cry(true); if (navigator.vibrate) navigator.vibrate(200);
    if (view === 'people') drawPeople();
  }
  if (ev.t === 'hello') { c.lastHello = ev.at; save(); say(`🌤 ${esc(c.name)}님이 오늘도 잘 있대!${ev.mood ? ` (마음 날씨: ${esc(ev.mood)})` : ''}`, { pose: 'joy', ms: 9000, buttons: [{ label: '💌 답장하기', act: () => startPmode(c) }, { label: '좋아', ghost: true }] }); }
  if (ev.t === 'guard') { say(ev.sos ? `🚨🚨 ${esc(c.name)}님이 "도와주세요"를 외쳐서 119에 전화했대! 바로 연락해 봐!` : `🚨 ${esc(c.name)}님이 ${ev.days || 1}일 동안 소식이 없어. 안부를 확인해 볼까?`, { pose: 'sad', ms: 60000, important: true, buttons: [...(tel ? [{ label: '📞 전화하기', tel }] : []), { label: '💌 말 걸기', act: () => startPmode(c) }] }); if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]); }
}
// 초대 코드 (PC 와 같은 모양: HARU-npub…-토큰)
async function invite(c) {
  const token = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  S.invites[token] = { cid: c.id, at: Date.now() }; save();
  const code = `HARU-${NT.nip19.npubEncode(PK)}-${token}`;
  const text = `${c.name}, 하루 예보에서 우리 팻끼리 이야기하자! 🐶\n① 앱 받기: https://yje0807111-eng.github.io/haru-yebo/get/\n② 하루 예보를 켜고 말창에 아래 초대 코드를 그대로 붙여 넣어 줘.\n${code}`;
  if (await shareText('하루 예보 초대', text)) return;
  try { await navigator.clipboard.writeText(text); say(`📋 초대 글을 복사했어! 카톡에서 ${esc(c.name)}에게 붙여 넣어 보내 줘`, { pose: 'joy', ms: 8000 }); } catch { say('초대 글: ' + esc(code), { ms: 20000 }); }
}
async function join(code) {
  const m = String(code || '').match(/HARU-(npub1[0-9a-z]{20,80})-([0-9a-z]{6})/); if (!m) return 'code';
  let pk; try { pk = NT.nip19.decode(m[1]).data; } catch { return 'code'; }
  if (pk === PK) return 'self';
  S.peoplePending[pk] = { token: m[2], at: Date.now() }; save();
  const r = await nsend(pk, 'link', '', { token: m[2], name: nameOf() });
  return r.ok ? 'ok' : 'net';
}
// 말창: 초대 코드·"엄마한테 ~라고 전해 줘"·"엄마랑 연결해 줘"·"엄마한테 전화 걸어 줘"
let pmode = null; window.pmode = null;
function startPmode(c) { petOnly(false); pmode = window.pmode = { cid: c.id, name: c.name }; document.body.classList.add('pmode'); t.placeholder = `💌 ${c.name}에게 보낼 말… ("그만"이면 끝)`; go('home'); t.focus(); }
function endPmode() { pmode = window.pmode = null; document.body.classList.remove('pmode'); t.placeholder = `${bn()}에게 말 걸기…`; }
async function sendTo(c, msg) {
  const r = await nsend(c.pk, 'pmsg', msg, { name: nameOf() });
  if (r.ok) { S.pchats[c.id] = [...(S.pchats[c.id] || []), { who: 'me', text: msg, at: Date.now() }].slice(-100); save(); say(`💌 ${esc(c.name)}에게 전했어!`, { pose: 'letter', ms: 3000 }); }
  else say('앗, 못 보냈어. 인터넷을 확인해 줘 🥲', { ms: 4000 });
}
async function pmodeSend(text) {
  if (/^(그만|끝|됐어)[!~.\s]*$/.test(text)) { endPmode(); say('알겠어, 다시 나랑 이야기하자 🐶', { ms: 2500 }); return; }
  const c = S.contacts.find(x => x.id === pmode.cid); if (c) await sendTo(c, text);
}
// ✉️💬 11-08: "엄마에게 문자(카톡) 보내 줘" → 어떻게 보낼까? → 말하면 받아 적고 → 말풍선 누르면 보냄
let MC = null;
const FPx = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
const mcIcon = k => k === 'sms' ? '✉️' : '💬', mcWhat = k => k === 'sms' ? '문자' : '카톡';
async function msgCompose(kind, who, num, text) {
  const F = FPx();
  if (document.hidden && F && F.compose) { const r = await F.compose({ kind, who, num: num || '', text: text || '' }).catch(() => null); if (r && r.ok) return; }
  MC = { kind, who, num, text: '', until: Date.now() + 90000 };
  if (text) return msgConfirm(text);
  say(`${mcIcon(kind)} <b>${esc(who)}</b>에게 ${mcWhat(kind)} 어떻게 보낼까?<br>말해 줘 🎤 <span class="small">(글로 써도 돼)</span>`, { pose: 'joy', ms: 20000, buttons: [{ label: '그만', ghost: true, act: () => { MC = null; hideBubble(); } }] });
  if (window.Native && Native.listen) setTimeout(msgListen, 700);
}
async function msgListen() {
  if (!MC) return;
  let txt = ''; try { txt = await Native.listen(); } catch { }
  txt = String(txt || '').trim();
  if (txt) msgPending(txt); else if (MC && !MC.text) say('잘 못 들었어 🥲 다시 말하려면 🎤 를 눌러 줘 (글로 써도 돼)', { ms: 6000 });
}
function msgConfirm(text) {
  MC.text = text; MC.until = Date.now() + 30000;
  say(`${mcIcon(MC.kind)} <b>${esc(MC.who)}</b>에게 이렇게 보낼까?<br>"${esc(text)}"<br><span class="small">👉 말풍선을 누르면 보내요</span>`, { pose: 'letter', ms: 30000, tap: msgGo, buttons: [{ label: '보내기', act: msgGo }, ...(window.Native && Native.listen ? [{ label: '🎤 다시 말하기', act: () => { hideBubble(); msgListen(); } }] : []), { label: '그만', ghost: true, act: () => { MC = null; hideBubble(); } }] });
}
window.msgPending = function (text) {   // 받아 적는 중이면 이 말 = 보낼 글
  if (!MC || Date.now() > MC.until) { MC = null; return false; }
  if (/^(그만|취소|안\s*보내|됐어)[!~.\s]*$/.test(text)) { MC = null; say('알겠어, 안 보낼게', { ms: 2500 }); return true; }
  msgConfirm(text); return true;
};
async function msgGo() {
  if (!MC || !MC.text) return;
  const { kind, who, num, text } = MC; MC = null; hideBubble();
  const F = FPx();
  if (F && F.msgSend) {
    const r = await F.msgSend({ kind, who, num: num || '', text }).catch(() => ({ how: 'fail' }));
    const h = r && r.how;
    if (kind === 'sms') say(h === 'sent' ? `✉️ ${esc(who)}에게 문자 보냈어! ✓` : h === 'open' ? '✉️ 문자 화면에 글을 채워 뒀어. 보내기 단추만 눌러 줘' : '문자를 못 보냈어 🥲', { pose: h === 'sent' ? 'joy' : 'talk', ms: 5000 });
    else say(h === 'reply' ? `💬 ${esc(who)}에게 카톡 보냈어! ✓` : h === 'share' ? `💬 글은 채워 뒀어! <b>${esc(who)}</b> 님을 찾아 누르고 [확인]만 눌러 줘` : '카톡을 못 열었어 🥲', { pose: 'joy', ms: 9000 });
    return;
  }
  if (kind === 'sms') { location.href = `sms:${String(num).replace(/[^0-9+]/g, '')}?body=${encodeURIComponent(text)}`; return; }
  try { await navigator.clipboard.writeText(text); } catch { }
  say('💬 글을 복사해 뒀어! 카톡에서 붙여 넣어 줘', { ms: 5000 });
}
function msgTalk(clean) {
  const W = '(문자\\s*메시지|문자|메시지|메세지|카카오\\s*톡|카톡|톡)';
  let m = clean.match(new RegExp(`^(.{1,12}?)\\s*(한테|에게|께|님)?\\s*${W}\\s*(으로|로)?\\s*(?:["“'‘](.+?)["”'’]\\s*(?:이라고|라고|고)?|(.+?)\\s*(?:이라고|라고))?\\s*(좀\\s*)?(보내|해|써|전해|날려)\\s*(줘|줄래|주라|봐)?[!~.?\\s]*$`));
  let name, kw, text = '';
  if (m) { name = m[1]; kw = m[3]; text = (m[5] || m[6] || '').trim(); }
  else {
    m = clean.match(new RegExp(`^(.{1,12}?)\\s*(한테|에게|께)\\s*["“'‘]?(.+?)["”'’]?\\s*(이라고|라고)\\s*${W}\\s*(으로|로)?\\s*(좀\\s*)?(보내|해|써|전해|날려)\\s*(줘|줄래|주라|봐)?[!~.?\\s]*$`));
    if (m) { name = m[1]; text = m[3].trim(); kw = m[5]; }
    else {   // "문자 엄마한테 보내 줘"
      m = clean.match(new RegExp(`^${W}\\s*(좀\\s*)?(.{1,12}?)\\s*(한테|에게|께)\\s*(좀\\s*)?(보내|해|써|전해|날려)\\s*(줘|줄래|주라|봐)?[!~.?\\s]*$`));
      if (!m) return false;
      kw = m[1]; name = m[3];
    }
  }
  const kind = /카|톡/.test(kw) ? 'kakao' : 'sms';
  const c = findPerson(name);
  if (kind === 'sms') {
    if (!c) { say(`📞 연락처에서 <b>${esc(name)}</b>을(를) 못 찾았어. 이름을 다시 말해 줄래?`, { ms: 5000 }); return true; }
    const p = c.phones && c.phones[0];
    if (!p) { say(`${esc(c.name)} 번호가 없어 🥲`, { ms: 4000 }); return true; }
    msgCompose('sms', c.name, p.num, text); return true;
  }
  msgCompose('kakao', c ? c.name : name.trim(), '', text); return true;
}
const findPerson = nm => { nm = String(nm || '').trim(); return S.contacts.find(c => c.name === nm) || (nm.length >= 2 ? S.contacts.find(c => c.name.includes(nm) || nm.includes(c.name)) : null); };
async function peopleTalk(text) {
  const clean = stripName(text);
  if (/HARU-npub1[0-9a-z]+-[0-9a-z]{6}/.test(clean)) { const r = await join(clean); say(r === 'ok' ? '🔗 연결 신청을 보냈어! 상대가 받으면 알려 줄게 🐶' : r === 'self' ? '이건 내가 만든 초대 코드야~' : r === 'net' ? '인터넷 문제로 못 보냈어. 다시 붙여 넣어 줘' : '초대 코드가 이상해. 받은 글을 통째로 붙여 넣어 줘!', { pose: 'joy', ms: 6000 }); return true; }
  if (msgTalk(clean)) return true;   // ✉️💬 문자·카톡 보내기
  const call = clean.match(/^(.{1,12}?)\s*(한테|에게|께|에)?\s*(전화|통화)\s*(좀\s*)?(걸어\s*(줘|줄래)?|해\s*(줘|줄래)|연결해?\s*(줘)?|하자|할래)?[!~.?\s]*$/);
  if (call) { const c = findPerson(call[1]); const p = c && c.phones[0]; if (c) { if (!p) say(`${esc(c.name)} 번호가 없어 🥲`); else say(`📞 <b>${esc(c.name)}</b>  ${esc(p.num)}<br><span class="small">👉 말풍선을 누르면 전화 화면이 열려요. 초록 단추만 누르면 걸려요</span>`, { pose: 'joy', ms: 20000, telNum: p.num, tap: () => dialNum(p.num), buttons: [{ label: '📞 전화 화면 열기', tel: p.num }, { label: '아니', ghost: true }] }); return true; } }
  const m = clean.match(/^(.{1,12}?)\s*(한테|에게|께)\s*["“'‘]?(.+?)["”'’]?\s*(라고|이라고|고)?\s*(전해|보내|말해|알려)\s*(줘|줄래|주라)?[!~.?\s]*$/);
  if (m) { const c = findPerson(m[1]); if (c && c.pk) { await sendTo(c, m[3].trim()); return true; } if (c) { say(`${esc(c.name)}는 아직 하루 예보로 연결 전이야. 📞 연락처에서 🔗 초대해 줘!`, { ms: 5000 }); return true; } }
  const k = clean.match(/^(.{1,12}?)\s*(랑|이랑|하고|와|과)\s*(연결|이야기|얘기|대화|톡)/);
  if (k) { const c = findPerson(k[1]); if (c && c.pk) { startPmode(c); say(`💌 ${esc(c.name)}랑 연결했어! 말창에 쓰면 내가 전해 줄게`, { pose: 'joy' }); return true; } if (c) { say(`${esc(c.name)}는 아직 연결 전이야. 📞 연락처에서 🔗 초대해 줘!`); return true; } }
  return false;
}

// ── 주소록 화면
let pOpen = null, pTalk = null, pShow = null;   // pShow: 이름을 눌러 단추가 보이는 사람 (11-07)
function fmtPhone(n) { const d = String(n).replace(/[^\d+]/g, '').replace(/^\+82/, '0'); if (/^01\d{8,9}$/.test(d)) return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`; return d; }
function addContacts(add) {
  let added = 0;
  for (const a of add) {
    const same = S.contacts.find(x => x.name === a.name || (a.phones || []).some(p => (x.phones || []).some(q => q.num === p.num)));
    if (same) { for (const p of a.phones || []) if (!same.phones.some(q => q.num === p.num)) same.phones.push(p); if (!same.addr && a.addr) same.addr = a.addr; if (!same.bday && a.bday) same.bday = a.bday; }
    else { S.contacts.push({ id: uid(), name: a.name, phones: a.phones || [], addr: a.addr || '', bday: a.bday || null, memo: '' }); added++; }
  }
  save(); return added;
}
async function pickPhoneContacts() {
  const st = t => { const e = $('#pSt'); if (e) e.innerHTML = t; };
  const btn = $('#pPick'); if (btn) btn.disabled = true;
  st('📱 연락처를 가져오는 중… (사람이 많으면 조금 걸려요)');
  if (window.Native && Native.contacts) {   // 앱 파일: 한 번 허락하면 생일까지
    try {
      const l = await Native.contacts();
      if (l) {
        const n = addContacts(l); drawPeople();
        st(`✅ ${l.length}명을 읽어서 새로 ${n}명을 넣었어요!`);
        say(`📒 ${n}명을 연락처에 넣었어! 생일 있는 사람은 미리 알려 줄게 🎂`, { pose: 'joy', ms: 7000 });
        return;
      }
    } catch (e) {
      if (btn) btn.disabled = false;
      if (e && e.denied) { st('⚠️ 연락처 허락이 꺼져 있어요. <button class="btn small" id="pSet">휴대폰 설정에서 켜기</button><br><span class="small">[권한] → [연락처] → [허용] 을 눌러 주세요</span>'); const b = $('#pSet'); if (b) b.onclick = () => Native.appSettings(); return; }
      st('⚠️ 연락처를 못 가져왔어요: ' + esc(String((e && e.message) || e)).slice(0, 120)); return;
    }
  }
  if (!('contacts' in navigator && 'ContactsManager' in window)) { st('이 화면에서는 휴대폰 연락처를 바로 못 읽어요. 연락처 파일(.vcf)을 골라 주세요.'); if (btn) btn.disabled = false; $('#vcfFile').click(); return; }
  try {
    const props = await navigator.contacts.getProperties();
    const list = await navigator.contacts.select(props.filter(p => ['name', 'tel', 'address'].includes(p)), { multiple: true });
    const n = addContacts(list.map(c => ({ name: (c.name || [])[0] || (c.tel || [])[0] || '이름 없음', phones: (c.tel || []).map(x => ({ type: '휴대폰', num: fmtPhone(x) })), addr: ((c.address || [])[0] || {}).addressLine ? c.address[0].addressLine.join(' ') : '' })));
    drawPeople(); st(`✅ 새로 ${n}명을 넣었어요!`);
  } catch { st('⚠️ 연락처를 못 가져왔어요. 다시 눌러 주세요.'); }
  if (btn) btn.disabled = false;
}
$('#vcfFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const buf = new Uint8Array(await f.arrayBuffer()); let text = new TextDecoder('utf-8').decode(buf);
  if (/�/.test(text)) { try { text = new TextDecoder('euc-kr').decode(buf); } catch { } }
  const n = addContacts(parseVcf(text)); say(`📒 ${n}명을 연락처에 넣었어!`, { pose: 'joy' }); drawPeople();
};
function parseVcf(text) {
  const qp = s => { const bytes = []; s = s.replace(/=\r?\n/g, ''); for (let i = 0; i < s.length; i++) { if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.substr(i + 1, 2))) { bytes.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; } else bytes.push(...new TextEncoder().encode(s[i])); } return new TextDecoder().decode(new Uint8Array(bytes)); };
  const lines = []; for (const l of String(text).replace(/\r\n/g, '\n').split('\n')) { if (/^[ \t]/.test(l) && lines.length) lines[lines.length - 1] += l.slice(1); else if (lines.length && /QUOTED-PRINTABLE/i.test(lines[lines.length - 1]) && /=$/.test(lines[lines.length - 1])) lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + l; else lines.push(l); }
  const out = []; let c = null;
  for (const l of lines) {
    if (/^BEGIN:VCARD/i.test(l)) { c = { name: '', phones: [], addr: '', bday: null }; continue; }
    if (/^END:VCARD/i.test(l)) { if (c && (c.name || c.phones.length)) out.push({ ...c, name: c.name || c.phones[0].num }); c = null; continue; }
    if (!c) continue; const i = l.indexOf(':'); if (i < 0) continue;
    const head = l.slice(0, i), key = head.split(';')[0].replace(/^item\d+\./i, '').toUpperCase(); let v = l.slice(i + 1);
    if (/QUOTED-PRINTABLE/i.test(head)) v = qp(v);
    if (key === 'FN') c.name = v.trim(); else if (key === 'TEL') { const n = fmtPhone(v); if (n && !c.phones.some(p => p.num === n)) c.phones.push({ type: '휴대폰', num: n }); }
    else if (key === 'ADR' && !c.addr) { const a = v.split(';'); c.addr = [a[4], a[3], a[2]].filter(Boolean).join(' '); }
    else if (key === 'BDAY') { const m = v.match(/(\d{4})?-?-?(\d{2})-?(\d{2})/); if (m) c.bday = { m: +m[2], d: +m[3] }; }
  }
  return out;
}
function drawPeople() {
  const ordOf = c => c.ord == null ? 1e9 : c.ord;   // 11-07: 끌어 올린 순서 먼저, 나머지는 가나다
  const all = S.contacts.slice().sort((a, b) => ordOf(a) - ordOf(b) || a.name.localeCompare(b.name, 'ko'));
  $('#pAsk').innerHTML = all.length ? `<div class="row"><button class="btn small ghost" id="pPick">🔄 휴대폰 연락처 다시 불러오기</button></div><p class="note small" id="pSt"></p>` : `<h3>📒 너의 핸드폰에 있는 사람들을 내가 관리해 줄까?</h3><p class="note">한 번만 허락하면 전화번호까지 정리해서, 생일도 챙기고 연락도 도와줄게. 이 휴대폰 안에만 저장돼.</p>
    <div class="row"><button class="btn" id="pPick">📱 휴대폰 연락처 가져오기</button></div><p class="note small" id="pSt"></p><p class="note small">아이폰은 연락처 앱에서 '모든 연락처'를 길게 눌러 내보낸 파일(.vcf)을 고르면 돼요.</p>`;
  const q = ($('#pQ').value || '').trim();
  const list = q ? all.filter(c => c.name.includes(q) || c.phones.some(p => p.num.replace(/-/g, '').includes(q.replace(/-/g, '')))) : all;
  const favs = list.filter(c => c.fav), rest = list.filter(c => !c.fav);
  const rowHtml = c => {
    const p = c.phones[0], open = pOpen === c.id, tk = pTalk === c.id, show = pShow === c.id || open || tk;
    return `<div class="prow" data-c="${c.id}"><div class="top">${q ? '' : '<span class="grip" title="끌어서 순서 바꾸기">☰</span>'}<span class="nm">${esc(c.name)}${c.pk ? ' 🔗' : ''}</span><span class="ph">${p ? esc(p.num) : ''}</span></div>
      ${show ? `<div class="acts4">${p ? `<a class="pb" href="tel:${esc(p.num.replace(/-/g, ''))}">📞 전화</a><button class="pb" data-a="sms">💬 문자</button>` : '<span></span><span></span>'}<button class="pb" data-a="edit">✏️ 수정</button><button class="pb ${c.fav ? 'on' : ''}" data-a="fav" title="${c.fav ? '즐겨찾기에서 빼기' : '즐겨찾기에 넣기'}">${c.fav ? '↓' : '↑'}</button></div>${c.bday ? `<p class="note small" style="margin:4px 2px 0">🎂 생일 ${c.bday.m}/${c.bday.d}</p>` : ''}` : ''}
      ${tk ? `<div class="msgs">${(S.pchats[c.id] || []).slice(-30).map(m => `<div class="m ${m.who}">${esc(m.text)}</div>`).join('') || '<p class="note small">첫 마디를 보내 봐!</p>'}</div><div class="row"><input data-f="pm" placeholder="${esc(c.name)}에게 보낼 말"><button class="btn small" data-a="psend">보내기</button></div>` : ''}
      ${open ? `<div class="edit"><input data-f="name" value="${esc(c.name)}" placeholder="이름"><input data-f="phones" value="${esc(c.phones.map(x => x.num).join(', '))}" placeholder="전화번호" inputmode="tel">
        <div class="row">생일 <select data-f="bm"><option value="">-</option>${Array.from({ length: 12 }, (_, i) => `<option ${c.bday && c.bday.m === i + 1 ? 'selected' : ''} value="${i + 1}">${i + 1}월</option>`).join('')}</select><select data-f="bd"><option value="">-</option>${Array.from({ length: 31 }, (_, i) => `<option ${c.bday && c.bday.d === i + 1 ? 'selected' : ''} value="${i + 1}">${i + 1}일</option>`).join('')}</select></div>
        <div class="row">${c.pk ? '<button class="btn small ghost" data-a="talk">💬 대화</button>' : ''}<button class="btn small ghost" data-a="del">🗑 삭제</button><button class="btn small" data-a="close" style="margin-left:auto">다 됐어</button></div></div>` : ''}</div>`;
  };
  $('#pList').innerHTML = (favs.length ? `<p class="phead">⭐ 즐겨찾기 ${favs.length}</p>` + favs.slice(0, 100).map(rowHtml).join('') + (rest.length ? `<p class="phead">📒 전체 ${rest.length}</p>` : '') : '') + rest.slice(0, 300).map(rowHtml).join('') || (all.length ? '<p class="note">찾는 사람이 없어.</p>' : '');
  const pk = $('#pPick'); if (pk) pk.onclick = pickPhoneContacts;
}
$('#pQ').oninput = drawPeople;
$('#pAdd').onclick = () => { if (!S.contacts.length || confirm('휴대폰 연락처를 가져올까? (취소 = 한 사람 직접 넣기)')) { if (!S.contacts.length) return pickPhoneContacts(); return pickPhoneContacts(); } const c = { id: uid(), name: '새 사람', phones: [], addr: '', bday: null, memo: '' }; S.contacts.push(c); save(); pOpen = c.id; drawPeople(); };
$('#pJoin').onclick = async () => { const r = await join($('#pCode').value); say(r === 'ok' ? '🔗 연결 신청을 보냈어! 상대가 받으면 알려 줄게' : r === 'self' ? '이건 내가 만든 초대 코드야~' : '초대 코드가 이상해. 받은 글을 통째로 붙여 넣어 줘!', { ms: 5000 }); if (r === 'ok') { $('#pCode').value = ''; go('home'); } };
$('#pList').addEventListener('click', async e => {
  const row = e.target.closest('[data-c]'), a = e.target.closest('[data-a]'); if (!row) return;
  if (!a) { if (e.target.closest('.top') && !e.target.closest('.grip')) { pShow = pShow === row.dataset.c ? null : row.dataset.c; drawPeople(); } return; }   // 이름 누르면 단추 보이기/숨기기
  const c = S.contacts.find(x => x.id === row.dataset.c); if (!c) return;
  const act = a.dataset.a;
  if (act === 'edit') { pOpen = pOpen === c.id ? null : c.id; return drawPeople(); }
  if (act === 'close') { pOpen = null; return drawPeople(); }
  if (act === 'del') { if (confirm(`${c.name}을(를) 지울까?`)) { S.contacts = S.contacts.filter(x => x.id !== c.id); save(); pOpen = null; drawPeople(); } return; }
  if (act === 'invite') return invite(c);
  if (act === 'fav') { c.fav = !c.fav; save(); pShow = c.id; say(c.fav ? `⭐ ${esc(c.name)} 즐겨찾기에 넣었어` : `${esc(c.name)} 즐겨찾기에서 뺐어`, { ms: 2200 }); return drawPeople(); }
  if (act === 'sms') { const n = (c.phones[0] || {}).num; if (!n) return; const url = 'sms:' + n.replace(/-/g, ''); const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet; if (F && F.openApp) F.openApp({ pkg: '', url }).catch(() => {}); else location.href = url; return; }
  if (act === 'talk') { pTalk = pTalk === c.id ? null : c.id; return drawPeople(); }
  if (act === 'psend') { const el = row.querySelector('[data-f=pm]'), msg = el.value.trim(); if (!msg) return; el.value = ''; await sendTo(c, msg); drawPeople(); }
});
$('#pList').addEventListener('change', e => {
  const row = e.target.closest('[data-c]'), f = e.target.dataset.f; if (!row || !f || f === 'pm') return;
  const c = S.contacts.find(x => x.id === row.dataset.c); if (!c) return;
  if (f === 'name') c.name = e.target.value.trim() || c.name;
  if (f === 'phones') c.phones = e.target.value.split(/[,/]/).map(x => x.trim()).filter(Boolean).map(n => ({ type: '휴대폰', num: fmtPhone(n) }));
  if (f === 'bm' || f === 'bd') { const m = +row.querySelector('[data-f=bm]').value, d = +row.querySelector('[data-f=bd]').value; c.bday = m && d ? { m, d } : null; }
  save();
});
window.addEventListener('load', () => setTimeout(startNostr, 800));

// ☰ 끌어서 순서 바꾸기 (11-07): 손잡이를 꾹 잡고 위아래로 끌면 그 자리로. 바꾼 순서는 저장됨
(function pDragInit() {
  const L = $('#pList'); let drag = null;
  L.addEventListener('pointerdown', e => {
    const g = e.target.closest('.grip'); if (!g) return;
    const row = g.closest('.prow'); e.preventDefault(); g.setPointerCapture(e.pointerId);
    const r = row.getBoundingClientRect();
    drag = { row, g, y0: e.clientY, h: r.height + 8, id: row.dataset.c };
    row.classList.add('dragging');
  });
  L.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = e.clientY - drag.y0; drag.row.style.transform = `translateY(${dy}px)`;
    const rows = [...L.querySelectorAll('.prow')], i = rows.indexOf(drag.row);
    let to = i;
    rows.forEach((x, k) => { if (x === drag.row) return; const rr = x.getBoundingClientRect(), mid = rr.top + rr.height / 2; if (k < i && e.clientY < mid) to = Math.min(to, k); if (k > i && e.clientY > mid) to = Math.max(to, k); });
    rows.forEach(x => x.classList.toggle('dropat', rows.indexOf(x) === to && x !== drag.row));
    drag.to = to;
    const v = L.closest('.view'); if (v) { const vr = v.getBoundingClientRect(); if (e.clientY < vr.top + 60) v.scrollTop -= 12; else if (e.clientY > vr.bottom - 60) v.scrollTop += 12; }
  });
  const end = () => {
    if (!drag) return;
    const rows = [...L.querySelectorAll('.prow')].map(x => x.dataset.c), i = rows.indexOf(drag.id), to = drag.to == null ? i : drag.to;
    rows.splice(i, 1); rows.splice(to, 0, drag.id);
    rows.forEach((id, k) => { const c = S.contacts.find(x => x.id === id); if (c) c.ord = k; });
    save(); drag = null; drawPeople();
  };
  L.addEventListener('pointerup', end); L.addEventListener('pointercancel', end);
})();

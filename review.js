// ✍️ 가게 후기 (11-08): 영수증으로 실제 이용한 사람만 · 공개 통로(Nostr)에 저장 · 🧾 배지 · 🚩 신고 3번이면 가림
// 영수증 사진은 휴대폰 안에서 글자만 읽고 바로 버림 (가게 이름·날짜·승인번호만 확인, 승인번호는 알아볼 수 없게 바꿔서 한 번만)
const KIND_REVIEW = 30078, KIND_REPORT = 1984;
const RV = { place: null, list: [], loading: false, form: null };
const rvKey = p => 'hrv:' + String(p.name).replace(/\s+/g, '') + '@' + (+p.lat).toFixed(3) + ',' + (+p.lon).toFixed(3);
function rvPool() { if (!pool) { myKey(); pool = new NT.SimplePool(); } else if (!SK) myKey(); return pool; }
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32); }
async function rvLoad(p) {
  RV.place = p; RV.list = []; RV.loading = true; RV.form = null; rvDraw();
  try {
    const k = rvKey(p), P = rvPool();
    const [evs, reps] = await Promise.all([P.querySync(RELAYS, { kinds: [KIND_REVIEW], '#l': [k] }, { maxWait: 5000 }), P.querySync(RELAYS, { kinds: [KIND_REPORT], '#l': [k] }, { maxWait: 5000 })]);
    if (RV.place !== p) return;
    const rep = {}; for (const r of reps || []) { const e = (r.tags.find(t => t[0] === 'e') || [])[1]; if (e) (rep[e] = rep[e] || new Set()).add(r.pubkey); }
    RV.list = (evs || []).map(e => { try { const c = JSON.parse(e.content); return { id: e.id, pk: e.pubkey, at: e.created_at, good: !!c.good, text: String(c.text || '').slice(0, 120), proof: c.proof || 'receipt', nick: String(c.nick || '하루 이웃').slice(0, 12), hidden: (rep[e.id] || new Set()).size >= 3, mine: e.pubkey === PK }; } catch { return null; } }).filter(Boolean).sort((a, b) => b.at - a.at);
  } catch { }
  RV.loading = false; rvDraw();
}
function rvDraw() {
  const el = $('#rvBox'); if (!el || !RV.place) return;
  const L = RV.list.filter(x => !x.hidden), g = L.filter(x => x.good).length, b = L.length - g, F = RV.form;
  const when = t => { const d = Math.floor((Date.now() / 1000 - t) / 86400); return d < 1 ? '오늘' : d < 7 ? d + '일 전' : new Date(t * 1000).toLocaleDateString('ko-KR'); };
  el.innerHTML = `<div class="rvbox"><p class="rvhead">✍️ 하루 후기 ${RV.loading ? '<span class="note small">불러오는 중…</span>' : L.length ? `<b>👍 ${g}</b> · <b>👎 ${b}</b>` : '<span class="note small">아직 없어요</span>'}</p>
    ${L.slice(0, 6).map(x => `<div class="rvi"><span class="rvb">🧾 영수증 인증</span> <b>${x.good ? '👍' : '👎'}</b> ${esc(x.text)}<small>${esc(x.nick)} · ${when(x.at)}${x.mine ? '' : ` · <button data-rvrep="${x.id}">🚩 신고</button>`}</small></div>`).join('')}
    ${F ? (F.step === 'reading' ? '<p class="note">🧾 영수증 글자를 읽는 중…</p>' : F.step === 'write' ? `<div class="rvform"><p class="note small">✅ <b>${esc(F.okName)}</b> 영수증 확인 (${esc(F.day)})</p>
        <div class="row bctl"><button data-rvg="1" class="${F.good === true ? 'on' : ''}">👍 좋았어요</button><button data-rvg="0" class="${F.good === false ? 'on' : ''}">👎 별로예요</button></div>
        <input id="rvText" maxlength="100" placeholder="한 줄 후기 (100자까지, 이름·전화번호는 쓰지 마세요)">
        <div class="row bctl"><button data-rv="post" class="bplay">올리기</button><button data-rv="cancel">취소</button></div></div>` : `<p class="note">${F.msg || ''}</p><div class="row bctl"><button data-rv="again">🧾 다시 찍기</button><button data-rv="cancel">닫기</button></div>`)
      : `<button class="btn ghost" data-rv="start" style="width:100%">🧾 영수증으로 후기 쓰기</button><p class="note small">이 가게 영수증(7일 안)을 찍으면 후기를 쓸 수 있어요. 사진은 휴대폰 안에서 글자만 읽고 저장하지 않아요.</p>`}
    <input type="file" id="rvFile" accept="image/*" capture="environment" hidden></div>`;
}
// 영수증 사진 → (작게 줄이고 바로 세워서) → 휴대폰 안 글자 읽기(ML Kit)
async function rvOcr(file) {
  const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
  if (!F || !F.ocr) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const k = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const r = await F.ocr({ data: c.toDataURL('image/jpeg', 0.88) });
    return String(r.text || '');
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}
function rvCheck(text, p) {
  const T = text.replace(/\s+/g, ''), D = text.replace(/\D/g, '');
  const base = String(p.name).replace(/\s+/g, '').replace(/\(.*?\)|\[.*?\]/g, ''), core = base.replace(/(본점|[가-힣]{1,6}점)$/, '');
  const tel = String(p.tel || '').replace(/\D/g, '');
  const nameOk = (core.length >= 2 && T.includes(core)) || (core.length >= 4 && T.includes(core.slice(0, 4))) || (tel.length >= 8 && D.includes(tel.slice(-8)));
  let day = null;
  for (const m of text.matchAll(/(?<!\d)(20\d{2}|\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)/g)) {
    if (+m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) continue;   // 사업자번호 같은 숫자는 건너뛰기
    const y = +m[1] < 100 ? 2000 + +m[1] : +m[1], d = new Date(y, +m[2] - 1, +m[3]), diff = (Date.now() - d) / 864e5;
    if (diff >= -1 && diff <= 7) { day = `${y}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`; break; }
  }
  const appr = (text.match(/승\s*인\s*번\s*호\s*[:：]?\s*(\d{6,12})/) || [])[1] || '';
  const total = (text.replace(/\s+/g, '').match(/(합계|결제금액|받을금액|청구금액|총액)[^\d]{0,6}([\d,]{3,})/) || [])[2] || '';
  return { nameOk, day, uniq: appr || (day && total ? day + '|' + total : '') };
}
async function rvFromPhoto(file) {
  const p = RV.place; RV.form = { step: 'reading' }; rvDraw();
  const text = await rvOcr(file);
  if (text === null) { RV.form = { step: 'fail', msg: '영수증 읽기는 <b>갤럭시 앱</b>에서 돼요.' }; return rvDraw(); }
  const c = rvCheck(text, p);
  if (!c.nameOk) { RV.form = { step: 'fail', msg: `영수증에서 <b>${esc(p.name)}</b> 가게 이름(또는 전화번호)을 못 찾았어 🥲 가게 이름이 잘 보이게 다시 찍어 줘.` }; return rvDraw(); }
  if (!c.day) { RV.form = { step: 'fail', msg: '영수증 날짜를 못 찾았거나 7일이 지났어 🥲 날짜가 잘 보이게 다시 찍어 줘.' }; return rvDraw(); }
  if (!c.uniq) { RV.form = { step: 'fail', msg: '영수증의 승인번호나 합계 금액을 못 읽었어 🥲 다시 찍어 줘.' }; return rvDraw(); }
  const rh = await sha(rvKey(p) + '|' + c.uniq);
  RV.form = { step: 'reading' }; rvDraw();
  try { const used = await rvPool().querySync(RELAYS, { kinds: [KIND_REVIEW], '#x': [rh] }, { maxWait: 4000 }); if (used && used.length) { RV.form = { step: 'fail', msg: '이 영수증으로는 이미 후기를 썼어. 영수증 한 장에 후기 하나야.' }; return rvDraw(); } } catch { }
  RV.form = { step: 'write', rh, day: c.day, okName: p.name, good: null }; rvDraw();
}
const rvClean = s => String(s || '').replace(/\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, '***').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '***').trim().slice(0, 100);
async function rvPost() {
  const F = RV.form, p = RV.place; if (!F || F.step !== 'write') return;
  if (F.good == null) return say('👍 좋았어요 / 👎 별로예요 중에 골라 줘', { ms: 2500 });
  const text = rvClean(($('#rvText') || {}).value); if (text.length < 2) return say('한 줄 후기를 써 줘', { ms: 2500 });
  rvPool(); const k = rvKey(p);
  const ev = NT.finalizeEvent({ kind: KIND_REVIEW, created_at: Math.floor(Date.now() / 1000), tags: [['d', k + '|' + F.rh], ['l', k], ['x', F.rh], ['t', 'haru-review']], content: JSON.stringify({ v: 1, good: F.good, text, proof: 'receipt', day: F.day, nick: (S.town && S.town.nick) || '하루 이웃', name: p.name }) }, SK);
  try { await Promise.any(pool.publish(RELAYS, ev)); } catch { return say('후기를 못 올렸어 🥲 인터넷을 확인하고 다시 해 줘', { ms: 3000 }); }
  say('✍️ 후기를 올렸어! 고마워 💛', { ms: 2500 }); RV.form = null; rvLoad(p);
}
async function rvReport(id) {
  if (!confirm('이 후기를 신고할까? (욕설·거짓·광고·개인정보) 신고가 3번 모이면 가려져요.')) return;
  rvPool(); const k = rvKey(RV.place);
  try { await Promise.any(pool.publish(RELAYS, NT.finalizeEvent({ kind: KIND_REPORT, created_at: Math.floor(Date.now() / 1000), tags: [['e', id, 'other'], ['l', k]], content: '하루 예보 후기 신고' }, SK))); say('🚩 신고했어. 고마워', { ms: 2500 }); } catch { say('신고를 못 보냈어 🥲', { ms: 2500 }); }
  rvLoad(RV.place);
}
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#rvBox')) return;
  const a = (e.target.closest('[data-rv]') || {}).dataset; const rep = e.target.closest('[data-rvrep]'); const g = e.target.closest('[data-rvg]');
  if (rep) return rvReport(rep.dataset.rvrep);
  if (g && RV.form) { RV.form.good = g.dataset.rvg === '1'; const t = ($('#rvText') || {}).value; rvDraw(); if (t && $('#rvText')) $('#rvText').value = t; return; }
  if (!a) return;
  if (a.rv === 'start' || a.rv === 'again') { const f = $('#rvFile'); if (f) { f.value = ''; f.click(); } }
  if (a.rv === 'cancel') { RV.form = null; rvDraw(); }
  if (a.rv === 'post') rvPost();
});
document.addEventListener('change', e => { if (e.target.id === 'rvFile' && e.target.files && e.target.files[0]) rvFromPhoto(e.target.files[0]); });

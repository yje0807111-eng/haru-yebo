// 🎨 내 방 꾸미기 (휴대폰) — 가족·친구·학교… 이름 있는 방에 사진·동영상·글씨, 공개하면 이웃이 구경 (PC 와 같은 모양)
const ROOM_NAMES = [['👨‍👩‍👧', '가족'], ['🤝', '친구'], ['🏫', '학교'], ['💼', '직장'], ['🧸', '물건'], ['🌱', '식물'], ['✈️', '여행'], ['🐶', '반려동물']];
const newRoom = (name) => { const emo = (ROOM_NAMES.find(([, n]) => n === name) || ['🏠'])[0]; return { name, bg: 'g:linear-gradient(160deg,#FFDEE9,#B5FFFC)', bgImg: null, items: [{ id: 't1', type: 'text', x: 50, y: 9, w: 34, rot: -2, text: `${emo} ${name}`, color: '#2B2118', font: 0, size: 1, z: 1 }], strokes: [], open: false }; };
if (!S.album) { S.album = { open: false, intro: '', cur: 0, pages: [newRoom('가족')] }; save(); }
let rSel = null, rNaming = null;
const RM = () => S.album.pages[S.album.cur] || S.album.pages[0];
function bgCss(r) { if (r.bgImg) return `center/cover url(${r.bgImg})`; const k = r.bg || 'c:#FFF7DF'; return k.startsWith('c:') || k.startsWith('g:') ? k.slice(2) : '#FFF7DF'; }
function renderBoard(el, r, editable) {
  el.style.background = bgCss(r);
  const W = el.clientWidth || 340;
  el.innerHTML = [...(r.items || [])].sort((a, b) => (a.z || 0) - (b.z || 0)).map(it => {
    const base = `left:${it.x}%;top:${it.y}%;width:${it.w}%;transform:translate(-50%,-50%) rotate(${it.rot || 0}deg);z-index:${it.z || 0};`;
    let inner = '';
    if (it.type === 'photo') inner = `<img src="${it.src}" draggable="false" alt="">${it.video ? '<span class="vid">▶</span>' : ''}${it.cap ? `<div class="cap">${esc(it.cap)}</div>` : ''}`;
    if (it.type === 'text') inner = `<span style="color:${it.color || '#2B2118'};font-size:${(it.w / 100 * W / Math.max(4, [...it.text].length) * 1.5 * (it.size || 1)).toFixed(0)}px;font-weight:800">${esc(it.text)}</span>`;
    if (it.type === 'sticker') inner = `<span style="font-size:${(it.w / 100 * W * 0.85).toFixed(0)}px">${it.text}</span>`;
    return `<div class="ritem ${it.type} ${editable && rSel === it.id ? 'sel' : ''}" data-id="${it.id}" style="${base}">${inner}</div>`;
  }).join('');
}
function drawRoom() {
  const a = S.album, names = a.pages.map(p => p.name).filter(Boolean);
  $('#roomBox').innerHTML = `
  <div class="rtabs">${a.pages.map((p, i) => `<button data-pg="${i}" class="${i === a.cur ? 'on' : ''}">${esc(p.name || (i + 1) + '쪽')}</button>`).join('')}<button data-pa="add">＋ 새 방</button></div>
  ${rNaming ? `<div class="card"><b>${rNaming === 'add' ? '새 방 이름' : '이 방 이름'}</b><div class="likes">${ROOM_NAMES.filter(([, n]) => rNaming === 'rename' || !names.includes(n)).map(([e, n]) => `<button data-nm="${n}">${e} ${n}</button>`).join('')}</div><div class="row"><input id="rNameIn" placeholder="직접 쓰기" maxlength="12"><button class="btn small" data-nm="__in">정하기</button><button class="btn small ghost" data-nm="__x">✕</button></div></div>` : ''}
  <div class="rboard" id="rBoard"></div>
  <div class="rsel" id="rSelBar">${rSel ? `<button data-a="big">➕ 크게</button><button data-a="small">➖ 작게</button><button data-a="rot">↻ 돌리기</button><button data-a="up">⬆ 앞으로</button><button data-a="del">🗑 지우기</button>` : '<span class="note small">사진·글씨를 눌러 고르고, 끌어서 옮겨요</span>'}</div>
  <div class="row"><button class="btn" id="rPhoto" style="flex:1">🖼️ 사진·동영상 가져오기</button><button class="btn" id="rText" style="flex:1">🔤 글씨 넣기</button></div>
  <div class="row" id="rTextRow" hidden><input id="rTextIn" placeholder="넣을 글씨" maxlength="40"><button class="btn small" id="rTextOk">넣기</button></div>
  <div class="row" style="justify-content:space-between"><button class="btn small ghost" data-pa="rename">✏️ 방 이름</button><button class="btn small ghost" data-pa="del">🗑 방 지우기</button></div>
  <label class="chk"><input type="checkbox" id="rOpen" ${a.open ? 'checked' : ''}> 🌍 모두에게 공개 (이웃이 구경할 수 있어요)</label>
  <input type="file" id="rFile" accept="image/*,video/*" multiple hidden>`;
  renderBoard($('#rBoard'), RM(), true);
}
function shrink(src, max, q) { return new Promise(res => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', q)); }; im.onerror = () => res(null); im.src = src; }); }
function videoFrame(f) { return new Promise(res => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.src = URL.createObjectURL(f); v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); }; v.onseeked = () => { const c = document.createElement('canvas'); const k = Math.min(1, 600 / Math.max(v.videoWidth, v.videoHeight)); c.width = v.videoWidth * k; c.height = v.videoHeight * k; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.75)); }; v.onerror = () => res(null); }); }
function addItem(it) { const r = RM(); it.id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); it.z = Math.max(0, ...r.items.map(i => i.z || 0)) + 1; r.items.push(it); rSel = it.id; save(); drawRoom(); pubRoom(); }
let pubT = 0;
function pubRoom() {
  clearTimeout(pubT);
  pubT = setTimeout(async () => {
    if (!pool) return;
    const now = () => Math.floor(Date.now() / 1000);
    const put = (d, content) => Promise.any(pool.publish(RELAYS, NT.finalizeEvent({ kind: KIND_PRESENCE, created_at: now(), tags: [['d', d]], content }, SK)));
    const a = S.album;
    if (!a.open) { try { await put(APP + '-room', JSON.stringify({ closed: true })); } catch { } return; }
    const fit = src => new Promise(res => { const im = new Image(); im.onload = async () => { let m = 360, q = 0.6, d = ''; for (let i = 0; i < 6; i++) { const c = document.createElement('canvas'); const k = Math.min(1, m / Math.max(im.width, im.height)); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); d = c.toDataURL('image/jpeg', q); if (d.length <= 20000) break; m *= 0.8; q = Math.max(0.35, q - 0.07); } res(d.length <= 20000 ? d : null); }; im.onerror = () => res(null); im.src = src; });
    const pages = [];
    for (const pg of a.pages) { const r = structuredClone(pg), imgs = []; for (const it of r.items) if (it.type === 'photo') { if (imgs.length >= 12) { it.drop = true; continue; } const d = await fit(it.src); if (d) { it.ref = imgs.length; imgs.push(d); } else it.drop = true; delete it.src; } r.items = r.items.filter(x => !x.drop); delete r.bgImg; pages.push({ room: r, imgs }); }
    try { await put(APP + '-room', JSON.stringify({ open: true, intro: a.intro || '', n: pages.length })); } catch { return say('⚠ 방 공개를 못 했어 (인터넷 확인)', { ms: 3000 }); }
    for (let p = 0; p < pages.length; p++) { try { await put(`${APP}-room-p${p}`, JSON.stringify(pages[p].room)); } catch { } for (let i = 0; i < pages[p].imgs.length; i++) { try { await put(`${APP}-room-p${p}-img-${i}`, pages[p].imgs[i]); } catch { } } }
  }, 1500);
}
// 이웃 방 구경
async function visitRoom(who, nick) {
  say('🏠 방을 불러오는 중… 🐾', { ms: 8000 });
  const ds = [APP + '-room']; for (let p = 0; p < 12; p++) { ds.push(`${APP}-room-p${p}`); for (let i = 0; i < 13; i++) ds.push(`${APP}-room-p${p}-img-${i}`); }
  const evs = await pool.querySync(RELAYS, { kinds: [KIND_PRESENCE], authors: [who], '#d': ds }, { maxWait: 6000 }).catch(() => []);
  const byD = {}; for (const e of evs) { const d = (e.tags.find(t => t[0] === 'd') || [])[1]; if (!byD[d] || byD[d].created_at < e.created_at) byD[d] = e; }
  let a = null; try { a = JSON.parse((byD[APP + '-room'] || {}).content); } catch { }
  if (!a || a.closed) return say('이 이웃은 방을 공개하지 않았어', { ms: 3000 });
  const ok = c => /^data:image\/(jpeg|png|webp);base64,/.test(c || '') ? c : null;
  const pages = []; for (let p = 0; p < Math.min(12, a.n || 0); p++) { const e = byD[`${APP}-room-p${p}`]; if (!e) continue; let r; try { r = JSON.parse(e.content); } catch { continue; } r.items = (r.items || []).map(it => it.type === 'photo' ? { ...it, src: ok((byD[`${APP}-room-p${p}-img-${it.ref}`] || {}).content) } : it).filter(it => it.type !== 'photo' || it.src); pages.push(r); }
  if (!pages.length) return say('방을 못 불러왔어 🥲', { ms: 3000 });
  hideBubble();
  const box = document.createElement('div'); box.className = 'roomview'; let cur = 0;
  box.innerHTML = `<div class="card" style="margin:0"><div class="row" style="justify-content:space-between"><b>🏠 ${esc(nick || '이웃')}의 방</b><button class="btn small ghost" data-x="1">✕</button></div><div class="rtabs" id="rvTabs"></div><div class="rboard" id="rvBoard"></div></div>`;
  document.body.appendChild(box);
  const show = i => { cur = i; box.querySelector('#rvTabs').innerHTML = pages.map((p, k) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${esc(p.name || (k + 1) + '쪽')}</button>`).join(''); renderBoard(box.querySelector('#rvBoard'), pages[cur], false); };
  box.onclick = e => { if (e.target.dataset.x || e.target === box) box.remove(); const k = e.target.closest('[data-k]'); if (k) show(+k.dataset.k); };
  show(0);
}
// 끌어서 옮기기 (손가락)
let rDrag = null;
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('#rBoard'); if (!b) return;
  const el = e.target.closest('.ritem'); if (!el) { rSel = null; return drawRoom(); }
  const it = RM().items.find(x => x.id === el.dataset.id); if (!it) return;
  if (rSel !== it.id) { rSel = it.id; drawRoom(); }
  const rc = $('#rBoard').getBoundingClientRect();
  rDrag = { it, rc, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, moved: false };
  e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!rDrag) return;
  const d = rDrag; const dx = (e.clientX - d.sx) / d.rc.width * 100, dy = (e.clientY - d.sy) / d.rc.height * 100;
  if (Math.abs(dx) + Math.abs(dy) > 1) d.moved = true;
  d.it.x = Math.max(0, Math.min(100, d.ox + dx)); d.it.y = Math.max(0, Math.min(100, d.oy + dy));
  const el = document.querySelector(`#rBoard [data-id="${d.it.id}"]`); if (el) { el.style.left = d.it.x + '%'; el.style.top = d.it.y + '%'; }
});
document.addEventListener('pointerup', () => { if (rDrag) { if (rDrag.moved) { save(); pubRoom(); } rDrag = null; } });
document.addEventListener('click', async e => {
  if (!e.target.closest('#roomBox')) return;
  const id = e.target.id, a = S.album;
  if (id === 'rPhoto') return $('#rFile').click();
  if (id === 'rText') { $('#rTextRow').hidden = false; $('#rTextIn').focus(); return; }
  if (id === 'rTextOk') { const v = $('#rTextIn').value.trim(); if (v) addItem({ type: 'text', text: v, x: 50, y: 50, w: Math.min(80, 12 + [...v].length * 6), rot: 0, color: pick(['#2B2118', '#E0245E', '#2F74D8', '#2EAD5A', '#8E44AD']), font: 0, size: 1 }); return; }
  const pg = e.target.closest('[data-pg]'), pa = e.target.closest('[data-pa]'), nm = e.target.closest('[data-nm]'), act = e.target.closest('[data-a]');
  if (pg) { a.cur = +pg.dataset.pg; rSel = null; save(); return drawRoom(); }
  if (pa) {
    const k = pa.dataset.pa;
    if (k === 'add') { rNaming = rNaming === 'add' ? null : 'add'; return drawRoom(); }
    if (k === 'rename') { rNaming = rNaming === 'rename' ? null : 'rename'; return drawRoom(); }
    if (k === 'del') { if (a.pages.length <= 1) return say('방은 하나는 있어야 해 🙂', { ms: 2500 }); if (!confirm(`'${RM().name || ''}' 방을 지울까?`)) return; a.pages.splice(a.cur, 1); a.cur = 0; save(); drawRoom(); pubRoom(); return; }
  }
  if (nm) {
    const v = nm.dataset.nm === '__in' ? ($('#rNameIn').value || '').trim() : nm.dataset.nm;
    if (nm.dataset.nm === '__x' || !v) { rNaming = null; return drawRoom(); }
    if (rNaming === 'add') { a.pages.push(newRoom(v)); a.cur = a.pages.length - 1; }
    else { const r = RM(), old = r.name; r.name = v; const tt = r.items.find(i => i.type === 'text' && (i.id === 't1' || (old && i.text.includes(old)))); if (tt) tt.text = `${(ROOM_NAMES.find(([, n]) => n === v) || ['🏠'])[0]} ${v}`; }
    rNaming = null; save(); drawRoom(); pubRoom(); return;
  }
  if (act && rSel) {
    const r = RM(), it = r.items.find(x => x.id === rSel); if (!it) return;
    const k = act.dataset.a;
    if (k === 'big') it.w = Math.min(100, it.w * 1.2); if (k === 'small') it.w = Math.max(6, it.w / 1.2); if (k === 'rot') it.rot = ((it.rot || 0) + 15) % 360;
    if (k === 'up') it.z = Math.max(0, ...r.items.map(i => i.z || 0)) + 1;
    if (k === 'del') { r.items = r.items.filter(x => x.id !== rSel); rSel = null; }
    save(); drawRoom(); pubRoom();
  }
});
document.addEventListener('change', async e => {
  if (e.target.id === 'rFile') {
    const fs = [...e.target.files].slice(0, 12); e.target.value = '';
    say(`📷 사진 ${fs.length}장 넣는 중…`, { ms: 4000 });
    for (const f of fs) { const src = f.type.startsWith('video') ? await videoFrame(f) : await shrink(URL.createObjectURL(f), 700, 0.78); if (src) addItem({ type: 'photo', src, x: 25 + Math.random() * 50, y: 30 + Math.random() * 45, w: 34, rot: Math.round(Math.random() * 14 - 7), frame: 'polaroid', video: f.type.startsWith('video') }); }
  }
  if (e.target.id === 'rOpen') { S.album.open = e.target.checked; save(); pubRoom(); if (S.town && S.town.open) publishMe(); say(S.album.open ? '🌍 내 방을 공개했어! 이웃이 구경하러 올 거야 🏡' : '🔒 이제 내 방은 나만 볼게', { ms: 3500 }); }
});
document.addEventListener('keydown', e => { if (e.target.id === 'rTextIn' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('#rTextOk').click(); } if (e.target.id === 'rNameIn' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); document.querySelector('[data-nm="__in"]').click(); } });

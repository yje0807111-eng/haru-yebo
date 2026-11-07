// 🎵 뮤직방 (11-07): 전체 음악 · 아티스트 · 장르 · 즐겨듣기 — 곡마다 ▶/⏸ · ⏭ · ♡ · 장르/가수 정하기 · 빼기
const GENRES = ['발라드', '댄스', '트로트', '힙합', '알앤비', '록', '인디', '팝', 'OST', '재즈', '클래식', '찬양', '동요', '기타'];
let mTab = 'all', mSel = '', mQ = '', mEdit = null;
function openMusic() { hideBubble(); petOnly(false); go('music'); drawMusic(true); }
async function drawMusic(load) {
  const box = $('#musicBox'); if (!box) return;
  if (load || !musicCache) { box.innerHTML = '<p class="note">🎵 휴대폰 노래를 불러오는 중…</p>'; const l = await musicFiles(); if (l === null) { box.innerHTML = '<div class="card"><p class="note">휴대폰 노래를 보려면 <b>음악 파일 허락</b>이 필요해요.</p><button class="btn" id="mPerm">허락하러 가기</button></div>'; $('#mPerm').onclick = () => window.Native && Native.appSettings && Native.appSettings(); return; } }
  const all = songs(), now = window.musicNow || {}, playing = !!now.playing, curId = +now.id || 0;
  const cnt = { all: all.length, fav: all.filter(x => x.fav).length };
  const byKey = k => { const m = new Map(); for (const x of all) { const v = k === 'A' ? x.A : (x.G || '장르 없음'); m.set(v, (m.get(v) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')); };
  let list = [], head = '';
  if (mTab === 'all') list = all;
  else if (mTab === 'fav') list = all.filter(x => x.fav);
  else if (mSel) { list = all.filter(x => (mTab === 'artist' ? x.A : (x.G || '장르 없음')) === mSel); head = `<div class="mhead"><button class="btn small ghost" id="mBack">◀ ${mTab === 'artist' ? '아티스트' : '장르'}</button><b>${esc(mSel)}</b> <span class="note small">${list.length}곡</span>${mTab === 'artist' ? `<select id="mBulkG"><option value="">이 가수 장르 정하기</option>${GENRES.map(g => `<option>${g}</option>`).join('')}</select>` : ''}</div>`; }
  if (mQ) { const nq = norm(mQ); list = (mTab === 'artist' || mTab === 'genre') && !mSel ? all.filter(x => norm(x.t + x.A + x.G).includes(nq)) : list.filter(x => norm(x.t + x.A + x.G).includes(nq)); }
  const tabs = [['all', `전체 음악 ${cnt.all}`], ['artist', '아티스트'], ['genre', '장르'], ['fav', `♥ 즐겨듣기 ${cnt.fav}`]];
  const cur = all.find(x => x.id === curId);
  let html = `<div class="mnow ${playing ? 'on' : ''}"><div class="mt">${cur ? `🎵 <b>${esc(cur.t)}</b><span>${esc(cur.A)}</span>` : now.title ? `🎵 <b>${esc(now.title)}</b><span>${esc(now.artist || '')}</span>` : '<span>노래를 골라 ▶ 를 눌러 보세요</span>'}</div>
    <div class="mc"><button data-m="prev">⏮</button><button data-m="${playing ? 'pause' : 'play'}" class="big">${playing ? '⏸' : '▶'}</button><button data-m="next">⏭</button><button data-m="shuf" title="섞어 듣기">🔀</button></div></div>
    <div class="seg mtabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${mTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <input id="mQ" placeholder="🔍 제목·가수·장르 찾기" value="${esc(mQ)}">`;
  if ((mTab === 'artist' || mTab === 'genre') && !mSel && !mQ) {
    const groups = byKey(mTab === 'artist' ? 'A' : 'G');
    html += `<div class="mgroups">${groups.map(([k, n]) => `<button class="mgrp" data-sel="${esc(k)}"><b>${esc(k)}</b><span>${n}곡</span><i data-gplay="${esc(k)}">▶</i></button>`).join('') || '<p class="note">노래가 없어요</p>'}</div>`;
    if (mTab === 'genre') html += '<p class="note small">장르는 곡마다 ✎ 를 눌러 정하거나, 아티스트 안에서 "이 가수 장르 정하기"로 한 번에 정할 수 있어요.</p>';
  } else {
    html += head + (list.length ? `<div class="mbar"><button class="btn small" id="mAll">▶ 전체 듣기</button><button class="btn small ghost" id="mShuf">🔀 섞어 듣기</button><span class="note small">${list.length}곡</span></div>` : '');
    html += `<div class="mlist">${list.slice(0, 400).map(x => {
      const isCur = x.id === curId, ed = mEdit === x.id;
      return `<div class="mrow ${isCur ? 'cur' : ''}" data-id="${x.id}">
        <button class="fav ${x.fav ? 'on' : ''}" data-a="fav">${x.fav ? '♥' : '♡'}</button>
        <div class="info" data-a="play"><b>${esc(x.t)}</b><span>${esc(x.A)}${x.G ? ' · ' + esc(x.G) : ''}</span></div>
        <button data-a="${isCur && playing ? 'pause' : 'play'}">${isCur && playing ? '⏸' : '▶'}</button>${isCur ? '<button data-a="next">⏭</button>' : ''}<button data-a="edit">✎</button><button data-a="hide" title="목록에서 빼기">✕</button>
        ${ed ? `<div class="medit"><select data-f="g"><option value="">장르 고르기</option>${GENRES.map(g => `<option ${x.G === g ? 'selected' : ''}>${g}</option>`).join('')}<option value="__new">+ 새 장르</option></select><input data-f="a" value="${esc(x.A === '알 수 없는 가수' ? '' : x.A)}" placeholder="가수 이름"><button class="btn small" data-a="done">다 됐어</button></div>` : ''}
      </div>`; }).join('') || `<p class="note">${mTab === 'fav' ? '♡ 를 누른 노래가 여기에 모여요' : '노래가 없어요'}</p>`}</div>`;
    const hidN = songs(true).filter(x => x.hid).length;
    if (mTab === 'all' && hidN) html += `<p class="note small" style="text-align:center"><button class="btn small ghost" id="mUnhide">뺀 노래 ${hidN}곡 다시 넣기</button></p>`;
  }
  html += '<p class="note small" style="text-align:center">✕ 는 목록에서만 빼요. 휴대폰의 노래 파일은 지우지 않아요.</p>';
  box.innerHTML = html;
  window._mList = list;
}
document.addEventListener('click', async e => {
  const box = $('#musicBox'); if (!box || !box.contains(e.target)) return;
  const F = MF();
  const tb = e.target.closest('[data-tab]'); if (tb) { mTab = tb.dataset.tab; mSel = ''; mEdit = null; return drawMusic(); }
  const gp = e.target.closest('[data-gplay]'); if (gp) { e.stopPropagation(); const k = gp.dataset.gplay; const l = songs().filter(x => (mTab === 'artist' ? x.A : (x.G || '장르 없음')) === k); return playList(shuffle(l), 0, `${k} ${l.length}곡`); }
  const sl = e.target.closest('[data-sel]'); if (sl) { mSel = sl.dataset.sel; return drawMusic(); }
  if (e.target.id === 'mBack') { mSel = ''; return drawMusic(); }
  if (e.target.id === 'mAll') return playList(window._mList || [], 0, '전체');
  if (e.target.id === 'mShuf') return playList(shuffle(window._mList || []), 0, '섞어서');
  if (e.target.id === 'mUnhide') { for (const x of songs(true)) if (x.hid) setMeta(x.id, { hid: false }); return drawMusic(); }
  const mc = e.target.closest('[data-m]'); if (mc) { const c = mc.dataset.m; if (c === 'shuf') return playList(shuffle(window._mList && window._mList.length ? window._mList : songs()), 0, '섞어서'); if (F && F.musicCtl) await F.musicCtl({ cmd: c }).catch(() => {}); return; }
  const row = e.target.closest('.mrow'), a = e.target.closest('[data-a]'); if (!row || !a) return;
  const id = +row.dataset.id, x = songs(true).find(s => s.id === id); if (!x) return;
  const act = a.dataset.a;
  if (act === 'fav') { setMeta(id, { fav: !x.fav }); return drawMusic(); }
  if (act === 'play') { if (id === +((window.musicNow || {}).id) && !(window.musicNow || {}).playing && F) { await F.musicCtl({ cmd: 'play' }).catch(() => {}); return; } const l = window._mList || [x]; return playList(l, Math.max(0, l.findIndex(s => s.id === id))); }
  if (act === 'pause') { if (F) await F.musicCtl({ cmd: 'pause' }).catch(() => {}); return; }
  if (act === 'next') { if (F) await F.musicCtl({ cmd: 'next' }).catch(() => {}); return; }
  if (act === 'hide') { setMeta(id, { hid: true }); if (id === +((window.musicNow || {}).id) && F) await F.musicCtl({ cmd: 'next' }).catch(() => {}); return drawMusic(); }
  if (act === 'edit') { mEdit = mEdit === id ? null : id; return drawMusic(); }
  if (act === 'done') { mEdit = null; return drawMusic(); }
});
document.addEventListener('change', e => {
  const box = $('#musicBox'); if (!box || !box.contains(e.target)) return;
  if (e.target.id === 'mBulkG' && e.target.value) { const g = e.target.value; for (const x of songs().filter(s => s.A === mSel)) setMeta(x.id, { g }); say(`🎵 ${esc(mSel)} 노래를 모두 '${esc(g)}'(으)로 정했어!`, { ms: 2500 }); return drawMusic(); }
  const row = e.target.closest('.mrow'); if (!row) return; const id = +row.dataset.id;
  if (e.target.dataset.f === 'g') { let g = e.target.value; if (g === '__new') { g = (prompt('새 장르 이름') || '').trim(); if (!g) return drawMusic(); if (!GENRES.includes(g)) GENRES.splice(GENRES.length - 1, 0, g); } setMeta(id, { g }); return drawMusic(); }
  if (e.target.dataset.f === 'a') { setMeta(id, { a: e.target.value.trim() }); }
});
document.addEventListener('input', e => { if (e.target.id === 'mQ') { mQ = e.target.value; clearTimeout(window._mqT); window._mqT = setTimeout(() => { drawMusic().then(() => { const i = $('#mQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 300); } });
// 노래가 바뀌거나 멈추면 뮤직방도 바로 바뀜
if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet && Capacitor.Plugins.FloatPet.addListener) Capacitor.Plugins.FloatPet.addListener('music', d => { window.musicNow = d; if (view === 'music') drawMusic(); });

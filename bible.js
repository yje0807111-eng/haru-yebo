// 📖 성경 보며 듣기 (11-07) — 개역한글, 한 번 내려받으면 인터넷 없이 · 휴대폰 목소리로 한 절씩
const BIBLE_CH = [50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4,
  28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22];
const BB = { b: 40, c: 1, at: -1, playing: false, verses: [], fs: 20, rate: 1.0, dl: '' };   // b = 1~66
const BTTS = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet && Capacitor.Plugins.FloatPet.ttsSpeak ? Capacitor.Plugins.FloatPet : null;

// ── 휴대폰 저장소 (IndexedDB)
function bdb() {
  return new Promise((ok, no) => { const r = indexedDB.open('haruBible', 1); r.onupgradeneeded = () => { r.result.createObjectStore('krv'); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
}
async function bget(k) { const d = await bdb(); return new Promise(ok => { const q = d.transaction('krv').objectStore('krv').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(undefined); }); }
async function bput(k, v) { const d = await bdb(); return new Promise(ok => { const t = d.transaction('krv', 'readwrite'); t.objectStore('krv').put(v, k); t.oncomplete = () => ok(true); t.onerror = () => ok(false); }); }
const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// 한 장 가져오기: 저장된 것 → 없으면 인터넷에서 그 장만
async function bChapter(b, c) {
  const all = await bget('b' + b).catch(() => null);
  if (all && all[c - 1]) return all[c - 1];
  const one = await bget(`c${b}_${c}`).catch(() => null); if (one) return one;
  if (!navigator.onLine) return null;
  try {
    const r = await fetch(`https://bolls.life/get-chapter/KRV/${b}/${c}/`); const d = await r.json();
    const v = d.sort((x, y) => x.verse - y.verse).map(x => clean(x.text)); if (v.length) bput(`c${b}_${c}`, v); return v;
  } catch { return null; }
}
// 📥 성경 전체 내려받기 (한 번만, 약 11MB)
async function bDownload() {
  if (BB.dl === 'ing') return;
  if (!navigator.onLine) { say('인터넷이 될 때 한 번만 내려받으면 그다음부터는 인터넷 없이 돼!', { ms: 4000 }); return; }
  BB.dl = 'ing'; drawBible();
  try {
    const r = await fetch('https://bolls.life/static/translations/KRV.json');
    const total = +r.headers.get('Content-Length') || 11163338, rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; const el = $('#bDlPct'); if (el) el.textContent = Math.min(99, Math.round(got / total * 100)) + '%'; }
    const txt = new TextDecoder().decode(await new Blob(parts).arrayBuffer());
    const books = {};
    for (const v of JSON.parse(txt)) { const bk = books[v.book] = books[v.book] || []; const ch = bk[v.chapter - 1] = bk[v.chapter - 1] || []; ch[v.verse - 1] = clean(v.text); }
    for (const k in books) await bput('b' + k, books[k].map(ch => (ch || []).filter(x => x != null)));
    await bput('done', Date.now()); BB.dl = 'done';
    say('📖 성경 전체를 휴대폰에 저장했어! 이제 인터넷 없이도 볼 수 있어', { ms: 4000 });
  } catch (e) { BB.dl = ''; say('내려받다가 끊겼어 🥲 다시 눌러 줘', { ms: 3500, important: true }); }
  drawBible();
}

// ── 화면
function openBible(book, ch, read) {
  if (typeof stopOthers === 'function') stopOthers('bible');
  hideBubble(); petOnly(false); go('bible');
  if (book) { const i = BIBLE.indexOf(book); if (i >= 0) BB.b = i + 1; }
  if (ch) BB.c = Math.max(1, Math.min(BIBLE_CH[BB.b - 1], ch));
  bLoad(read);
}
async function bLoad(read) {
  bStop(true); BB.at = -1; BB.verses = []; drawBible('loading');
  const v = await bChapter(BB.b, BB.c);
  BB.verses = v || []; S.bible = { b: BB.b, c: BB.c, fs: BB.fs, rate: BB.rate }; save();
  drawBible(v ? '' : 'none');
  if (read && v) bRead(0);
}
async function drawBible(st) {
  const box = $('#bibleBox'); if (!box) return;
  if (BB.dl !== 'ing' && BB.dl !== 'done') BB.dl = (await bget('done').catch(() => null)) ? 'done' : '';
  const name = BIBLE[BB.b - 1], n = BIBLE_CH[BB.b - 1];
  box.innerHTML = `<div class="card bnav">
      <div class="row"><select id="bBook">${BIBLE.map((b, i) => `<option value="${i + 1}" ${i + 1 === BB.b ? 'selected' : ''}>${b}</option>`).join('')}</select>
      <select id="bCh" style="flex:none;width:90px">${Array.from({ length: n }, (_, i) => `<option value="${i + 1}" ${i + 1 === BB.c ? 'selected' : ''}>${i + 1}장</option>`).join('')}</select></div>
      <div class="row bctl"><button data-b="prev">◀ 앞 장</button><button data-b="play" class="bplay">${BB.playing ? '⏸ 멈춤' : '▶ 읽어 줘'}</button><button data-b="next">다음 장 ▶</button></div>
      <div class="row bctl small"><button data-b="fs-">가−</button><button data-b="fs+">가+</button><button data-b="slow" class="${BB.rate < 1 ? 'on' : ''}">느리게</button><button data-b="norm" class="${BB.rate === 1 ? 'on' : ''}">보통</button><button data-b="fast" class="${BB.rate > 1 ? 'on' : ''}">빠르게</button></div></div>
    <div class="card btext" style="font-size:${BB.fs}px"><h3>${name} ${BB.c}장</h3>${st === 'loading' ? '<p class="note">불러오는 중…</p>' : st === 'none' ? `<p class="note">이 장은 아직 휴대폰에 없어 🥲<br>인터넷이 될 때 아래 <b>성경 전체 내려받기</b>를 한 번 눌러 줘.</p>` : BB.verses.map((t, i) => `<p class="bv ${i === BB.at ? 'on' : ''}" data-v="${i}"><sup>${i + 1}</sup>${esc(t)}</p>`).join('')}</div>
    <div class="card"><h3>📥 인터넷 없이 보기</h3>${BB.dl === 'done' ? '<p class="note">✅ 성경 전체가 휴대폰에 저장돼 있어요. 인터넷이 없어도 보고 들을 수 있어요.</p>' : BB.dl === 'ing' ? '<p class="note">내려받는 중… <b id="bDlPct">0%</b> (화면을 그대로 두세요)</p>' : '<p class="note">한 번만 내려받으면 그다음부터 인터넷 없이 돼요 (약 11MB, 와이파이 추천)</p><button class="btn" data-b="dl">📥 성경 전체 내려받기</button>'}
    <p class="note small">개역한글 · 본문은 bolls.life 에서 받아요 · 목소리는 휴대폰에 들어 있는 한국어 목소리</p></div>`;
  if (BB.at >= 0) { const e = box.querySelector('.bv.on'); if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
document.addEventListener('change', e => {
  if (e.target.id === 'bBook') { BB.b = +e.target.value; BB.c = 1; bLoad(); }
  if (e.target.id === 'bCh') { BB.c = +e.target.value; bLoad(); }
});
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#bibleBox')) return;
  const bv = e.target.closest('.bv'); if (bv) return bRead(+bv.dataset.v);   // 그 절부터 읽기
  const b = e.target.closest('[data-b]'); if (!b) return;
  const a = b.dataset.b;
  if (a === 'play') return BB.playing ? bStop() : bRead(BB.at >= 0 ? BB.at : 0);
  if (a === 'prev' || a === 'next') return bStep(a === 'next' ? 1 : -1, BB.playing);
  if (a === 'fs-' || a === 'fs+') { BB.fs = Math.max(14, Math.min(34, BB.fs + (a === 'fs+' ? 2 : -2))); S.bible = Object.assign(S.bible || {}, { fs: BB.fs }); save(); return drawBible(); }
  if (a === 'slow' || a === 'norm' || a === 'fast') { BB.rate = a === 'slow' ? 0.8 : a === 'fast' ? 1.25 : 1.0; S.bible = Object.assign(S.bible || {}, { rate: BB.rate }); save(); if (BB.playing) bRead(BB.at); return drawBible(); }
  if (a === 'dl') return bDownload();
});
function bStep(d, read) {
  let b = BB.b, c = BB.c + d;
  if (c < 1) { if (b > 1) { b--; c = BIBLE_CH[b - 1]; } else c = 1; }
  if (c > BIBLE_CH[b - 1]) { if (b < 66) { b++; c = 1; } else c = BIBLE_CH[b - 1]; }
  BB.b = b; BB.c = c; bLoad(read);
}

// ── 읽기 (한 절씩, 끝나면 다음 절 → 장 끝나면 다음 장)
let bId = '';
async function bRead(i) {
  if (!BB.verses.length) return;
  if (i >= BB.verses.length) return bStep(1, true);
  BB.at = i; BB.playing = true; drawBible();
  const id = bId = `${BB.b}_${BB.c}_${i}_${Date.now()}`;
  const text = (i === 0 ? `${BIBLE[BB.b - 1]} ${BB.c}장. ` : '') + BB.verses[i];
  const F = BTTS();
  if (F) {
    const r = await F.ttsSpeak({ text, id, rate: BB.rate }).catch(() => ({ st: 'nodata' }));
    if (r.st === 'nodata') { BB.playing = false; drawBible(); say('휴대폰에 한국어 목소리가 없어 🥲 설치 화면을 열게', { ms: 4000, important: true }); F.ttsInstall().catch(() => {}); }
    return;
  }
  if (window.speechSynthesis) {   // 웹(PC)에서
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = BB.rate;
    u.onend = () => { if (bId === id && BB.playing) bRead(i + 1); }; speechSynthesis.speak(u); return;
  }
  BB.playing = false; drawBible(); say('읽어 주기는 갤럭시 앱에서 돼요', { ms: 3000 });
}
function bStop(quiet) {
  const was = BB.playing; BB.playing = false; bId = '';
  const F = BTTS(); if (F) F.ttsStop().catch(() => {}); else if (window.speechSynthesis) speechSynthesis.cancel();
  if (!quiet && was) drawBible();
}
// 휴대폰 목소리가 한 절 다 읽으면 → 다음 절
(function () {
  const F = BTTS(); if (!F || !F.addListener) return;
  F.addListener('tts', d => {
    if (!d || d.id !== bId || !BB.playing) return;
    if (d.what === 'done') bRead(BB.at + 1);
    else if (d.what === 'nodata') { BB.playing = false; drawBible(); }
  });
})();
// 처음: 지난번 보던 곳
(function () { try { const s = (window.S && S.bible) || {}; if (s.b) BB.b = s.b; if (s.c) BB.c = s.c; if (s.fs) BB.fs = s.fs; if (s.rate) BB.rate = s.rate; } catch { } })();

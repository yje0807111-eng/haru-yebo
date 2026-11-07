// 📺 TV방 (11-07): 내가 넣어 둔 유튜브 채널·재생목록을 주제별로 — "개그 틀어 줘" 하면 개그 채널 영상만
// 유튜브가 허락한 '퍼가기 재생'으로 TV 화면 안에서 틀고, 팻이 아래에서 같이 봄. 검색·열쇠 필요 없음.
const TV_CATS0 = ['뮤직영상', '영화', '개그', '춤', '짤', '낚시', '도서', '요리', '동물', '뉴스'];
const TV_APPS = [['유튜브', 'com.google.android.youtube', 'https://www.youtube.com'], ['틱톡', 'com.zhiliaoapp.musically', 'https://www.tiktok.com'], ['인스타', 'com.instagram.android', 'https://www.instagram.com/reels/'], ['넷플릭스', 'com.netflix.mediaclient', 'https://www.netflix.com'], ['티빙', 'net.cj.cjhv.gs.tving', 'https://www.tving.com'], ['웨이브', 'kr.co.captv.pooqV2', 'https://www.wavve.com'], ['쿠팡플레이', 'com.coupang.mobile.play', 'https://www.coupangplay.com'], ['디즈니', 'com.disney.disneyplus', 'https://www.disneyplus.com']];
const TV = () => (S.tv = S.tv || { cats: TV_CATS0.slice(), chans: [] });

const tvNum = cat => TV().cats.indexOf(cat) + 1;   // 1번·2번… 채널
const tvSorted = list => list.slice().sort((a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9) || (a.rank || 99) - (b.rank || 99));
let tvOrderEdit = false;
let tvCat = '', tvAdd = false, tvNow = null, tvBig = false, tvPetT = 0;
const YT = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
function openTV(cat) { hideBubble(); petOnly(false); go('tv'); if (cat) tvCat = cat; drawTV(); tvDefaults(false); }

// 주소 → { kind, list(재생목록 번호), name }
async function tvParse(url) {
  url = String(url || '').trim(); if (!url) return null;
  if (!/^https?:/.test(url)) url = url.startsWith('@') ? 'https://www.youtube.com/' + url : 'https://www.youtube.com/@' + url.replace(/\s/g, '');
  const pl = url.match(/[?&]list=([A-Za-z0-9_-]+)/); if (pl) { let name = '재생목록'; try { const r = await YT().ytResolve({ url: 'https://www.youtube.com/playlist?list=' + pl[1] }); if (r.title) name = r.title; } catch { } return { kind: 'playlist', list: pl[1], name, url }; }
  const ch = url.match(/\/channel\/(UC[0-9A-Za-z_-]{22})/);
  let id = ch && ch[1], name = '', image = '';
  const F = YT();
  if (F && F.ytResolve) { try { const r = await F.ytResolve({ url }); id = id || r.channelId; name = r.title || ''; image = r.image || ''; } catch { } }
  if (!id) return null;
  return { kind: 'channel', list: 'UU' + id.slice(2), id, name: name || '채널', image, url };
}

function drawTV() {
  const box = $('#tvBox'); if (!box) return;
  const T = TV(), cats = T.cats, chans = T.chans;
  const inCat = tvSorted(tvCat ? chans.filter(c => c.cat === tvCat) : chans.slice().sort((a, b) => tvNum(a.cat) - tvNum(b.cat)));
  let h = `<div class="tvset ${tvBig ? 'big' : ''}" id="tvSet"><div class="tvscreen">${tvNow ? `<iframe id="tvFrame" src="${tvSrc(tvNow)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>` : `<div class="tvoff"><b>📺</b><span>${chans.length ? '주제나 채널을 골라 ▶ 를 눌러 보세요' : '먼저 [+ 채널 추가] 로 좋아하는 유튜브 채널을 넣어 주세요'}</span></div>`}</div>
    <div class="tvbar"><span class="tvname">${tvNow ? `📡 ${tvNow.cat ? tvNum(tvNow.cat) + '번 ' + esc(tvNow.cat) + ' · ' : ''}${esc(tvNow.name)}` : '꺼짐'}</span>
      <button data-tv="prev">⏮</button><button data-tv="next">⏭</button><button data-tv="other" title="다른 채널">🔀</button><button data-tv="big" title="크게 보기">${tvBig ? '🗗' : '⛶'}</button><button data-tv="off" title="끄기">⏻</button>${tvNow ? '<button data-tv="app" title="유튜브 앱에서 보기">↗</button>' : ''}</div>
    <img class="tvpet" id="tvPet" alt=""></div>`;
  h += `<div class="tvcats"><button data-cat="" class="${!tvCat ? 'on' : ''}">전체 ${chans.length}</button>${cats.map((c, i) => `<button data-cat="${esc(c)}" class="${tvCat === c ? 'on' : ''}"><em>${i + 1}</em>${esc(c)}</button>`).join('')}<button data-cat="__new">+ 주제</button><button data-cat="__order">✏️ 순서</button></div>`;
  if (tvOrderEdit) h += `<div class="card tvorder"><h3>✏️ 채널 번호 순서</h3><p class="note small">▲▼ 로 순서를 바꾸면 그 순서대로 1번·2번 채널이 돼요. "3번 틀어 줘" 라고 말할 수 있어요.</p>${cats.map((c, i) => `<div class="tvo" data-oc="${esc(c)}"><b>${i + 1}</b><span>${esc(c)}</span><i class="note small">${(T.rank || {})[c] ? '인기 ' + T.rank[c] + '위' : '내 주제'}</i><button data-o="up">▲</button><button data-o="down">▼</button></div>`).join('')}<div class="row"><button class="btn small ghost" id="tvOrderReset">인기 순위대로</button><button class="btn small" id="tvOrderDone">다 됐어</button></div></div>`;
  if (tvCat) h += `<div class="mbar"><button class="btn small" id="tvPlayCat">▶ ${tvNum(tvCat)}번 ${esc(tvCat)} 틀기</button><span class="note small">"${tvNum(tvCat)}번 틀어 줘" · "${esc(tvCat)} 틀어 줘"</span></div>`;
  h += `<div class="card tvadd">${tvAdd ? `<h3>+ 채널 넣기</h3><p class="note small">유튜브 앱에서 채널(또는 재생목록) → 공유 → <b>링크 복사</b> 후 붙여 넣기. @이름 만 써도 돼요.</p>
      <input id="tvUrl" placeholder="https://youtube.com/@채널  또는  재생목록 주소"><div class="row"><select id="tvCatSel">${cats.map(c => `<option ${c === tvCat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><button class="btn" id="tvSave">넣기</button><button class="btn ghost" id="tvCancel">닫기</button></div><p class="note small" id="tvSt"></p>`
    : `<button class="btn" id="tvOpenAdd">+ 채널 추가</button>`}</div>`;
  h += `<div class="tvlist">${inCat.map(c => `<div class="tvrow ${tvNow && tvNow.list === c.list ? 'cur' : ''}" data-ch="${c.list}">${c.image ? `<img src="${esc(c.image)}" alt="">` : '<i>📺</i>'}<div class="info" data-t="play"><b>${esc(c.name)}</b><span>${esc(c.cat)} · ${c.kind === 'playlist' ? '재생목록' : '채널'}${c.subs ? ' · ' + esc(c.subs) : ''}${c.def ? ' · ⭐기본' : ''}</span></div>${tvCat ? '<button data-t="up" title="위로">▲</button>' : ''}<button data-t="play">▶</button><select data-t="cat">${cats.map(x => `<option ${x === c.cat ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><button data-t="del">✕</button></div>`).join('') || (chans.length ? '<p class="note">이 주제에는 아직 채널이 없어요</p>' : '')}</div>`;
  if ((T.removed || []).length) h += `<p class="note small" style="text-align:center"><button class="btn small ghost" id="tvRestore">뺀 기본 채널 ${T.removed.length}개 다시 넣기</button></p>`;
  h += `<div class="card"><h3>📱 다른 영상 앱 열기</h3><div class="tvapps">${TV_APPS.map(([n, p]) => `<button data-app="${p}">${n}</button>`).join('')}</div><p class="note small">틱톡·인스타·넷플릭스 같은 앱은 하루 예보 안에서 틀 수 없어서 그 앱을 열어 줘요. "넷플릭스 열어 줘" 라고 말해도 돼요.</p></div>`;
  box.innerHTML = h;
  const f = $('#tvFrame'); if (f) f.onload = () => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'tv', channel: 'widget' }), '*'); } catch { } };   // 다음 영상 등 명령을 받게
  tvPetLoop();
}
function tvSrc(c) {
  const start = Math.floor(Math.random() * (c.kind === 'channel' ? 15 : 5));
  return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(c.list)}&index=${start}&autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
}
function tvPlay(c, quiet) {
  if (!c) return; tvNow = c; if (view !== 'tv') { go('tv'); } drawTV();
  if (!quiet) say(`📺 ${esc(c.name)} 틀게! "다음 영상", "다른 채널", "크게 보기" 라고 말해 줘`, { ms: 3500 });
}
function tvPlayCat(cat) {
  const l = TV().chans.filter(c => !cat || c.cat === cat);
  if (!l.length) { openTV(cat); say(cat ? `"${esc(cat)}" 주제에 넣어 둔 채널이 없어! [+ 채널 추가] 로 넣어 줘 📺` : '넣어 둔 채널이 없어! [+ 채널 추가] 로 넣어 줘 📺', { ms: 5000 }); return; }
  tvCat = cat || ''; const ls = tvSorted(l), w = ls.map((_, i) => 1 / (i + 1)), sum = w.reduce((a, b) => a + b, 0); let r = Math.random() * sum, k = 0; while (k < ls.length - 1 && (r -= w[k]) > 0) k++;   // 순위 높은 채널을 더 자주
  const pickc = tvNow && ls.length > 1 && ls[k].list === tvNow.list ? ls[(k + 1) % ls.length] : ls[k]; tvPlay(pickc);
}
function tvCmd(cmd) {   // 유튜브 플레이어에 직접 명령 (enablejsapi)
  const f = $('#tvFrame'); if (!f) return;
  f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*');
}
// 팻이 같이 봄: 가끔 웃기·박수
function tvPetLoop() {
  clearInterval(tvPetT); const im = $('#tvPet'); if (!im) return;
  const C = CH || {}, A = C.anims || {}, Sp = C.sprites || {};
  const frames = n => A[n] ? A[n].frames : Sp[n] ? [Sp[n].file] : null;
  const poses = ['앉아', '웃어', '기쁨', '즐거움', '윙크'].map(frames).filter(Boolean);
  if (!poses.length) { im.src = DIR() + (Sp['정면'] || {}).file; return; }
  let cur = poses[0], k = 0, tick = 0;
  tvPetT = setInterval(() => {
    if (!tvNow) { cur = poses[0]; }
    else if (++tick % 40 === 0) cur = poses[Math.floor(Math.random() * poses.length)];
    k = (k + 1) % cur.length; im.src = DIR() + cur[k];
  }, 150);
}
document.addEventListener('click', async e => {
  const box = $('#tvBox'); if (!box || !box.contains(e.target)) return;
  const T = TV();
  const ob = e.target.closest('[data-o]'); if (ob) { const c = ob.closest('[data-oc]').dataset.oc, i = T.cats.indexOf(c), j = ob.dataset.o === 'up' ? i - 1 : i + 1; if (j >= 0 && j < T.cats.length) { [T.cats[i], T.cats[j]] = [T.cats[j], T.cats[i]]; T.myOrder = true; save(); drawTV(); } return; }
  if (e.target.id === 'tvOrderDone') { tvOrderEdit = false; return drawTV(); }
  if (e.target.id === 'tvOrderReset') { T.myOrder = false; T.defVer = ''; tvOrderEdit = false; await tvDefaults(false); return drawTV(); }
  const cb = e.target.closest('[data-cat]'); if (cb && cb.dataset.cat === '__order') { tvOrderEdit = !tvOrderEdit; return drawTV(); }
  if (cb) { let c = cb.dataset.cat; if (c === '__new') { c = (prompt('새 주제 이름 (예: 운동)') || '').trim(); if (!c) return; if (!T.cats.includes(c)) T.cats.push(c); save(); } tvCat = c; return drawTV(); }
  const tv = e.target.closest('[data-tv]'); if (tv) {
    const a = tv.dataset.tv;
    if (a === 'next') return tvCmd('nextVideo');
    if (a === 'prev') return tvCmd('previousVideo');
    if (a === 'other') return tvPlayCat(tvNow ? tvNow.cat : tvCat);
    if (a === 'big') { tvBig = !tvBig; $('#tvSet').classList.toggle('big', tvBig); tv.textContent = tvBig ? '🗗' : '⛶'; return; }
    if (a === 'off') { tvNow = null; tvBig = false; return drawTV(); }
    if (a === 'app' && tvNow) { const F = YT(); const url = 'https://www.youtube.com/playlist?list=' + tvNow.list; if (F && F.openApp) F.openApp({ pkg: 'com.google.android.youtube', url }); else window.open(url, '_blank'); return; }
  }
  const ap = e.target.closest('[data-app]'); if (ap) { const x = TV_APPS.find(z => z[1] === ap.dataset.app); const F = YT(); if (F && F.openApp) F.openApp({ pkg: x[1], url: '' }).then(r => { if (!r.ok) F.openApp({ pkg: '', url: x[2] }); }); else window.open(x[2], '_blank'); return; }
  if (e.target.id === 'tvOpenAdd') { tvAdd = true; drawTV(); const i = $('#tvUrl'); if (i) i.focus(); return; }
  if (e.target.id === 'tvCancel') { tvAdd = false; return drawTV(); }
  if (e.target.id === 'tvPlayCat') return tvPlayCat(tvCat);
  if (e.target.id === 'tvRestore') { tvDefaults(true); return; }
  if (e.target.id === 'tvSave') {
    const st = $('#tvSt'); st.textContent = '📡 채널을 찾는 중…'; e.target.disabled = true;
    const c = await tvParse($('#tvUrl').value); e.target.disabled = false;
    if (!c) { st.innerHTML = '⚠️ 채널을 못 찾았어요. 유튜브 앱의 <b>공유 → 링크 복사</b> 주소를 붙여 넣어 주세요.'; return; }
    c.cat = $('#tvCatSel').value || tvCat || T.cats[0];
    if (T.chans.some(x => x.list === c.list)) { st.textContent = '이미 넣은 채널이에요'; return; }
    T.chans.push(c); save(); tvAdd = false; tvCat = c.cat; drawTV(); say(`📺 "${esc(c.name)}" 을(를) ${esc(c.cat)} 에 넣었어!`, { ms: 3000 }); return;
  }
  const row = e.target.closest('.tvrow'), t = e.target.closest('[data-t]'); if (!row || !t) return;
  const c = T.chans.find(x => x.list === row.dataset.ch); if (!c) return;
  if (t.dataset.t === 'play') return tvPlay(c, true);
  if (t.dataset.t === 'up') { const l = tvSorted(T.chans.filter(x => x.cat === c.cat)), i = l.indexOf(c); if (i > 0) { [l[i - 1], l[i]] = [l[i], l[i - 1]]; l.forEach((x, k) => x.ord = k); c.mine = true; save(); drawTV(); } return; }
  if (t.dataset.t === 'del') { if (confirm(`"${c.name}" 채널을 뺄까?`)) { if (c.def) { T.removed = T.removed || []; T.removed.push(c.list); } T.chans = T.chans.filter(x => x !== c); if (tvNow && tvNow.list === c.list) tvNow = null; save(); drawTV(); } }
});
document.addEventListener('change', e => { const row = e.target.closest && e.target.closest('.tvrow'); if (!row || e.target.dataset.t !== 'cat') return; const c = TV().chans.find(x => x.list === row.dataset.ch); if (c) { c.cat = e.target.value; c.mine = true; save(); drawTV(); } });

// 말 알아듣기 → 처리했으면 true
function tvTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').trim(), T = TV();
  if (/^(tv|티비|텔레비전|TV)\s*(방)?\s*(좀\s*)?(켜|틀어|보여|열어|보자)/i.test(t)) { openTV(); return true; }
  const app = TV_APPS.find(([n]) => t.startsWith(n) && /(열어|켜|틀어|보여|가)/.test(t) && !/(노래|음악)/.test(t));
  if (app && app[0] !== '유튜브') { const F = YT(); if (F && F.openApp) F.openApp({ pkg: app[1], url: '' }).then(r => { if (!r.ok) F.openApp({ pkg: '', url: app[2] }); }); else window.open(app[2], '_blank'); say(`📱 ${app[0]} 열게!`, { ms: 2500 }); return true; }
  const nm = t.match(/^(?:채널\s*)?(\d{1,2}|[일이삼사오육칠팔구십]{1,2})\s*번\s*(?:채널)?\s*(?:좀\s*)?(?:틀어|보여|켜|돌려|봐)?/) || t.match(/^채널\s*(\d{1,2})/);
  if (nm && (/(틀어|보여|켜|돌려|채널)/.test(t))) { const n = /^\d+$/.test(nm[1]) ? +nm[1] : (window.HA && HA.num ? HA.num(nm[1]) : 0); const cat = T.cats[n - 1]; if (cat) { tvPlayCat(cat); return true; } }
  if (view === 'tv' || tvNow) {
    if (/^(다음\s*(영상|거|꺼)|넘겨)/.test(t)) { tvCmd('nextVideo'); return true; }
    if (/^(이전\s*(영상|거)|앞\s*(영상|거))/.test(t)) { tvCmd('previousVideo'); return true; }
    if (/^(영상|티비|tv)?\s*(멈춰|정지|그만\s*봐|일시\s*정지)/i.test(t)) { tvCmd('pauseVideo'); return true; }
    if (/^(영상\s*)?(다시\s*(틀어|봐|재생))/.test(t)) { tvCmd('playVideo'); return true; }
    if (/^(다른\s*채널|채널\s*(바꿔|돌려))/.test(t)) { tvPlayCat(tvNow ? tvNow.cat : tvCat); return true; }
    if (/^(크게\s*(보기|봐|보여)|전체\s*화면)/.test(t)) { tvBig = true; const s = $('#tvSet'); if (s) s.classList.add('big'); return true; }
    if (/^(작게\s*(보기|봐)|원래대로)/.test(t)) { tvBig = false; const s = $('#tvSet'); if (s) s.classList.remove('big'); return true; }
    if (/^(티비|tv|영상)\s*(꺼|끄)/i.test(t)) { tvNow = null; drawTV(); return true; }
  }
  const m = t.match(/^(.+?)\s*(tv|티비|영상|채널|동영상)?\s*(좀\s*)?(틀어|보여|켜|보자|볼래)\s*(줘|줄래|주라|봐|줘요|주세요)?$/i);
  if (m) {
    const w = m[1].trim().replace(/(관련|재미있는|웃긴)$/, '').trim(), nw = norm(w);
    const ch = T.chans.find(c => norm(c.name) && (norm(c.name).includes(nw) || nw.includes(norm(c.name)))) ;
    const cat = T.cats.find(c => norm(c) === nw || nw.startsWith(norm(c)) || norm(c).startsWith(nw) && nw.length >= 2);
    if (cat && (m[2] || T.chans.some(c => c.cat === cat))) { tvPlayCat(cat); return true; }
    if (ch && m[2] !== undefined) { tvPlay(ch); return true; }
    if (ch && /(채널|tv|티비)/i.test(t)) { tvPlay(ch); return true; }
    if (/^(재미있는|웃긴|재밌는)\s*(영상|거)?$/.test(m[1].trim()) || (/^(영상|동영상)$/.test(w))) { const fun = T.cats.find(c => c === '개그') || ''; tvPlayCat(T.chans.some(c => c.cat === fun) ? fun : ''); return true; }
  }
  return false;
}
// 노래 이벤트처럼 뷰가 바뀌면 팻 반복 멈춤
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInterval(tvPetT); else if (view === 'tv') tvPetLoop(); });

// 📦 기본 채널 (11-07): tv.json(하루 예보가 정한 주제별 인기 채널)을 받아 합침 — 내가 뺀 채널·바꾼 주제는 그대로 둠
// 인터넷(github.io)에서 새 목록을 받으므로, 목록을 바꿔 올리면 앱을 다시 깔지 않아도 모두에게 바뀜
async function tvDefaults(force) {
  let d = null;
  try { d = await (await fetch('https://yje0807111-eng.github.io/haru-yebo/tv.json?t=' + Date.now(), { cache: 'no-store' })).json(); } catch { }
  if (!d) try { d = await (await fetch('tv.json')).json(); } catch { }
  if (!d || !d.chans) return;
  const T = TV(); if (!force && T.defVer === d.ver) return;
  T.removed = T.removed || [];
  if (!T.myOrder) { const mine = T.cats.filter(c => !(d.cats || []).includes(c) && T.chans.some(x => x.cat === c && !x.def)); T.cats = [...(d.cats || []), ...mine]; }   // 기본 순위 (내가 만든 주제는 뒤에)
  else for (const c of d.cats || []) if (!T.cats.includes(c)) T.cats.push(c);
  T.rank = d.rank || {};
  for (const c of d.chans) {
    if (T.removed.includes(c.list) && !force) continue;
    const ex = T.chans.find(x => x.list === c.list);
    if (ex) { if (ex.def) { ex.name = c.name; ex.image = c.image; ex.subs = c.subs; ex.rank = c.rank; if (!ex.mine) ex.cat = c.cat; } continue; }
    T.chans.push({ ...c });
  }
  if (force) T.removed = [];
  const keep = new Set(d.chans.map(c => c.list));
  T.chans = T.chans.filter(c => !c.def || keep.has(c.list) || c.mine);   // 기본 목록에서 빠진 기본 채널은 정리
  T.defVer = d.ver; save(); if (view === 'tv') drawTV();
}
window.addEventListener('load', () => setTimeout(() => tvDefaults(false), 3000));

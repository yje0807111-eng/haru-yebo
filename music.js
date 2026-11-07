// 🎵 노래 (11-07): "노래 들려줘", "아이유 노래 틀어 줘", "다음 곡", "멈춰", "소리 키워", "지금 무슨 노래야?"
// ① 휴대폰 노래 파일에서 찾으면 하루 예보가 바로 틀고 ② 없으면 고른 음악 앱을 열어 찾아 틀고 ③ 조절은 어느 쪽이든 ④ 노래 나오면 팻이 춤
const MUSIC_APPS = [['', '알아서 고르기'], ['com.sec.android.app.music', '삼성 뮤직'], ['com.iloen.melon', '멜론'], ['com.ktmusic.geniemusic', '지니'], ['com.google.android.apps.youtube.music', '유튜브 뮤직'], ['com.spotify.music', '스포티파이'], ['skplanet.musicmate', 'FLO'], ['com.naver.vibe', '바이브'], ['com.google.android.youtube', '유튜브']];
let musicCache = null;
const MF = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
async function musicFiles() {
  if (musicCache) return musicCache;
  const F = MF(); if (!F || !F.musicList) return [];
  try { const r = await F.musicList(); musicCache = r.list || []; } catch (e) { if (String(e && e.message || e).includes('denied')) { say('🎵 휴대폰 노래를 틀려면 <b>음악 파일</b> 허락이 필요해!', { ms: 8000, buttons: [{ label: '허락하러 가기', act: () => window.Native && Native.appSettings && Native.appSettings() }, { label: '괜찮아', ghost: true }] }); musicCache = null; return null; } musicCache = []; }
  return musicCache;
}

// 📚 내 노래 도서관 (11-07 뮤직방): 파일 정보 + 내가 정한 가수(a)·장르(g)·즐겨듣기(fav)·뺀 노래(hid)
const MM = () => (S.musicMeta = S.musicMeta || {});
function songs(withHidden) {
  const m = MM();
  return (musicCache || []).map(x => { const o = m[x.id] || {}; return { ...x, A: o.a || x.a || '알 수 없는 가수', G: o.g || x.g || '', fav: !!o.fav, hid: !!o.hid }; }).filter(x => withHidden || !x.hid);
}
function setMeta(id, p) { const m = MM(); m[id] = { ...(m[id] || {}), ...p }; save(); }
async function playList(list, start = 0, label) {
  const F = MF(); if (!F || !F.musicPlay) { say('갤럭시 앱에서 쓸 수 있어 🎵', { ms: 2500 }); return; }
  if (!list.length) { say('들을 노래가 없어 🥲', { ms: 2500 }); return; }
  window.mQueue = list.map(x => x.id);
  await F.musicPlay({ list: list.slice(0, 500).map(x => ({ id: x.id, t: x.t, a: x.A })), start }).catch(() => {});
  setPose('dance'); P.until = performance.now() + 8000;
  if (label) say(`🎵 ${label} 틀게! "다음 곡", "멈춰" 라고 말해 줘`, { ms: 3500 });
}
const norm = t => String(t || '').toLowerCase().replace(/[\s\-_.,·()[\]'"!?~]/g, '');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// 🎵 휴대폰에 없는 노래 → 유튜브에서 전곡 찾아 뮤직방에서 (11-07: 음악 앱은 미리듣기만 나와서)
async function musicYT(q) {
  if (typeof ytFind !== 'function') return musicApp(q);
  say(`🎵 "${esc(q)}" 찾는 중…`, { ms: 3000 });
  const secs = l => l.split(':').reduce((a, b) => a * 60 + +b, 0);
  const r = (await ytFind(q + ' 노래')).filter(v => !v.live && v.len && secs(v.len) >= 90 && secs(v.len) <= 600 && !/(shorts|커버\s*연습|1시간|반복)/i.test(v.title));
  if (!r.length) return musicApp(q);
  wPlayer(r.slice(0, 15).map(v => v.id), `🎵 ${q}`, { kind: 'yt', q });
  say(`🎵 <b>${esc(r[0].title.slice(0, 40))}</b><br><span class="small">"다음 곡" · "노래 꺼 줘"</span>`, { pose: 'dance', ms: 4000 });
}
async function musicApp(q) {
  const F = MF(); if (!F || !F.musicApp) { say('노래는 갤럭시 앱에서 틀 수 있어 🎵', { ms: 3000 }); return; }
  const pkg = S.music && S.music.app || '';
  const r = await F.musicApp({ pkg, q: q || '' }).catch(() => ({ ok: false }));
  say(r.ok ? (q ? `🎵 "${esc(q)}" 찾아서 틀어 볼게!` : '🎵 음악 앱을 열었어!') : '음악 앱을 못 열었어 🥲 설정 → 🎵 노래 에서 앱을 골라 줘', { pose: r.ok ? 'dance' : 'sad', ms: 4000 });
}
async function musicPlay(q) {
  const pref = (S.music && S.music.plain) || 'files';
  if (!q && pref === 'app') return musicApp('');
  const list = await musicFiles(); if (list === null) return;
  const all = songs();
  let pick_ = [];
  if (q) {
    const nq = norm(q);
    if (/^(즐겨\s*듣기|즐겨찾기|좋아하는\s*(노래|곡)?|내가\s*좋아하는\s*(노래|곡)?|찜한\s*(노래|곡)?)$/.test(q)) { pick_ = all.filter(x => x.fav); if (!pick_.length) { say('아직 즐겨듣기 노래가 없어! 뮤직방에서 ♡ 를 눌러 줘 🎵', { ms: 4000 }); return; } return playList(shuffle(pick_), 0, '즐겨듣기 ' + pick_.length + '곡'); }
    const byG = all.filter(x => x.G && norm(x.G) === nq.replace(/(노래|음악|곡|장르)$/, ''));
    if (byG.length) return playList(shuffle(byG), 0, `${q} ${byG.length}곡`);
    pick_ = all.filter(x => norm(x.t).includes(nq) || norm(x.A).includes(nq) || (norm(x.A).length > 1 && nq.includes(norm(x.A))));
  } else pick_ = shuffle(all);
  if (!pick_.length) return q ? musicYT(q) : musicApp(q);   // 파일에 없으면 유튜브 전곡 (음악 앱은 미리듣기만 나옴)
  if (q && pick_.length > 1) pick_ = shuffle(pick_);
  return playList(pick_, 0, q ? `"${esc(q)}" ${pick_.length}곡` : '휴대폰 노래');
}
async function musicCtl(cmd, line) {
  const F = MF(); if (!F || !F.musicCtl) { say('갤럭시 앱에서 쓸 수 있어 🎵', { ms: 2500 }); return; }
  await F.musicCtl({ cmd }).catch(() => {});
  say(line, { pose: cmd === 'pause' || cmd === 'stop' ? 'sit' : 'dance', ms: 2500 });
}
async function musicStopAll() {   // 휴대폰 노래 + 멜론 등 다른 앱 + 유튜브 듣기 전부
  if (typeof wStop === 'function') wStop();
  const F = MF(); if (F && F.musicCtl) await F.musicCtl({ cmd: 'stopall' }).catch(() => {});
  say('⏹ 노래 다 껐어', { pose: 'sit', ms: 2500 });
}
async function musicNow() {
  const F = MF(); const r = F && F.musicNow ? await F.musicNow().catch(() => ({})) : {};
  if (r && r.title) say(`🎵 지금 ${r.playing ? '나오는' : '멈춰 있는'} 노래는<br><b>${esc(r.title)}</b>${r.artist ? ' · ' + esc(r.artist) : ''} 이야!`, { pose: 'dance', ms: 6000 });
  else say('지금은 나오는 노래가 없어 🎵 "노래 들려줘" 라고 해 봐!', { ms: 4000 });
}
// 말 알아듣기 → 처리했으면 true
async function musicTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').trim();
  if (/^(뮤직\s*방|음악\s*방|노래\s*방)\s*(좀\s*)?(열어|보여|가|들어가)/.test(t)) { openMusic(); return true; }
  if (/^(지금\s*)?(무슨|뭔|어떤)\s*(노래|곡|음악)/.test(t) || /(이\s*노래|이\s*곡)\s*(뭐|제목)/.test(t)) { await musicNow(); return true; }
  if (/^(다음\s*(곡|노래)|노래\s*넘겨|넘겨)/.test(t)) { await musicCtl('next', '⏭ 다음 곡!'); return true; }
  if (/^(이전\s*(곡|노래)|앞\s*(곡|노래)|전\s*곡)/.test(t)) { await musicCtl('prev', '⏮ 앞 곡!'); return true; }
  if (/^(노래|음악|찬양|찬송가?|복음\s*성가|성경)\s*(좀\s*)?(멈춰|그만|꺼|끄|끝|정지|멈춤|일시\s*정지|중지|스톱)/.test(t) || /^(일시\s*정지|멈춰|그만|소리\s*꺼|다\s*꺼)\s*(줘|해)?$/.test(t)) { await musicStopAll(); return true; }   // 11-07: 모든 노래 끄기
  if (/^(노래|음악)\s*(다시|계속)\s*(틀어|켜|들려)/.test(t) || /^다시\s*틀어/.test(t)) { await musicCtl('play', '▶ 다시 틀게!'); return true; }
  if (/^(소리|볼륨|음량)\s*(좀\s*)?(키워|크게|올려|높여)/.test(t)) { await musicCtl('up', '🔊 소리 키웠어'); return true; }
  if (/^(소리|볼륨|음량)\s*(좀\s*)?(줄여|작게|낮춰|내려)/.test(t)) { await musicCtl('down', '🔉 소리 줄였어'); return true; }
  const m = t.match(/^(.*?)\s*(노래|음악|곡)?\s*(좀\s*)?(틀어|들려|켜|재생해)\s*(줘|줄래|주라|봐|줘요|주세요)?$/);
  const appWord = MUSIC_APPS.some(([p, n]) => p && t.includes(n)) || /^(즐겨\s*듣기|즐겨찾기|좋아하는)/.test(t) || (musicCache && songs().some(x => x.G && t.startsWith(x.G)));
  if (m && (m[2] || /노래|음악|곡/.test(t) || appWord || (/^(틀어|재생해)$/.test(m[4]) && !/(에어컨|선풍기|티비|tv|보일러|히터|불|라디오|난방|냉방|영상|동영상|유튜브\s*영상)/i.test(m[1] || '')))) {
    let q = (m[1] || '').replace(/(의|이|가|를|을|로|으로|에서)$/, '').replace(/^(아무|아무거나|아무\s*노래|신나는|조용한|잔잔한)$/, '').trim();
    if (/^(노래|음악|곡)$/.test(q)) q = '';
    const app = MUSIC_APPS.find(([p, n]) => p && q.startsWith(n));   // "멜론에서 아이유 틀어 줘"
    if (app) { q = q.slice(app[1].length).replace(/^\s*(에서|로)\s*/, '').trim(); S.music = S.music || {}; const old = S.music.app; S.music.app = app[0]; await musicApp(q); S.music.app = old; return true; }
    await musicPlay(q); return true;
  }
  return false;
}
// ⚙️ 설정 칸
function musicCard() {
  const m = S.music || {};
  return `<div class="card"><h3>🎵 노래</h3>
    <p class="note small">"노래 들려줘", "아이유 노래 틀어 줘", "다음 곡", "멈춰", "소리 키워", "지금 무슨 노래야?"</p>
    <label class="note">음악 앱 <select id="s_mapp">${MUSIC_APPS.map(([p, n]) => `<option value="${p}" ${(m.app || '') === p ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <p class="note" style="margin:10px 0 4px">그냥 "노래 들려줘" 하면</p><div class="seg" id="s_mplain">${[['files', '📱 휴대폰 노래 파일'], ['app', '🎧 음악 앱']].map(([k, n]) => `<button data-mp="${k}" class="${(m.plain || 'files') === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <p class="note small">가수·제목을 말하면 먼저 휴대폰 노래 파일에서 찾고, 없으면 유튜브에서 전곡을 찾아 들려줘요 ("멜론에서 ○○ 틀어 줘" 하면 음악 앱). "노래 꺼 줘" 하면 다른 앱 노래까지 다 꺼요. 노래가 나오면 팻이 춤춰요 💃</p></div>`;
}

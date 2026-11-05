// 🏘️ 우리 동네 날씨 (휴대폰) — PC 하루 예보와 같은 방식: 마음을 연 이웃이 지도에 점으로, 인사하고 1:1 채팅
const INTERESTS = [
  { key: '게임', color: '#2B2B2B', icon: '🎮' }, { key: '여행', color: '#2F7BEA', icon: '✈️' }, { key: '술 한잔', color: '#E53935', icon: '🍻' },
  { key: '친구', color: '#2EAD5A', icon: '🤝' }, { key: '연애', color: '#FF6FAE', icon: '💕' }, { key: '운동', color: '#F2C200', icon: '🏃' },
  { key: '맛집', color: '#FF8A1F', icon: '🍜' }, { key: '책·공부', color: '#8B5A2B', icon: '📚' }, { key: '반려동물', color: '#4FC3E8', icon: '🐾' }, { key: '기타', color: '#8E44AD', icon: '✨' },
];
const HOBBIES = {
  '게임': ['PC게임', '모바일게임', '콘솔게임', '보드게임', '바둑·장기', 'e스포츠 보기'], '여행': ['국내여행', '해외여행', '캠핑', '차박', '드라이브', '맛집 여행'],
  '술 한잔': ['맥주', '와인', '막걸리', '칵테일', '혼술', '포차'], '친구': ['동네 친구', '수다', '산책 친구', '육아 친구', '봉사', '스터디'], '연애': ['연애', '결혼', '소개팅'],
  '운동': ['걷기', '달리기', '헬스', '등산', '자전거', '수영', '골프', '배드민턴', '탁구', '요가·필라테스', '축구', '야구', '테니스', '볼링'],
  '맛집': ['맛집 탐방', '카페', '빵·디저트', '요리', '홈베이킹', '배달 맛집'], '책·공부': ['독서', '글쓰기', '외국어', '자격증', '코딩', '역사'],
  '반려동물': ['강아지', '고양이', '반려동물 산책', '식물 키우기'], '기타': ['음악 듣기', '노래', '악기', '그림', '사진', '영화', '드라마', '뜨개질', '공예', '낚시', '패션', '재테크 공부', '종교 모임'],
};
const HOBBY_CAT = {}; for (const [c, l] of Object.entries(HOBBIES)) { HOBBY_CAT[c] = c; for (const h of l) HOBBY_CAT[h] = c; }
const interestOf = k => INTERESTS.find(x => x.key === (HOBBY_CAT[k] || k)) || INTERESTS[INTERESTS.length - 1];
const AGES = ['20대', '30대', '40대', '50대', '60대', '70대 이상'];
const MOODS = { 맑음: ['☀️', '#FFC93C'], 구름조금: ['⛅', '#9DD0F5'], 흐림: ['☁️', '#B8BEC9'], 비: ['🌧️', '#7FA3D6'] };
const ZOOMS = ['전국', '시·도', '구', '동', '가까이'];
const KIND_PRESENCE = 30078;
merge(DEF, { place: { label: '', lat: null, lon: null }, town: { open: false, nick: '', likes: [], gender: '', age: '', zoom: 3, chats: {} } });
S = merge(structuredClone(DEF), S);
if (!S.town.nick) { const A = ['느긋한', '반짝이는', '포근한', '씩씩한', '졸린', '상냥한', '엉뚱한', '조용한', '명랑한', '따뜻한'], B = ['고래', '호빵', '구름', '다람쥐', '해바라기', '펭귄', '감자', '별님', '토끼', '도토리']; S.town.nick = pick(A) + ' ' + pick(B); save(); }

// ── 지역 태그 (PC 와 같음): 전국 · 시도 · 시도 구 · 전체 동 이름, 가까이 = 약 1.2km 칸
const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function geohash(lat, lon, n = 6) { let la = [-90, 90], lo = [-180, 180], bit = 0, ch = 0, even = true, out = ''; while (out.length < n) { const r = even ? lo : la, v = even ? lon : lat, mid = (r[0] + r[1]) / 2; if (v > mid) { ch = (ch << 1) | 1; r[0] = mid; } else { ch <<= 1; r[1] = mid; } even = !even; if (++bit === 5) { out += B32[ch]; bit = 0; ch = 0; } } return out; }
const areaTag = a => `${APP}-${String(a || '').trim()}`;
function levels() { const p = String(S.place.label || '').split(' ').filter(Boolean); const t = ['전국']; if (p.length) { t.push(p[0]); if (p.length > 2) t.push(p.slice(0, 2).join(' ')); t.push(p.join(' ')); } return { tags: t.map(areaTag), g: S.place.lat != null ? geohash(S.place.lat, S.place.lon, 6) : null }; }

const neighbors = new Map(); let subP = null, areaKey = '';
function setArea(z) {
  if (!pool) return; if (z != null) { S.town.zoom = z; save(); }
  const zl = S.town.zoom, L = levels();
  const key = zl >= 4 ? 'g:' + L.g : 't:' + (L.tags[Math.min(zl, L.tags.length - 1)] || L.tags[0]);
  if (key === areaKey && subP) return;
  areaKey = key; neighbors.clear(); if (subP) { subP.close(); subP = null; }
  const filter = zl >= 4 ? (L.g ? { '#g': [L.g] } : { '#t': [L.tags[0]] }) : { '#t': [key.slice(2)] };
  subP = pool.subscribeMany(RELAYS, { kinds: [KIND_PRESENCE], ...filter, since: Math.floor(Date.now() / 1000) - 86400 }, {
    onevent: ev => {
      if (ev.pubkey === PK) return;
      const exp = +((ev.tags.find(t => t[0] === 'expiration') || [])[1] || 0); if (exp && exp * 1000 < Date.now()) return;
      let c; try { c = JSON.parse(ev.content); } catch { return; }
      const old = neighbors.get(ev.pubkey); if (old && old.created >= ev.created_at) return;
      if (c.closed) neighbors.delete(ev.pubkey);
      else neighbors.set(ev.pubkey, { nick: String(c.nick || '이웃').slice(0, 20), mood: c.mood || '맑음', likes: (c.likes || []).slice(0, 12), gender: ['m', 'f'].includes(c.gender) ? c.gender : '', age: AGES.includes(c.age) ? c.age : '', room: !!c.room, created: ev.created_at });
      clearTimeout(setArea._t); setArea._t = setTimeout(() => { if (view === 'town') drawMap(); }, 300);
    },
  });
}
async function publishMe() {
  if (!pool || !S.place.label) return;
  const t = S.town, L = levels();
  const content = t.open ? { nick: t.nick, mood: S.mood.date === today() && S.mood.today !== '천둥' ? S.mood.today : '구름조금', likes: t.likes.slice(0, 12), sub: null, gender: t.gender || '', age: t.age || '', room: !!(S.album && S.album.open) } : { closed: true };
  const ev = NT.finalizeEvent({ kind: KIND_PRESENCE, created_at: Math.floor(Date.now() / 1000), tags: [['d', APP], ...L.tags.map(x => ['t', x]), ...(L.g ? [['g', L.g]] : []), ['expiration', String(Math.floor(Date.now() / 1000) + 86400)]], content: JSON.stringify(content) }, SK);
  try { await Promise.any(pool.publish(RELAYS, ev)); return true; } catch { return false; }
}
// 이웃과 1:1 (PC 와 같은 말: hi 인사 · ok 받아 줌 · msg 대화 · bye 끝)
async function tsend(to, t, text) {
  const body = JSON.stringify({ app: APP, t, text: String(text || '').slice(0, 500), nick: S.town.nick, likes: S.town.likes, mood: S.mood.today || '맑음', species: 'dog' });
  try { await Promise.any(pool.publish(RELAYS, NT.nip17.wrapEvent(SK, { publicKey: to }, body))); return true; } catch { return false; }
}
function townDm(ev) {
  const ch = S.town.chats, nick = String(ev.nick || '이웃').slice(0, 20);
  const c = ch[ev.from] || { nick, likes: ev.likes || [], mood: ev.mood || '맑음', state: 'new', msgs: [] };
  if (c.blocked) return;
  c.nick = nick; if (ev.likes && ev.likes.length) c.likes = ev.likes;
  let line = null;
  if (ev.t === 'hi') { if (c.state === 'sent') { c.state = 'ok'; c.msgs.push({ who: 'sys', text: '🤝 서로 인사했어요', at: ev.at }); line = `📩 ${nick}님도 인사했어! 이제 이야기할 수 있어`; } else if (c.state !== 'ok') { c.state = 'incoming'; c.msgs.push({ who: 'sys', text: `👋 ${nick}님이 인사를 보냈어요`, at: ev.at }); line = `👋 ${nick}님이 인사를 보냈어!`; } }
  else if (ev.t === 'ok') { c.state = 'ok'; c.msgs.push({ who: 'sys', text: '🤝 인사를 받아 줬어요', at: ev.at }); line = `📩 ${nick}님이 인사를 받아 줬어!`; }
  else if (ev.t === 'msg') { if (c.state !== 'ok') return; if (c.msgs.some(m => m.at === ev.at && m.text === ev.text)) return; c.msgs.push({ who: 'them', text: String(ev.text || '').slice(0, 500), at: ev.at }); line = `💬 ${esc(nick)}: ${esc(String(ev.text || '').slice(0, 30))}`; }
  else if (ev.t === 'bye') { c.state = 'closed'; c.msgs.push({ who: 'sys', text: '이웃이 대화를 끝냈어요', at: ev.at }); }
  else return;
  c.msgs = c.msgs.slice(-200); ch[ev.from] = c; save();
  if (line) say(line, { pose: 'letter', ms: 9000, important: true, buttons: [{ label: '🏘️ 보러 가기', act: () => { openView('town'); openChat(ev.from); } }, { label: '나중에', ghost: true }] });
  if (view === 'town') drawTown();
}

// ── 동네 찾기 (PC 와 같은 이름 모양: "서울특별시 광진구 화양동")
async function geocode(name) {
  const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=8&language=ko&format=json&countryCode=KR`)).json();
  return (j.results || []).map(r => ({ label: [r.admin1, r.admin2, r.admin3, r.name].filter((v, i, a) => v && a.indexOf(v) === i && /[가-힣]/.test(v)).join(' ') || [r.admin1, r.name].filter(Boolean).join(' '), lat: r.latitude, lon: r.longitude }));
}
async function myLocation() {
  if (!navigator.geolocation) return say('위치를 쓸 수 없어 🥲 동 이름으로 찾아 줘', { ms: 3000 });
  say('📍 지금 있는 동네를 찾는 중…', { ms: 8000 });
  navigator.geolocation.getCurrentPosition(async p => {
    try {
      const r = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&accept-language=ko&zoom=16&lat=${p.coords.latitude}&lon=${p.coords.longitude}`)).json();
      const a = r.address || {}, dong = a.quarter || a.suburb || a.neighbourhood || a.village || a.town || a.city_district;
      const list = dong ? await geocode(dong) : [];
      const best = list.sort((x, y) => Math.hypot(x.lat - p.coords.latitude, x.lon - p.coords.longitude) - Math.hypot(y.lat - p.coords.latitude, y.lon - p.coords.longitude))[0];
      if (!best) return say('동네 이름을 못 찾았어. 동 이름으로 찾아 줘!', { ms: 3500 });
      setPlace(best);
    } catch { say('동네를 못 찾았어 🥲', { ms: 3000 }); }
  }, () => say('위치 허락이 필요해. 동 이름으로 찾아도 돼!', { ms: 3500 }), { enableHighAccuracy: false, timeout: 15000 });
}
function setPlace(p) { S.place = { label: p.label, lat: p.lat, lon: p.lon }; save(); areaKey = ''; setArea(); publishMe(); say(`📍 우리 동네: ${esc(p.label)}`, { pose: 'joy', ms: 3000 }); drawTown(); }

// ── 화면
let tChat = null, tPick = null, tPlaceOpen = false;
function dotPos(id, n) { let h = 2166136261; for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } const a = ((h >>> 0) % 3600) / 3600 * Math.PI * 2, r = 0.18 + (((h >>> 12) % 1000) / 1000) * 0.78; return [50 + Math.cos(a) * r * 44, 50 + Math.sin(a) * r * 44]; }
function drawMap() {
  const box = $('#tMap'); if (!box) return;
  const list = [...neighbors].map(([id, n]) => ({ id, ...n }));
  const dotR = [1.6, 2.4, 3.2, 4.2, 5.2][S.town.zoom] || 3;
  box.innerHTML = `<svg viewBox="0 0 100 100" class="tmap"><circle cx="50" cy="50" r="47" fill="#F4FBEF" stroke="#2B2118" stroke-width="0.8"/><circle cx="50" cy="50" r="30" fill="none" stroke="#cfe3c2" stroke-width="0.4" stroke-dasharray="1.5 1.5"/>
    ${list.map(n => { const [x, y] = dotPos(n.id); const col = n.likes.length ? interestOf(n.likes[0]).color : (MOODS[n.mood] || MOODS.구름조금)[1]; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotR}" fill="${col}" stroke="#fff" stroke-width="0.5" data-n="${n.id}"/>`; }).join('')}
    <circle cx="50" cy="50" r="${dotR + 1.2}" fill="#FFD93B" stroke="#2B2118" stroke-width="0.7"/><text x="50" y="${53 + dotR * 0.4}" text-anchor="middle" font-size="${dotR * 1.4 + 2}">🐶</text></svg>`;
  const moods = {}; for (const n of list) moods[n.mood] = (moods[n.mood] || 0) + 1;
  $('#tSum').innerHTML = list.length ? `이웃 <b>${list.length}</b>명 · ${Object.entries(moods).map(([k, v]) => `${(MOODS[k] || ['⛅'])[0]} ${v}`).join(' ')}` : '아직 이 범위에 마음을 연 이웃이 없어. 범위를 넓혀 봐!';
  const card = $('#tCard'); const n = tPick && neighbors.get(tPick);
  card.innerHTML = n ? `<b>${esc(n.nick)}</b> ${(MOODS[n.mood] || ['⛅'])[0]} ${n.gender ? (n.gender === 'm' ? '남자' : '여자') : ''} ${n.age || ''}<br><span class="note small">${n.likes.map(k => interestOf(k).icon + ' ' + esc(k)).join(' · ') || '관심사 없음'}</span>
    <div class="row">${(S.town.chats[tPick] || {}).state === 'ok' ? `<button class="btn small" data-tc="${tPick}">💬 이야기하기</button>` : `<button class="btn small" data-hi="${tPick}">👋 인사하기</button>`}${n.room ? `<button class="btn small ghost" data-room="${tPick}">🏠 방 구경</button>` : ''}</div>` : '';
}
function drawTown() {
  const t = S.town, chats = Object.entries(t.chats).filter(([, c]) => !c.blocked).sort((a, b) => ((b[1].msgs.slice(-1)[0] || {}).at || 0) - ((a[1].msgs.slice(-1)[0] || {}).at || 0));
  if (tChat && t.chats[tChat]) return drawChat();
  $('#townBox').innerHTML = `
  <div class="card"><div class="row" style="justify-content:space-between"><b>📍 ${S.place.label ? esc(S.place.label.split(' ').slice(-1)[0]) : '동네를 정해 줘'}</b><button class="btn small ghost" id="tPlaceBtn">바꾸기</button></div>
    ${tPlaceOpen || !S.place.label ? `<div class="row"><input id="tPlaceIn" placeholder="동 이름 (예: 화양동)"><button class="btn small" id="tFind">찾기</button></div><button class="btn small ghost" id="tGps">📍 지금 있는 곳으로</button><div id="tPlaceList"></div>` : ''}</div>
  ${S.place.label ? `<div class="seg" id="tZoom">${ZOOMS.map((z, i) => `<button data-z="${i}" class="${t.zoom === i ? 'on' : ''}">${z}</button>`).join('')}</div>
  <div id="tMap"></div><p class="note small" id="tSum" style="text-align:center"></p><div class="card" id="tCard"></div>` : ''}
  <div class="card"><h3>🔓 내 마음 오픈하기</h3><p class="note small">켜면 내 별명·마음 날씨·관심사가 이웃 지도에 점으로 보여요. 이름·번호·위치는 안 보이고, 하루가 지나면 사라져요.</p>
    <label class="chk"><input type="checkbox" id="tOpen" ${t.open ? 'checked' : ''}> 내 마음 오픈하기 <span class="note small">(별명: ${esc(t.nick)})</span></label>
    <div class="likes">${INTERESTS.map(i => `<button data-like="${i.key}" class="${t.likes.includes(i.key) ? 'on' : ''}">${i.icon} ${i.key}</button>`).join('')}</div>
    <div class="row"><select id="tGender"><option value="">성별 (안 밝힘)</option><option value="m" ${t.gender === 'm' ? 'selected' : ''}>남자</option><option value="f" ${t.gender === 'f' ? 'selected' : ''}>여자</option></select><select id="tAge"><option value="">나이 (안 밝힘)</option>${AGES.map(a => `<option ${t.age === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div></div>
  <div class="card"><h3>💬 이웃 톡</h3>${chats.length ? chats.map(([id, c]) => `<div class="prow" data-tc="${id}"><div class="top"><span class="nm">${esc(c.nick)}</span><span class="ph">${c.state === 'incoming' ? '👋 인사 왔어요' : c.state === 'sent' ? '인사 보냄' : c.state === 'ok' ? '💬' : ''}</span></div><span class="note small">${esc((c.msgs.slice(-1)[0] || {}).text || '')}</span></div>`).join('') : '<p class="note small">지도에서 이웃 점을 눌러 👋 인사해 봐!</p>'}</div>
  <p class="note small">처음 만난 이웃에게 돈·인증번호·주소를 보내지 마세요. 이상하면 🚫 차단!</p>`;
  if (S.place.label) { setArea(); drawMap(); }
}
function openChat(id) { tChat = id; drawTown(); }
function drawChat() {
  const c = S.town.chats[tChat];
  $('#townBox').innerHTML = `<div class="row" style="justify-content:space-between"><button class="btn small ghost" id="tBack">← 동네</button><b>${esc(c.nick)}</b><button class="btn small ghost" id="tBlock">🚫 차단</button></div>
    <div class="msgs" id="tMsgs" style="max-height:55vh">${c.msgs.map(m => `<div class="m ${m.who === 'me' ? 'me' : m.who === 'them' ? 'them' : ''}" ${m.who === 'sys' ? 'style="align-self:center;border:0;font-size:12px;color:#7a6a55"' : ''}>${esc(m.text)}</div>`).join('')}</div>
    ${c.state === 'incoming' ? `<button class="btn" id="tAccept">🤝 인사 받아 주기</button>` : c.state === 'ok' ? `<div class="row"><input id="tMsgIn" placeholder="${esc(c.nick)}님에게"><button class="btn small" id="tSend">보내기</button></div>` : '<p class="note small">상대가 인사를 받아 주면 이야기할 수 있어요.</p>'}`;
  const m = $('#tMsgs'); if (m) m.scrollTop = m.scrollHeight;
}
document.addEventListener('click', async e => {
  if (!e.target.closest('#townBox')) return;
  const id = e.target.id, el = e.target.closest('[data-z],[data-n],[data-hi],[data-tc],[data-like],[data-room],[data-pl]');
  if (id === 'tPlaceBtn') { tPlaceOpen = !tPlaceOpen; return drawTown(); }
  if (id === 'tFind') { const l = await geocode($('#tPlaceIn').value.trim()).catch(() => []); $('#tPlaceList').innerHTML = l.map((p, i) => `<button class="btn small ghost" data-pl="${i}" style="margin:3px">${esc(p.label)}</button>`).join('') || '<p class="note small">못 찾았어. 다르게 써 봐!</p>'; window._tpl = l; return; }
  if (id === 'tGps') return myLocation();
  if (id === 'tBack') { tChat = null; return drawTown(); }
  if (id === 'tBlock') { if (confirm('이 이웃을 차단할까?')) { S.town.chats[tChat].blocked = true; save(); tsend(tChat, 'bye', ''); tChat = null; drawTown(); } return; }
  if (id === 'tAccept') { const c = S.town.chats[tChat]; if (await tsend(tChat, 'ok', '')) { c.state = 'ok'; c.msgs.push({ who: 'sys', text: '🤝 서로 인사했어요', at: Date.now() }); save(); drawChat(); } return; }
  if (id === 'tSend') { const v = $('#tMsgIn').value.trim(); if (!v) return; const c = S.town.chats[tChat]; if (await tsend(tChat, 'msg', v)) { c.msgs.push({ who: 'me', text: v, at: Date.now() }); save(); drawChat(); } else say('못 보냈어. 인터넷을 확인해 줘', { ms: 3000 }); return; }
  if (!el) return;
  if (el.dataset.pl != null) { tPlaceOpen = false; return setPlace(window._tpl[+el.dataset.pl]); }
  if (el.dataset.z != null) { setArea(+el.dataset.z); return drawTown(); }
  if (el.dataset.n) { tPick = el.dataset.n; return drawMap(); }
  if (el.dataset.hi) { const n = neighbors.get(el.dataset.hi); if (await tsend(el.dataset.hi, 'hi', '')) { S.town.chats[el.dataset.hi] = { ...(S.town.chats[el.dataset.hi] || { msgs: [] }), nick: n ? n.nick : '이웃', likes: n ? n.likes : [], state: 'sent' }; S.town.chats[el.dataset.hi].msgs.push({ who: 'sys', text: '👋 인사를 보냈어요', at: Date.now() }); save(); say('👋 인사를 보냈어! 받아 주면 알려 줄게', { pose: 'joy', ms: 3500 }); drawTown(); } return; }
  if (el.dataset.tc) return openChat(el.dataset.tc);
  if (el.dataset.like) { const L = S.town.likes, k = el.dataset.like; S.town.likes = L.includes(k) ? L.filter(x => x !== k) : [...L, k].slice(0, 5); save(); el.classList.toggle('on'); clearTimeout(window._pubT); window._pubT = setTimeout(publishMe, 1200); return; }
  if (el.dataset.room) return visitRoom(el.dataset.room, (neighbors.get(el.dataset.room) || {}).nick);
});
document.addEventListener('change', e => {
  if (!e.target.closest('#townBox')) return;
  if (e.target.id === 'tOpen') { S.town.open = e.target.checked; save(); if (S.town.open && !S.place.label) { say('먼저 우리 동네를 정해 줘!', { ms: 3000 }); } publishMe(); say(S.town.open ? '🔓 내 마음을 열었어! 이웃 지도에 내 점이 생겼어' : '🔒 이웃 지도에서 내 점을 내렸어', { ms: 3500 }); }
  if (e.target.id === 'tGender') { S.town.gender = e.target.value; save(); publishMe(); }
  if (e.target.id === 'tAge') { S.town.age = e.target.value; save(); publishMe(); }
});
document.addEventListener('keydown', e => { if (e.target.id === 'tMsgIn' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('#tSend').click(); } if (e.target.id === 'tPlaceIn' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('#tFind').click(); } });
// 하루에 한 번 내 점 다시 올리기 (켜 두었으면)
window.addEventListener('load', () => setTimeout(() => { if (pool) { setArea(); if (S.town.open) publishMe(); } }, 2500));

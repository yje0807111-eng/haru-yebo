// 🌿 둘러보기 (11-08): 지금 있는 곳(또는 도착지) 근처 볼거리·산책 코스·숙소·맛집 — 한국관광공사 관광정보(열쇠는 비밀 금고 TOUR_KEY)
const TO = { tab: 'see', at: null, items: [], course: null, sel: null, map: null, mk: [], watch: null, next: 0 };
const TOUR_API = 'https://apis.data.go.kr/B551011/KorService2';
const TTYPE = { see: [12, 14], food: [39], stay: [32], walk: [12, 14] };
const TNAME = { 12: '관광지', 14: '문화시설', 15: '행사', 25: '여행코스', 28: '레포츠', 32: '숙소', 38: '쇼핑', 39: '맛집' };
const https = u => String(u || '').replace(/^http:\/\//, 'https://');
async function trGet(op, q) {
  const k = RK().tour; if (!k) return null;
  const qs = Object.entries(Object.assign({ serviceKey: k, MobileOS: 'AND', MobileApp: 'haruyebo', _type: 'json' }, q)).map(([a, b]) => a + '=' + (a === 'serviceKey' ? b : encodeURIComponent(b))).join('&');
  try { const j = await (await fetch(`${TOUR_API}/${op}?${qs}`)).json(); const it = (((j.response || {}).body || {}).items || {}).item; return it ? (Array.isArray(it) ? it : [it]) : []; } catch { return null; }
}
async function trNear(at, types, radius, rows) {
  const out = [];
  for (const ct of types) {
    const r = await trGet('locationBasedList2', { mapX: at.lon, mapY: at.lat, radius, arrange: 'E', contentTypeId: ct, numOfRows: rows || 15, pageNo: 1 });
    if (r === null) return null;
    out.push(...r.map(x => ({ id: x.contentid, type: +x.contenttypeid, title: x.title, addr: [x.addr1, x.addr2].filter(Boolean).join(' '), lat: +x.mapy, lon: +x.mapx, img: https(x.firstimage2 || x.firstimage), dist: +x.dist || 0, tel: x.tel || '' })));
  }
  return out.sort((a, b) => a.dist - b.dist);
}
async function trDetail(id) {
  const r = await trGet('detailCommon2', { contentId: id }); const x = r && r[0]; if (!x) return null;
  return { overview: String(x.overview || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(), home: (String(x.homepage || '').match(/https?:\/\/[^"'\s<>]+/) || [])[0] || '', img: https(x.firstimage), tel: x.tel || '' };
}

// ── 화면
async function openTour(tab, at) {
  hideBubble(); petOnly(false); go('tour');
  TO.tab = tab || TO.tab || 'see'; TO.sel = null; TO.course = null; trStop();
  TO.at = at || (window.R && R.step === 'going' && R.to) || null;
  trDraw('loading');
  if (!TO.at) { const p = await myPos(); TO.at = p ? { lat: p.lat, lon: p.lon, name: '지금 있는 곳' } : (S.place.lat ? { lat: S.place.lat, lon: S.place.lon, name: S.place.label } : null); }
  if (!TO.at) { trSay('위치를 못 찾았어 🥲 휴대폰 위치(GPS)를 켜 줘'); return trDraw(); }
  if (!TO.at.name || TO.at.name === '지금 있는 곳') { const a = await addrOf(TO.at); TO.at.name = a ? a.split(' ').slice(-3).join(' ') : '지금 있는 곳'; }
  trLoad();
}
async function trLoad() {
  if (!RK().tour) { trSay('둘러보기는 <b>갤럭시 앱</b>에서 돼요 (관광 자료 열쇠가 앱에만 있어요)'); TO.items = []; return trDraw(); }
  trDraw('loading');
  const radius = TO.tab === 'stay' ? 5000 : TO.tab === 'food' ? 1000 : TO.tab === 'walk' ? 3500 : 3000;
  const r = await trNear(TO.at, TTYPE[TO.tab], radius, TO.tab === 'walk' ? 25 : 15);
  if (r === null) { trSay('관광 자료를 못 불러왔어 🥲 잠시 뒤에 다시 해 줘'); TO.items = []; return trDraw(); }
  TO.items = r;
  if (TO.tab === 'walk') return trCourse(60);
  const n = r.length, what = { see: '볼거리', food: '맛집', stay: '숙소' }[TO.tab];
  trSay(n ? `<b>${esc(TO.at.name)}</b> 근처 ${what} <b>${n}곳</b>을 찾았어! 가까운 곳부터 보여 줄게. 누르면 자세히 알려 줘.` : `근처에 ${what} 정보가 없어 🥲`);
  trDraw();
}
// 🚶 산책 코스: 가까운 볼거리를 차례로 이어 한 바퀴 (시간에 맞게)
function trCourse(minutes) {
  const pool = TO.items.filter(x => x.dist < Math.max(1200, minutes / 60 * 2300)).slice(0, 15), at = TO.at, stops = [];
  let cur = at, walked = 0;
  while (pool.length) {
    pool.sort((a, b) => rkm(cur, a) - rkm(cur, b));
    const nx = pool[0], leg = rkm(cur, nx) * 1.3, back = rkm(nx, at) * 1.3;
    const mm = (walked + leg + back) / 4 * 60 + (stops.length + 1) * 8;   // 볼거리마다 8분 구경
    if (mm > minutes && stops.length >= 1) break;
    stops.push(nx); walked += leg; cur = nx; pool.shift();
    if (stops.length >= 5) break;
  }
  walked += cur === at ? 0 : rkm(cur, at) * 1.3;
  TO.course = stops.length ? { min: minutes, stops, km: walked, time: walked / 4 * 60 + stops.length * 8 } : null;
  trSay(TO.course ? `<b>${esc(TO.at.name)}</b>에서 출발해서 <b>${stops.length}곳</b>을 돌아오는 산책 코스야. 약 ${TO.course.km.toFixed(1)}km, ${mins(TO.course.time)}. <b>🐾 같이 걷기</b>를 누르면 한 곳씩 소개해 줄게!` : '근처에 이어 걸을 만한 볼거리가 적어 🥲 다른 곳에서 해 볼까?');
  trDraw();
}
async function trPick(i) {
  const it = TO.items[i]; if (!it) return;
  TO.sel = Object.assign({}, it, { loading: true }); trDraw();
  const d = await trDetail(it.id); TO.sel = Object.assign({}, it, d || {}, { loading: false }); trDraw();
  if (TO.sel.overview) trSay(`<b>${esc(it.title)}</b> — ${esc(TO.sel.overview.slice(0, 120))}…`, false);
}
function trSay(html, speak) { const b = $('#tPet'); if (b) b.innerHTML = '🐾 ' + html; TO.say = html; if (speak !== false && typeof rSpeak === 'function') rSpeak(html); }
function trDraw(st) {
  const box = $('#tourBox'); if (!box) return;
  const tabs = [['see', '🌿 볼거리'], ['walk', '🚶 산책 코스'], ['food', '🍚 맛집'], ['stay', '🏨 숙소']];
  const list = TO.tab === 'walk' && TO.course ? TO.course.stops : TO.items;
  const S0 = TO.sel;
  box.innerHTML = `<div class="seg mtabs">${tabs.map(([k, n]) => `<button data-tt="${k}" class="${TO.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="card rpetc"><p id="tPet">🐾 ${st === 'loading' ? '찾는 중…' : (TO.say || '')}</p></div>
    <div id="tMap" class="rmap"></div>
    ${TO.tab === 'walk' ? `<div class="card"><div class="seg">${[30, 60, 90].map(m => `<button data-tm="${m}" class="${TO.course && TO.course.min === m ? 'on' : ''}">${m}분</button>`).join('')}</div>${TO.course ? `<div class="row bctl"><button data-tg="1" class="bplay">${TO.watch ? '⏹ 걷기 그만' : '🐾 같이 걷기'}</button></div>` : ''}</div>` : ''}
    ${S0 ? `<div class="card tsel">${S0.img ? `<img src="${esc(S0.img)}" alt="">` : ''}<h3>${esc(S0.title)}</h3><p class="note small">${esc(TNAME[S0.type] || '')} · ${S0.dist ? (S0.dist / 1000).toFixed(1) + 'km' : ''} · ${esc(S0.addr)}</p>
      <p class="note" style="line-height:1.7">${S0.loading ? '불러오는 중…' : esc((S0.overview || '소개 글이 없어요').slice(0, 600))}${S0.overview && S0.overview.length > 600 ? '…' : ''}</p>
      <div class="row bctl"><button data-ts="say">🔊 들려줘</button><button data-ts="go">🧭 여기로 길찾기</button>${S0.type === 32 ? '<button data-ts="price">💰 가격 보기</button>' : ''}${S0.home ? '<button data-ts="home">🌐 누리집</button>' : ''}</div></div>` : ''}
    ${list.map((x, i) => `<button class="titem ${S0 && S0.id === x.id ? 'on' : ''}" data-ti="${TO.items.indexOf(x)}">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : '<span class="tnoimg">📍</span>'}<span><b>${TO.tab === 'walk' ? (i + 1) + '. ' : ''}${esc(x.title)}</b><small>${esc(TNAME[x.type] || '')} · ${(x.dist / 1000).toFixed(1)}km</small></span></button>`).join('')}
    <p class="note small" style="text-align:center">자료: 한국관광공사 · 지도 © OpenStreetMap${TO.tab === 'stay' ? ' · 가격·빈방·예약은 숙소 앱에서 본인이 직접' : ''}</p>`;
  trMapDraw(list);
}
function trMapDraw(list) {
  const el = $('#tMap'); if (!el || !window.L || !TO.at) return;
  try { if (TO.map) TO.map.remove(); } catch { }
  TO.map = L.map(el, { zoomControl: false, attributionControl: false }).setView([TO.at.lat, TO.at.lon], 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(TO.map);
  const me = L.marker([TO.at.lat, TO.at.lon], { icon: L.divIcon({ className: 'rme', html: '<i></i>', iconSize: [18, 18] }) }).addTo(TO.map);
  TO.meMk = me;
  const pts = [[TO.at.lat, TO.at.lon]];
  list.slice(0, 20).forEach((x, i) => { L.marker([x.lat, x.lon], { icon: L.divIcon({ className: 'tnum', html: `<i>${TO.tab === 'walk' ? i + 1 : ''}</i>`, iconSize: [24, 24] }) }).addTo(TO.map).on('click', () => trPick(TO.items.indexOf(x))); pts.push([x.lat, x.lon]); });
  if (TO.tab === 'walk' && TO.course) L.polyline(pts.concat([[TO.at.lat, TO.at.lon]]), { color: '#3182f6', weight: 4, dashArray: '8 8' }).addTo(TO.map);
  if (pts.length > 1) TO.map.fitBounds(L.latLngBounds(pts).pad(0.15));
  setTimeout(() => TO.map && TO.map.invalidateSize(), 200);
}
// 🐾 같이 걷기: 다음 볼거리 60m 안에 오면 소개
function trGo() {
  if (TO.watch) return trStop(true);
  if (!TO.course || !navigator.geolocation) return;
  TO.next = 0;
  TO.watch = navigator.geolocation.watchPosition(async p => {
    const me = { lat: p.coords.latitude, lon: p.coords.longitude };
    if (TO.meMk) TO.meMk.setLatLng([me.lat, me.lon]);
    const st = TO.course.stops[TO.next];
    if (!st) { if (rkm(me, TO.at) < 0.08) { trSay('🎉 산책 끝! 다 돌았어. 수고했어 💛'); trStop(); } return; }
    if (rkm(me, st) < 0.06) {
      TO.next++;
      const d = await trDetail(st.id);
      trSay(`📍 <b>${esc(st.title)}</b>에 왔어! ${d && d.overview ? esc(d.overview.slice(0, 160)) + '…' : ''} ${TO.course.stops[TO.next] ? '다음은 <b>' + esc(TO.course.stops[TO.next].title) + '</b>야' : '이제 처음 자리로 돌아가자'}`);
    }
  }, () => trSay('위치를 못 읽고 있어. 휴대폰 위치(GPS)를 켜 줘'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  trDraw(); trSay(`좋아, 같이 걷자! 첫 번째는 <b>${esc(TO.course.stops[0].title)}</b>야 🐾`);
}
function trStop(talk) { if (TO.watch != null) { try { navigator.geolocation.clearWatch(TO.watch); } catch { } TO.watch = null; if (talk) trSay('산책 안내를 멈췄어'); } }
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#tourBox')) return;
  const tt = e.target.closest('[data-tt]'); if (tt) { TO.tab = tt.dataset.tt; TO.sel = null; TO.course = null; trStop(); return trLoad(); }
  const ti = e.target.closest('[data-ti]'); if (ti) return trPick(+ti.dataset.ti);
  const tm = e.target.closest('[data-tm]'); if (tm) return trCourse(+tm.dataset.tm);
  if (e.target.closest('[data-tg]')) return trGo();
  const ts = e.target.closest('[data-ts]'); if (!ts || !TO.sel) return;
  const a = ts.dataset.ts, F = RF();
  if (a === 'say') rSpeak(`${TO.sel.title}. ${TO.sel.overview || ''}`);
  if (a === 'go') openRoute(TO.sel.title);
  const open = u => { if (F && F.openApp) F.openApp({ pkg: '', url: u }); else window.open(u, '_blank'); };
  if (a === 'price') open('https://m.search.naver.com/search.naver?query=' + encodeURIComponent(TO.sel.title + ' 숙박 가격'));
  if (a === 'home') open(TO.sel.home);
});
// 말: "여기 뭐 볼 거 있어?", "산책로 알려 줘", "근처 숙소", "근처 맛집"
function tourTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').trim();
  if (/(산책\s*(로|코스|길)|걷기\s*(좋은\s*)?(길|코스)|산책\s*하고\s*싶|둘레\s*길)/.test(t)) { openTour('walk'); return true; }
  if (/(근처|주변|여기|이\s*동네|가까운).*(숙소|호텔|모텔|펜션|게스트\s*하우스|잘\s*곳|묵을\s*곳)|^(숙소|호텔|모텔|펜션)\s*(좀\s*)?(찾아|알려|추천)/.test(t)) { openTour('stay'); return true; }
  if (/(근처|주변|여기|이\s*동네).*(맛집|먹을\s*(곳|데)|식당|밥\s*집)/.test(t)) { openTour('food'); return true; }
  if (/(근처|주변|여기|이\s*동네).*(볼\s*거리|볼거리|볼\s*거\s*(있|없|많)|뭐\s*볼|구경|관광|가\s*볼\s*(만한|데)|뭐\s*있)|^(둘러보기|관광지\s*(알려|찾아))/.test(t)) { openTour('see'); return true; }
  return false;
}

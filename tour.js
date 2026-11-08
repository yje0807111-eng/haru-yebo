// 🌿 둘러보기 (11-08): 지금 있는 곳(또는 도착지) 근처 볼거리·산책 코스·숙소·맛집
// 자료: 한국관광공사(열쇠는 비밀 금고 TOUR_KEY) + 오픈스트리트맵(공원·공원 안 볼거리, 열쇠 없음) + TMAP 걷는 길
const TO = { radius: 30, tab: 'see', at: null, items: [], view: [], course: null, sel: null, map: null, watch: null, next: 0 };
const TOUR_API = 'https://apis.data.go.kr/B551011/KorService2';
const TTYPE = { see: [12, 14], food: [39], stay: [32], walk: [12, 14] };
const TNAME = { 12: '관광지', 14: '문화시설', 15: '행사', 25: '여행코스', 28: '레포츠', 32: '숙소', 38: '쇼핑', 39: '맛집' };
const https = u => String(u || '').replace(/^http:\/\//, 'https://');
const tlabel = x => x.kind || TNAME[x.type] || '';
async function trGet(op, q) {
  const k = RK().tour; if (!k) return null;
  const qs = Object.entries(Object.assign({ serviceKey: k, MobileOS: 'AND', MobileApp: 'haruyebo', _type: 'json' }, q)).map(([a, b]) => a + '=' + (a === 'serviceKey' ? b : encodeURIComponent(b))).join('&');
  try { const j = await (await fetch(`${TOUR_API}/${op}?${qs}`)).json(); const it = (((j.response || {}).body || {}).items || {}).item; return it ? (Array.isArray(it) ? it : [it]) : []; } catch { return null; }
}
const ktoItem = x => ({ id: x.contentid, type: +x.contenttypeid, title: x.title, addr: [x.addr1, x.addr2].filter(Boolean).join(' '), lat: +x.mapy, lon: +x.mapx, img: https(x.firstimage2 || x.firstimage), dist: +x.dist || 0, tel: x.tel || '' });
async function trNear(at, types, radius, rows) {
  if (!RK().tour) return [];
  const out = [];
  for (const ct of types) {
    const r = await trGet('locationBasedList2', { mapX: at.lon, mapY: at.lat, radius, arrange: 'E', contentTypeId: ct, numOfRows: rows || 15, pageNo: 1 });
    if (r === null) return null;
    out.push(...r.map(ktoItem));
  }
  return out.sort((a, b) => a.dist - b.dist);
}
async function trDetail(id) {
  const r = await trGet('detailCommon2', { contentId: id }); const x = r && r[0]; if (!x) return null;
  return { overview: String(x.overview || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(), home: (String(x.homepage || '').match(/https?:\/\/[^"'\s<>]+/) || [])[0] || '', img: https(x.firstimage), tel: x.tel || '' };
}
// 오픈스트리트맵 곳은 관광공사에서 같은 이름을 찾아 소개 글을 붙이고, 없으면 위키백과
async function trDetailAny(it) {
  if (/^\d+$/.test(String(it.id))) return trDetail(it.id);
  if (String(it.id).startsWith('gate_')) return { overview: '', img: '', home: '' };
  if (RK().tour) {
    const r = await trGet('searchKeyword2', { keyword: it.title, numOfRows: 6, pageNo: 1 });
    const k = (r || []).map(ktoItem).filter(x => rkm(x, it) < 1.5).sort((a, b) => rkm(a, it) - rkm(b, it))[0];
    if (k) { const d = await trDetail(k.id); if (d) return Object.assign(d, { img: d.img || k.img }); }
  }
  try { const j = await (await fetch(`https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(it.title)}`)).json(); if (j && j.extract && j.type !== 'disambiguation') return { overview: j.extract, img: https((j.thumbnail || {}).source || ''), home: '' }; } catch { }
  return { overview: `${it.title}은(는) ${it.kind || '볼거리'}야.`, img: '', home: '' };
}

// ── 오픈스트리트맵 (Overpass): 공원·정원·볼거리, 큰 공원 안 볼거리
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
// 여러 서버에 한꺼번에 물어 먼저 온 대답을 씀 (12초 안에) · 같은 질문은 이틀 동안 휴대폰에 저장
async function osmQ(q, ms) {
  const ck = 'osm:' + q.length + ':' + q.slice(-120), C = S.osmCache = S.osmCache || {};
  if (C[ck] && Date.now() - C[ck].at < 2 * 864e5) return C[ck].el;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 9000);
  try {
    const el = await Promise.any(OVERPASS.map(async u => { const r = await fetch(u, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }); if (!r.ok) throw 0; const j = await r.json(); if (!j.elements) throw 0; return j.elements; }));
    ctl.abort(); clearTimeout(t);
    const slim = el.map(e => ({ type: e.type, id: e.id, lat: e.lat, lon: e.lon, center: e.center, bounds: e.bounds, tags: e.tags && { name: e.tags.name, 'name:ko': e.tags['name:ko'], leisure: e.tags.leisure, tourism: e.tags.tourism, historic: e.tags.historic, natural: e.tags.natural, amenity: e.tags.amenity } }));
    C[ck] = { at: Date.now(), el: slim }; const ks = Object.keys(C); if (ks.length > 20) delete C[ks.sort((a, b) => C[a].at - C[b].at)[0]]; save();
    return slim;
  } catch { clearTimeout(t); return null; }
}
const OSM_KIND = t => t.leisure === 'park' ? '공원' : t.leisure === 'garden' ? '정원' : t.leisure === 'nature_reserve' ? '자연 보호 구역' : t.tourism === 'museum' ? '박물관' : t.tourism === 'gallery' ? '미술관' : t.tourism === 'zoo' ? '동물원' : t.tourism === 'theme_park' ? '놀이공원' : t.tourism === 'viewpoint' ? '전망 좋은 곳' : t.historic ? '역사 유적' : t.natural === 'water' ? '연못' : t.natural ? '숲·잔디밭' : t.leisure === 'playground' ? '놀이터' : t.amenity === 'fountain' ? '분수' : t.amenity ? '공연장' : '볼거리';
function osmItem(e, at) {
  const t = e.tags || {}, b = e.bounds, c = e.center || (e.lat != null ? { lat: e.lat, lon: e.lon } : b ? { lat: (b.minlat + b.maxlat) / 2, lon: (b.minlon + b.maxlon) / 2 } : null);
  if (!c || !(t['name:ko'] || t.name)) return null;
  const area = b ? Math.round((b.maxlat - b.minlat) * 111000 * (b.maxlon - b.minlon) * 88000) : 0;
  return { id: `osm_${e.type}_${e.id}`, osm: { type: e.type, id: e.id }, kind: OSM_KIND(t), title: t['name:ko'] || t.name, addr: '', lat: c.lat, lon: c.lon, img: '', dist: at ? rkm(at, c) * 1000 : 0, area, tags: t };
}
async function osmNear(at, r) {
  const a = `(around:${r},${at.lat},${at.lon})`;
  const el = await osmQ(`[out:json][timeout:12];(way${a}[leisure~"^(park|garden|nature_reserve)$"][name];relation${a}[leisure~"^(park|garden|nature_reserve)$"][name];nwr${a}[tourism~"^(attraction|viewpoint|museum|gallery|zoo|theme_park)$"][name];);out center bb tags;`);
  return (el || []).map(e => osmItem(e, at)).filter(x => x && !(x.kind === '공원' && x.area < 1500));
}
async function osmInside(box, ms) {   // box = [남, 서, 북, 동]
  const b = box.map(v => v.toFixed(5)).join(',');
  const el = await osmQ(`[out:json][timeout:8];(nwr(${b})[name][tourism];nwr(${b})[name][historic];nwr(${b})[name][leisure~"^(garden)$"];nwr(${b})[name][natural~"^(water|wood)$"];nwr(${b})[name][amenity~"^(fountain|theatre|arts_centre)$"];);out center tags;`, ms);
  const pri = x => /동물원|놀이공원|전망|박물관|미술관/.test(x.kind) ? 0 : /정원|연못|역사|분수/.test(x.kind) ? 1 : /숲/.test(x.kind) ? 2 : 3;
  const seen = new Set();
  return (el || []).map(e => osmItem(e, null)).filter(x => x && x.tags.tourism !== 'information' && !seen.has(x.title) && seen.add(x.title)).sort((a, b) => pri(a) - pri(b));
}
// ── TMAP 공원 찾기 (빠름): 정문·후문 같은 문이 여러 개면 큰 공원 — 문 자리로 공원 크기를 어림
async function tmapAround(at, cat, km, count) {
  if (!RK().tmap) return [];
  try {
    const r = await fetch(`https://apis.openapi.sk.com/tmap/pois/search/around?version=1&centerLon=${at.lon}&centerLat=${at.lat}&categories=${encodeURIComponent(cat)}&radius=${Math.max(1, Math.round(km))}&count=${Math.min(100, count || 60)}`, { headers: { appKey: RK().tmap } });
    if (!r.ok) return [];
    const j = await r.json(); return (((j.searchPoiInfo || {}).pois || {}).poi || []).map(p => ({ name: p.name, lat: +(p.frontLat || p.noorLat), lon: +(p.frontLon || p.noorLon) }));
  } catch { return []; }
}
const GATE = /(정문|후문|동문|서문|남문|북문|[가-힣]{1,4}문)$/;
const BIGPARK = /(대공원|한강공원|서울숲|수목원|식물원|생태공원|근린공원|체육공원|자연공원|둘레길|숲길|올레)/;
function parkGroups(pois, at) {
  const G = {};
  for (const p of pois) {
    if (/(주차장|화장실|매점|관리|사무소|출구|입구역|정류장)/.test(p.name) && !GATE.test(p.name.replace(/\s*주차장$/, ''))) { if (/주차장|화장실|매점|관리|사무소/.test(p.name)) continue; }
    if (/주차장|화장실|매점/.test(p.name)) continue;
    const base = p.name.replace(/\s+(정문|후문|동문|서문|남문|북문|[가-힣]{1,4}문)$/, '').trim();
    const g = G[base] = G[base] || { title: base, gates: [], pts: [] };
    if (base !== p.name && GATE.test(p.name)) g.gates.push(p); else g.pts.push(p);
  }
  return Object.values(G).map(g => {
    const all = g.gates.concat(g.pts), c = g.pts[0] || g.gates[0];
    const la = all.map(x => x.lat), lo = all.map(x => x.lon), box = [Math.min(...la), Math.min(...lo), Math.max(...la), Math.max(...lo)];
    let area = g.gates.length >= 2 ? Math.round((box[2] - box[0]) * 111000 * (box[3] - box[1]) * 88000) : 0;
    if (BIGPARK.test(g.title)) area = Math.max(area, 60000);
    if (!area && !/어린이공원|소공원|쌈지/.test(g.title)) area = 5000;
    const mid = g.gates.length >= 2 ? { lat: (box[0] + box[2]) / 2, lon: (box[1] + box[3]) / 2 } : c;
    return { id: 'tm_' + g.title, kind: '공원', title: g.title, addr: '', lat: mid.lat, lon: mid.lon, img: '', dist: rkm(at, mid) * 1000, area, gates: g.gates, box: g.gates.length >= 2 ? box : null };
  }).filter(x => x.title.length >= 2);
}
const nname = s => String(s || '').replace(/[\s()·\-_.]/g, '').replace(/(서울|공원|시립)/g, '');
function trMerge(kto, osm) {
  const out = kto.slice();
  for (const o of osm) {
    const k = out.find(x => rkm(x, o) < 0.6 && (nname(x.title).includes(nname(o.title)) || nname(o.title).includes(nname(x.title))) && nname(o.title).length >= 2);
    if (k) { k.osm = k.osm || o.osm; k.area = Math.max(k.area || 0, o.area || 0); k.gates = k.gates || o.gates; k.box = k.box || o.box; k.kind = k.kind || o.kind; continue; }
    out.push(o);
  }
  return out.sort((a, b) => a.dist - b.dist);
}

// ── 🥾 두루누비 공식 걷기길 (전국 175개 코스, 이레 동안 저장) · GPS 길은 휴대폰이 직접 받아서 그림
const CITY = { 서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기', 강원도: '강원', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남', 전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주' };
async function durAll() {
  const C = S.duru; if (C && Date.now() - C.at < 7 * 864e5 && C.list.length) return C.list;
  const k = RK().tour; if (!k) return [];
  try {
    const j = await (await fetch(`https://apis.data.go.kr/B551011/Durunubi/courseList?serviceKey=${k}&MobileOS=AND&MobileApp=haruyebo&_type=json&numOfRows=300&pageNo=1&brdDiv=DNWW`)).json();
    const it = (((j.response || {}).body || {}).items || {}).item || [];
    const list = (Array.isArray(it) ? it : [it]).map(x => ({ id: x.crsIdx, name: x.crsKorNm, km: +x.crsDstnc || 0, min: +x.crsTotlRqrmHour || 0, level: +x.crsLevel || 0, cycle: x.crsCycle || '', sigun: x.sigun || '', gpx: x.gpxpath || '', sum: String(x.crsSummary || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').slice(0, 400) }));
    S.duru = { at: Date.now(), list }; save(); return list;
  } catch { return []; }
}
async function durNear(addr) {
  const a = String(addr || '').split(' '), city = CITY[a[0]] || (a[0] || '').slice(0, 2), gu = a[1] || '';
  const all = await durAll();
  return all.filter(c => c.sigun.startsWith(city)).sort((x, y) => (y.sigun.includes(gu) ? 1 : 0) - (x.sigun.includes(gu) ? 1 : 0)).slice(0, 6);
}
async function durGpx(c) {
  if (c.pts) return c.pts;
  const H = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp; let txt = '';
  try { if (H) txt = (await H.get({ url: c.gpx, responseType: 'text' })).data; else txt = await (await fetch(c.gpx)).text(); } catch { return null; }
  const pts = [...String(txt).matchAll(/<trkpt[^>]*lat="([\d.]+)"[^>]*lon="([\d.]+)"/g)].map(m => [+m[1], +m[2]]);
  if (!pts.length) return null;
  const step = Math.max(1, Math.floor(pts.length / 400)); c.pts = pts.filter((_, i) => i % step === 0).concat([pts[pts.length - 1]]);
  return c.pts;
}
async function durPick(i) {
  const c = (TO.duru || [])[i]; if (!c) return;
  trSay(`🥾 <b>${esc(c.name)}</b> 길을 불러오는 중…`, false);
  const pts = await durGpx(c);
  if (!pts) return trSay(`<b>${esc(c.name)}</b> — ${c.km}km · 약 ${mins(c.min)}. ${esc(c.sum.slice(0, 120))}… (길 그림은 갤럭시 앱에서 보여 줄게)`);
  const start = { lat: pts[0][0], lon: pts[0][1], name: c.name + ' 출발점' }, far = rkm(TO.at, start);
  TO.course = { min: c.min, stops: [], park: null, km: c.km, time: c.min, line: pts, turns: [], trail: c, start };
  trDraw();
  trSay(`🥾 <b>${esc(c.name)}</b> (${esc(c.sigun)}) — ${c.km}km · 약 ${mins(c.min)} · ${['', '쉬움', '보통', '어려움'][c.level] || ''} · ${esc(c.cycle)}. 출발점까지 ${far.toFixed(1)}km야. ${esc(c.sum.split('\n')[0].replace(/^-\s*/, ''))}`);
}

// ── 화면
async function openTour(tab, at, radius) {
  hideBubble(); petOnly(false); go('tour');
  TO.tab = tab || TO.tab || 'see'; TO.sel = null; TO.course = null; TO.say = ''; trStop();
  TO.radius = radius || (window.R && R.radius) || TO.radius || 30;
  TO.at = at || (window.R && R.arrived) || null;
  trDraw('loading');
  if (!TO.at) { const p = await myPos(); TO.at = p ? { lat: p.lat, lon: p.lon, name: '지금 있는 곳' } : (S.place.lat ? { lat: S.place.lat, lon: S.place.lon, name: S.place.label } : null); }
  if (!TO.at) { trSay('위치를 못 찾았어 🥲 휴대폰 위치(GPS)를 켜 줘'); return trDraw(); }
  if (!TO.at.name || TO.at.name === '지금 있는 곳') { const a = await addrOf(TO.at); TO.at.name = a ? a.split(' ').slice(-3).join(' ') : '지금 있는 곳'; }
  trLoad();
}
async function trLoad() {
  trDraw('loading');
  const green = TO.tab === 'see' || TO.tab === 'walk';
  if (!RK().tour && !green) { trSay('맛집·숙소는 <b>갤럭시 앱</b>에서 돼요 (관광 자료 열쇠가 앱에만 있어요)'); TO.items = []; return trDraw(); }
  const radius = TO.radius;
  if (green) trSay('공원·볼거리를 찾는 중…', false);
  const tab0 = TO.tab, [k, tp] = await Promise.all([trNear(TO.at, TTYPE[TO.tab], radius, TO.tab === 'walk' ? 25 : 15), green ? tmapAround(TO.at, '공원', Math.max(1, radius / 1000 + 0.5), 80) : Promise.resolve([])]);
  if (TO.tab !== tab0) return;
  const edge = x => x.dist - (x.area ? Math.sqrt(x.area) / 2 : 0);   // 큰 공원은 가장자리부터 재기
  const parks = green ? parkGroups(tp, TO.at).filter(x => edge(x) <= radius) : [];
  if (k === null && !parks.length) { trSay('자료를 못 불러왔어 🥲 잠시 뒤에 다시 해 줘'); TO.items = []; return trDraw(); }
  TO.items = green ? trMerge(k || [], parks) : (k || []);
  if (TO.tab === 'see') {
    TO.items = TO.items.filter(x => !(x.kind === '공원' && x.area < 8000 && !x.type));   // 아주 작은 놀이터 공원은 빼기
    osmNear(TO.at, radius).then(o => { if (TO.tab !== 'see' || !o || !o.length) return; const n0 = TO.items.length; TO.items = trMerge(TO.items, o.filter(x => x.kind !== '공원' || x.area >= 8000)); if (TO.items.length > n0 && !TO.sel) trDraw(); });   // 오픈스트리트맵은 오는 대로 더하기
  }
  if (TO.tab === 'walk') { durNear(await addrOf(TO.at)).then(d => { TO.duru = d; if (TO.tab === 'walk' && d.length) trDraw(); }); return trCourse(60); }
  TO.items = TO.items.filter(x => (x.area ? x.dist - Math.sqrt(x.area) / 2 : x.dist) <= radius + 30);
  const n = TO.items.length, what = { see: '볼거리', food: '맛집', stay: '숙소' }[TO.tab], rr = radius >= 1000 ? radius / 1000 + 'km' : radius + 'm';
  const big = TO.items.filter(x => x.area >= 100000).slice(0, 2).map(x => esc(x.title));
  trSay(n ? `반경 ${rr} 안 ${what} <b>${n}곳</b>${big.length ? ` (큰 공원 ${big.join(', ')})` : ''}. 누르면 자세히 보여 줘.` : `반경 ${rr} 안에는 ${what}이(가) 없어. 지도 아래에서 반경을 넓혀 봐.`);
  trDraw();
}

// 🚶 산책 코스: 가까운 큰 공원이 있으면 공원 안 볼거리를 이어 한 바퀴 (TMAP 걷는 길), 없으면 근처 볼거리를 이어서
const nnOrder = (from, arr) => { const rest = arr.slice(), out = []; let cur = from; while (rest.length) { rest.sort((a, b) => rkm(cur, a) - rkm(cur, b)); cur = rest.shift(); out.push(cur); } return out; };
async function trWalkRoute(start, stops) {
  if (!RK().tmap || !stops.length) return null;
  try {
    const end = { lat: start.lat + 0.00018, lon: start.lon };   // 출발=도착이면 안 받아 줘서 20m 옆
    const body = { startX: String(start.lon), startY: String(start.lat), endX: String(end.lon), endY: String(end.lat), startName: '출발', endName: '도착', passList: stops.slice(0, 5).map(s => `${s.lon},${s.lat}`).join('_') };
    const r = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1', { method: 'POST', headers: { appKey: RK().tmap, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    const j = await r.json(), f = j.features || []; if (!f.length) return null;
    const p0 = f[0].properties || {}, line = [], turns = [];
    for (const x of f) {
      const g = x.geometry || {};
      if (g.type === 'LineString') for (const c of g.coordinates) line.push([c[1], c[0]]);
      if (g.type === 'Point' && x.properties && x.properties.description && !/^(SP|EP|PP)/.test(x.properties.pointType || '')) turns.push({ lat: g.coordinates[1], lon: g.coordinates[0], text: x.properties.description.replace(/<[^>]+>/g, ''), done: false });
    }
    return { km: (p0.totalDistance || 0) / 1000, min: (p0.totalTime || 0) / 60, line, turns };
  } catch { return null; }
}
async function trCourse(minutes, inner) {
  TO.course = null; TO.courseMin = minutes; trDraw('loading'); trSay('가장 좋은 산책 코스를 만드는 중…', false);
  const lim = TO.radius;
  const parks = TO.items.filter(x => x.area >= 30000 && x.dist - Math.sqrt(x.area) / 2 <= lim).sort((a, b) => b.area / (1 + b.dist / 400) - a.area / (1 + a.dist / 400));
  const main = parks[0];
  let stops = [];
  if (main) {
    const box = main.box || [main.lat - 0.004, main.lon - 0.005, main.lat + 0.004, main.lon + 0.005];
    const inBox = x => x.lat >= box[0] - 0.0005 && x.lat <= box[2] + 0.0005 && x.lon >= box[1] - 0.0005 && x.lon <= box[3] + 0.0005;
    const want = minutes <= 30 ? 1 : minutes <= 60 ? 2 : 3;
    // 공원 안 볼거리(오픈스트리트맵)는 4초만 기다리고, 늦게 오면 받은 뒤에 코스를 더 좋게 바꿈
    let pool = inner;
    if (!pool) {
      const P = osmInside(box, 40000), first = await Promise.race([P, new Promise(r => setTimeout(() => r(null), 4000))]);
      if (first) pool = first;
      else P.then(late => { late = (late || []).filter(inBox); if (late.length && TO.tab === 'walk' && !TO.watch && TO.course && TO.course.park === main && TO.courseMin === minutes) { trCourse(minutes, late).then(() => trSay(`공원 안 볼거리도 넣어서 코스를 더 좋게 바꿨어 🌳 ${TO.course.stops.map(s => esc(s.title)).join(' → ')} → 출발점. 약 <b>${TO.course.km.toFixed(1)}km · ${mins(TO.course.time)}</b>`)); } });
    }
    pool = (pool || []).filter(inBox).slice(0, 14);
    if (pool.length) {
      stops = [pool.slice().sort((a, b) => rkm(TO.at, a) - rkm(TO.at, b))[0]];
      while (stops.length < want) {   // 서로 멀리 떨어진 곳을 골라 공원을 넓게 돌기
        let best = null, bd = -1;
        for (const c of pool) { if (stops.includes(c)) continue; const d = Math.min(...stops.map(s => rkm(s, c))); if (d > bd) { bd = d; best = c; } }
        if (!best || bd < 0.08) break; stops.push(best);
      }
    }
    // 🚪 공원 문: 가까운 문으로 들어가 반대쪽 문까지 — 공원을 가로질러 한 바퀴
    const gates = (main.gates || []).map(g => ({ id: 'gate_' + g.name, kind: '공원 문', title: g.name, lat: g.lat, lon: g.lon, img: '' }));
    if (gates.length) {
      const entry = gates.slice().sort((a, b) => rkm(TO.at, a) - rkm(TO.at, b))[0];
      const far = gates.slice().sort((a, b) => rkm(entry, b) - rkm(entry, a))[0];
      stops = [entry].concat(stops.filter(s => rkm(s, entry) > 0.08 && rkm(s, far) > 0.08)).concat(far !== entry && minutes > 30 ? [far] : []);
    }
    if (!stops.length) stops = [main];
    stops = [stops[0]].concat(nnOrder(stops[0], stops.slice(1)));
  } else {
    const pool = TO.items.filter(x => x.dist < lim).slice(0, 12); let cur = TO.at;
    while (pool.length && stops.length < 4) { pool.sort((a, b) => rkm(cur, a) - rkm(cur, b)); cur = pool.shift(); stops.push(cur); }
  }
  stops.forEach(s => { s.dist = rkm(TO.at, s) * 1000; });
  let rt = await trWalkRoute(TO.at, stops);
  while (rt && rt.min + stops.length * 5 > minutes * 1.3 && stops.length > 1) { stops.pop(); rt = await trWalkRoute(TO.at, stops); }
  let km = 0, cur = TO.at; for (const s of stops) { km += rkm(cur, s) * 1.3; cur = s; } km += rkm(cur, TO.at) * 1.3;
  if (!rt) while (stops.length > 1 && km / 4 * 60 + stops.length * 5 > minutes * 1.3) { stops.pop(); km = 0; cur = TO.at; for (const s of stops) { km += rkm(cur, s) * 1.3; cur = s; } km += rkm(cur, TO.at) * 1.3; }
  TO.course = stops.length ? { min: minutes, stops, park: main || null, km: rt ? rt.km : km, time: (rt ? rt.min : km / 4 * 60) + stops.length * 5, line: rt ? rt.line : null, turns: rt ? rt.turns : [] } : null;
  const c = TO.course;
  trSay(c ? `${main ? `<b>${esc(main.title)}</b>${main.area >= 100000 ? ` (약 ${(main.area / 10000).toFixed(0)}만㎡)` : ''}을(를) 걷는 ` : ''}${minutes}분 산책 코스야: ${c.stops.map(s => esc(s.title)).join(' → ')} → 다시 출발점. 약 <b>${c.km.toFixed(1)}km · ${mins(c.time)}</b>${c.line ? ' (실제 걷는 길)' : ''}. <b>🐾 같이 걷기</b>를 누르면 돌 곳과 볼거리를 하나씩 알려 줄게!` : `반경 ${TO.radius >= 1000 ? TO.radius / 1000 + 'km' : TO.radius + 'm'} 안에는 걸을 만한 공원·볼거리가 없어. 지도 아래에서 반경을 넓혀 봐.`);
  trDraw();
}
async function trPick(i) {
  const it = TO.view[i]; if (!it) return;
  if (!TO.sel) navPush(() => { TO.sel = null; trDraw(); });
  TO.sel = Object.assign({}, it, { loading: true }); trDraw();
  const d = await trDetailAny(it); TO.sel = Object.assign({}, it, d || {}, { img: (d && d.img) || it.img, loading: false }); trDraw();
  if (TO.sel.overview) trSay(`<b>${esc(it.title)}</b> — ${esc(TO.sel.overview.slice(0, 120))}…`, false);
}
function trSay(html, speak) { const b = $('#tPet'); if (b) b.innerHTML = '🐾 ' + html; TO.say = html; if (speak !== false && typeof rSpeak === 'function') rSpeak(html); }
function trDraw(st) {
  if (TO.map) { try { TO.map.remove(); } catch { } TO.map = null; }   // 화면을 바꾸기 전에 지도 치우기
  const box = $('#tourBox'); if (!box) return;
  const tabs = [['see', '🌿 볼거리'], ['walk', '🚶 산책 코스'], ['food', '🍚 맛집'], ['stay', '🏨 숙소']];
  const list = TO.view = TO.tab === 'walk' ? (TO.course ? TO.course.stops : []) : TO.items;
  const S0 = TO.sel;
  if (TO.map) { try { TO.map.remove(); } catch { } TO.map = null; }
  box.innerHTML = `<div class="seg mtabs">${tabs.map(([k, n]) => `<button data-tt="${k}" class="${TO.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="card rpetc"><p id="tPet">🐾 ${st === 'loading' && !TO.say ? '찾는 중…' : (TO.say || '')}</p></div>
    <div id="tMap" class="rmap"></div>
    ${S0 ? '' : `<div class="rrad"><span>반경</span><input type="range" id="tRad" min="0" max="${RSTEPS.length - 1}" step="1" value="${Math.max(0, RSTEPS.indexOf(TO.radius))}"><b id="tRadV">${rfmt(TO.radius)}</b></div>`}
    ${TO.tab === 'walk' ? `<div class="card"><div class="seg">${[30, 60, 90].map(m => `<button data-tm="${m}" class="${TO.courseMin === m ? 'on' : ''}">${m}분</button>`).join('')}</div>${TO.course ? `<div class="row bctl"><button data-tg="1" class="bplay">${TO.watch ? '⏹ 걷기 그만' : '🐾 같이 걷기'}</button>${TO.course.trail ? '<button data-ts2="start">🧭 출발점까지 길찾기</button>' : ''}</div>` : ''}</div>
      ${(TO.duru || []).length ? `<div class="card"><h3>🥾 근처 공식 걷기길 (두루누비)</h3>${TO.duru.map((c, i) => `<button class="rcand ${TO.course && TO.course.trail === c ? 'on' : ''}" data-du="${i}"><b>${esc(c.name)}</b><span>${esc(c.sigun)} · ${c.km}km · 약 ${mins(c.min)} · ${['', '쉬움', '보통', '어려움'][c.level] || ''}</span></button>`).join('')}</div>` : ''}` : ''}
    ${S0 ? `<div class="card tsel">${S0.img ? `<img src="${esc(S0.img)}" alt="">` : ''}<h3>${esc(S0.title)}</h3><p class="note small">${esc(tlabel(S0))}${S0.dist ? ' · ' + (S0.dist / 1000).toFixed(1) + 'km' : ''}${S0.addr ? ' · ' + esc(S0.addr) : ''}</p>
      <p class="note" style="line-height:1.7">${S0.loading ? '불러오는 중…' : esc((S0.overview || '소개 글이 없어요').slice(0, 600))}${S0.overview && S0.overview.length > 600 ? '…' : ''}</p>
      <div class="row bctl"><button data-ts="go">🧭 여기로 길찾기</button>${S0.type === 32 ? '<button data-ts="price">💰 가격 보기</button>' : ''}${S0.home ? '<button data-ts="home">🌐 누리집</button>' : ''}</div></div>` : ''}
    ${S0 ? '' : list.map((x, i) => `<button class="titem ${S0 && S0.id === x.id ? 'on' : ''}" data-ti="${i}">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : `<span class="tnoimg">${x.kind === '공원' || /정원|숲|연못/.test(x.kind || '') ? '🌳' : '📍'}</span>`}<span><b>${TO.tab === 'walk' ? (i + 1) + '. ' : ''}${esc(x.title)}</b><small>${esc(tlabel(x))}${x.area >= 100000 ? ' · 큰 공원' : ''} · ${(x.dist / 1000).toFixed(1)}km</small></span></button>`).join('')}
    <p class="note small" style="text-align:center">자료: 한국관광공사 · 오픈스트리트맵${RK().tmap ? ' · TMAP' : ''}${TO.tab === 'stay' ? ' · 가격·빈방·예약은 숙소 앱에서 본인이 직접' : ''}</p>`;
  trMapDraw(list);
}
function trMapDraw(list) {
  list = list || [];
  const el = $('#tMap'); if (!el || !window.L || !TO.at) return;
  try { if (TO.map) TO.map.remove(); } catch { }
  TO.map = L.map(el, { zoomControl: false, attributionControl: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, inertia: false, zoomSnap: 0, maxZoom: 21 }).setView([TO.at.lat, TO.at.lon], 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 21, maxNativeZoom: 19 }).addTo(TO.map);
  TO.meMk = L.marker([TO.at.lat, TO.at.lon], { icon: rMeIcon() }).addTo(TO.map);
  const pts = [[TO.at.lat, TO.at.lon]];
  if (TO.sel) list = [TO.sel];

  list.slice(0, 25).forEach((x, i) => { L.marker([x.lat, x.lon], { icon: L.divIcon({ className: 'tnum', html: `<i>${TO.tab === 'walk' ? i + 1 : ''}</i>`, iconSize: [24, 24] }) }).addTo(TO.map).on('click', () => trPick(i)); pts.push([x.lat, x.lon]); });
  const c = TO.course;
  if (TO.tab === 'walk' && c) {
    if (c.line && c.line.length) { L.polyline(c.line, { color: c.trail ? '#12b886' : '#3182f6', weight: 5, opacity: .85 }).addTo(TO.map); pts.push(...c.line); if (c.trail) { L.marker(c.line[0], { icon: L.divIcon({ className: 'tnum', html: '<i>출발</i>', iconSize: [34, 24] }) }).addTo(TO.map); } }
    else L.polyline(pts.concat([[TO.at.lat, TO.at.lon]]), { color: '#3182f6', weight: 4, dashArray: '8 8' }).addTo(TO.map);
  }
  if (!TO.sel && !(TO.tab === 'walk' && c)) ringShow(TO.map, TO.at, TO.radius);   // 원은 같은 크기, 반경에 맞춰 지도만
  else if (pts.length > 1) TO.map.fitBounds(L.latLngBounds(pts).pad(0.12), { animate: false });
  const m0 = TO.map; setTimeout(() => { if (m0 && TO.map === m0 && document.body.contains(m0.getContainer())) m0.invalidateSize(false); }, 200);
}
// 🐾 같이 걷기: 돌 곳(30m)·볼거리(60m)에 오면 말해 주고, 큰 공원에 들어서면 공원 소개
function trGo() {
  if (TO.watch) return trStop(true);
  const c = TO.course; if (!c || !navigator.geolocation) return;
  TO.next = 0; c.turns.forEach(t => t.done = false); c.inPark = false;
  if (c.trail) {   // 🥾 공식 걷기길: 길 위 어디쯤인지 · 500m 마다 남은 거리
    let lastK = -1;
    TO.watch = navigator.geolocation.watchPosition(p => {
      const me = { lat: p.coords.latitude, lon: p.coords.longitude }; if (TO.meMk && TO.meMk._map) TO.meMk.setLatLng([me.lat, me.lon]);
      let bi = 0, bd = 1e9; c.line.forEach((q, i) => { const d = rkm(me, { lat: q[0], lon: q[1] }); if (d < bd) { bd = d; bi = i; } });
      if (bd > 0.15) return trSay(`길에서 ${Math.round(bd * 1000)}m 떨어져 있어. 초록 선 쪽으로 가 줘`);
      const done = c.km * bi / Math.max(1, c.line.length - 1), k = Math.floor(done * 2);
      if (bi >= c.line.length - 2) { trSay(`🎉 <b>${esc(c.trail.name)}</b> 끝까지 걸었어! 정말 대단해 💛`); return trStop(); }
      if (k !== lastK) { lastK = k; trSay(`🥾 ${done.toFixed(1)}km 걸었어. 앞으로 <b>${(c.km - done).toFixed(1)}km</b> 남았어`); }
    }, () => trSay('위치를 못 읽고 있어. 휴대폰 위치(GPS)를 켜 줘'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    trDraw(); return trSay(`좋아, <b>${esc(c.trail.name)}</b> 같이 걷자! 출발점에서 시작해 줘 🐾`);
  }
  TO.watch = navigator.geolocation.watchPosition(async p => {
    const me = { lat: p.coords.latitude, lon: p.coords.longitude };
    if (TO.meMk && TO.meMk._map) TO.meMk.setLatLng([me.lat, me.lon]);
    if (c.park && !c.inPark && rkm(me, c.park) * 1000 < Math.sqrt(c.park.area || 0) / 2) {
      c.inPark = true; const d = await trDetailAny(c.park);
      return trSay(`🌳 <b>${esc(c.park.title)}</b>에 들어왔어! ${d && d.overview ? esc(d.overview.slice(0, 180)) + '…' : ''}`);
    }
    const st = c.stops[TO.next];
    if (st && rkm(me, st) < 0.06) {
      TO.next++;
      const d = await trDetailAny(st);
      return trSay(`${st.kind === '공원 문' ? '🚪' : '📍'} <b>${esc(st.title)}</b>에 왔어! ${d && d.overview ? esc(d.overview.slice(0, 160)) + '…' : ''} ${c.stops[TO.next] ? '다음은 <b>' + esc(c.stops[TO.next].title) + '</b>야' : '이제 출발한 곳으로 돌아가자'}`);
    }
    const tn = c.turns.find(t => !t.done && rkm(me, t) < 0.03);
    if (tn) { tn.done = true; return trSay(`🚶 ${esc(tn.text)}`); }
    if (!st && TO.next > 0 && rkm(me, TO.at) < 0.06) { trSay('🎉 산책 끝! 다 돌았어. 수고했어 💛'); trStop(); }
  }, () => trSay('위치를 못 읽고 있어. 휴대폰 위치(GPS)를 켜 줘'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  trDraw(); trSay(`좋아, 같이 걷자! 첫 번째는 <b>${esc(c.stops[0].title)}</b>야. 돌 곳에 오면 알려 줄게 🐾`);
}
function trStop(talk) { if (TO.watch != null) { try { navigator.geolocation.clearWatch(TO.watch); } catch { } TO.watch = null; if (talk) trSay('산책 안내를 멈췄어'); } }
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#tourBox')) return;
  const tt = e.target.closest('[data-tt]'); if (tt) { const pt = TO.tab; if (pt !== tt.dataset.tt) navPush(() => { TO.tab = pt; TO.sel = null; TO.course = null; TO.say = ''; trStop(); trLoad(); }); TO.tab = tt.dataset.tt; TO.sel = null; TO.course = null; TO.say = ''; trStop(); return trLoad(); }
  const ti = e.target.closest('[data-ti]'); if (ti) return trPick(+ti.dataset.ti);
  const tm = e.target.closest('[data-tm]'); if (tm) { TO.sel = null; trStop(); return trCourse(+tm.dataset.tm); }
  if (e.target.closest('[data-tg]')) return trGo();
  const du = e.target.closest('[data-du]'); if (du) { trStop(); return durPick(+du.dataset.du); }
  if (e.target.closest('[data-ts2]') && TO.course && TO.course.start) return openRoute(TO.course.start.name, TO.course.start);
  const ts = e.target.closest('[data-ts]'); if (!ts || !TO.sel) return;
  const a = ts.dataset.ts, F = RF();
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
  if (/(근처|주변|여기|이\s*동네).*(볼\s*거리|볼거리|볼\s*거\s*(있|없|많)|뭐\s*볼|구경|관광|가\s*볼\s*(만한|데)|뭐\s*있|공원)|^(둘러보기|관광지\s*(알려|찾아))/.test(t)) { openTour('see'); return true; }
  return false;
}

// 반경 조절 (둘러보기 화면): 바꾸면 그 반경 안에서 다시 찾기
let trRadT = 0;
document.addEventListener('input', e => {
  if (e.target.id !== 'tRad') return;
  TO.radius = RSTEPS[+e.target.value] || 30; const v = $('#tRadV'); if (v) v.textContent = rfmt(TO.radius); if (TO.map && !TO.sel && TO.tab !== 'walk') ringShow(TO.map, TO.at, TO.radius);
  clearTimeout(trRadT); trRadT = setTimeout(() => { TO.sel = null; TO.course = null; TO.say = ''; trStop(); trLoad(); }, 500);
});

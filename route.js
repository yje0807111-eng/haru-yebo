// 🧭 하루 길동무 (11-08): 지금 위치 → 어디로? → 지도로 확인 → 되묻기·왜 가? → 가는 방법·요금 → 같이 가며 안내
const R = { radius: 30, step: 'idle', from: null, to: null, cands: [], purpose: '', airport: null, watch: null, lastSay: 0, lastLeft: 0, map: null, mk: {}, story: '' };
const RK = () => window.HARU_KEYS || {};
const rkm = (a, b) => { const t = Math.PI / 180, dl = (b.lat - a.lat) * t, dn = (b.lon - a.lon) * t, x = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dn / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); };
const won = (n, r) => { n = r ? Math.round(n / 100) * 100 : Math.round(n); return n > 0 ? n.toLocaleString() + '원' : '0원'; };   // r = 택시처럼 대략
const mins = m => m >= 60 ? `${Math.floor(m / 60)}시간 ${Math.round(m % 60)}분` : `${Math.round(m)}분`;
const RSTEPS = [30, 50, 100, 200, 300, 500, 700, 1000, 1500, 2000];
const rfmt = m => m >= 1000 ? m / 1000 + 'km' : m + 'm';
// 🔵 원은 늘 같은 크기 — 반경에 맞게 지도만 확대·축소 (지도 너비의 80% = 지름)
function ringZoom(map, lat, meters) { const el = map.getContainer(), px = Math.max(80, Math.min(el.clientWidth, el.clientHeight) * 0.4); return Math.min(21, Math.log2(156543.03392 * Math.cos(lat * Math.PI / 180) * px / meters)); }
function ringShow(map, at, meters) {
  const el = map.getContainer(); let r = el.querySelector('.rring');
  if (!r) { r = document.createElement('div'); r.className = 'rring'; r.innerHTML = '<span></span>'; el.appendChild(r); }
  r.querySelector('span').textContent = rfmt(meters);
  map.setView([at.lat, at.lon], ringZoom(map, at.lat, meters), { animate: false });
}
// 🧭 보고 있는 방향: 파란 점 앞 빨간 삼각형 (지도는 돌리지 않음)
let rHead = null;
function rHeadSet(h) { rHead = (h + 360) % 360; document.querySelectorAll('.rme .rdir').forEach(e => { e.style.transform = `rotate(${rHead}deg)`; e.style.display = 'block'; }); }
window.addEventListener('deviceorientationabsolute', e => { if (e.alpha != null) rHeadSet(360 - e.alpha); }, true);
window.addEventListener('deviceorientation', e => { if (e.webkitCompassHeading != null) rHeadSet(e.webkitCompassHeading); else if (e.absolute && e.alpha != null) rHeadSet(360 - e.alpha); }, true);
const rMeIcon = () => L.divIcon({ className: 'rme', html: `<div class="rdir" style="${rHead == null ? 'display:none' : `transform:rotate(${rHead}deg)`}"><b></b></div><i></i>`, iconSize: [44, 44], iconAnchor: [22, 22] });
const shortAddr = a => String(a || '').split(' ').filter((w, i) => !(i === 0 && /(특별시|광역시|특별자치시|특별자치도|도)$/.test(w))).filter(w => !/^\d+(-\d+)?$/.test(w)).join(' ');
const RF = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
function rSpeak(text) { return;   // 11-08: 소리 내어 읽지 않기 (글로만) — 사람 많은 곳에서 시끄러워서
  const F = RF(); const t = String(text).replace(/<[^>]+>/g, ' ').replace(/[🐾🧭📍✈️⛪🚇🚌🚕🚶💰⚡😌👴🎉💛]/gu, ''); if (F && F.ttsSpeak) F.ttsSpeak({ text: t, id: 'route' + Date.now() }).catch(() => {}); else if (window.speechSynthesis) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'ko-KR'; speechSynthesis.speak(u); } }
function rTalk(html, speak) { const b = $('#rPet'); if (b) b.innerHTML = '🐾 ' + html; if (speak !== false) rSpeak(html); }

// ── 위치·장소 (열쇠 없이: 오픈스트리트맵)
function myPos() {
  return new Promise(ok => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }), () => ok(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });
}
async function addrOf(p) {
  try { const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lon}&accept-language=ko&zoom=18`)).json(); const a = j.address || {};
    return [a.city || a.province || a.state, a.borough || a.county || a.city_district, a.suburb || a.quarter || a.neighbourhood, a.road, a.house_number].filter(Boolean).join(' ') || j.display_name || ''; } catch { return ''; }
}
async function tmapPlace(q) {
  try {
    const c = R.from ? `&centerLon=${R.from.lon}&centerLat=${R.from.lat}` : '';
    const r = await fetch(`https://apis.openapi.sk.com/tmap/pois?version=1&searchKeyword=${encodeURIComponent(q)}&count=8${c}`, { headers: { appKey: RK().tmap } });
    if (!r.ok) return null;
    const j = await r.json(), list = (((j.searchPoiInfo || {}).pois || {}).poi) || [];
    return list.map(p => ({ name: p.name, addr: [p.upperAddrName, p.middleAddrName, p.lowerAddrName, p.detailAddrName, p.firstNo ? p.firstNo + (p.secondNo && p.secondNo !== '0' ? '-' + p.secondNo : '') : ''].filter(Boolean).join(' '), lat: +(p.frontLat || p.noorLat), lon: +(p.frontLon || p.noorLon), kind: p.upperBizName || '', tel: p.telNo || '' }));
  } catch { return null; }
}
async function findPlace(q) {
  if (RK().tmap) { const t = await tmapPlace(q); if (t && t.length) { R.tmapOrder = true; return t; } }
  R.tmapOrder = false;
  const near = R.from ? `&viewbox=${R.from.lon - 1.5},${R.from.lat + 1.5},${R.from.lon + 1.5},${R.from.lat - 1.5}` : '';
  const get = async extra => { try { return await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=kr&accept-language=ko&limit=6${extra}`)).json(); } catch { return []; } };
  let r = await get(near); if (!r.length) r = await get('');
  return r.map(x => ({ name: x.name || String(x.display_name).split(',')[0], addr: String(x.display_name).split(',').slice(1, 5).reverse().join(' ').replace(/\s+/g, ' ').trim(), lat: +x.lat, lon: +x.lon, kind: x.type }));
}

// ── 화면
function openRoute(dest, at) {
  hideBubble(); petOnly(false); go('route');
  rStop(); R.to = null; R.cands = []; R.purpose = ''; R.airport = null; R.story = ''; R.walk = null;
  rDraw('start');
  rStart(dest, at);
}
async function rStart(dest, at) {
  R.step = 'locating'; rDraw();
  rTalk('지금 어디에 있는지 확인하는 중이야…', false);
  const p = await myPos();
  if (p) { R.from = p; R.from.addr = await addrOf(p); rTalk(`지금 <b>${esc(shortAddr(R.from.addr) || '이 근처')}</b> 근처야.`, false); }
  else { R.from = S.place.lat ? { lat: S.place.lat, lon: S.place.lon, addr: S.place.label } : null; rTalk(R.from ? `위치를 못 찾아서 우리 동네(<b>${esc(R.from.addr)}</b>)에서 출발할게.` : '위치를 못 찾았어 🥲 휴대폰 위치(GPS)를 켜 줘.', false); }
  rMapInit();
  if (at && at.lat) { R.q = dest || at.name || ''; R.cands = [{ name: at.name || dest, addr: at.addr || '', lat: at.lat, lon: at.lon }]; return rPick(0); }
  if (dest) return rSearch(dest);
  R.step = 'dest'; rDraw();
  rTalk(`${R.from && R.from.addr ? '지금 <b>' + esc(shortAddr(R.from.addr)) + '</b> 근처야. ' : ''}어디로 갈까? 아래에 써 줘.`, false);
}
async function rSearch(q) {
  q = String(q || '').trim(); if (!q) return;
  R.step = 'finding'; rDraw(); rTalk(`"${esc(q)}" 찾는 중…`, false);
  R.q = q; R.cands = await findPlace(q);
  if (!R.cands.length) { R.step = 'dest'; rDraw(); return rTalk(`"${esc(q)}"을(를) 못 찾았어 🥲 동네 이름을 붙여서 다시 말해 줘. (예: 대전 ○○교회)`); }
  if (R.from && !R.tmapOrder) R.cands.sort((a, b) => rkm(R.from, a) - rkm(R.from, b));   // TMAP 은 맞는 순서 그대로
  rPick(0);
}
function rPick(i) {
  if (R.step === 'finding' || R.step === 'dest') navPush(() => { rStop(); R.step = 'dest'; R.to = null; R.walk = null; rDraw(); rTalk('어디로 갈까? 아래에 써 줘.', false); });
  R.to = R.cands[i]; R.walk = null; R.step = 'confirm'; rDraw(); rMapShow();
  const more = R.cands.length > 1 ? ' 다른 곳이면 아래에서 골라 줘.' : '';
  rTalk(`<b>${esc(R.to.name)}</b>${R.to.addr ? ' (' + esc(R.to.addr) + ')' : ''}${R.from ? ', 여기서 ' + rkm(R.from, R.to).toFixed(1) + 'km' : ''}. <b>여기 맞아?</b>${more}`);
}
function rConfirm() {
  if (/인천.*공항|인천국제공항/.test(R.q + R.to.name)) { R.step = 'airport'; rDraw(); return rTalk('인천공항 가는구나! <b>1터미널이야, 2터미널이야?</b> 그리고 <b>출국</b>이야, <b>마중</b>이야?'); }
  R.step = 'why'; rDraw();
  rTalk(`무슨 일로 가? 말해 주면 더 잘 도와줄게. 말하기 싫으면 <b>그냥 가자</b>를 눌러 줘.`);
}
// ✈️ 편명으로 인천공항 운항 정보 (오늘): 터미널·출발/도착 예정·체크인 카운터·게이트·입국장 출구
const T_ID = { P01: '1', P02: '1', P03: '2' };
async function rFlight(raw) {
  const id = String(raw || '').toUpperCase().replace(/\s+/g, ''); if (!/^[A-Z0-9]{2}\d{1,4}$/.test(id)) return rTalk('편명은 <b>KE123</b>처럼 영어 두 글자와 숫자야');
  rTalk(`✈️ ${id} 찾는 중…`, false);
  const get = async op => { try { const j = await (await fetch(`https://apis.data.go.kr/B551177/StatusOfPassengerFlightsOdp/${op}?serviceKey=${RK().tour}&type=json&flight_id=${id}&numOfRows=10`)).json(); return (((j.response || {}).body || {}).items || []).filter(x => x.flightId === id); } catch { return []; } };
  const kind = (R.airport || {}).kind;
  let out = kind !== 'in' ? await get('getPassengerDeparturesOdp') : [], inn = kind !== 'out' ? await get('getPassengerArrivalsOdp') : [];
  const hm = s => s && s.length === 4 ? `${s.slice(0, 2)}:${s.slice(2)}` : (s || '');
  const f = out[0] || inn[0];
  if (!f) return rTalk(`오늘 인천공항 ${id} 편을 못 찾았어 🥲 편명이나 날짜를 다시 확인해 줘`);
  const isOut = !!out[0], t = T_ID[f.terminalId] || '1', tn = f.terminalId === 'P02' ? '1터미널(탑승동 — 1터미널에서 셔틀트레인)' : t + '터미널';
  R.airport = Object.assign(R.airport || {}, { t, kind: isOut ? 'out' : 'in' });
  R.to = Object.assign({}, R.to, T_POS[t]); rMapShow();
  const late = f.estimatedDateTime && f.estimatedDateTime !== f.scheduleDateTime ? ` (바뀐 시각 <b>${hm(f.estimatedDateTime)}</b>)` : '';
  if (isOut) {
    const [h, m] = (f.estimatedDateTime || f.scheduleDateTime).match(/\d\d/g).map(Number), leave = new Date(); leave.setHours(h - 3, m, 0, 0);
    R.airport.flight = `✈️ <b>${esc(f.airline)} ${id}</b> → ${esc(f.airport)}<br>• <b>${tn}</b> · 출발 ${hm(f.scheduleDateTime)}${late}<br>• 체크인 카운터 <b>${esc(f.chkinrange || '-')}</b> · 탑승구 <b>${esc(f.gatenumber || '-')}</b>번<br>• 상태: ${esc(f.remark || '예정')}<br>• 공항에는 <b>${String(leave.getHours()).padStart(2, '0')}:${String(leave.getMinutes()).padStart(2, '0')}</b>까지 도착하면 넉넉해`;
  } else {
    R.airport.flight = `🙋 <b>${esc(f.airline)} ${id}</b> ← ${esc(f.airport)}<br>• <b>${tn}</b> · 도착 ${hm(f.scheduleDateTime)}${late}<br>• 입국장 출구 <b>${esc(f.exitnumber || '-')}</b> · 짐 찾는 곳 ${esc(f.carousel || '-')}번<br>• 상태: ${esc(f.remark || '예정')}<br>• 내린 뒤 짐 찾고 나오는 데 보통 30~40분 걸려`;
  }
  rDraw();
  rTalk(isOut ? `${id}은 <b>${tn}</b>에서 ${hm(f.estimatedDateTime || f.scheduleDateTime)}에 출발해. 체크인은 ${esc(f.chkinrange || '-')} 카운터야` : `${id}은 <b>${tn}</b>에 ${hm(f.estimatedDateTime || f.scheduleDateTime)}에 도착해. 입국장 <b>${esc(f.exitnumber || '-')}번 출구</b>에서 기다리면 돼`);
  if (R.airport.kind) setTimeout(() => { R.purpose = isOut ? '출국' : '마중'; rRoutes(); }, 3500);
}
const T_POS = { 1: { lat: 37.4492, lon: 126.4508, name: '인천공항 제1여객터미널' }, 2: { lat: 37.4669, lon: 126.4338, name: '인천공항 제2여객터미널' } };
function rAirport(t, kind) {
  R.airport = Object.assign(R.airport || {}, t ? { t } : {}, kind ? { kind } : {});
  if (R.airport.t && R.airport.t !== '?') { R.to = Object.assign({}, R.to, T_POS[R.airport.t]); rMapShow(); }
  if (!R.airport.t || !R.airport.kind) { rDraw(); return; }
  R.purpose = R.airport.kind === 'out' ? '출국' : '마중'; rRoutes();
}
async function rRoutes(again) {
  if (!again && R.step !== 'routes') { const back = R.step; navPush(() => { rStop(); R.step = back === 'airport' ? 'airport' : 'confirm'; rDraw(); }); }
  if (!again) { R.pt = null; R.ptDone = false; }
  R.step = 'routes'; rDraw(); if (!again) rTalk('가는 방법을 찾는 중…', false);
  const d = R.from ? rkm(R.from, R.to) : 0, roadKm = d * 1.3;
  const out = [];
  if (R.pt) out.push(...R.pt);   // 🚇🚌 지하철·버스 (단추로 찾은 것)
  if (d && d < 2.5) {
    if (!again) R.walk = RK().tmap && R.from ? await tmapWalk() : null;
    const wk = R.walk;
    out.unshift({ icon: '🚶', title: wk ? `걸어가기 (지름길 ${wk.km.toFixed(1)}km, 돌 곳 ${wk.turns.length}번)` : '걸어가기', min: wk ? wk.min : roadKm / 4.2 * 60, fare: 0, note: wk ? '조금만 걸으면 0원이야. "같이 가자" 하면 돌 곳마다 알려 줄게' : '조금만 걸으면 0원이야', tag: '💰 돈 안 드는 길' });
  }
  if (d >= 0.8) { const rk = d * 1.25, tmin = 6 + rk / (rk > 20 ? 58 : 24) * 60, taxi = (4800 + Math.max(0, rk - 1.6) * 760) * 1.12; out.push({ icon: '🚕', title: '택시', approx: true, min: tmin, fare: taxi, note: `대략이야. 차가 막히면 더 나와${rk > 30 ? ' · 고속도로 통행료 따로' : ''}`, tag: '' }); }
  R.routes = out; rDraw();
  const best = out.filter(r => r.tag).map(r => `${r.tag}: ${r.title} ${mins(r.min)}`).join(', ');
  if (again && R.pt && R.pt.length) { const f = R.pt[0], c = R.pt.find(r => r.tag && r.tag.startsWith('💰')); rTalk(`${f.tag}: ${esc(f.title.replace(/[🚇🚌]/gu, ''))}, <b>${mins(f.min)} · ${won(f.fare)}</b>.${c ? ` 돈을 아끼려면 ${mins(c.min)} · <b>${won(c.fare)}</b> 길도 있어.` : ''} 어떤 걸로 갈까?`); rDraw(); return; }
  rTalk(`${esc(R.to.name)}까지 ${d.toFixed(1)}km야. ${RK().odsay ? '아래 <b>🚇🚌 지하철·버스로 가는 길 찾기</b>를 누르면 빠른 길·싼 길·편한 길을 알려 줄게.' : '지하철·버스 길은 아래 <b>카카오맵</b>이나 <b>네이버 지도</b> 단추로 바로 볼 수 있어.'}${S.me.senior ? ' 어르신은 지하철이 무료야!' : ''}`);
  rBrief();
}
// 🚶 TMAP 보행자 길: 지름길 선 + 돌 곳 안내
async function tmapWalk() {
  try {
    const r = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1', { method: 'POST', headers: { appKey: RK().tmap, 'Content-Type': 'application/json' }, body: JSON.stringify({ startX: String(R.from.lon), startY: String(R.from.lat), endX: String(R.to.lon), endY: String(R.to.lat), startName: '출발', endName: R.to.name.slice(0, 20) }) });
    if (!r.ok) return null;
    const j = await r.json(), f = j.features || []; if (!f.length) return null;
    const p0 = f[0].properties || {}, line = [], turns = [];
    for (const x of f) {
      const g = x.geometry || {};
      if (g.type === 'LineString') for (const c of g.coordinates) line.push([c[1], c[0]]);
      if (g.type === 'Point' && x.properties && x.properties.description && (x.properties.pointType || '') !== 'SP') turns.push({ lat: g.coordinates[1], lon: g.coordinates[0], text: x.properties.description.replace(/<[^>]+>/g, ''), done: false });
    }
    return { km: (p0.totalDistance || 0) / 1000, min: (p0.totalTime || 0) / 60, line, turns };
  } catch { return null; }
}
// ODsay (열쇠가 있을 때): 지하철·버스 경로 2~3개 — 무료는 하루 30번(모두 합쳐서)이라 단추로만, 같은 길은 저장해 둔 것
async function rTransit() {
  if (!RK().odsay || !R.from) return rOpenMap('kakao');
  const key = `${R.from.lat.toFixed(3)},${R.from.lon.toFixed(3)}>${R.to.lat.toFixed(3)},${R.to.lon.toFixed(3)}`;
  const C = S.ptCache = S.ptCache || {}, day = today(), U = S.ptUse = S.ptUse && S.ptUse.d === day ? S.ptUse : { d: day, n: 0 };
  let raw = C[key] && Date.now() - C[key].at < 7 * 864e5 ? C[key].paths : null;
  if (!raw) {
    if (U.n >= 8) { rTalk('오늘은 지하철·버스 찾기를 많이 써서, 카카오맵으로 보여 줄게!'); return rOpenMap('kakao'); }
    rTalk('지하철·버스 길을 찾는 중…', false);
    raw = await odsayRaw();
    if (!raw) { rTalk('지금은 지하철·버스 길을 못 찾았어 🥲 카카오맵으로 보여 줄게'); return rOpenMap('kakao'); }
    U.n++; C[key] = { at: Date.now(), paths: raw };
    const ks = Object.keys(C); if (ks.length > 30) delete C[ks.sort((a, b) => C[a].at - C[b].at)[0]];
    save();
  }
  R.pt = odsayPick(raw); R.ptDone = true;
  await rRoutes(true);
}
async function odsayRaw() {
  try {
    const u = `https://api.odsay.com/v1/api/searchPubTransPathT?SX=${R.from.lon}&SY=${R.from.lat}&EX=${R.to.lon}&EY=${R.to.lat}&apiKey=${encodeURIComponent(RK().odsay)}`;
    const j = await (await fetch(u)).json(); if (j.error) return null;
    return ((j.result || {}).path || []).slice(0, 8).map(p => ({ info: p.info, subPath: (p.subPath || []).map(s => ({ trafficType: s.trafficType, sectionTime: s.sectionTime, distance: s.distance, stationCount: s.stationCount, startName: s.startName, endName: s.endName, lane: (s.lane || []).slice(0, 1).map(l => ({ name: l.name, busNo: l.busNo })) })) }));
  } catch { return null; }
}
function odsayPick(paths) {
  {
    const list = paths.map(p => {
      const i = p.info || {}, subs = p.subPath || [], bus = subs.some(s => s.trafficType === 2), sub = subs.some(s => s.trafficType === 1);
      const legs = subs.filter(s => s.trafficType !== 3).map(s => s.trafficType === 1 ? `🚇 ${((s.lane && s.lane[0] && s.lane[0].name) || '지하철').replace(/^수도권\s*/, '')} ${s.startName}→${s.endName}` : `🚌 ${(s.lane && s.lane[0] && s.lane[0].busNo) || '버스'} ${s.startName}→${s.endName}`);
      const transfers = (i.busTransitCount || 0) + (i.subwayTransitCount || 0) - 1;
      let fare = i.payment || 0; if (S.me.senior && !bus) fare = 0;
      return { icon: '', title: legs.join(' → '), min: i.totalTime || 0, fare, walk: i.totalWalk || 0, transfers: Math.max(0, transfers), note: `갈아타기 ${Math.max(0, transfers)}번 · 걷기 ${Math.round((i.totalWalk || 0) / 70)}분${S.me.senior && !bus ? ' · 어르신 지하철 무료' : ''}`, tag: '' };
    });
    if (!list.length) return [];
    const fast = list.slice().sort((a, b) => a.min - b.min)[0];
    // 💰 싼 길: 300원 넘게 아끼고 시간이 1.5배 안쪽일 때만 (몇십 원 아끼려고 한참 돌아가지 않게)
    let cheap = list.filter(r => fast.fare - r.fare >= 500 && r.min <= fast.min * 1.3).sort((a, b) => a.fare - b.fare || a.min - b.min)[0] || fast;
    const easy = list.slice().sort((a, b) => a.transfers - b.transfers || a.walk - b.walk || a.min - b.min)[0];
    fast.tag = '⚡ 가장 빠른 길'; if (cheap !== fast) cheap.tag = '💰 가장 싼 길'; if (easy !== fast && easy !== cheap) easy.tag = '😌 가장 편한 길 (갈아타기 적게)';
    if (cheap !== fast) cheap.note += ` · ${mins(cheap.min - fast.min)} 더 걸리지만 ${won(fast.fare - cheap.fare)} 아껴`;
    return [...new Set([fast, cheap, easy])];
  }
}
function rOpenMap(which) {
  const F = RF(), f = R.from || {}, t = R.to, name = encodeURIComponent(t.name);
  const urls = which === 'naver' ? [`nmap://route/public?slat=${f.lat}&slng=${f.lon}&sname=${encodeURIComponent('출발')}&dlat=${t.lat}&dlng=${t.lon}&dname=${name}&appname=kr.haruyebo.app`, `https://map.naver.com/p/directions/-/${t.lon},${t.lat},${name},,/-/transit`]
    : [`kakaomap://route?sp=${f.lat},${f.lon}&ep=${t.lat},${t.lon}&by=PUBLICTRANSIT`, `https://map.kakao.com/link/to/${name},${t.lat},${t.lon}`];
  if (F && F.openApp) F.openApp({ pkg: '', url: urls[0] }).then(r => { if (!r.ok) F.openApp({ pkg: '', url: urls[1] }); }).catch(() => F.openApp({ pkg: '', url: urls[1] }));
  else window.open(urls[1], '_blank');
}
// 📖 가는 동안 들려줄 이야기 (목적 맞춤)
async function rBrief() {
  const P = R.purpose, A = R.airport;
  let tips = '';
  if (A && A.kind === 'out') tips = `✈️ <b>출국 준비</b><br>• 여권(남은 기간 6개월 넘는지), 전자 탑승권, 항공사 앱<br>• 국제선은 <b>3시간 전</b>에 도착하면 넉넉해<br>• 보조배터리는 꼭 들고 타는 가방에, 물·화장품 같은 액체는 100ml 이하만<br>• 순서: 체크인 → 짐 부치기 → 보안 검색 → 출국 심사 → 탑승구<br>• ${A.t === '2' ? '<b>2터미널</b>로 가요. 체크인 카운터는 항공사 앱이나 표에서 확인해' : A.t === '1' ? '<b>1터미널</b>로 가요. 체크인 카운터는 항공사 앱이나 표에서 확인해' : '터미널은 표에 적힌 T1/T2를 꼭 확인해 (대한항공·아시아나·델타 등은 2터미널)'}`;
  else if (A && A.kind === 'in') tips = `🙋 <b>마중 가는 법</b><br>• 비행기가 내려도 짐 찾고 나오는 데 보통 <b>30~40분</b> 걸려<br>• 도착 시각과 <b>입국장 출구 번호</b>는 공항 누리집·앱에서 편명으로 확인할 수 있어 (열쇠를 받으면 내가 바로 찾아 줄게)<br>• 기다리는 동안 입국장 근처 카페나 의자에서 쉬어도 돼<br>• 차로 가면 단기 주차장이 입국장과 가까워`;
  else if (P === '예배') tips = '⛪ <b>예배 가기</b><br>• 예배 시간과 주차는 교회 누리집에서 확인해 줘 (아래 단추)<br>• 처음 가면 안내 데스크에 "처음 왔어요" 하면 반갑게 맞아 줘';
  else if (P === '병원') tips = '🏥 <b>병원 가기</b><br>• 신분증 꼭 챙기기 (진료 접수에 필요해)<br>• 먹는 약 이름을 적어 가면 좋아<br>• 예약 시간 10~20분 전에 도착하면 넉넉해';
  else if (P === '약속') tips = '🤝 <b>약속</b><br>• 늦을 것 같으면 미리 연락해. "○○에게 전화해 줘" 하면 전화 화면을 열어 줄게';
  else if (P === '구경') tips = '🌿 <b>구경·관광</b><br>• 도착하면 근처 볼거리와 산책 코스를 알려 줄게 (곧 생겨요)<br>• 편한 신발, 물 한 병!';
  let story = '';
  try { const j = await (await fetch(`https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(R.to.name)}`)).json(); if (j && j.extract && j.type !== 'disambiguation') story = j.extract; } catch { }
  R.story = story; R.tips = tips; rDraw();
}

function rDraw(force) {
  if (R.map) { try { R.map.remove(); } catch { } R.map = null; }   // 11-08: 화면을 바꾸기 전에 지도 치우기 (_leaflet_pos 오류)
  const box = $('#routeBox'); if (!box) return;
  const st = R.step;
  let body = '';
  if (st === 'dest' || st === 'finding' || st === 'locating' || force === 'start')
    body = `<div class="card"><div class="row"><input id="rQ" placeholder="어디로 갈까? (예: 인천공항, 대전 ○○교회)" enterkeyhint="search"><button class="btn" data-r="find">찾기</button></div></div>
      <div class="rcat">${[['see', '🌿 볼거리'], ['walk', '🚶 산책'], ['food', '🍚 맛집'], ['stay', '🏨 숙소']].map(([k, n]) => `<button data-rt="${k}">${n}</button>`).join('')}</div>`;
  if (st === 'confirm') body = `<div class="card"><div class="row bctl"><button data-r="yes" class="bplay">✅ 맞아</button><button data-r="again">✏️ 다시 찾기</button></div>
      ${R.cands.length > 1 ? `<p class="note small" style="margin:10px 0 4px">혹시 이곳?</p>${R.cands.map((c, i) => `<button class="rcand ${c === R.to ? 'on' : ''}" data-rc="${i}"><b>${esc(c.name)}</b><span>${esc(c.addr)}${R.from ? ' · ' + rkm(R.from, c).toFixed(1) + 'km' : ''}</span></button>`).join('')}` : ''}</div>`;
  if (st === 'airport') { const A = R.airport || {}; body = `<div class="card"><p class="note">터미널</p><div class="seg">${[['1', '1터미널'], ['2', '2터미널'], ['?', '모르겠어']].map(([k, n]) => `<button data-at="${k}" class="${A.t === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <p class="note small">모르면 비행기 표나 문자에 적힌 <b>T1 / T2</b>를 봐 줘. 대한항공·아시아나·델타·에어프랑스 등은 2터미널이야.</p>
      <p class="note" style="margin-top:10px">무슨 일로?</p><div class="seg">${[['out', '✈️ 출국'], ['in', '🙋 마중(입국)']].map(([k, n]) => `<button data-ak="${k}" class="${A.kind === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      ${RK().tour ? `<p class="note" style="margin-top:10px">비행기 편명을 알면 터미널·시각·게이트까지 찾아 줄게 (예: KE123)</p><div class="row"><input id="rFl" placeholder="편명 (모르면 비워 둬)" style="text-transform:uppercase"><button class="btn" data-r="fl">찾기</button></div>` : ''}
      ${A.flight ? `<div class="rflight">${A.flight}</div>` : ''}</div>`; }
  if (st === 'why') body = `<div class="card"><div class="tvapps">${[['예배', '⛪ 예배'], ['약속', '🤝 약속·만남'], ['병원', '🏥 병원'], ['구경', '🌿 구경·관광'], ['볼일', '📋 볼일'], ['', '그냥 가자']].map(([k, n]) => `<button data-rp="${k}">${n}</button>`).join('')}</div></div>`;
  if (st === 'routes' || st === 'going') body = `${(R.routes || []).map(r => `<div class="card rroute">${r.tag ? `<p class="rtag">${r.tag}</p>` : ''}<p><b>${r.icon ? r.icon + ' ' : ''}${esc(r.title)}</b></p><p class="rbig">${mins(r.min)} · ${r.approx ? '약 ' + won(r.fare, 1) : won(r.fare)}</p><p class="note small">${esc(r.note || '')}</p></div>`).join('')}
      ${RK().odsay && !R.ptDone ? '<div class="card"><button class="btn" data-r="pt" style="width:100%;font-size:17px;padding:14px">🚇🚌 지하철·버스로 가는 길 찾기</button></div>' : ''}
      <div class="card"><p class="note">${RK().odsay ? '실시간 버스 도착·내릴 역 알림은 지도 앱이 더 정확해요' : '지하철·버스 길은 지도 앱에서 바로 볼 수 있어요'}</p><div class="row bctl"><button data-r="kakao">🗺️ 카카오맵</button><button data-r="naver">🗺️ 네이버 지도</button></div>
      <div class="row bctl"><button data-r="go" class="bplay">${R.watch ? '⏹ 안내 그만' : '🐾 같이 가자 (내 위치 따라 안내)'}</button></div></div>
      ${R.tips ? `<div class="card"><p class="note" style="line-height:1.75">${R.tips}</p>${R.purpose === '예배' ? `<button class="btn ghost small" data-r="web">⛪ 예배 시간 찾아보기</button>` : ''}</div>` : ''}
      ${R.story ? `<div class="card"><h3>📖 ${esc(R.to.name)} 이야기</h3><p class="note" style="line-height:1.75">${esc(R.story)}</p></div>` : ''}`;
  box.innerHTML = `<div class="card rpetc"><p id="rPet">${($('#rPet') || {}).innerHTML || '🐾 길 찾을 준비 중…'}</p></div>
    <div id="rMap" class="rmap"></div>
    ${(st === 'dest' || st === 'finding' || st === 'locating' || force === 'start') ? `<div class="rrad"><span>반경</span><input type="range" id="rRad" min="0" max="${RSTEPS.length - 1}" step="1" value="${Math.max(0, RSTEPS.indexOf(R.radius))}"><b id="rRadV">${rfmt(R.radius)}</b></div>` : ''}
    ${body}
    <p class="note small" style="text-align:center">지도 © OpenStreetMap · 시간·요금은 대략이에요</p>`;
  rMapInit(); rMapShow();
}

// ── 지도 (Leaflet)
function rMapInit() {
  const el = $('#rMap'); if (!el || !window.L) return;
  if (R.map && R.map.getContainer() === el && document.body.contains(el)) return;
  try { if (R.map) R.map.remove(); } catch { }
  R.map = L.map(el, { zoomControl: false, attributionControl: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, inertia: false, zoomSnap: 0, maxZoom: 21 }).setView(R.from ? [R.from.lat, R.from.lon] : [37.5665, 126.978], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 21, maxNativeZoom: 19 }).addTo(R.map);
  R.mk = {};
  const m0 = R.map; setTimeout(() => { if (m0 && R.map === m0 && document.body.contains(m0.getContainer())) m0.invalidateSize(false); }, 200);
}
function rMapShow() {
  if (!R.map) return;
  const me = rMeIcon();
  if (R.from) { if (!R.mk.me) R.mk.me = L.marker([R.from.lat, R.from.lon], { icon: me }).addTo(R.map); else R.mk.me.setLatLng([R.from.lat, R.from.lon]); }
  if (R.to) { if (!R.mk.to) R.mk.to = L.marker([R.to.lat, R.to.lon]).addTo(R.map); else R.mk.to.setLatLng([R.to.lat, R.to.lon]); R.mk.to.bindTooltip(R.to.name, { permanent: true, direction: 'top', offset: [0, -36] }); }
  const ring = R.map.getContainer().querySelector('.rring');
  if (R.from && !R.to) ringShow(R.map, R.from, R.radius); else if (ring) ring.remove();
  if (R.from && R.to) {
    if (R.mk.line) R.map.removeLayer(R.mk.line);
    const pts = R.walk && R.walk.line.length ? R.walk.line : [[R.from.lat, R.from.lon], [R.to.lat, R.to.lon]];
    R.mk.line = L.polyline(pts, R.walk ? { color: '#3182f6', weight: 5, opacity: .85 } : { color: '#3182f6', weight: 3, dashArray: '6 8' }).addTo(R.map);
    if (!R.watch) R.map.fitBounds(L.latLngBounds(pts.concat([[R.from.lat, R.from.lon]])).pad(0.25), { animate: false }); else R.map.panTo([R.from.lat, R.from.lon], { animate: false });
  }
  else if (R.to) R.map.setView([R.to.lat, R.to.lon], 15, { animate: false });
}

// ── 같이 가기: 내 위치를 따라가며 남은 거리·도착 알려 주기 (앱을 켜 둔 동안)
function rGo() {
  if (R.watch) return rStop(true);
  if (!navigator.geolocation) return rTalk('이 휴대폰은 위치를 못 읽어 🥲');
  R.step = 'going'; R.lastLeft = 0; R.lastSay = 0;
  R.watch = navigator.geolocation.watchPosition(p => {
    R.from = { lat: p.coords.latitude, lon: p.coords.longitude, addr: R.from && R.from.addr };
    rMapShow();
    const left = rkm(R.from, R.to), now = Date.now();
    if (R.walk) { const tn = R.walk.turns.find(x => !x.done && rkm(R.from, x) < 0.03); if (tn) { tn.done = true; R.lastSay = now; R.lastLeft = left; rTalk(`🚶 ${esc(tn.text)}`); return; } }
    if (left < 0.06) { rTalk(`🎉 <b>${esc(R.to.name)}</b>에 도착했어! 수고했어 💛 근처를 둘러보고 싶으면 "여기 뭐 볼 거 있어?" 하고 말해 줘`); rStop(); R.arrived = { lat: R.to.lat, lon: R.to.lon, name: R.to.name }; return; }
    const step = left > 5 ? 1 : left > 1 ? 0.3 : 0.1;
    if (!R.lastLeft || Math.abs(R.lastLeft - left) >= step || now - R.lastSay > 180000) {
      const getting = R.lastLeft && left > R.lastLeft + 0.05;
      R.lastLeft = left; R.lastSay = now;
      rTalk(getting ? `어? 멀어지고 있어. <b>${esc(R.to.name)}</b> 쪽으로 다시 가 볼까? 지금 ${left.toFixed(1)}km 남았어` : `잘 가고 있어! <b>${left < 1 ? Math.round(left * 1000) + 'm' : left.toFixed(1) + 'km'}</b> 남았어`);
    }
  }, () => rTalk('위치를 못 읽고 있어. 휴대폰 위치(GPS)를 켜 줘'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  rDraw(); rTalk('좋아, 같이 가자! 남은 거리를 글로 알려 줄게. 화면을 켜 둔 채로 가 줘 🐾', false);
}
function rStop(talk) { if (R.watch != null) { try { navigator.geolocation.clearWatch(R.watch); } catch { } R.watch = null; if (talk) rTalk('안내를 멈췄어'); } if (R.step === 'going') R.step = 'routes'; }

document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#routeBox')) return;
  const rt = e.target.closest('[data-rt]'); if (rt) return openTour(rt.dataset.rt, R.from ? { lat: R.from.lat, lon: R.from.lon, name: shortAddr(R.from.addr) || '지금 있는 곳' } : null, R.radius);
  const c = e.target.closest('[data-rc]'); if (c) return rPick(+c.dataset.rc);
  const at = e.target.closest('[data-at]'); if (at) return rAirport(at.dataset.at, null);
  const ak = e.target.closest('[data-ak]'); if (ak) return rAirport(null, ak.dataset.ak);
  const rp = e.target.closest('[data-rp]'); if (rp) { R.purpose = rp.dataset.rp; return rRoutes(); }
  const b = e.target.closest('[data-r]'); if (!b) return;
  const a = b.dataset.r;
  if (a === 'find') { const q = $('#rQ').value.trim(); if (q) rSearch(q); }
  if (a === 'yes') rConfirm();
  if (a === 'again') { R.step = 'dest'; R.to = null; rDraw(); rTalk('<b>어디로 갈까?</b> 다시 말해 줘'); }
  if (a === 'kakao' || a === 'naver') rOpenMap(a);
  if (a === 'pt') rTransit();
  if (a === 'fl') rFlight($('#rFl').value);
  if (a === 'go') rGo();
  if (a === 'story') rSpeak(R.story);
  if (a === 'web') { const F = RF(), u = 'https://search.naver.com/search.naver?query=' + encodeURIComponent(R.to.name + ' 예배시간'); if (F && F.openApp) F.openApp({ pkg: '', url: u }); else window.open(u, '_blank'); }
});
document.addEventListener('keydown', e => { if (e.target.id === 'rQ' && e.key === 'Enter') { const q = e.target.value.trim(); if (q) rSearch(q); } });
// 반경 조절: 지도만 다시 맞춤 (100m ~ 2km)
document.addEventListener('input', e => { if (e.target.id !== 'rRad') return; R.radius = RSTEPS[+e.target.value] || 30; const v = $('#rRadV'); if (v) v.textContent = rfmt(R.radius); rMapShow(); });
if (window.S) delete S.routeRecent;   // 찾은 흔적은 남기지 않음

// 말 알아듣기: "길 찾아 줘", "인천공항 가는 길", "서울역까지 어떻게 가?" · 길찾기 중엔 도착지·"맞아"
function routeTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').trim();
  if (view === 'route') {
    if (R.step === 'dest') { const q = t.replace(/\s*(으로|로|에|까지)?\s*(가자|갈래|가고\s*싶어|가 줘|가줘|가야\s*해)$/, '').trim(); if (q) { rSearch(q); return true; } }
    if (R.step === 'confirm') { if (/^(응|어|맞아|맞아요|네|예|그래|여기|거기|좋아)/.test(t)) { rConfirm(); return true; } if (/^(아니|아냐|다른|틀려)/.test(t)) { R.step = 'dest'; rDraw(); rTalk('<b>어디로 갈까?</b> 다시 말해 줘'); return true; } }
    if (R.step === 'airport' && /^[A-Za-z0-9]{2}\s*\d{1,4}\s*(편)?/.test(t) && RK().tour) { rFlight(t.match(/^[A-Za-z0-9]{2}\s*\d{1,4}/)[0]); return true; }
    if (R.step === 'airport') { const tm = /(1|일|첫)\s*터미널/.test(t) ? '1' : /(2|이|두)\s*터미널/.test(t) ? '2' : null, k = /출국|떠나|여행\s*가|비행기\s*타/.test(t) ? 'out' : /마중|입국|데리러|마중나가|도착/.test(t) ? 'in' : null; if (tm || k) { rAirport(tm, k); return true; } }
    if (R.step === 'why') { const m = [['예배', /예배|교회|미사|기도/], ['병원', /병원|진료|검사|치료/], ['약속', /약속|만나|만남|모임|미팅/], ['구경', /구경|관광|여행|산책|놀러/], ['볼일', /볼일|일|업무|서류/]].find(([, re]) => re.test(t)); if (m || /그냥|몰라|말\s*안|비밀/.test(t)) { R.purpose = m ? m[0] : ''; rRoutes(); return true; } }
    if (R.step === 'routes' && /(지하철|버스|대중교통|전철)/.test(t) && !R.ptDone) { rTransit(); return true; }
    if (/^(같이\s*가자|안내해\s*줘|출발)/.test(t)) { rGo(); return true; }
    if (/^(안내\s*(그만|멈춰|꺼)|길찾기\s*(그만|꺼))/.test(t)) { rStop(true); return true; }
  }
  if (/^(길\s*(좀\s*)?(찾아|알려|안내)|길찾기|길\s*찾기)/.test(t)) { openRoute(''); return true; }
  const m = t.match(/^(.{2,30}?)\s*(?:까지|에|으로|로)?\s*(?:가는\s*(?:길|방법)|어떻게\s*가|가려면|가는\s*거|길\s*(?:좀\s*)?(?:찾아|알려|안내))/);
  if (m) { openRoute(m[1].trim()); return true; }
  return false;
}

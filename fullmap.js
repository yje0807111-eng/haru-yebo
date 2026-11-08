// 🗺️ 전체 화면 걷기 지도 (11-08): 팻에게 "지도" → 휴대폰 전체가 지도 · 거리 30~500m(처음 100m) · 2D/3D
// 팻은 구석에 조용히 있다가, 눌러서 물어볼 때만 글로 대답 · 걷는 동안 화면이 꺼지지 않음
const FM_STEPS = [30, 50, 100, 200, 300, 500];
let fmOn = false, fmSayT = 0;
function fmKeep(on) { const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet; if (F && F.keepScreen) F.keepScreen({ on }).catch(() => { }); }
async function openWalkMap() {
  window.mapWantAt = Date.now(); { const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet; if (document.hidden && F && F.front) F.front().catch(() => { }); }
  if (view !== 'route' || R.to || !['dest', 'finding', 'locating'].includes(R.step)) { openRoute(''); await new Promise(r => setTimeout(r, 300)); }
  if (fmOn) return;
  fmOn = true; document.body.classList.add('fullmap');
  R.radius = 100;   // 전체 화면 지도는 늘 100m 로 시작
  navPush(() => fmClose());
  fmUI(); fmKeep(true);
  setTimeout(() => { try { if (R.map) R.map.invalidateSize(false); if (typeof m3 !== 'undefined' && m3) m3.resize(); } catch { } rMapShow(); rPois().then(rPoiDraw); }, 120);
}
function fmClose() {
  if (!fmOn) return;
  fmOn = false; R.focus = null; document.body.classList.remove('fullmap'); fmKeep(false);
  const u = document.getElementById('fmUI'); if (u) u.remove();
  if (!RSTEPS.includes(R.radius)) R.radius = 100;
  rDraw(); rPois().then(rPoiDraw);
}
function fmUI() {
  let u = document.getElementById('fmUI'); if (u) u.remove();
  u = document.createElement('div'); u.id = 'fmUI';
  const petSrc = (document.querySelector('#pet') || document.querySelector('.pet img') || {}).src || '';
  u.innerHTML = `<div class="fmtop"><button class="fmx" data-fm="x">✕</button><div class="fmr"><b id="fmRad">반경 ${rfmt(R.radius)}</b><small>두 손가락으로 넓히고 좁혀요</small></div></div>
    <button class="fmpet" data-fm="ask" title="눌러서 물어보기">${petSrc ? `<img src="${esc(petSrc)}" alt="">` : '🐾'}</button>
    <div class="fmsay" id="fmSay" hidden></div>`;
  document.body.appendChild(u);
}
function fmSay(html, ms) { const b = document.getElementById('fmSay'); if (!b) return; b.innerHTML = '🐾 ' + html; b.hidden = false; clearTimeout(fmSayT); fmSayT = setTimeout(() => { b.hidden = true; }, ms || 7000); }
// 팻을 누르면 물어보기 (말로 — 웹이면 글로)
async function fmAsk() {
  let q = '';
  if (window.Native && Native.listen) { fmSay('👂 듣고 있어… 물어봐!', 9000); try { q = await Native.listen(); } catch { } }
  else q = prompt('무엇을 물어볼까? (예: 국밥집 어디야?, 앞에 있는 가게 뭐야?)') || '';
  q = String(q || '').trim(); if (!q) return fmSay('잘 못 들었어. 다시 눌러 줘', 3000);
  fmAnswer(q);
}
const FM_CAT = [[/편의점/, '편의점'], [/약국/, '약국'], [/은행|ATM|에이티엠|현금/i, '은행'], [/병원|의원/, '병원'], [/주차/, '주차장'], [/카페|커피/, '카페'], [/숙소|모텔|호텔|잘\s*곳/, '숙박'], [/식당|밥집|음식점|맛집|먹을/, '음식점']];
async function fmAnswer(q) {
  const t = q.replace(/[?!.~]+$/g, '').trim();
  if (/(앞|정면).*(뭐|무슨|어디|가게|있)/.test(t)) {
    const f = rHead == null ? [] : R.pois.filter(p => Math.abs(((bearing(R.from, p) - rHead + 540) % 360) - 180) <= 35);
    if (!f.length) return fmSay(rHead == null ? '휴대폰 나침반을 못 읽어서 앞쪽을 모르겠어 🥲' : '바로 앞 반경 안에는 가게가 없어');
    rPoiOpen(R.pois.indexOf(f[0])); return fmSay(`앞에 <b>${esc(f[0].name)}</b>(${esc(f[0].cat)})가 ${Math.round(f[0].d)}m 거리에 있어${f[1] ? `. 그 뒤로 ${esc(f[1].name)}` : ''}`);
  }
  if (/(지도|그만|닫아|꺼)/.test(t) && t.length < 8) return haruBack();
  // 찾을 말: "국밥집 어디야" → "국밥", "화장실 어디 있어" → "화장실"
  const kw = t.replace(/\s*(은|는|이|가|을|를|좀)?\s*(어디\s*(야|있어|있니|에\s*있어)?|찾아\s*(줘)?|알려\s*(줘)?|있어|가까운\s*데|근처에?|보여\s*(줘)?)\s*/g, ' ').replace(/(집|가게)$/, '').trim() || t;
  fmSay(`"${esc(kw)}" 찾는 중…`, 4000);
  if (!R.from || !RK().tmap) return fmSay('찾기는 갤럭시 앱에서 돼요');
  let list = [];
  try {
    const r = await fetch(`https://apis.openapi.sk.com/tmap/pois?version=1&searchKeyword=${encodeURIComponent(kw)}&centerLon=${R.from.lon}&centerLat=${R.from.lat}&radius=1&searchtypCd=R&count=10`, { headers: { appKey: RK().tmap } });
    const j = r.ok ? await r.json() : {};
    list = ((((j.searchPoiInfo || {}).pois || {}).poi) || []).map(p => { const m = String(p.name).match(/^(.*?)\s*\[([^\]]+)\]\s*$/); const cat = (FM_CAT.find(([re]) => re.test(kw + ' ' + (p.upperBizName || '') + (p.middleBizName || ''))) || [])[1] || '음식점'; return { name: m ? m[1] : p.name, sub: m ? m[2] : '', cat, lat: +(p.frontLat || p.noorLat), lon: +(p.frontLon || p.noorLon), tel: p.telNo || '', addr: [p.upperAddrName, p.middleAddrName, p.lowerAddrName, p.roadName, p.firstBuildNo].filter(Boolean).join(' ') }; });
  } catch { }
  list = list.map(p => Object.assign(p, { d: rkm(R.from, p) * 1000 })).sort((a, b) => a.d - b.d);
  if (!list.length) return fmSay(`가까운 곳에 "${esc(kw)}"이(가) 없어 🥲`);
  // 찾은 곳이 보이게: 거리 단계를 넓히고 그 가게들만 지도에
  const far = list[0].d, step = FM_STEPS.find(m => m >= far * 1.15) || 500;
  if (step > R.radius) rRadiusSet(step);
  R.focus = list.filter(p => p.d <= Math.max(R.radius, far)).slice(0, 10); rPoiFilter(); rPoiDraw(); R.poi = null; rPoiOpen(0);
  fmSay(`가장 가까운 <b>${esc(list[0].name)}</b>은(는) <b>${Math.round(list[0].d)}m</b> 거리야${list[1] ? ` · 다음은 ${esc(list[1].name)} ${Math.round(list[1].d)}m` : ''}`);
}
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#fmUI')) return;
  const r = e.target.closest('[data-fmr]');
  if (r) { R.radius = +r.dataset.fmr; R.poi = null; R.focus = null; rPoiCard(); fmUI(); rMapShow(); rPois(true).then(rPoiDraw); return; }
  const b = e.target.closest('[data-fm]'); if (!b) return;
  if (b.dataset.fm === 'x') haruBack();
  if (b.dataset.fm === 'ask') fmAsk();
});
// 말: "지도", "지도 보여 줘", "걷기 지도", "산책 지도"
function mapTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').trim();
  if (/^(지도|걷기\s*지도|산책\s*지도|동네\s*지도|큰\s*지도)(\s*(좀\s*)?(보여|열어|켜|펼쳐|틀어)\s*(줘|줄래)?)?$/.test(t)) { openWalkMap(); return true; }
  return false;
}

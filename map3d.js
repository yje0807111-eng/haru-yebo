// 🏙️ 3D 지도 (11-08): 길찾기 첫 화면에서 [3D]를 고르면 건물이 솟은 입체 지도 — MapLibre + OpenFreeMap (무료·열쇠 없음)
// 3D 를 처음 고를 때만 도구를 불러옴 (평소엔 가벼운 2D)
let m3Busy = false;
let m3 = null, m3Me = null, m3Pts = [], m3Loading = null;
const m3Active = () => !!(S.map3d && typeof R !== 'undefined' && R.from && !R.to && ['dest', 'finding', 'locating'].includes(R.step) && view === 'route');
function loadML() {
  if (window.maplibregl) return Promise.resolve(true);
  if (m3Loading) return m3Loading;
  return m3Loading = new Promise(ok => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'lib/maplibre/maplibre-gl.css'; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = 'lib/maplibre/maplibre-gl.js'; s.onload = () => ok(true); s.onerror = () => { m3Loading = null; ok(false); }; document.head.appendChild(s);
  });
}
function m3Remove() { if (m3) { try { m3.remove(); } catch { } } m3 = null; m3Me = null; m3Pts = []; }
const m3Zoom = (el, lat, meters) => { const px = Math.max(80, Math.min(el.clientWidth, el.clientHeight) * 0.42); return Math.min(19.5, Math.log2(78271.517 * Math.cos(lat * Math.PI / 180) * px / meters)); };
function m3Circle(c, m) { const pts = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * 2 * Math.PI, dy = m * Math.cos(a) / 111320, dx = m * Math.sin(a) / (111320 * Math.cos(c.lat * Math.PI / 180)); pts.push([c.lon + dx, c.lat + dy]); } return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] } }; }
async function m3Init(el) {
  m3Remove();
  if (!el) return;
  el.innerHTML = '<p class="note" style="padding:20px;text-align:center">3D 지도를 불러오는 중…</p>';
  if (!(await loadML()) || !window.maplibregl) { el.innerHTML = '<p class="note" style="padding:20px">3D 지도를 못 불러왔어 🥲 2D 로 볼게</p>'; S.map3d = false; save(); return setTimeout(() => rDraw(), 1200); }
  if (!document.body.contains(el) || !m3Active()) return;
  el.innerHTML = '';
  m3 = new maplibregl.Map({
    container: el, style: 'https://tiles.openfreemap.org/styles/liberty', center: [R.from.lon, R.from.lat], zoom: m3Zoom(el, R.from.lat, R.radius),
    pitch: 58, bearing: 0, maxPitch: 75, attributionControl: false, localIdeographFontFamily: "'Noto Sans KR', 'Malgun Gothic', sans-serif",
  });
  m3.on('load', () => {
    try {   // 이름은 한국어로
      for (const l of m3.getStyle().layers) if (l.type === 'symbol' && m3.getLayoutProperty(l.id, 'text-field')) m3.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:ko'], ['get', 'name']]);
      if (m3.getLayer('building-3d')) m3.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.85);
    } catch { }
    m3.addSource('ring', { type: 'geojson', data: m3Circle(rCenter(), R.radius) });
    m3.addLayer({ id: 'ring-fill', type: 'fill', source: 'ring', paint: { 'fill-color': '#3182f6', 'fill-opacity': 0.08 } });
    m3.addLayer({ id: 'ring-line', type: 'line', source: 'ring', paint: { 'line-color': '#3182f6', 'line-width': 2.5 } });
    m3Show(); m3Pois();
  });
  m3.on('rotate', m3Arrow);
  try { m3.touchZoomRotate.enable({ around: 'center' }); m3.scrollZoom.enable({ around: 'center' }); m3.doubleClickZoom.disable(); } catch { }
  m3.on('zoomend', () => { if (m3Busy || !m3 || !m3Active()) return; const el = m3.getContainer(), px = Math.max(80, Math.min(el.clientWidth, el.clientHeight) * 0.42), c = m3.getCenter(); rRadiusSet(px * 78271.517 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, m3.getZoom()), true); const src = m3.getSource('ring'); if (src) src.setData(m3Circle({ lat: c.lat, lon: c.lng }, R.radius)); });
  m3.on('dragend', () => { const c = m3.getCenter(); rBrowseTo({ lat: c.lat, lon: c.lng }); });
}
function m3Show() {
  if (!m3 || !R.from) return;
  const el = m3.getContainer();
  const c = rCenter(), z = m3Zoom(el, c.lat, R.radius);
  m3Busy = true; m3.jumpTo({ center: [c.lon, c.lat], zoom: z }); m3Busy = false;
  const src = m3.getSource && m3.getSource('ring'); if (src) src.setData(m3Circle(c, R.radius));
  if (typeof rBrowseBtn === 'function') rBrowseBtn();
  if (!m3Me) { const d = document.createElement('div'); d.className = 'rme'; d.style.width = d.style.height = '44px'; d.innerHTML = `<div class="rdir" style="display:none"><b></b></div><i></i>`; m3Me = new maplibregl.Marker({ element: d, rotationAlignment: 'viewport' }).setLngLat([R.from.lon, R.from.lat]).addTo(m3); }
  else m3Me.setLngLat([R.from.lon, R.from.lat]);
  if (R.browse) { /* 끌어 보는 중: 지도는 그대로 */ }
  let lab = el.querySelector('.m3lab'); if (!lab) { lab = document.createElement('div'); lab.className = 'm3lab'; el.appendChild(lab); }
  lab.textContent = '반경 ' + rfmt(R.radius);
  m3Arrow();
}
function m3Comp() {   // 지도를 돌리면 북·동·남·서 글자가 지도 가장자리를 따라 돌아감
  const c = document.getElementById('rComp'); if (!c || !m3) return;
  c.style.transform = `rotate(${-m3.getBearing()}deg)`;
}
function m3Arrow() { m3Comp(); if (!m3Me || rHead == null || !m3) return; const e = m3Me.getElement().querySelector('.rdir'); if (e) { e.style.display = 'block'; e.style.transform = `rotate(${rHead - m3.getBearing()}deg)`; } }
function m3Pois() {
  if (!m3) return;
  m3Pts.forEach(m => m.remove()); m3Pts = [];
  R.pois.slice(0, 200).forEach((p, i) => {
    const d = document.createElement('div'); d.className = 'rpoi' + (R.poi === p ? ' on' : ''); d.innerHTML = `<span>${POI_ICON[p.cat] || '📍'}</span>`;
    d.addEventListener('click', ev => { ev.stopPropagation(); rPoiOpen(i); });
    m3Pts.push(new maplibregl.Marker({ element: d }).setLngLat([p.lon, p.lat]).addTo(m3));
  });
  rFront();
}
// 방향이 바뀌면 3D 화살표도 (지도 돌린 만큼 빼서)
{ const _rh = rHeadSet; rHeadSet = function (h) { _rh(h); m3Arrow(); }; }
// 2D / 3D 고르기
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-m3]'); if (!b) return;
  const want = b.dataset.m3 === '1'; if (!!S.map3d === want) return;
  S.map3d = want; save(); m3Remove(); rDraw();
  if (want) rTalk('🏙️ 3D 지도야. 두 손가락으로 돌리거나 기울여 볼 수 있어. 걸으면 같이 따라가.', false);
});

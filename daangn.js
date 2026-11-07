// 🥕 당근 (11-07): "당근에서 컴퓨터 찾아 줘" → 당근 검색 화면을 바로 열기. 거리 범위는 당근 앱 설정을 따름
const DG_PKG = 'com.towneers.www';
const DG_QUICK = ['컴퓨터', '노트북', '휴대폰', '자전거', '가구', '유아용품', '가전', '무료나눔'];
function dgState() { S.dg = S.dg || { recent: [] }; return S.dg; }
async function dgSearch(q) {
  q = String(q || '').trim(); const st = dgState();
  if (q) { st.recent = [q].concat(st.recent.filter(x => x !== q)).slice(0, 8); save(); }
  const url = q ? `https://www.daangn.com/kr/search/buy-sell/?q=${encodeURIComponent(q)}` : 'https://www.daangn.com/kr/buy-sell/';
  const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
  say(q ? `🥕 당근에서 "${esc(q)}" 찾아볼게!` : '🥕 당근 열게!', { pose: 'happy', ms: 3500 });
  if (F && F.openApp) { await F.openApp({ pkg: '', url }).catch(() => {}); }   // 당근 앱이 있으면 앱으로, 없으면 웹으로
  else window.open(url, '_blank');
  if (view === 'town') dgDraw();
}
function dgOpenApp() {
  const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
  if (F && F.openApp) F.openApp({ pkg: DG_PKG, url: '' }).then(r => { if (!r.ok) say('휴대폰에 당근 앱이 없어 🥲 플레이스토어에서 "당근"을 깔아 줘', { ms: 4000 }); }).catch(() => {});
  else window.open('https://www.daangn.com/kr/', '_blank');
}
function dgCardHtml() {
  const st = dgState();
  return `<div class="card" id="dgCard"><h3>🥕 당근 (동네 중고 물건)</h3>
    <div class="row"><input id="dgQ" placeholder="찾을 물건 (예: 컴퓨터)" enterkeyhint="search"><button class="btn" data-dg="go">찾기</button></div>
    <div class="tvapps" style="margin-top:8px">${DG_QUICK.map(q => `<button data-dgq="${q}">${q}</button>`).join('')}</div>
    ${st.recent.length ? `<p class="note small" style="margin:10px 0 4px">최근 찾은 것</p><div class="tvapps">${st.recent.map(q => `<button data-dgq="${esc(q)}">🕘 ${esc(q)}</button>`).join('')}</div>` : ''}
    <details class="dgrange"><summary>📏 집에서 얼마나 먼 곳까지 볼지 정하기</summary>
      <p class="note">거리 범위는 <b>당근 앱</b>에 맞춰 둔 대로 찾아요. 바꾸려면:</p>
      <ol class="note"><li>아래 <b>당근 앱 열기</b>를 눌러요</li><li>맨 위 왼쪽 <b>내 동네 이름</b>을 눌러요</li><li><b>내 동네 설정</b>에서 아래 막대를 밀어 <b>가까운 동네 ↔ 먼 동네</b>를 골라요</li></ol>
      <button class="btn ghost" data-dg="app" style="width:100%">🥕 당근 앱 열기</button></details>
    <p class="note small">말로도 돼요: "당근에서 컴퓨터 찾아 줘", "당근 자전거 알아봐 줘"</p></div>`;
}
function dgDraw() {
  const box = $('#townBox'); if (!box) return;
  const old = $('#dgCard'); if (old) { old.outerHTML = dgCardHtml(); return; }
  const first = box.querySelector('.card'); if (first) first.insertAdjacentHTML('afterend', dgCardHtml()); else box.insertAdjacentHTML('beforeend', dgCardHtml());
}
// 동네 날씨 화면에 칸 붙이기
if (typeof drawTown === 'function') { const _dt = drawTown; drawTown = function () { _dt.apply(this, arguments); if (!(typeof tChat !== 'undefined' && tChat)) dgDraw(); }; }
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('#dgCard')) return;
  const q = e.target.closest('[data-dgq]'); if (q) return dgSearch(q.dataset.dgq);
  const b = e.target.closest('[data-dg]'); if (!b) return;
  if (b.dataset.dg === 'go') return dgSearch($('#dgQ').value);
  if (b.dataset.dg === 'app') return dgOpenApp();
});
document.addEventListener('keydown', e => { if (e.target.id === 'dgQ' && e.key === 'Enter') dgSearch(e.target.value); });
// 말 알아듣기: "당근에서 컴퓨터 찾아 줘", "당근 마켓에 자전거 있어?", "당근 열어 줘"
function dgTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').trim();
  if (!/당근/.test(t)) return false;
  if (/^당근\s*(마켓)?\s*(앱)?\s*(좀\s*)?(열어|켜|보여)\s*(줘|줄래)?$/.test(t)) { dgSearch(''); return true; }
  const m = t.match(/당근\s*(?:마켓)?\s*(?:에서|에|으로|서)?\s*(.+?)\s*(?:좀\s*)?(?:찾아|알아봐|알아\s*봐|검색|보여|팔아|나왔)/) || t.match(/당근\s*(?:마켓)?\s*(?:에서|에)\s*(.+?)\s*(?:이|가)?\s*있(?:어|나|는지|니|을까)/);
  if (m) { const q = m[1].replace(/(이|가|을|를|은|는|좀|중고|물건)$/g, '').trim(); if (q) { dgSearch(q); return true; } }
  return false;
}

// 🛡️ 지킴이 (휴대폰): 가족 안부 · 보이스피싱 살펴보기 · 119
const RULES = [
  { re: /https?:\/\/|www\.|\.(ly|kr|me|io|xyz|top|click|link)\b|bit\.ly|han\.gl|me2\.kr/i, w: 3, why: '링크가 들어 있어' },
  { re: /택배|배송.*(조회|확인|주소)|주소.*(불명|오류|확인)|반송/, w: 3, why: '택배·주소 확인을 핑계로 해' },
  { re: /미납|연체|체납|과태료|범칙금|벌점/, w: 3, why: '미납·과태료로 겁을 줘' },
  { re: /검찰|경찰|수사관|금감원|금융감독원|법원|명의도용|사건번호/, w: 4, why: '검찰·경찰·금감원을 사칭하는 말투야' },
  { re: /대출|저금리|정부지원|한도|승인|대환/, w: 2, why: '대출을 권해' },
  { re: /엄마|아빠|폰.*(고장|깨졌|액정)|임시.*번호|문화상품권|기프트카드/, w: 4, why: '가족인 척하며 폰이 고장 났다고 해 (메신저 피싱)' },
  { re: /인증번호|비밀번호|OTP|보안카드|계좌.*(알려|보내)|신분증.*(사진|촬영)/i, w: 5, why: '인증번호·비밀번호·신분증을 달라고 해' },
  { re: /앱.*(설치|다운)|원격|팀뷰어|애니데스크|apk/i, w: 5, why: '앱 설치나 원격 조종을 시켜' },
  { re: /당첨|환급|지원금|쿠폰.*(지급|발송)|포인트.*소멸/, w: 2, why: '당첨·환급·포인트 소멸로 서두르게 해' },
  { re: /긴급|즉시|오늘.*까지|지금.*바로|24시간/, w: 1, why: '급하게 하라고 재촉해' },
  { re: /\[국외발신\]|\[국제발신\]|\[해외발신\]|\[Web발신\]/, w: 2, why: '해외에서 보낸 문자야' },
];
function scamCheck(text) {
  const hits = RULES.filter(r => r.re.test(String(text || ''))), score = hits.reduce((s, r) => s + r.w, 0);
  const level = score >= 6 ? '위험' : score >= 3 ? '조심' : '괜찮아 보임';
  return { level, reasons: hits.map(h => h.why), advice: level === '위험' ? '링크 누르지 말고, 답장하지 말고, 돈·인증번호 절대 보내지 마. 걱정되면 112나 1394에 물어봐.' : level === '조심' ? '보낸 사람을 직접 전화로 꼭 확인하고, 링크는 누르지 마.' : '특별히 이상한 점은 안 보여. 그래도 돈·인증번호를 달라고 하면 바로 멈춰.' };
}
// 긴급 전화: 세고 → 전화 앱 열기 (세는 동안 취소)
let sosT = null, sosI = null;
function sosCall(num, auto) {
  const name = { '119': '119 (불·구급)', '112': '112 (경찰)', '1394': '1394 (보이스피싱 상담)' }[num] || num;
  clearTimeout(sosT); clearInterval(sosI); let n = auto ? 10 : 3;
  const show = () => say(`🚨 <b style="font-size:1.4em">${n}</b>초 뒤에 <b>${name}</b>에 전화할게!${auto ? '<br>"도와주세요"를 세 번 들었어' : ''}`, { pose: 'bark', ms: (n + 3) * 1000, important: true, buttons: [{ label: '✋ 취소', act: () => { clearTimeout(sosT); clearInterval(sosI); say('알겠어, 전화 안 할게. 괜찮은 거지? 🐶', { ms: 4000 }); } }, { label: '📞 지금 바로', tel: num }] });
  show(); if (auto) { cry(false, true); if (navigator.vibrate) navigator.vibrate([500, 200, 500]); }
  sosI = setInterval(() => { n--; if (n > 0) { show(); if (auto) cry(false, true); } }, 1000);
  sosT = setTimeout(() => {
    clearInterval(sosI);
    if (auto) for (const g of S.guard.guardians || []) { const c = S.contacts.find(x => x.id === g); if (c && c.pk) nsend(c.pk, 'guard', `${nameOf() || '사용자'}님이 "도와주세요"를 외쳐서 119에 전화했어요`, { name: nameOf(), sos: true, days: 0 }); }
    say(`📞 ${num}에 전화하는 중…`, { pose: 'bark', ms: 15000 });
    dialNum(num);
  }, n * 1000 + 300);
}
// 💌 안부 문자 (11-07): 초대 없이 주소록 번호로 — 휴대폰이 매일 아침 처음 잠금을 풀 때 저절로 보냄
const DEF_HELLO = '오늘도 잘 있어요 🌤 (하루 예보 안부)';
const SMSF = () => { const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet; return F && F.smsConfig ? F : null; };
function guardNums() { return (S.guard.guardians || []).map(id => S.contacts.find(c => c.id === id)).filter(c => c && c.phones[0]).map(c => c.phones[0].num.replace(/[^0-9+]/g, '')); }
async function smsSync(ask) {
  const F = SMSF(); if (!F) { if (ask && S.guard.daily) say('안부 문자는 갤럭시 앱에서 돼요', { ms: 3000 }); return; }
  const r = await F.smsConfig({ nums: guardNums().join(','), text: S.guard.msg || DEF_HELLO, on: !!S.guard.daily }).catch(() => ({}));
  if (ask && S.guard.daily && !r.granted) say('문자 보내기를 허락해 줘야 안부를 보낼 수 있어 🥲', { ms: 4500, important: true });
  else if (ask && S.guard.daily) { say(`💌 좋아! 내일 아침부터 보호자 ${guardNums().length}명에게 안부 문자를 보낼게`, { ms: 4000 }); smsDailyNow(); }
}
async function smsDailyNow() {
  const F = SMSF(); if (!F || !S.guard.daily) return;
  const r = await F.smsDaily().catch(() => ({})); if (r && r.day) { S.guard.smsDay = r.day; save(); }
  if (r && r.sent) say(`💌 보호자 ${r.sent}명에게 오늘 안부 문자를 보냈어`, { ms: 3500 });
}
document.addEventListener('click', async e => {
  if (!e.target.closest || !e.target.closest('#safeBox')) return;
  const d = e.target.closest('[data-gdel]'); if (d) { patch({ guard: { guardians: (S.guard.guardians || []).filter(x => x !== d.dataset.gdel) } }); smsSync(); return drawSafe(); }
  if (e.target.id === 'g_test') {
    const F = SMSF(), nums = guardNums(); if (!nums.length) return say('먼저 보호자를 골라 줘', { ms: 2500 });
    if (!F) return say('문자 보내기는 갤럭시 앱에서 돼요', { ms: 3000 });
    const pr = await F.smsConfig({ nums: nums.join(','), text: S.guard.msg || DEF_HELLO, on: true }).catch(() => ({}));
    if (!pr.granted) { await F.smsConfig({ nums: nums.join(','), text: S.guard.msg || DEF_HELLO, on: !!S.guard.daily }).catch(() => {}); return say('문자 보내기를 허락해 줘야 보낼 수 있어 🥲', { ms: 4000, important: true }); }
    if (!S.guard.daily) F.smsConfig({ nums: nums.join(','), text: S.guard.msg || DEF_HELLO, on: false }).catch(() => {});
    let n = 0; for (const num of nums) { const r = await F.smsSend({ num, text: S.guard.msg || DEF_HELLO }).catch(() => ({})); if (r.ok) n++; }
    say(n ? `📨 ${n}명에게 안부 문자를 보냈어` : '문자를 못 보냈어 🥲', { ms: 3500 });
  }
});
// 매일 안부: 오늘 앱을 처음 켜면 보호자에게 "오늘도 잘 있어요"
async function dailyHello() {
  if (!S.guard.daily || !pool) return;
  const d = today(); if (S.guard.helloDay === d || new Date().getHours() < 7) return;
  patch({ guard: { helloDay: d } });
  for (const g of S.guard.guardians || []) { const c = S.contacts.find(x => x.id === g); if (c && c.pk) await nsend(c.pk, 'hello', '', { name: nameOf(), mood: S.mood.date === d ? S.mood.today : '' }); }
}
// 안부를 받던 사람에게서 하루 넘게 소식이 없으면 알려 주기 (내가 보호자일 때)
function checkQuiet() {
  for (const c of S.contacts) {
    if (!c.lastHello || Date.now() - c.lastHello < 30 * 3600e3 || c.quietTold === today()) continue;
    c.quietTold = today(); save();
    const tel = (c.phones[0] || {}).num;
    say(`🚨 ${esc(c.name)}님한테서 하루 넘게 안부가 안 왔어. 연락해 볼까?`, { pose: 'sad', ms: 30000, important: true, buttons: [...(tel ? [{ label: '📞 전화하기', tel }] : []), { label: '💌 말 걸기', act: () => startPmode(c) }] });
    break;
  }
}
function drawSafe() {
  const g = S.guard, gList = (g.guardians || []).map(id => S.contacts.find(c => c.id === id)).filter(Boolean);
  $('#safeBox').innerHTML = `
  <div class="card"><h3>🚨 도움이 필요할 때</h3>
    <div class="sosgrid"><button class="sos red" data-sos="119">🚑 119<br><span>불·구급</span></button><button class="sos blue" data-sos="112">👮 112<br><span>경찰·사기 신고</span></button>
    <button class="sos" data-sos="1394">🛡️ 1394<br><span>보이스피싱 상담</span></button>
    ${(g.guardians || []).map(id => S.contacts.find(c => c.id === id)).filter(c => c && c.phones[0]).map(c => `<a class="sos green" href="tel:${esc(c.phones[0].num.replace(/-/g, ''))}" style="text-decoration:none">📞 ${esc(c.name)}<br><span>${esc(c.phones[0].num)}</span></a>`).join('')}</div>
    <p class="note small">팻을 누르고 "119 전화해 줘" 하면 3초 세고 전화 화면을 열어요. "취소"하면 멈춰요.</p></div>
  <div class="card"><h3>💌 가족 안부 전하기</h3>
    <p class="note">보호자를 고르면 매일 아침 처음 휴대폰을 열 때 <b>안부 문자</b>를 저절로 보내요. (아침 7시 넘어서, 하루 한 번)</p>
    <label class="chk"><input type="checkbox" id="g_daily" ${g.daily ? 'checked' : ''}> 매일 보호자에게 안부 문자 보내기</label>
    ${gList.length ? gList.map(c => `<div class="grow"><span>👤 <b>${esc(c.name)}</b> <span class="note small">${esc((c.phones[0] || {}).num || '번호 없음')}</span></span><button class="pb" data-gdel="${c.id}">빼기</button></div>`).join('') : '<p class="note small">아직 보호자가 없어요. 아래에서 골라 주세요.</p>'}
    <div class="row" style="margin-top:6px"><select id="g_pick"><option value="">➕ 주소록에서 보호자 고르기</option>${S.contacts.filter(c => c.phones[0] && !(g.guardians || []).includes(c.id)).sort((x, y) => (y.fav ? 1 : 0) - (x.fav ? 1 : 0) || x.name.localeCompare(y.name, 'ko')).map(c => `<option value="${c.id}">${c.fav ? '⭐ ' : ''}${esc(c.name)}</option>`).join('')}</select></div>
    <p class="note small" style="margin:10px 0 4px">보낼 말</p><input id="g_msg" value="${esc(g.msg || DEF_HELLO)}">
    <div class="row" style="margin-top:8px"><button class="btn small ghost" id="g_test">📨 지금 한 번 보내 보기</button></div>
    <p class="note small" id="g_st">${g.smsDay ? '마지막으로 보낸 날: ' + esc(g.smsDay) : ''}</p></div>
  <div class="card"><h3>🛡️ 문자 사기 살펴보기</h3>
    <textarea id="g_text" rows="3" placeholder="의심 가는 문자를 그대로 붙여 넣어 줘 (이 휴대폰 안에서만 살펴봐)"></textarea>
    <div class="row"><button class="btn" id="g_check">살펴보기</button></div><div id="g_out"></div>
    <h3 style="margin-top:10px">📱 함께 깔면 좋은 무료 앱</h3>
    <div class="row" style="flex-wrap:wrap"><a class="btn small ghost" href="https://play.google.com/store/search?q=%EC%8B%9C%ED%8B%B0%EC%A6%8C%EC%BD%94%EB%82%9C&c=apps" target="_blank">시티즌코난 (경찰청)</a><a class="btn small ghost" href="https://www.counterscam112.go.kr" target="_blank">보이스피싱 신고센터</a></div>
    <p class="note small">휴대폰 설정에서 '출처를 알 수 없는 앱 설치'는 꼭 꺼 두세요.</p></div>`;
  $('#g_check').onclick = () => { const r = scamCheck($('#g_text').value); $('#g_out').innerHTML = `<div class="scam ${r.level === '위험' ? 'bad' : r.level === '조심' ? 'warn' : 'ok'}"><b>${r.level}</b>${r.reasons.length ? '<br>· ' + r.reasons.map(esc).join('<br>· ') : ''}<br><span class="note small">${esc(r.advice)}</span></div>`; };
}
document.addEventListener('click', e => { const b = e.target.closest('[data-sos]'); if (b) sosCall(b.dataset.sos); });
document.addEventListener('change', e => {
  if (!e.target.closest('#safeBox')) return;
  const id = e.target.id;
  if (id === 'g_daily') { patch({ guard: { daily: e.target.checked } }); smsSync(true); }
  if (id === 'g_pick' && e.target.value) { patch({ guard: { guardians: [...new Set([...(S.guard.guardians || []), e.target.value])] } }); smsSync(); drawSafe(); }
  if (id === 'g_msg') { patch({ guard: { msg: e.target.value.trim() } }); smsSync(); }
});
window.addEventListener('load', () => { setTimeout(dailyHello, 5000); setTimeout(() => { smsSync(); smsDailyNow(); }, 6000); setInterval(checkQuiet, 10 * 60e3); setTimeout(checkQuiet, 20000); });

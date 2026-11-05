// 🛡️ 지킴이 (휴대폰): 가족 안부 · 보이스피싱 살펴보기 · 119 · "도와주세요" 세 번
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
    location.href = 'tel:' + num;
  }, n * 1000 + 300);
}
const SOS_RE = /(도와\s*주세요|도와\s*줘요|도와줘|살려\s*주세요|살려\s*줘|사람\s*살려|구해\s*주세요)/;
let sosHits = [];
function sosHear(text) {
  if (!S.guard.sosAuto || !SOS_RE.test(text)) return false;
  const now = Date.now(); sosHits = sosHits.filter(x => now - x < 60000); sosHits.push(now);
  if (sosHits.length >= 3) { sosHits = []; sosCall('119', true); }
  else say(`🚨 "도와주세요" 들었어 (${sosHits.length}/3)<br>괜찮아? 세 번이면 119에 전화할게`, { pose: 'sad', ms: 8000, important: true });
  return true;
}
// 지킴이 듣기: 앱이 켜져 있는 동안 계속 듣기 ("도와주세요"·"119 전화해 줘")
let guardRec = null;
function guardListen(on) {
  const SRx = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SRx) return;
  if (!on) { if (guardRec) { guardRec.onend = null; guardRec.stop(); guardRec = null; } return; }
  if (guardRec) return;
  guardRec = new SRx(); guardRec.lang = 'ko-KR'; guardRec.continuous = true; guardRec.interimResults = false;
  guardRec.onresult = e => { const txt = e.results[e.results.length - 1][0].transcript; if (SOS_RE.test(txt) || /(119|112|구급차).*(전화|신고|불러)/.test(txt)) send(txt); };
  guardRec.onend = () => { if (guardRec && S.guard.listen) setTimeout(() => { try { guardRec.start(); } catch { } }, 400); };
  try { guardRec.start(); } catch { }
}
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
  const g = S.guard, linked = S.contacts.filter(c => c.pk);
  $('#safeBox').innerHTML = `
  <div class="card"><h3>🚨 도움이 필요할 때</h3>
    <div class="sosgrid"><button class="sos red" data-sos="119">🚑 119<br><span>불·구급</span></button><button class="sos blue" data-sos="112">👮 112<br><span>경찰·사기 신고</span></button>
    <button class="sos" data-sos="1394">🛡️ 1394<br><span>보이스피싱 상담</span></button>
    ${(g.guardians || []).map(id => S.contacts.find(c => c.id === id)).filter(c => c && c.phones[0]).map(c => `<a class="sos green" href="tel:${esc(c.phones[0].num.replace(/-/g, ''))}" style="text-decoration:none">📞 ${esc(c.name)}<br><span>${esc(c.phones[0].num)}</span></a>`).join('')}</div>
    <label class="chk"><input type="checkbox" id="g_sos" ${g.sosAuto ? 'checked' : ''}> "도와주세요"를 1분 안에 세 번 말하면 119에 자동으로 전화하기</label>
    <label class="chk"><input type="checkbox" id="g_listen" ${g.listen ? 'checked' : ''}> 앱이 켜져 있는 동안 계속 듣기 (🎤 안 눌러도 "도와주세요"를 들어요)</label>
    <p class="note small">걸기 전에 10초를 세고, "취소"하면 멈춰요. 보호자에게도 알려요. 말창에 "119 전화해 줘" 하면 3초 세고 걸어요.</p></div>
  <div class="card"><h3>💌 가족 안부 전하기</h3>
    <p class="note">보호자를 고르면 매일 아침 "오늘도 잘 있어요 🌤"를 보내요. 보호자 쪽 팻은 안부가 하루 넘게 안 오면 알려 줘요. (가입·요금 없음, 보호자도 하루 예보를 깔고 🔗 연결돼 있어야 해요)</p>
    <label class="chk"><input type="checkbox" id="g_daily" ${g.daily ? 'checked' : ''}> 매일 보호자에게 안부 보내기</label>
    ${linked.length ? linked.map(c => `<label class="chk"><input type="checkbox" data-gd="${c.id}" ${(g.guardians || []).includes(c.id) ? 'checked' : ''}> 🔗 ${esc(c.name)}</label>`).join('') : '<p class="note small">아직 🔗 연결된 사람이 없어. 📒 주소록에서 🔗 초대를 먼저 해 줘.</p>'}</div>
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
  if (id === 'g_sos') patch({ guard: { sosAuto: e.target.checked } });
  if (id === 'g_listen') { patch({ guard: { listen: e.target.checked } }); guardListen(e.target.checked); }
  if (id === 'g_daily') { patch({ guard: { daily: e.target.checked } }); dailyHello(); }
  if (e.target.dataset.gd) { const s = new Set(S.guard.guardians || []); e.target.checked ? s.add(e.target.dataset.gd) : s.delete(e.target.dataset.gd); patch({ guard: { guardians: [...s] } }); dailyHello(); }
});
window.addEventListener('load', () => { setTimeout(dailyHello, 5000); setInterval(checkQuiet, 10 * 60e3); setTimeout(checkQuiet, 20000); if (S.guard.listen) setTimeout(() => guardListen(true), 3000); });

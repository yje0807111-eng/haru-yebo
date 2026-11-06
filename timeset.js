// ⏰ 시간 · 알람 · 생일  /  ⚙️ 설정 (💾 저장을 눌러야 바뀜)
const DAYN = ['일', '월', '화', '수', '목', '금', '토'];
const p2 = n => String(n).padStart(2, '0');
function drawTime() {
  const ch = S.chimes.slice().sort((a, b) => a.hm.localeCompare(b.hm)), al = S.alarms.slice().sort((a, b) => a.at - b.at);
  $('#timeBox').innerHTML = `
  <div class="card"><h3>🕒 시간 알려주기 <button class="btn small" id="chAdd">➕</button></h3>
    ${ch.map(c => `<div class="trow ${c.on ? '' : 'off'}" data-ch="${c.id}"><input type="checkbox" data-k="on" ${c.on ? 'checked' : ''} style="width:22px;height:22px"><input type="time" data-k="hm" value="${c.hm}">
      <span class="days">${DAYN.map((n, i) => `<button data-day="${i}" class="${c.days.includes(i) ? 'on' : ''}">${n}</button>`).join('')}</span>
      <input class="txt" data-k="text" value="${esc(c.text)}"><button class="btn small ghost" data-del="ch">🗑</button></div>`).join('')}</div>
  <div class="card"><h3>⏰ 알람 <button class="btn small" id="alAdd">➕</button></h3>
    <p class="note small">말창에 "내일 7시에 깨워 줘" 해도 돼요.${window.Native ? '' : ' (웹앱은 앱이 열려 있을 때 울려요)'}</p>
    ${al.map(a => `<div class="trow" data-al="${a.id}"><input type="datetime-local" data-k="at" value="${(d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`)(new Date(a.at))}">
      <label class="chk" style="margin:0"><input type="checkbox" data-k="daily" ${a.daily ? 'checked' : ''}>매일</label><input class="txt" data-k="label" value="${esc(a.label || '')}" placeholder="무엇을? (예: 약 먹기)"><button class="btn small ghost" data-del="al">🗑</button></div>`).join('') || '<p class="note">맞춰 둔 알람이 없어.</p>'}</div>
  <div class="card"><h3>🎂 생일 <button class="btn small" id="bdAdd">➕</button></h3>
    <p class="note small">3일 전·하루 전·당일에 알려 줘요. 주소록에 넣은 생일도 같이 챙겨요.</p>
    ${S.birthdays.map(b => `<div class="trow" data-bd="${b.id}"><input data-k="name" value="${esc(b.name)}" placeholder="이름" style="flex:1"><select data-k="m">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${b.m === i + 1 ? 'selected' : ''}>${i + 1}월</option>`).join('')}</select><select data-k="d">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${b.d === i + 1 ? 'selected' : ''}>${i + 1}일</option>`).join('')}</select><button class="btn small ghost" data-del="bd">🗑</button></div>`).join('')}</div>`;
}
$('#timeBox').addEventListener('click', e => {
  if (e.target.id === 'chAdd') { S.chimes.push({ id: uid(), hm: '12:00', days: [0, 1, 2, 3, 4, 5, 6], text: '점심 맛있게 먹어! 🍚', on: true }); save(); return drawTime(); }
  if (e.target.id === 'alAdd') { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(7, 0, 0, 0); S.alarms.push({ id: uid(), at: d.getTime(), kind: 'wake', label: '' }); save(); schedNotify(); return drawTime(); }
  if (e.target.id === 'bdAdd') { const d = new Date(); S.birthdays.push({ id: uid(), name: '', m: d.getMonth() + 1, d: d.getDate() }); save(); return drawTime(); }
  const row = e.target.closest('.trow'); if (!row) return;
  const day = e.target.closest('[data-day]'), del = e.target.closest('[data-del]');
  if (day && row.dataset.ch) { const c = S.chimes.find(x => x.id === row.dataset.ch), i = +day.dataset.day; c.days = c.days.includes(i) ? c.days.filter(x => x !== i) : [...c.days, i]; if (!c.days.length) c.days = [i]; save(); return drawTime(); }
  if (del) { const k = del.dataset.del; if (k === 'ch') S.chimes = S.chimes.filter(x => x.id !== row.dataset.ch); if (k === 'al') S.alarms = S.alarms.filter(x => x.id !== row.dataset.al); if (k === 'bd') S.birthdays = S.birthdays.filter(x => x.id !== row.dataset.bd); save(); schedNotify(); drawTime(); }
});
$('#timeBox').addEventListener('change', e => {
  const row = e.target.closest('.trow'), k = e.target.dataset.k; if (!row || !k) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (row.dataset.ch) { const c = S.chimes.find(x => x.id === row.dataset.ch); if (k === 'hm' && !v) return; c[k] = v; save(); if (k === 'on') row.classList.toggle('off', !v); }
  if (row.dataset.al) { const a = S.alarms.find(x => x.id === row.dataset.al); if (k === 'at') { const at = new Date(v).getTime(); if (at > Date.now()) a.at = at; else return say('그 시간은 벌써 지났어!', { ms: 3000 }); } else a[k] = v; if (a.daily) while (a.at <= Date.now()) a.at += 864e5; save(); schedNotify(); }
  if (row.dataset.bd) { const b = S.birthdays.find(x => x.id === row.dataset.bd); b[k] = k === 'name' ? v.trim() : +v; save(); }
});

// ⚙️ 설정: 바꾼 것을 모아 두었다가 💾 저장
let draft = {};
function dset(p) { merge(draft, p); $('#setSave').disabled = false; $('#setSave').classList.add('dirty'); $('#saveBar').hidden = false; }
// 저장 안 하고 나가거나 [되돌리기] → 예전 그대로 (미리 보기도 되돌림)
function setUndo(quiet) { const had = Object.keys(draft).length; draft = {}; window.prevSize = null; window.prevSp = null; pet._h = 0; setPose('idle'); $('#setSave').disabled = true; $('#setSave').classList.remove('dirty'); $('#saveBar').hidden = true; if (had && !quiet) say('저장을 안 눌러서 예전 그대로 둘게 🐾', { ms: 2600 }); return had; }
function drawSet() {
  draft = {}; $('#setSave').disabled = true; $('#setSave').classList.remove('dirty'); $('#saveBar').hidden = true;
  $('#setBox').innerHTML = `
  <div class="card"><h3>나와 팻 <button class="mutebtn ${S.talk.mute ? 'on' : ''}" id="s_mute">${S.talk.mute ? '🔇 소리 꺼짐' : '🔊 소리 켜짐'}</button></h3>
    <label class="note">내 이름 <input id="s_name" value="${esc(S.me.name)}" placeholder="예: 푸른이"></label>
    <label class="note">팻 이름 <input id="s_bname" value="${esc(S.me.buddyName)}" placeholder="예: 사랑이"></label></div>
  <div class="card"><h3>🐾 팻 종류</h3><div class="seg" id="s_sp">${[['dog', '🐶 강아지'], ['cat', '🐱 고양이'], ['pig', '🐷 돼지']].map(([k, n]) => `<button data-sp="${k}" class="${(S.me.species || 'dog') === k ? 'on' : ''}">${n}</button>`).join('')}</div><p class="note small">누르면 바로 바뀌어요</p></div>
  <div class="card"><h3>🐶 팻 크기</h3><p class="note small">10 = 아주 작게 · 100 = 크게</p><div class="sizes" id="s_size">${[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(n => `<button data-sz="${n}" class="${(S.me.size || 100) === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
${window.Native ? `<div class="card"><h3>🐶 화면 위 팻</h3><label class="chk"><input type="checkbox" id="s_float" ${S.floatOff ? '' : 'checked'}> 하루 예보를 닫아도 다른 앱 위에 팻 띄우기</label><p class="note small">팻을 끌어서 옮기고, 누르면 하루 예보가 열려요.</p><button class="btn ghost small" id="s_diag">🩺 팻 상태 보기</button><pre id="s_diagOut" style="white-space:pre-wrap;font-size:11px;max-height:300px;overflow:auto"></pre></div>` : ''}
  <div class="card"><h3>🐾 팻 기분</h3><div class="seg" id="s_temper">${[['active', '😆 활발'], ['normal', '🙂 평범'], ['shy', '🥺 소심']].map(([k, n]) => `<button data-tm="${k}" class="${(S.me.temper || 'normal') === k ? 'on' : ''}">${n}</button>`).join('')}</div><p class="note small">활발 = 화면을 아주 신나게 뛰어다녀요 · 소심 = 거의 가만히</p></div>
  <div class="card"><h3>말 걸고 움직이는 정도</h3>
    <div class="seg" id="s_freq">${[['often', '자주'], ['normal', '보통'], ['rare', '가끔'], ['quiet', '조용히']].map(([k, n]) => `<button data-f="${k}" class="${S.talk.freq === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <p class="note" style="margin:12px 0 4px">🎤 마이크 켜질 때 '띵' 소리</p><div class="seg" id="s_mb">${[[2, '보통'], [1, '작게'], [0, '끄기']].map(([k, n]) => `<button data-mb="${k}" class="${(S.talk.micBeep ?? 1) === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <label class="note" style="display:block;margin-top:10px">🔊 짖는 소리 크기 <input type="range" id="s_vol" min="0" max="100" step="5" value="${Math.round(S.talk.volume * 100)}" style="padding:0;border:0"></label></div>
  <div class="card"><h3>🤖 AI 연결 (선택)</h3>
    <p class="note small">연결하면 팻이 더 똑똑하게 이야기하고 검색 결과도 짧게 정리해 줘요. 열쇠는 이 휴대폰에만 저장돼요. 연결하지 않아도 기본 대화·검색은 돼요.</p>
    <div class="seg" id="s_ai"><button data-p="none" class="${S.ai.provider !== 'claude' ? 'on' : ''}">연결 안 함</button><button data-p="claude" class="${S.ai.provider === 'claude' ? 'on' : ''}">Claude</button></div>
    <input id="s_key" type="password" placeholder="Claude API 열쇠 붙여 넣기 (sk-ant-…)" value="${S.ai.key ? '••••••••' : ''}" style="margin-top:8px" autocomplete="off"></div>
  <div class="card"><h3>🔔 알림</h3><button class="btn ghost" id="s_notif">알림 허락하기</button><p class="note small">알람이 울릴 때 휴대폰 알림도 같이 띄워요.</p></div>
  <div class="card"><h3>📤 친구·가족에게 알려 주기</h3><p class="note small">카카오톡 등으로 '하루 예보 받기' 주소를 보내요. 받은 사람이 누르면 바로 받을 수 있어요.</p><button class="btn" id="s_share">📤 하루 예보 보내기</button></div>
  <div class="card"><h3>📱 이 앱</h3><p class="note small">하루 예보 휴대폰판 <span id="s_ver"></span> · 주소록·대화는 이 휴대폰에만 저장돼요.</p>${window.Native ? '<button class="btn ghost small" id="s_upd">🔄 새 버전 확인</button>' : ''}</div>`;
  fetch('version.json').then(r => r.json()).then(v => { const e = $('#s_ver'); if (e) e.textContent = '(' + v.build + '판)'; }).catch(() => {});
}
$('#setBox').addEventListener('input', e => {
  if (e.target.id === 's_name') dset({ me: { name: e.target.value.trim() } });
  if (e.target.id === 's_bname') dset({ me: { buddyName: e.target.value.trim() } });
  if (e.target.id === 's_vol') dset({ talk: { volume: +e.target.value / 100, cries: +e.target.value > 0 } });
  if (e.target.id === 's_key' && !/^•+$/.test(e.target.value)) dset({ ai: { key: e.target.value.trim() } });
});
$('#setBox').addEventListener('click', async e => {
  const sz = e.target.closest('[data-sz]'); if (sz) { $$('#s_size button').forEach(b => b.classList.toggle('on', b === sz)); dset({ me: { size: +sz.dataset.sz } }); window.prevSize = +sz.dataset.sz; pet._h = 0; }   // 미리 보기만 (저장해야 바뀜)
  const spb = e.target.closest('[data-sp]'); if (spb) { $$('#s_sp button').forEach(b => b.classList.toggle('on', b === spb)); dset({ me: { species: spb.dataset.sp } }); window.prevSp = spb.dataset.sp; pet._h = 0; setPose('joy'); return; }   // 미리 보기만 (저장해야 바뀜)
  if (e.target.id === 's_mute') { setMute(!S.talk.mute); return; }   // 바로 (저장 필요 없음)
  const mb = e.target.closest('[data-mb]'); if (mb) { $$('#s_mb button').forEach(b => b.classList.toggle('on', b === mb)); dset({ talk: { micBeep: +mb.dataset.mb } }); }
  const tm = e.target.closest('[data-tm]'); if (tm) { $$('#s_temper button').forEach(b => b.classList.toggle('on', b === tm)); dset({ me: { temper: tm.dataset.tm } }); }
  const f = e.target.closest('[data-f]'); if (f) { $$('#s_freq button').forEach(b => b.classList.toggle('on', b === f)); dset({ talk: { freq: f.dataset.f } }); }
  const p = e.target.closest('[data-p]'); if (p) { $$('#s_ai button').forEach(b => b.classList.toggle('on', b === p)); dset({ ai: { provider: p.dataset.p } }); }
  if (e.target.id === 's_share') return shareApp();
  if (e.target.id === 's_diag') {
    const FPx = window.Capacitor && Capacitor.Plugins.FloatPet; if (!FPx) return;
    try {
      const d = await FPx.diag(); let v = ''; try { v = (await (await fetch('version.json')).json()).build; } catch { }
      const txt = `판: ${v}\n휴대폰: ${d.model} (안드로이드 ${d.sdk})\n다른 앱 위 허락: ${d.canDraw ? '있음' : '없음'} · 켜기: ${d.on ? '켜짐' : '꺼짐'}\n서비스: ${d.running ? '돌아가는 중' : '꺼짐'} · 보이기: ${d.shown ? '보임' : '숨김'}\n팻: ${d.pet ? '떠 있음' : '없음'} · 말창: ${d.bar ? '떠 있음' : '없음'}\n오류: ${d.err || '없음'}\n멈춤: ${d.crash || '없음'}\n--- 기록 ---\n${d.log || '(없음)'}`;
      $('#s_diagOut').textContent = txt;
    } catch (er) { $('#s_diagOut').textContent = '상태를 못 읽었어: ' + er; }
    return;
  }
  if (e.target.id === 's_float') { patch({ floatOff: !e.target.checked }); if (window.Native) Native.floatConfig(); if (e.target.checked && window.Native) Native.askFloat(); return; }
  if (e.target.id === 's_upd' && window.Native) return Native.checkUpdate(true);
  if (e.target.id === 's_notif') { try { const r = await Notification.requestPermission(); say(r === 'granted' ? '알림을 켰어! 🔔' : '알림을 못 켰어. 휴대폰 설정에서 허락해 줘', { ms: 3500 }); } catch { say('이 브라우저는 알림을 못 해 🥲', { ms: 3000 }); } }
});
$('#setSave').onclick = $('#setSave2').onclick = () => {
  if (draft.me && 'buddyName' in draft.me) draft.me.buddyName = draft.me.buddyName.slice(0, 10) || '다루';
  const oldB = bn(), spChanged = draft.me && draft.me.species && draft.me.species !== S.me.species; patch(draft); draft = {}; window.prevSize = null; window.prevSp = null; pet._h = 0; $('#saveBar').hidden = true;
  if (spChanged) setSpecies(S.me.species); else setPose('joy');
  setBuddyName(bn()); $('#tabPet').textContent = bn(); setSmode(smode);
  $('#setSave').disabled = true; $('#setSave').classList.remove('dirty');
  if (window.Native && Native.petSize) Native.petSize(S.me.size);
  if (window.Native && Native.floatConfig) Native.floatConfig();
  petOnly(true);
  say(bn() !== oldB ? `이제 내 이름은 '${esc(bn())}'야! "${esc(callName(bn()))}" 하고 불러 줘 🐶` : '설정을 저장했어! ✓', { pose: 'joy' });
};

$('#setUndo').onclick = () => { setUndo(true); drawSet(); say('예전 그대로 되돌렸어 🐾', { ms: 2200 }); };

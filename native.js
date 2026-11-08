// 앱 파일(APK)로 깔았을 때만 쓰는 휴대폰 기능: 닫혀 있어도 알람 알림 · 연락처(생일까지) · 말 알아듣기
(function () {
  const C = window.Capacitor; if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const Pl = C.Plugins || {};
  const FP0 = Pl.FloatPet;
  const N = window.Native = {};
  // ⏰ 알람: 휴대폰 알림으로 예약 (앱이 꺼져 있어도 울림)
  N.schedule = async alarms => {   // 11-07: 안드로이드 알람으로 — 앱을 닫아도 [그만] 누를 때까지 울림
    const F = Pl.FloatPet;
    if (F && F.setAlarms) {
      try {
        const r = await F.setAlarms({ list: (alarms || []).map(a => ({ id: a.id, at: a.at, daily: !!a.daily, text: HA.alarmLine(a).replace(/<[^>]+>/g, '') })) });
        if (r && r.count && !r.exact && S.exactAsked !== today()) { patch({ exactAsked: today() }); say('⏰ 알람이 정확한 시간에 울리게 하려면<br>휴대폰 설정에서 <b>알람 및 리마인더</b>를 허용해 줘!', { ms: 30000, important: true, buttons: [{ label: '허용하러 가기', act: () => { F.openExact(); hideBubble(); } }, { label: '나중에', ghost: true }] }); }
      } catch (e) { }
      return;
    }
    const LN = Pl.LocalNotifications; if (!LN) return;
    try {
      await LN.requestPermissions();
      const pend = await LN.getPending(); if (pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
      const list = (alarms || []).filter(a => a.at > Date.now()).slice(0, 60).map((a, i) => ({ id: 1000 + i, title: '⏰ 하루 예보', body: HA.alarmLine(a).replace(/<[^>]+>/g, ''), schedule: { at: new Date(a.at), allowWhileIdle: true }, sound: null, extra: { id: a.id } }));
      if (list.length) await LN.schedule({ notifications: list });
    } catch (e) { }
  };
  // 앱을 열 때: 밖에서 울린 알람 정리 (그만 누른 것·지금 울리는 것)
  N.alarmSync = async () => {
    const F = Pl.FloatPet; if (!F || !F.alarmState) return;
    const r = await F.alarmState().catch(() => null); if (!r) return;
    const now = Date.now(); let ch = false;
    for (const id of r.done || []) { const a = S.alarms.find(x => x.id === id || x.id + '_s' === id); if (!a) continue; window._rung = window._rung || {}; window._rung[a.id + '@' + a.at] = 1; if (a.daily) { while (a.at <= now) a.at += 864e5; } else a.done = true; ch = true; }
    if (ch) { S.alarms = S.alarms.filter(a => !a.done); save(); }
    if (r.ringing) { const a = S.alarms.find(x => x.id === r.ringing || x.id + '_s' === r.ringing) || { id: r.ringing, at: now, label: '' }; F.alarmStop({ id: r.ringing }).catch(() => {}); ring(a); }
    F.alarmClear().catch(() => {});
  };
  // 📒 연락처: 한 번 허락하면 이름·번호·주소·생일까지
  N.contacts = async () => {   // 11-07: 직접 만든 읽기(연락처 읽기 권한만)
    const F = Pl.FloatPet; if (!F || !F.readContacts) return null;
    let r; try { r = await F.readContacts(); } catch (e) { if (String(e && e.message || e).includes('denied')) { const x = new Error('denied'); x.denied = true; throw x; } throw e; }
    return (r.contacts || []).map(c => {
      const m = String(c.bday || '').match(/(\d{4}|-)?-?(\d{2})-(\d{2})$/);
      return { name: c.name || ((c.phones || [])[0]) || '이름 없음', phones: (c.phones || []).map(n => ({ type: '휴대폰', num: fmtPhone(n || '') })).filter(x => x.num), addr: c.addr || '', bday: m ? { m: +m[2], d: +m[3] } : null };
    });
  };

  // 🎤 말 알아듣기
  N.listen = async () => {
    const SR = Pl.SpeechRecognition; if (!SR) return null;
    const ok = await SR.available(); if (!ok.available) return null;
    await SR.requestPermissions();
    if (FP0 && FP0.micQuiet) await FP0.micQuiet({ level: S.talk.micBeep ?? 1 }).catch(() => {});
    let r; try { r = await SR.start({ language: 'ko-KR', maxResults: 1, partialResults: false, popup: false }); } finally { if (FP0 && FP0.micRestore) setTimeout(() => FP0.micRestore().catch(() => {}), 900); }
    return (r.matches || [])[0] || '';
  };
  // 🔄 새 버전: 하루 한 번 확인 → "바꿀까?" → [응] 이면 받아서 바로 설치 화면
  const REL = 'https://api.github.com/repos/yje0807111-eng/haru-yebo/releases/latest';
  const APK = 'https://github.com/yje0807111-eng/haru-yebo/releases/latest/download/haru-yebo.apk';
  // 🔄 새 버전 확인 (11-07: 결과를 설정 단추 바로 아래에 보여 줌 · GitHub 확인이 막히면 다른 길로)
  const upSt = t => { const e = document.getElementById('s_updSt'); if (e) e.innerHTML = t; };
  async function latestBuild() {
    try { const rel = await (await fetch(REL)).json(); const n = +String(rel.tag_name || '').replace(/\D/g, ''); const a = (rel.assets || []).find(x => /haru-yebo-\d+\.apk$/.test(x.name)); if (a) N.apkUrl = a.browser_download_url; if (n) return n; } catch (e) { }
    try { const r = await Pl.CapacitorHttp.get({ url: 'https://github.com/yje0807111-eng/haru-yebo/releases/latest' }); const m = String(r.url || '').match(/app-(\d+)/) || String(r.data || '').match(/releases\/tag\/app-(\d+)/); if (m) return +m[1]; } catch (e) { }
    return 0;
  }
  N.checkUpdate = async manual => {
    if (manual) upSt('🔎 확인하는 중…');
    const mine = +((await (await fetch('version.json')).json().catch(() => ({}))).build) || 0;
    const latest = await latestBuild();
    if (!latest) { if (manual) { upSt(`⚠️ 지금은 확인을 못 했어요. <button class="btn small" id="s_apk">📥 앱 파일 바로 받기</button>`); const b = document.getElementById('s_apk'); if (b) b.onclick = () => window.open(APK, '_system'); } return; }
    if (latest <= mine) { N.setUpd(0); if (manual) upSt(`✅ 지금이 제일 새 버전이에요 (${mine}판)`); return; }
    N.setUpd(latest);
    if (!manual) return;   // 저절로 확인할 때는 '1' 표시만
    upSt(`🔴 새 버전(${latest}판)이 있어요! <button class="btn small" id="s_doUpd">지금 바꾸기</button>`);
    const b = document.getElementById('s_doUpd'); if (b) b.onclick = () => N.install();
  };
  // 🔴 새 버전 '1': 휴대폰 아이콘(알림 하나) → 메뉴 ⚙️ 설정 → 🔄 새 버전 확인 으로 이어짐
  N.upd = 0;
  N.setUpd = async v => {
    N.upd = v || 0; document.body.classList.toggle('hasupd', !!N.upd);
    const LN = Pl.LocalNotifications; if (!LN) return;
    try {
      if (N.upd && S.updNoti !== N.upd) { await LN.requestPermissions(); await LN.schedule({ notifications: [{ id: 99, title: '🔄 하루 예보 새 버전', body: `새 버전(${N.upd}판)이 나왔어요. 눌러서 바꿔 주세요!`, extra: { upd: 1 } }] }); S.updNoti = N.upd; save(); }
      if (!N.upd) { await LN.cancel({ notifications: [{ id: 99 }] }); await LN.removeAllDeliveredNotifications?.(); }
    } catch (e) { }
  };
  N.install = async () => {   // 11-07 권한 줄임: 앱이 직접 설치하지 않고, 받기 주소를 열어 줌 → 받은 파일을 눌러 설치
    upSt('📥 받기 화면을 열었어요. 다 받아지면 알림의 파일을 눌러 [설치] 해 주세요.');
    window.open(N.apkUrl || APK, '_system');
  };

  // 🐶 화면 위 팻: 하루 예보를 닫으면 다른 앱 위에 팻이 떠 있고, 누르면 다시 열림
  const FP = Pl.FloatPet;
  // 크기·이름·켜기를 안드로이드에 알려 두면, 앱을 닫는 순간 안드로이드가 직접 팻과 말창을 띄움
  // 11-06: 고른 동물(강아지·고양이·돼지)과 그 그림 목록도 같이 넘김 → 안드로이드가 그 폴더에서 읽음
  const petLists = () => {
    const sp = SP(), C = CH || {}, A = C.anims || {}, Sp = C.sprites || {};
    const one = n => Sp[n] ? Sp[n].file : A[n] ? A[n].frames[0] : null;
    const uniq = a => [...new Set(a)].slice(0, 10);
    const idle = ['정면', '눈망울_앉기', '기쁨', '윙크', '엎드림', '앉아'].map(one).filter(Boolean).slice(0, 5);
    const walk = sp === 'dog' ? ['걷기1.webp', '걷기2.webp'] : uniq((A.walk || A['신나걷기'] || { frames: [Sp['정면'].file] }).frames);
    const rk = (C.runList || []).concat(['run', '네발뛰기', 'dash']).find(k => A[k]);
    const run = sp === 'dog' ? ['뛰기1.webp', '뛰기2.webp'] : rk ? uniq(A[rk].frames) : walk;
    const L = SOUNDS[sp] || SOUNDS.dog;
    const hk = ['인사_오른손', '인사_왼손', '기쁨', '만세'].find(k => A[k]); const hello = hk ? uniq(A[hk].frames) : [one('기쁨') || idle[0]];
    const dk = ['춤', '즐거움', '기쁨'].find(k => A[k]); const dance = dk ? uniq(A[dk].frames) : hello;
    return { sp, dance: dance.join('|'), hello: hello.join('|'), idle: idle.join('|'), walk: walk.join('|'), run: run.join('|'), home: one('기쁨') || idle[0], sndC: L[0].join('|'), sndH: L[1].join('|') };
  };
  N.floatConfig = () => { if (FP) FP.config({ size: S.me.size || 100, name: bn(), on: !S.floatOff, act: petAct(), cries: !S.talk.mute && S.talk.cries !== false && Date.now() >= (quietUntil || 0), micBeep: S.talk.micBeep ?? 1, temper: S.me.temper || 'normal', kakao: !S.kakaoOff, talkMin: ({ often: 5, normal: 20, rare: 30, quiet: 0 })[S.talk.freq || 'normal'] ?? 20, uname: S.me.name || '', vol: Math.max(0.2, S.talk.volume || 0.4), ...petLists() }).catch(() => {}); };
  N.quit = () => { if (FP && FP.quit) FP.quit().catch(() => {}); };
  N.petAction = id => { if (FP && document.hidden) FP.pose({ action: id === 'home' ? 'home' : 'free' }).catch(() => {}); };
  N.petSize = s => { if (FP) { FP.setSize({ size: s }).catch(() => {}); N.floatConfig(); } };
  N.askFloat = async () => {
    if (!FP) return;
    const p = await FP.hasPermission().catch(() => ({ granted: false }));
    if (p.granted) return;
    say('🐾 하루 예보를 닫아도<br>제가 휴대폰 화면 위에서 놀 수 있어요!<br>다음 화면에서 <b>하루 예보</b>를 찾아<br><b>"다른 앱 위에 표시"</b>를 켜 주세요.', { pose: 'gaze', ms: 60000, buttons: [{ label: '응, 켜 줄게', act: () => { FP.requestPermission(); hideBubble(); } }, { label: '나중에', ghost: true, act: () => { patch({ floatAsked: today() }); hideBubble(); } }] });
  };
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || !FP) return;
    N.floatConfig();   // 11-07: '다른 앱 위에 표시'를 켜고 돌아오면 바로 화면 위 팻 켜기
    setTimeout(() => N.checkUpdate(false), 2500);
    N.alarmSync();
    if (window.tvWantAt && Date.now() - window.tvWantAt < 8000) { if (view !== 'tv') go('tv'); }
    else if ((window.mapWantAt && Date.now() - window.mapWantAt < 8000) || (window.wantViewAt && Date.now() - window.wantViewAt < 8000)) { }   // 11-08: 지도를 열려고 앞으로 온 것 → 지도 그대로   // 11-07: TV 를 틀려고 앞으로 온 것 → TV 그대로
    else { petOnly(true);   // 앱을 열면 → 앱 안 팻만
    setTimeout(() => { if (!document.hidden && bubble.hidden) petMenu(); }, 500); }   // 11-06: 들어오자마자 메뉴
    const r = await FP.takePending().catch(() => null); if (r && r.text) send(r.text, { talk: true });   // 바탕화면에서 하던 말 이어서
  });
  // 💬 바탕화면 말창에서 쓴 말 → 여기서 생각해서 → 바탕화면 팻 말풍선으로 대답
  if (FP) {
    FP.addListener('overlayText', d => { FP.ack().catch(() => {}); if (d && d.text) send(d.text, { talk: true }); });
    const plain = x => String(x || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const _cry = window.cry;
    window.cry = cry = function (happy, loud) { if (document.hidden) { if (S.talk.mute || (!loud && (S.talk.cries === false))) return; FP.bark({ happy: !!happy, vol: loud ? 1 : Math.max(0.3, S.talk.volume) }).catch(() => {}); } else _cry(happy, loud); };
    const _setPose = window.setPose;
    window.setPose = setPose = function (p) { _setPose(p); if (!document.hidden) return; if (p === 'run' || p === 'walk') { FP.pose({ action: p }).catch(() => {}); return; } if (P.frames && P.frames.length > 1) { FP.frames({ files: P.frames, fps: P.fps || 8, ms: p === 'sleep' ? 20000 : 6000 }).catch(() => {}); return; } const f = (pet.getAttribute('src') || '').split('/').pop(); if (f) FP.pose({ file: decodeURIComponent(f), ms: p === 'sleep' || p === 'lie' || p === 'sit' ? 12000 : 6000 }).catch(() => {}); };
    const _say = window.say;
    window.say = say = function (text, opt = {}) { _say(text, opt); if (document.hidden) FP.say({ tel: opt.telNum || '', text: plain(text), ms: Math.min(opt.ms || (5000 + String(text).length * 80), 15000) }).catch(() => {}); };
  }
  // 💬 카톡이 오면 (하루 예보가 열려 있을 때는 여기서 알려 줌)
  if (FP) FP.addListener('kakao', d => { if (document.hidden || S.kakaoOff) return; say(`💬 <b>${esc(d.room && d.room !== d.who ? d.room + '(' + d.who + ')' : d.who)}</b>한테 카톡 왔어!<br>"${esc(d.text)}"`, { pose: 'bark', ms: 15000, buttons: [{ label: '💬 카톡 열기', act: () => { hideBubble(); FP.openKakao().catch(() => {}); } }, { label: '나중에', ghost: true }] }); cry(true); });
  N.kakaoCheck = async () => { if (!FP || !FP.notiAccess) return false; const r = await FP.notiAccess().catch(() => ({ granted: false })); return !!r.granted; };
  N.usageCheck = async () => { if (!FP || !FP.usageAccess) return false; const r = await FP.usageAccess().catch(() => ({ granted: false })); return !!r.granted; };
  N.appSettings = () => { const F = Pl.FloatPet; if (F && F.openAppSettings) F.openAppSettings().catch(() => {}); };
  N.kakaoAsk = async force => {
    if (!FP || S.kakaoOff) return; if (await N.kakaoCheck()) return;
    if (!force && S.kakaoAsked === today()) return; patch({ kakaoAsked: today() });
    say('💬 카톡이 오면 내가 바로 알려 줄까?<br>휴대폰 설정에서 <b>하루 예보 카톡 알림</b>을 켜 주면 돼!', { pose: 'gaze', ms: 60000, buttons: [{ label: '응, 켤게', act: () => { FP.openNotiAccess(); hideBubble(); } }, { label: '괜찮아', ghost: true, act: () => { patch({ kakaoOff: true }); N.floatConfig(); hideBubble(); } }] });
  };
  if (FP) FP.addListener('alarm', d => { const a = S.alarms.find(x => x.id === d.id || x.id + '_s' === d.id) || { id: d.id, at: Date.now(), label: '' }; FP.alarmStop({ id: d.id }).catch(() => {}); ring(a); });
  if (FP) FP.addListener('music', d => { window.musicNow = d; if (!document.hidden && d.playing) { setPose('dance'); P.until = performance.now() + 8000; if (d.title) say(`🎵 ${esc(d.title)}${d.artist ? ' · ' + esc(d.artist) : ''}`, { ms: 3500 }); } });
  if (FP) FP.addListener('petTap', d => { petOnly(true); const w = d && d.what; if (w === 'talk') setTimeout(() => { hideBubble(); t.focus(); }, 300); else if (w === 'mic') setTimeout(() => $('#micBtn').click(), 500); else setTimeout(petMenu, 400); });
  // 켤 때 알람 다시 예약 · 새 버전 확인(하루 한 번)
  window.addEventListener('load', () => {
    setTimeout(() => N.schedule(S.alarms), 2000);
    setTimeout(() => N.alarmSync(), 800);
    setTimeout(() => N.floatConfig(), 1000);
    setTimeout(() => { if (S.introDone && S.floatAsked !== today()) N.askFloat(); }, 4500);   // 처음 깐 사람은 안내가 끝난 뒤에 물음 (guide.js)
    setTimeout(function k() { if (!S.introDone || !bubble.hidden) return setTimeout(k, 20000); N.kakaoAsk(false); }, 15000);   // 카톡 알림 (안 켰으면 하루 한 번 물음)   // 화면 위 팻 허락 (안 했으면 하루 한 번 물음)
    setTimeout(() => N.checkUpdate(false), 4000);   // 11-06: 열 때마다 새 버전 확인 → 있으면 '1'
  });
})();

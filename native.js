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
    if (FP0 && FP0.wakePause) await FP0.wakePause({ on: true }).catch(() => {});   // 11-16: 어떤 받아쓰기든 "똑똑아" 귀가 마이크를 놓은 뒤에
    if (FP0 && FP0.micQuiet) await FP0.micQuiet({ level: S.talk.micBeep ?? 1 }).catch(() => {});
    window.__srBusy = (window.__srBusy || 0) + 1;
    try { await SR.stop(); } catch { }   // 11-16: 남아 있던 받아쓰기 끄기 (안 끄면 마이크를 붙잡아 다음부터 못 들음)
    window.__srWhy = '';
    let r; try { r = await Promise.race([SR.start({ language: 'ko-KR', maxResults: 1, partialResults: false, popup: false }), new Promise(res => setTimeout(() => res({ matches: [], timeout: 1 }), 9000))]); if (r && r.timeout) { window.__srWhy = '9초 동안 말이 안 들림'; try { await SR.stop(); } catch { } } } catch (e) { window.__srWhy = String((e && (e.message || e.code)) || e || '').slice(0, 60); throw e; } finally { if (FP0 && FP0.micRestore) setTimeout(() => FP0.micRestore().catch(() => {}), 900); window.__srBusy = Math.max(0, (window.__srBusy || 1) - 1); if (FP0 && FP0.wakePause) setTimeout(() => { if (!window.__srBusy) FP0.wakePause({ on: false }).catch(() => {}); }, 2500); }
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
    const uniq = a => [...new Set(a)].slice(0, 10), full = a => a.slice(0, 40);   // 11-10: 영상 동작(걷기·달리기)은 한 주기 전부
    const idle = ['정면', '눈망울_앉기', '기쁨', '윙크', '엎드림', '앉아'].map(one).filter(Boolean).slice(0, 5);
    const walk = sp === 'dog' ? (A.walk && A.walk.video ? A.walk.frames : ['걷기1.webp', '걷기2.webp']) : (A.walk && A.walk.video ? full : uniq)((A.walk || A['신나걷기'] || { frames: [Sp['정면'].file] }).frames);
    const rk = (C.runList || []).concat(['run', '네발뛰기', 'dash']).find(k => A[k]);
    const run = sp === 'dog' ? ['뛰기1.webp', '뛰기2.webp'] : rk ? (A[rk].video ? full : uniq)(A[rk].frames) : walk;
    const L = SOUNDS[sp] || SOUNDS.dog;
    const hk = ['인사_오른손', '인사_왼손', '기쁨', '만세'].find(k => A[k]); const hello = hk ? uniq(A[hk].frames) : [one('기쁨') || idle[0]];
    const dk = ['춤', '즐거움', '기쁨'].find(k => A[k]); const dance = dk ? uniq(A[dk].frames) : hello;
    const up = A['뒤돌아걷기'] ? full(A['뒤돌아걷기'].frames) : [], down = A['춤'] ? full(A['춤'].frames) : [];   // 11-10: 위로 갈 땐 뒤돌아 걷기, 아래로 올 땐 춤(앞으로 걸어오기)
    // 11-10: 혼자 운동하기 묶음 · 1분마다 명령 알려 주기(말 + 그 동작)
    const anOf = p => (POSES[p] || []).map(n => A[n]).find(a => a && a.frames && a.frames.length > 1);
    const sports = ['soccer', 'basketball', 'baseball', 'tennis', 'jumprope', 'taekwondo', 'hulahoop', 'bike'].map(anOf).filter(Boolean).map(a => full(a.frames).join('|'));
    const teach = [['앉아','sit'],['엎드려','lie'],['일어나','stand'],['기다려','wait'],['손','paw'],['빵','bang'],['굴러','roll'],['발라당','flipover'],['만세','hooray'],['점프','jump'],['돌아','spin'],['춤','dance'],['웃어','laugh'],['윙크','wink'],['이쁜 짓','cute'],['하트','heart'],['사랑해','loveyou'],['잘했어','praise'],['안 돼','sorry'],['쉿','quiet'],['슬퍼','sad'],['화내 봐','angry'],['깜짝','surprise'],['궁금해','curious'],['헤롱헤롱','dizzy'],['아파','sick'],['배고파','hungry'],['밥 먹자','meal'],['간식','snack'],['물 먹자','drink'],['양치','brush'],['세수','wash'],['물장난','splash'],['기지개','stretch'],['까꿍','peekaboo'],['돋보기','magnify'],['편지','letter'],['위험해','warn'],['인사','hello'],['짖어','bark'],['말해 봐','speak'],['혼자 놀아','solo'],['매달려','hang'],['기어','crawl'],['털썩','plop'],['밥그릇','emptybowl'],['자자','sleep'],['축구','soccer'],['농구','basketball'],['야구','baseball'],['테니스','tennis'],['줄넘기','jumprope'],['태권도','taekwondo'],['훌라후프','hulahoop'],['자전거','bike'],['신나게 걸어','skip'],['달려','gallop'],['뒤돌아 걸어','back']].map(([w, p]) => { const a = anOf(p); return a ? w + '\t' + (ONCE.has((POSES[p] || []).find(n => A[n] === a)) ? 1 : 0) + '\t' + full(a.frames).join('|') : null; }).filter(Boolean);
    const hg = anOf('hungry');
    return { sp, hungryF: hg ? full(hg.frames).join('|') : '', sports: sports.join(';'), teach: teach.join('\n'), up: up.join('|'), down: down.join('|'), dance: dance.join('|'), hello: hello.join('|'), idle: idle.join('|'), walk: walk.join('|'), run: run.join('|'), home: one('기쁨') || idle[0], sndC: L[0].join('|'), sndH: L[1].join('|') };
  };
  N.floatConfig = () => { if (FP) FP.config({ size: S.me.size || 100, name: bn(), on: !S.floatOff, act: petAct(), cries: !S.talk.mute && S.talk.cries !== false && Date.now() >= (quietUntil || 0), micBeep: S.talk.micBeep ?? 1, temper: S.me.temper || 'normal', kakao: !S.kakaoOff, talkMin: ({ often: 5, normal: 20, rare: 30, quiet: 0 })[S.talk.freq || 'normal'] ?? 20, uname: S.me.name || '', vol: S.talk.volume > 0 ? Math.max(0.1, S.talk.volume) : 0, teachMin: 1, factsOn: S.talk.facts !== false, age: S.me.age || 0, eng: window.engList ? engList() : '', ...petLists() }).catch(() => {}); };
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
    window.setPose = setPose = function (p) { _setPose(p); if (!document.hidden) return; if (p === 'run' || p === 'walk') { FP.pose({ action: p }).catch(() => {}); return; } if (P.frames && P.frames.length > 1) { FP.frames({ files: P.frames, fps: P.fps || 8, once: ONCE.has(P.an), ms: p === 'sleep' ? 20000 : ONCE.has(P.an) ? Math.round(P.frames.length / (P.fps || 8) * 1000 + 1200) : 6000 }).catch(() => {}); return; } const f = (pet.getAttribute('src') || '').split('/').pop(); if (f) FP.pose({ file: decodeURIComponent(f), ms: p === 'sleep' || p === 'lie' || p === 'sit' ? 12000 : 6000 }).catch(() => {}); };
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
  if (FP) FP.addListener('petTap', d => { const w = d && d.what; if (w === 'run') return;   // 화면 위 팻에게 한 말을 앱이 이어서 처리 (takePending)
    if (w === 'wake') { petOnly(true); hideBubble(); window.wokeByName = true;   // 🎤 이름으로 깨움: 팻창만 · 울음소리 → '듣고 있어… 말해 줘!' → 바로 듣기
      setPose('joy');
      const go = () => window.wakeHear && wakeHear(0);
      try { const L = SOUNDS[SP()] || SOUNDS.dog, a = new Audio('sounds/' + pick(L[1]) + '.mp3'); a.volume = Math.max(0.6, S.talk.volume || 0); let done = false; const g = () => { if (!done) { done = true; setTimeout(go, 250); } }; a.onended = g; setTimeout(g, 2500); a.play().catch(g); } catch { go(); }
      return; } if (w === 'feed' && window.openStudy) { if (S.food) { S.food.cryAt = Date.now(); save(); } setTimeout(openStudy, 400); return; } if (w && w.startsWith('chat:') && window.openChat) { setTimeout(() => openChat(w.slice(5)), 300); return; } if (w && w.startsWith('pong:') && window.PONG && PONG.invite) { const g = PONG.invite.go; PONG.invite = null; setTimeout(g, 400); return; } petOnly(true); if (w === 'talk') setTimeout(() => { hideBubble(); t.focus(); }, 300); else if (w === 'mic') setTimeout(() => $('#micBtn').click(), 500); else setTimeout(petMenu, 400); });
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

// 🎤 11-15: 이름으로 깨웠을 때 듣기 — 잠금 화면에선 구글 받아쓰기가 막히니 폰 안 인식(Vosk)으로 이어서
window.wakeHear = function () { if (window.voicePanel) voicePanel(); };

// 📞 11-16: 말로 "응/걸어 줘" · "아니/아냐/됐어" — 확인 말풍선 뒤에 한 번 들어서 실행
window.voiceYesNo = async function (yes, no) {
  if (!(window.Native && Native.listen)) return;
  await new Promise(r => setTimeout(r, 1200));
  let t = ''; try { t = (await Native.listen()) || ''; } catch { }
  t = String(t).replace(/\s+/g, ' ').trim();
  if (/^(응|어|네|예|그래|좋아|오케이|ok|걸어|걸어\s*줘|해\s*줘|보내|보내\s*줘|그렇게\s*해|부탁해|맞아)/i.test(t)) { hideBubble(); yes && yes(); }
  else if (/(아니|아냐|아뇨|취소|됐어|하지\s*마|그만|싫어|나중에)/.test(t)) { hideBubble(); say('알았어, 안 할게 🙂', { ms: 2000 }); no && no(); }
};

// 🎤 11-16 녹음 판: 빨간 단추가 깜빡이며 듣는 중 · 말하는 대로 글자가 실시간으로 적힘 · "다시/그게 아니고" = 지우고 다시
//  조용해지면 "실행해?" → "응/그래" 실행 · "아니/다시" 다시 듣기 · 폰 안 인식이라 잠금 화면에서도 됨
(function () {
  const FPv = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
  let ui, busy = false;
  function make() {
    if (ui) return ui;
    const st = document.createElement('style');
    st.textContent = `#vp{position:fixed;left:0;right:0;bottom:0;z-index:70;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -4px 20px #0003;padding:18px 18px 26px;text-align:center;font-family:inherit}
#vp .vpBtn{width:84px;height:84px;border-radius:50%;border:0;background:#e53935;color:#fff;font-size:34px;box-shadow:0 0 0 0 #e5393588;animation:vpP 1.2s infinite}
#vp.ask .vpBtn{background:#43a047;animation:none}#vp.idle .vpBtn{background:#9e9e9e;animation:none}
@keyframes vpP{0%{box-shadow:0 0 0 0 #e5393577}70%{box-shadow:0 0 0 22px #e5393500}100%{box-shadow:0 0 0 0 #e5393500}}
#vp .vpSt{font-weight:800;margin:10px 0 6px;font-size:17px}#vp .vpTx{min-height:56px;font-size:24px;font-weight:700;color:#222;word-break:keep-all;line-height:1.35}
#vp .vpHint{color:#888;font-size:13px;margin-top:8px}#vp .vpRow{display:flex;gap:10px;justify-content:center;margin-top:12px}#vp .vpRow button{border:0;border-radius:14px;padding:10px 18px;font-size:16px;font-weight:700}`;
    document.head.appendChild(st);
    ui = document.createElement('div'); ui.id = 'vp'; ui.hidden = true;
    ui.innerHTML = '<button class="vpBtn" id="vpBtn">🎤</button><div class="vpSt" id="vpSt"></div><div class="vpTx" id="vpTx"></div><div class="vpRow" id="vpRow" hidden><button id="vpYes" style="background:#43a047;color:#fff">✅ 실행</button><button id="vpAgain" style="background:#eee">🔄 다시</button><button id="vpX" style="background:#eee">✕ 닫기</button></div><div class="vpHint" id="vpHint">말이 끝나면 "실행해?" 하고 물어봐요 · 잘못 적히면 "다시"</div>';
    document.body.appendChild(ui);
    const F = FPv(); if (F && F.addListener) F.addListener('voskPartial', d => { if (!ui.hidden && ui.classList.contains('rec')) $('#vpTx').textContent = d.text || ''; });
    $('#vpX').onclick = () => close();
    return ui;
  }
  function close() { if (!ui) return; ui.hidden = true; busy = false; const F = FPv(); if (F && F.voskStop) F.voskStop().catch(() => { }); setTimeout(() => { if (F && F.wakePause) F.wakePause({ on: false }).catch(() => { }); }, 800); }
  async function hear() {   // 한 번 듣기 (실시간 글자)
    const F = FPv(); if (!F || !F.voskListen) return '';
    ui.className = 'rec'; $('#vpSt').textContent = '🔴 듣는 중… 말해 줘!'; $('#vpTx').textContent = '';
    const r = await F.voskListen().catch(() => ({ text: '' }));
    return (r && r.text || '').replace(/\s+/g, ' ').trim();
  }
  const AGAIN = /^(다시|다시\s*해|다시\s*할게|그게\s*아니고|그게\s*아니야|아니\s*다시|틀렸어)/;
  const YES = /^(응|어|네|예|그래|좋아|오케이|실행|실행해|해\s*줘|그렇게\s*해|맞아|보내|걸어)/;
  const NO = /^(아니|아냐|아뇨|취소|됐어|하지\s*마|그만)/;
  window.voicePanel = async function () {
    if (busy) return; busy = true; make(); ui.hidden = false; $('#vpRow').hidden = true;
    const F = FPv(); if (F && F.wakePause) await F.wakePause({ on: true }).catch(() => { });   // "똑똑아" 귀가 마이크를 놓을 때까지
    let cmd = '';
    for (let round = 0; round < 4 && !ui.hidden; round++) {
      cmd = await hear(); if (ui.hidden) return;
      if (!cmd) { $('#vpSt').textContent = '잘 못 들었어 🥲 다시 말해 줘!'; continue; }
      if (AGAIN.test(cmd)) { $('#vpSt').textContent = '🔄 지웠어! 다시 말해 줘'; cmd = ''; continue; }
      // 확인: "실행해?"
      ui.className = 'ask'; $('#vpTx').textContent = cmd; $('#vpSt').textContent = '✅ 이대로 실행해?'; $('#vpRow').hidden = false;
      const ans = await new Promise(async res => {
        $('#vpYes').onclick = () => res('응'); $('#vpAgain').onclick = () => res('다시');
        const a = await (F && F.voskListen ? F.voskListen().catch(() => ({ text: '' })) : Promise.resolve({ text: '' }));
        res((a && a.text || '').trim());
      });
      $('#vpRow').hidden = true; if (F && F.voskStop) F.voskStop().catch(() => { });
      if (YES.test(ans) && !NO.test(ans)) { close(); say(`👂 "${esc(cmd)}"`, { ms: 1500 }); if (typeof send === 'function') setTimeout(() => send(cmd), 300); return; }
      if (NO.test(ans) && !AGAIN.test(ans)) { close(); say('알았어, 안 할게 🙂', { ms: 1800 }); return; }
      $('#vpSt').textContent = '🔄 다시 말해 줘'; cmd = '';
    }
    close(); say('또 불러 줘! "똑똑아" 🐾', { ms: 2500 });
  };
})();

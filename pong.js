// 🏓 하루 탁구 (11-09)
//  🐶 하루와 하기: 팻이 위에서 골키퍼처럼 받아 침 · 이기면 다음 단계(1~10, 단계가 오를수록 팻이 잘함)
//  👫 친구와 하기: 하루 예보로 연결된 사람(🔗)에게 초대 → 휴대폰끼리 바로 연결(WebRTC)해서 대전
//  🌏 아무나와 하기: 공개 대기실(암호 중계소)에서 기다리는 사람과 짝지어 대전
//  🏆 랭킹: 대전 점수(레이팅)·승률·최고 단계를 공개 중계소에 올려 순위 보기 (별명만 보임)
//  규칙: 흰 공 · 벽에 튕기면 각도 바뀜 · 밀어 치면 빨라짐 · 11점 먼저(2점 차) · 서브는 5점마다 바꿈
const PONG = { on: false, mode: 'pet' };
const pongSnd = {};
function pongPlay(n, vol) {
  try { const a = (pongSnd[n] = pongSnd[n] || new Audio('sounds/pong_' + n + '.mp3')).cloneNode(); a.volume = vol == null ? 0.9 : vol; a.play().catch(() => { }); } catch { }
}
function pongRec() { S.pong = Object.assign({ win: 0, lose: 0, best: 0, stage: 1, rating: 1000, nwin: 0, nlose: 0 }, S.pong || {}); return S.pong; }
function pongUI() {
  let ui = document.getElementById('pongUI');
  if (!ui) {
    ui = document.createElement('div'); ui.id = 'pongUI';
    ui.innerHTML = '<canvas id="pongCv"></canvas><div class="pgTop"><button class="pgX" id="pgX">✕</button><div class="pgScore" id="pgScore"></div><div class="pgRec" id="pgRec"></div></div><div class="pgMsg" id="pgMsg"></div><div class="pgMenu" id="pgMenu" hidden></div>';
    document.body.appendChild(ui);
    ui.querySelector('#pgX').onclick = () => (window.haruBack ? haruBack() : pongClose());
  }
  return ui;
}
// 탁구 첫 화면 (고르기)
function openPong(mode) {
  window.wantViewAt = Date.now(); { const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet; if (document.hidden && F && F.front) F.front().catch(() => { }); }
  hideBubble();
  const ui = pongUI();
  if (!PONG.on) { ui.hidden = false; PONG.on = true; navPush(() => pongClose()); if (typeof fmKeep === 'function') fmKeep(true); pongSetup(); PONG.last = performance.now(); PONG.raf = requestAnimationFrame(pongLoop); }
  if (mode === 'pet') return pongStart('pet');
  pongMenu();
}
function pongMenu() {
  const r = pongRec(), m = document.getElementById('pgMenu');
  PONG.state = 'menu'; PONG.over = false; pongMsg(''); netEnd(true); lobbyStop();
  const friends = S.contacts.filter(c => c.pk);
  m.hidden = false;
  m.innerHTML = `<h2>🏓 하루 탁구</h2>
    <button data-pg="pet"><i>🐶</i><b>${esc(bn())}와 하기</b><small>지금 ${r.stage}단계 · 이기면 다음 단계</small></button>
    <button data-pg="friend"><i>👫</i><b>친구와 하기</b><small>${friends.length ? `하루 예보로 연결된 사람 ${friends.length}명` : '연락처에서 🔗 초대한 사람과'}</small></button>
    <button data-pg="any"><i>🌏</i><b>아무나와 하기</b><small>지금 기다리는 사람과 바로 대전</small></button>
    <button data-pg="rank"><i>🏆</i><b>랭킹</b><small>내 점수 ${r.rating} · 대전 ${r.nwin}승 ${r.nlose}패</small></button>`;
  pongScore();
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#pgMenu [data-pg]'); if (!b) return;
  const a = b.dataset.pg;
  if (a === 'pet') pongStart('pet');
  if (a === 'friend') pongFriends();
  if (a === 'any') lobbyStart();
  if (a === 'rank') pongRanking();
  if (a === 'menu') pongMenu();
  if (a === 'inv') pongInvite(b.dataset.pk);
});
function pongClose() {
  PONG.on = false; cancelAnimationFrame(PONG.raf); netEnd(true); lobbyStop();
  const ui = document.getElementById('pongUI'); if (ui) ui.hidden = true;
  if (typeof fmKeep === 'function') fmKeep(false);
}
function pongSetup() {
  const cv = document.getElementById('pongCv'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  Object.assign(PONG, { cv, g, W, H, r: Math.max(9, W * 0.028), base: H / 1.9, petW: Math.min(120, W * 0.26), petY: 150 + (parseInt(getComputedStyle(document.body).paddingTop) || 0) });
  if (!PONG.ball) PONG.ball = { x: W / 2, y: H - 150, vx: 0, vy: 0 };
  if (PONG.petX == null) PONG.petX = W / 2;
  const C = (window.CHARS || {})[SP()] || {}, A = C.anims || {}, Sp = C.sprites || {};
  const frames = (A.walk && A.walk.frames) || (Sp['정면'] ? [Sp['정면'].file] : []);
  const joy = (A['기쁨'] && A['기쁨'].frames) || frames, sad = (A['슬픔'] && A['슬픔'].frames) || (Sp['슬픔'] ? [Sp['슬픔'].file] : frames);
  const load = list => [...new Set(list)].slice(0, 60).map(f => { const im = new Image(); im.src = DIR() + f; return im; });
  PONG.img = { walk: load(frames), joy: load(joy), sad: load(sad), front: load(Sp['정면'] ? [Sp['정면'].file] : frames) };
  PONG.face = (A.walk && A.walk.face) || -1;
  if (!PONG.bound) {
    PONG.bound = true;
    cv.addEventListener('touchstart', pongDown, { passive: false }); cv.addEventListener('touchmove', pongMove, { passive: false }); cv.addEventListener('touchend', pongUp);
    cv.addEventListener('mousedown', e => pongDown({ preventDefault() { }, touches: [e] })); cv.addEventListener('mousemove', e => { if (e.buttons) pongMove({ preventDefault() { }, touches: [e] }); }); cv.addEventListener('mouseup', pongUp);
    window.addEventListener('resize', () => { if (PONG.on) pongSetup(); });
  }
}
// ── 경기 시작 (mode: 'pet' | 'net')
function pongStart(mode) {
  document.getElementById('pgMenu').hidden = true;
  PONG.mode = mode;
  Object.assign(PONG, { me: 0, pet: 0, played: 0, rally: 0, petX: PONG.W / 2, petV: 0, aim: PONG.W / 2, mood: 'walk', moodT: 0, over: false });
  pongServe();
}
function pongOpp() { return PONG.mode === 'net' ? (NET.name || '상대') : bn(); }
function pongServer() {   // 5점마다 서브 바꿈 (대전: 초대한 쪽 'a' 가 먼저)
  const first = Math.floor(PONG.played / 5) % 2 === 0;
  if (PONG.mode === 'net') return (first === (NET.role === 'a')) ? 'me' : 'pet';
  return first ? 'me' : 'pet';
}
function pongServe() {
  const who = pongServer(); PONG.rally = 0;
  PONG.state = who === 'me' ? 'serveMe' : PONG.mode === 'net' ? 'waitOpp' : 'servePet';
  PONG.ball = who === 'me' ? { x: PONG.W / 2, y: PONG.H - 150, vx: 0, vy: 0 } : { x: PONG.mode === 'net' ? PONG.W / 2 : PONG.petX, y: PONG.petY + 60, vx: 0, vy: 0 };
  PONG.serveAt = performance.now();
  pongMsg(who === 'me' ? '내 서브! 공을 위로 쭉 밀어 올려 봐 ☝️' : `${pongOpp()} 서브!`);
  pongScore();
}
function pongMsg(t, ms) { const e = document.getElementById('pgMsg'); if (!e) return; e.textContent = t; e.style.opacity = t ? 1 : 0; clearTimeout(PONG.msgT); if (t && ms) PONG.msgT = setTimeout(() => { e.style.opacity = 0; }, ms); }
function pongScore() {
  const e = document.getElementById('pgScore'), r = pongRec();
  if (e) e.innerHTML = /^menu/.test(PONG.state) ? '' : `<span>나</span><b>${PONG.me}</b><i>:</i><b>${PONG.pet}</b><span>${esc(pongOpp())}</span>`;
  const q = document.getElementById('pgRec');
  if (q) q.textContent = PONG.mode === 'net' && PONG.state !== 'menu' ? `내 점수 ${r.rating} · 상대 ${NET.rating || '-'}` : `${r.stage}단계 · ${r.win}승 ${r.lose}패 · 최고 랠리 ${r.best}`;
}
// ── 손가락: 내 쪽(아래)으로 온 공을 누르면 받아 치고, 밀어 올리면 더 빠르게
function pongCanHit() { const b = PONG.ball; return PONG.state === 'serveMe' || (PONG.state === 'play' && b.vy > 0 && b.y > PONG.H * 0.45); }
function pongDown(e) {
  if (!PONG.on || PONG.state === 'menu') return; e.preventDefault();
  if (PONG.over) { if (PONG.mode === 'pet') pongStart('pet'); else pongMenu(); return; }
  const t = e.touches[0], x = t.clientX, y = t.clientY, b = PONG.ball;
  PONG.touch = { x, y, t: performance.now(), t0: performance.now(), hit: false };
  if (Math.hypot(x - b.x, y - b.y) < PONG.r * 3.2 + 34 && pongCanHit()) pongHitMe(0, 0);
}
function pongMove(e) {
  if (!PONG.on || !PONG.touch) return; e.preventDefault();
  const t = e.touches[0], T = PONG.touch, now = performance.now();
  const fvx = (t.clientX - T.x) / Math.max(8, now - T.t) * 1000, fvy = (t.clientY - T.y) / Math.max(8, now - T.t) * 1000;
  T.x = t.clientX; T.y = t.clientY; T.t = now;
  const b = PONG.ball;
  if (!T.hit) { if (Math.hypot(T.x - b.x, T.y - b.y) < PONG.r * 3.2 + 30 && pongCanHit()) pongHitMe(fvx, fvy); }
  else if (now - T.t0 < 160 && fvy < -200) pongHitMe(fvx, fvy, true);   // 막 친 뒤 위로 밀면 속도 더
}
function pongUp() { PONG.touch = null; }
function pongHitMe(fvx, fvy, boost) {
  const b = PONG.ball, base = PONG.base, T = PONG.touch;
  const push = Math.max(0, Math.min(base * 1.1, -fvy * 0.35));                // 밀어 친 만큼 빨라짐
  const sp = Math.min(base * 2.4, base * (1 + PONG.rally * 0.025) + push);
  b.vy = -sp;
  b.vx = Math.max(-base * 0.9, Math.min(base * 0.9, (fvx || 0) * 0.3 + (b.vx || 0) * (boost ? 1 : 0.35) + (Math.random() - 0.5) * base * 0.15));
  if (!boost) { pongPlay('hit'); PONG.rally++; if (T) T.hit = true; if (navigator.vibrate) navigator.vibrate(15); }
  if (PONG.state !== 'play') { PONG.state = 'play'; pongMsg(''); }
  b.y = Math.min(b.y, PONG.H - PONG.r - 2);
  if (PONG.mode === 'net') netSend({ t: 'hit', x: b.x / PONG.W, y: b.y / PONG.H, vx: b.vx / PONG.W, vy: b.vy / PONG.H, rally: PONG.rally });
}
// ── 팻 실력: 단계가 오를수록 잘함 · 점수 차에 따라 막상막하
function pongSkill() {
  const st = pongRec().stage, d = PONG.me - PONG.pet, band = 0.07 * (1 - (st - 1) * 0.06);
  return Math.max(0.28, Math.min(0.9, 0.5 + (st - 1) * 0.035 + d * band));
}
function pongPredict() {
  const b = PONG.ball; if (b.vy >= 0) return PONG.W / 2;
  const t = (b.y - (PONG.petY + 40)) / -b.vy; let x = b.x + b.vx * t; const L = PONG.r, R = PONG.W - PONG.r, w = R - L;
  x = ((x - L) % (2 * w) + 2 * w) % (2 * w); return L + (x > w ? 2 * w - x : x);
}
function pongLoop(now) {
  if (!PONG.on) return;
  const dt = Math.min(0.033, (now - PONG.last) / 1000); PONG.last = now;
  if (!/^menu/.test(PONG.state)) pongStep(dt, now);
  pongDraw(now);
  PONG.raf = requestAnimationFrame(pongLoop);
}
function pongStep(dt, now) {
  const b = PONG.ball, W = PONG.W, H = PONG.H, r = PONG.r, net = PONG.mode === 'net';
  if (!net) {   // 팻 움직임
    const s = pongSkill();
    if (PONG.state === 'play' && b.vy < 0 && b.y < H * 0.82) {
      if (PONG.aimFor !== PONG.rally) { PONG.aimFor = PONG.rally; const fast = Math.abs(b.vy) / PONG.base; const A = PONG.petW * (0.95 - 0.5 * s) * (1 + Math.max(0, fast - 1) * 0.3); PONG.err = (Math.random() - 0.5) * 2 * A; }
      PONG.aim = pongPredict() + PONG.err;
    } else if (PONG.state === 'servePet') PONG.aim = W / 2; else PONG.aim = PONG.aim * 0.98 + (W / 2) * 0.02;
    const maxV = W * (0.75 + s * 0.9), dx = PONG.aim - PONG.petX;
    PONG.petV = Math.max(-maxV, Math.min(maxV, dx * 6));
    PONG.petX = Math.max(PONG.petW / 2, Math.min(W - PONG.petW / 2, PONG.petX + PONG.petV * dt));
    if (PONG.state === 'servePet') {
      b.x = PONG.petX; b.y = PONG.petY + 60;
      if (now - PONG.serveAt > 1300) { b.vy = PONG.base; b.vx = (Math.random() - 0.5) * PONG.base * 0.8; PONG.state = 'play'; pongPlay('hit'); pongMsg(''); }
      return;
    }
  }
  if (PONG.state !== 'play') return;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * 0.97; pongPlay('wall', 0.7); }
  if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx) * 0.97; pongPlay('wall', 0.7); }
  if (!net) {   // 팻이 받아 치기
    const top = PONG.petY + 34;
    if (b.vy < 0 && b.y - r <= top && b.y - r > top - 40 && Math.abs(b.x - PONG.petX) < PONG.petW * 0.55) {
      const sp = Math.min(PONG.base * 2.3, Math.abs(b.vy) * (1.02 + Math.random() * 0.05));
      b.vy = sp; b.vx += ((b.x - PONG.petX) / PONG.petW) * PONG.base * 0.9 + (Math.random() - 0.5) * PONG.base * 0.2;
      b.vx = Math.max(-PONG.base * 1.1, Math.min(PONG.base * 1.1, b.vx));
      b.y = top + r; PONG.rally++; pongPlay('hit');
    }
    if (b.y < -r * 2) pongPoint('me');
  } else if (b.y < -r * 2 && b.vy < 0) { PONG.state = 'waitOpp'; }   // 상대 쪽으로 넘어감 → 상대가 쳤는지(hit)·놓쳤는지(miss) 기다림
  if (b.y > H + r * 2) { if (net) netSend({ t: 'miss' }); pongPoint('pet'); }
}
function pongPoint(who) {
  PONG.state = 'point'; PONG.played++;
  if (who === 'me') PONG.me++; else PONG.pet++;
  const r = pongRec(); if (PONG.rally > r.best) r.best = PONG.rally;
  PONG.mood = who === 'me' ? 'sad' : 'joy'; PONG.moodT = performance.now() + 1400;
  pongPlay(who === 'me' ? 'point' : 'miss', 0.6);
  const a = PONG.me, b = PONG.pet;
  if ((a >= 11 || b >= 11) && Math.abs(a - b) >= 2) { pongEnd(a > b); return; }
  save(); pongScore();
  pongMsg(who === 'me' ? '득점! 👏' : `${pongOpp()} 득점!`, 1200);
  setTimeout(() => { if (PONG.on && !PONG.over && PONG.state === 'point') pongServe(); }, 1300);
}
function pongEnd(meWin) {
  PONG.over = true; const r = pongRec(), a = PONG.me, b = PONG.pet;
  pongPlay(meWin ? 'win' : 'miss', 0.8);
  if (PONG.mode === 'pet') {
    meWin ? r.win++ : r.lose++;
    const up = meWin && r.stage < 10; if (up) r.stage++;
    save(); pongScore(); pongPublish();
    pongMsg(meWin ? `🎉 이겼어! ${a} : ${b}${up ? ` → ${r.stage}단계로!` : ''}  (누르면 다시)` : `${bn()}가 이겼어! ${a} : ${b}  (누르면 다시)`);
    return;
  }
  // 대전: 레이팅(Elo) 바꾸기
  const exp = 1 / (1 + Math.pow(10, ((NET.rating || 1000) - r.rating) / 400)), k = 32;
  r.rating = Math.round(r.rating + k * ((meWin ? 1 : 0) - exp)); meWin ? r.nwin++ : r.nlose++;
  save(); pongScore(); pongPublish();
  pongMsg(meWin ? `🎉 ${NET.name || '상대'}를 이겼어! ${a} : ${b} · 내 점수 ${r.rating}` : `${NET.name || '상대'}가 이겼어 ${a} : ${b} · 내 점수 ${r.rating}  (누르면 처음 화면)`);
  setTimeout(() => netEnd(false), 1500);
}
function pongDraw(now) {
  const g = PONG.g, W = PONG.W, H = PONG.H, b = PONG.ball;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1d5a8f'); gr.addColorStop(1, '#16466f'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12);
  g.setLineDash([10, 10]); g.beginPath(); g.moveTo(W / 2, 10); g.lineTo(W / 2, H - 10); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(6, H / 2 - 2, W - 12, 4);
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(6, H * 0.45, W - 12, H * 0.55 - 6);
  if (/^menu/.test(PONG.state)) return;
  if (PONG.mode === 'net') {   // 상대 쪽
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(6, 6, W - 12, H * 0.25);
    g.fillStyle = '#fff'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.fillText(`🏓 ${NET.name || '상대'}`, W / 2, PONG.petY - 10);
  } else {
    const set = now < PONG.moodT ? PONG.img[PONG.mood] : Math.abs(PONG.petV) > 30 ? PONG.img.walk : PONG.img.front;
    const im = set && set[Math.floor(now / 90) % set.length];
    if (im && im.complete && im.naturalWidth) {
      const h = PONG.petW * 1.05, w = h * im.naturalWidth / im.naturalHeight, flip = set === PONG.img.walk && (PONG.petV > 0 ? PONG.face < 0 : PONG.face > 0);
      g.save(); g.translate(PONG.petX, PONG.petY - h / 2 + 30); if (flip) g.scale(-1, 1); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore();
    }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(PONG.petX - PONG.petW / 2, PONG.petY + 34, PONG.petW, 4);
  }
  if (PONG.state === 'waitOpp' && b.y < 0) return;
  g.beginPath(); g.ellipse(b.x + 4, b.y + 6, PONG.r, PONG.r * 0.6, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
  const bg = g.createRadialGradient(b.x - PONG.r * 0.4, b.y - PONG.r * 0.4, 1, b.x, b.y, PONG.r); bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#dfe6ee');
  g.beginPath(); g.arc(b.x, b.y, PONG.r, 0, Math.PI * 2); g.fillStyle = bg; g.fill();
}

// ══ 👫🌏 사람끼리 대전 — 휴대폰끼리 바로 연결(WebRTC 데이터 통로), 신호는 하루 대화방과 같은 암호 중계소
const NET = {};
function netSend(o) { try { if (NET.dc && NET.dc.readyState === 'open') NET.dc.send(JSON.stringify(o)); } catch { } }
function netEnd(silent) {
  if (!NET.pc && !NET.pending) return;
  try { if (!silent) netSend({ t: 'bye' }); } catch { }
  try { NET.dc && NET.dc.close(); } catch { } try { NET.pc && NET.pc.close(); } catch { }
  for (const k of Object.keys(NET)) delete NET[k];
}
async function netConnect(pk, role, name, rating) {
  netEnd(true);
  Object.assign(NET, { pk, role, name: name || '상대', rating: rating || 1000, pending: true });
  const ice = typeof iceServers === 'function' ? await iceServers() : [{ urls: ['stun:stun.l.google.com:19302'] }];
  const pc = NET.pc = new RTCPeerConnection({ iceServers: ice });
  const wire = dc => { NET.dc = dc; dc.onopen = () => netReady(); dc.onmessage = e => { try { netMsg(JSON.parse(e.data)); } catch { } }; dc.onclose = () => { if (PONG.on && PONG.mode === 'net' && !PONG.over) { pongMsg('연결이 끊겼어 🥲 (누르면 처음 화면)'); PONG.over = true; } }; };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') { pongMsg('연결이 안 됐어 🥲 다시 해 볼래?'); setTimeout(pongMenu, 2500); } };
  if (role === 'a') {
    wire(pc.createDataChannel('pong', { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer()); await pongWaitIce(pc);
    nsend(pk, 'pong-offer', '', { sdp: pc.localDescription.sdp, name: nameOf() || '나', rating: pongRec().rating });
  } else pc.ondatachannel = e => wire(e.channel);
  NET.timer = setTimeout(() => { if (NET.pending) { pongMsg('연결이 안 됐어 🥲'); netEnd(true); setTimeout(() => PONG.on && pongMenu(), 2000); } }, 30000);
}
function pongWaitIce(pc) { return new Promise(ok => { if (pc.iceGatheringState === 'complete') return ok(); const t = setTimeout(ok, 2500); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } }); }); }
function netReady() {
  clearTimeout(NET.timer); NET.pending = false;
  netSend({ t: 'hello', name: nameOf() || '나', rating: pongRec().rating });
  pongMsg(`${NET.name} 와 연결됐어! 🏓`, 1500);
  setTimeout(() => pongStart('net'), 600);
}
function netMsg(m) {
  if (!PONG.on) return;
  if (m.t === 'hello') { NET.name = String(m.name || NET.name).slice(0, 12); NET.rating = +m.rating || NET.rating; pongScore(); return; }
  if (m.t === 'bye') { if (!PONG.over) { pongMsg(`${NET.name}가 나갔어 (누르면 처음 화면)`); PONG.over = true; } return; }
  if (PONG.mode !== 'net') return;
  if (m.t === 'hit') {   // 상대가 친 공: 상대 화면 기준 → 내 화면 기준(위아래·좌우 뒤집기)
    const b = PONG.ball; b.x = (1 - m.x) * PONG.W; b.y = (1 - m.y) * PONG.H; b.vx = -m.vx * PONG.W; b.vy = -m.vy * PONG.H;
    const lag = 0.06; b.x += b.vx * lag; b.y += b.vy * lag;   // 전달 지연만큼 앞당김
    PONG.rally = m.rally || PONG.rally + 1; PONG.state = 'play'; pongMsg(''); pongPlay('hit', 0.6);
    return;
  }
  if (m.t === 'miss') { pongPoint('me'); return; }
}
// 신호 받기 (people.js 에서 넘겨줌: 연락처 아닌 사람도 — 아무나와 하기)
async function pongSignal(ev) {
  const from = ev.from;
  if (ev.t === 'pong-invite') {   // 친구가 초대
    const c = S.contacts.find(x => x.pk === from); if (!c) return;
    const go = () => { hideBubble(); openPong(); nsend(from, 'pong-accept', '', { name: nameOf() || '나', rating: pongRec().rating }); pongMsg(`${c.name} 와 연결하는 중…`); NET.pending = true; NET.waitPk = from; NET.name = c.name; };
    if (document.hidden) { const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet; if (F && F.say) F.say({ text: `🏓 ${c.name}가 탁구 하재!\n👉 누르면 시작`, open: 'pong:' + from, ms: 30000 }).catch(() => { }); PONG.invite = { from, go }; return; }
    say(`🏓 <b>${esc(c.name)}</b>가 탁구 하재!`, { pose: 'joy', ms: 30000, important: true, buttons: [{ label: '🏓 하자!', act: go }, { label: '다음에', ghost: true, act: () => { hideBubble(); nsend(from, 'pong-no', ''); } }] });
    cry(true); return;
  }
  if (ev.t === 'pong-accept') { if (NET.invitePk !== from) return; const c = S.contacts.find(x => x.pk === from); netConnect(from, 'a', c ? c.name : ev.name, +ev.rating); pongMsg('연결하는 중…'); return; }
  if (ev.t === 'pong-no') { if (NET.invitePk === from) { pongMsg('지금은 어렵대 🥲', 2500); setTimeout(() => PONG.on && pongMenu(), 2500); } return; }
  if (ev.t === 'pong-offer') {
    const ok = (NET.waitPk === from) || LOBBY.on;   // 친구 초대를 받았거나, 대기실에서 기다리는 중
    if (!ok || !PONG.on) return;
    lobbyStop();
    await netConnect(from, 'b', String(ev.name || NET.name || '상대').slice(0, 12), +ev.rating);
    const pc = NET.pc;
    await pc.setRemoteDescription({ type: 'offer', sdp: ev.sdp });
    await pc.setLocalDescription(await pc.createAnswer()); await pongWaitIce(pc);
    nsend(from, 'pong-answer', '', { sdp: pc.localDescription.sdp });
    return;
  }
  if (ev.t === 'pong-answer') { if (NET.pk !== from || !NET.pc) return; try { await NET.pc.setRemoteDescription({ type: 'answer', sdp: ev.sdp }); } catch { } return; }
}
window.pongSignal = pongSignal;
// 👫 친구와 하기
function pongFriends() {
  const m = document.getElementById('pgMenu'), fr = S.contacts.filter(c => c.pk);
  m.innerHTML = `<h2>👫 누구랑 할까?</h2>${fr.length ? fr.map(c => `<button data-pg="inv" data-pk="${c.pk}"><i>🏓</i><b>${esc(c.name)}</b><small>초대 보내기</small></button>`).join('') : '<p class="pgNote">아직 하루 예보로 연결된 사람이 없어요.<br>📞 연락처에서 이름을 누르고 🔗 초대를 보내 주세요.</p>'}<button data-pg="menu" class="ghost">← 처음으로</button>`;
}
function pongInvite(pk) {
  const c = S.contacts.find(x => x.pk === pk); if (!c) return;
  NET.invitePk = pk; document.getElementById('pgMenu').hidden = true; PONG.state = 'menuWait';
  nsend(pk, 'pong-invite', '', { name: nameOf() || '나' });
  pongMsg(`${c.name}에게 초대를 보냈어! 받으면 바로 시작해 🏓`);
  setTimeout(() => { if (PONG.on && NET.invitePk === pk && !NET.pc) { pongMsg(`${c.name}가 아직 안 받았어. 나중에 다시 해 보자`, 3000); NET.invitePk = null; setTimeout(() => PONG.on && pongMenu(), 3000); } }, 60000);
}
// 🌏 아무나와 하기: 공개 대기실 (오래 남지 않는 알림 kind 20078) — 서로 보이면 공개키가 작은 쪽이 연결을 검
const LOBBY = { on: false };
function lobbyStart() {
  if (typeof pool === 'undefined' || !pool || !NT || !SK) { pongMsg('인터넷 연결을 확인해 줘 🥲', 3000); return; }
  lobbyStop(); document.getElementById('pgMenu').hidden = true; PONG.state = 'menuWait';
  Object.assign(LOBBY, { on: true, partner: null, t0: Date.now() });
  pongMsg('🌏 같이 할 사람을 찾는 중…');
  const tick = () => {
    if (!LOBBY.on) return;
    try { const ev = NT.finalizeEvent({ kind: 20078, created_at: Math.floor(Date.now() / 1000), tags: [['t', 'haru-pong-lobby']], content: JSON.stringify({ name: nameOf() || '하루친구', rating: pongRec().rating }) }, SK); pool.publish(RELAYS, ev); } catch { }
    if (Date.now() - LOBBY.t0 > 90000) { lobbyStop(); pongMsg('지금은 기다리는 사람이 없어. 하루랑 먼저 해 볼까?', 4000); setTimeout(() => PONG.on && pongMenu(), 4000); return; }
    LOBBY.timer = setTimeout(tick, 4000);
  };
  try {
    LOBBY.sub = pool.subscribeMany(RELAYS, [{ kinds: [20078], '#t': ['haru-pong-lobby'], since: Math.floor(Date.now() / 1000) - 15 }], {
      onevent: ev => {
        if (!LOBBY.on || ev.pubkey === PK || LOBBY.partner) return;
        let info = {}; try { info = JSON.parse(ev.content); } catch { }
        LOBBY.partner = ev.pubkey; NET.name = String(info.name || '상대').slice(0, 12);
        pongMsg(`🎉 ${NET.name} 를 찾았어! 연결하는 중…`);
        if (PK < ev.pubkey) { lobbyStop(true); netConnect(ev.pubkey, 'a', NET.name, +info.rating); }
      },
    });
  } catch { }
  tick();
}
function lobbyStop(keepPartner) { LOBBY.on = keepPartner ? LOBBY.on : false; clearTimeout(LOBBY.timer); try { LOBBY.sub && LOBBY.sub.close(); } catch { } LOBBY.sub = null; if (!keepPartner) LOBBY.partner = null; else LOBBY.on = false; }
// 🏆 랭킹: 내 기록을 공개 중계소에 (별명·점수만) · 순위 불러오기
function pongPublish() {
  try {
    if (typeof pool === 'undefined' || !pool || !SK) return;
    const r = pongRec();
    const ev = NT.finalizeEvent({ kind: 30078, created_at: Math.floor(Date.now() / 1000), tags: [['d', 'haru-pong'], ['t', 'haru-pong']], content: JSON.stringify({ name: (nameOf() || '하루친구').slice(0, 12), rating: r.rating, nwin: r.nwin, nlose: r.nlose, stage: r.stage, best: r.best }) }, SK);
    pool.publish(RELAYS, ev);
  } catch { }
}
async function pongRanking() {
  const m = document.getElementById('pgMenu'), r = pongRec();
  m.innerHTML = '<h2>🏆 랭킹</h2><p class="pgNote">불러오는 중…</p>';
  pongPublish();
  let list = [];
  try { list = await Promise.race([pool.querySync(RELAYS, { kinds: [30078], '#t': ['haru-pong'], limit: 300 }), new Promise(ok => setTimeout(() => ok([]), 6000))]); } catch { }
  const best = new Map();
  for (const ev of list) { let d; try { d = JSON.parse(ev.content); } catch { continue; } const o = best.get(ev.pubkey); if (!o || o.at < ev.created_at) best.set(ev.pubkey, { ...d, at: ev.created_at, me: ev.pubkey === PK }); }
  if (!best.has(PK)) best.set(PK, { name: nameOf() || '나', rating: r.rating, nwin: r.nwin, nlose: r.nlose, stage: r.stage, me: true });
  const rows = [...best.values()].sort((a, b) => (b.rating - a.rating) || (b.stage - a.stage)).slice(0, 30);
  const rate = o => { const n = (o.nwin || 0) + (o.nlose || 0); return n ? Math.round(o.nwin * 100 / n) + '%' : '-'; };
  m.innerHTML = `<h2>🏆 랭킹</h2><div class="pgRank"><div class="rh"><span>순위</span><span>별명</span><span>점수</span><span>승률</span><span>단계</span></div>${rows.map((o, i) => `<div class="${o.me ? 'me' : ''}"><span>${i + 1}</span><span>${esc(String(o.name || '-').slice(0, 10))}</span><span>${o.rating || 1000}</span><span>${rate(o)}</span><span>${o.stage || 1}</span></div>`).join('')}</div>
    <p class="pgNote">점수는 사람끼리 대전으로 오르내려요. 단계는 ${esc(bn())}를 이긴 단계예요. 별명은 ⚙️ 설정의 내 이름이에요.</p><button data-pg="menu" class="ghost">← 처음으로</button>`;
}
// 말: "공놀이" = 공 던지기 · "탁구"/"핑퐁" = 하루 탁구 · "게임하자" = 고르기
function gameMenu() {
  const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
  if (document.hidden && F && F.say) { F.say({ text: '🎮 무슨 게임 할까?\n🎾 "공놀이" 또는 🏓 "탁구" 라고 말해 줘', ms: 12000 }).catch(() => { }); return; }
  say('🎮 무슨 게임 할까?', { pose: 'joy', ms: 20000, buttons: [{ label: '🎾 공놀이', act: () => { hideBubble(); ballGame(true); } }, { label: '🏓 하루 탁구', act: () => { hideBubble(); openPong(); } }, { label: '나중에', ghost: true }] });
}
function pongTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').replace(/\s+/g, ' ').trim();
  if (PONG.on && /^(게임\s*)?(끝|그만|종료|끝내|그만하자|탁구\s*(끝|그만))/.test(t)) { pongClose(); say('재미있었다! 또 하자 🏓', { ms: 3000 }); return true; }
  const f = t.match(/^(.{1,12}?)\s*(이랑|랑|하고|와|과)\s*(탁구|핑퐁)/);
  if (f) { const c = findPerson(f[1]); if (c && c.pk) { openPong(); pongInvite(c.pk); return true; } }
  if (/^(아무나|모르는\s*사람|다른\s*사람)(이랑|랑|하고|와|과)?\s*(탁구|핑퐁)/.test(t)) { openPong(); lobbyStart(); return true; }
  if (/^(하루|팻)(이랑|랑|하고|와|과)\s*(탁구|핑퐁)/.test(t)) { openPong('pet'); return true; }
  if (/^(우리\s*)?(하루\s*)?(탁구|핑퐁|팻\s*탁구)(\s*게임)?(\s*(하자|할래|해|시작|치자|쳐))?$/.test(t)) { openPong(); return true; }
  if (/^(탁구\s*)?(랭킹|순위)(\s*(보여|알려)\s*(줘)?)?$/.test(t)) { openPong(); pongRanking(); return true; }
  if (/^(우리\s*)?(게임\s*(하자|할래|해|하고\s*놀자|시작|뭐\s*있어)|게임)$/.test(t)) { gameMenu(); return true; }
  return false;
}
window.pongTalk = pongTalk;

// 🏓 하루 탁구 (11-09): 팻이 위에서 골키퍼처럼 좌우로 움직이며 받아 침 · 나는 아래에서 공을 손가락으로 밀어 쳐 올림
//  양옆 벽에 튕기면 각도가 바뀜 · 밀어 치면 빨라짐 · 11점 먼저(2점 차), 서브는 5점마다 바꿈 · 팻 실력은 점수 차에 따라 맞춰 막상막하
const PONG = { on: false };
const pongSnd = {};
function pongPlay(n, vol) {
  try { const a = (pongSnd[n] = pongSnd[n] || new Audio('sounds/pong_' + n + '.mp3')).cloneNode(); a.volume = vol == null ? 0.9 : vol; a.play().catch(() => { }); } catch { }
}
function openPong() {
  window.wantViewAt = Date.now(); { const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet; if (document.hidden && F && F.front) F.front().catch(() => { }); }
  hideBubble(); if (PONG.on) return;
  let ui = document.getElementById('pongUI');
  if (!ui) {
    ui = document.createElement('div'); ui.id = 'pongUI';
    ui.innerHTML = '<canvas id="pongCv"></canvas><div class="pgTop"><button class="pgX" id="pgX">✕</button><div class="pgScore" id="pgScore"></div><div class="pgRec" id="pgRec"></div></div><div class="pgMsg" id="pgMsg"></div>';
    document.body.appendChild(ui);
    ui.querySelector('#pgX').onclick = () => (window.haruBack ? haruBack() : pongClose());
  }
  ui.hidden = false; PONG.on = true; navPush(() => pongClose());
  if (typeof fmKeep === 'function') fmKeep(true);
  pongSetup(); pongNewGame();
  PONG.last = performance.now(); PONG.raf = requestAnimationFrame(pongLoop);
}
function pongClose() {
  PONG.on = false; cancelAnimationFrame(PONG.raf);
  const ui = document.getElementById('pongUI'); if (ui) ui.hidden = true;
  if (typeof fmKeep === 'function') fmKeep(false);
}
function pongSetup() {
  const cv = document.getElementById('pongCv'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  Object.assign(PONG, { cv, g, W, H, r: Math.max(9, W * 0.028), base: H / 1.9, petW: Math.min(120, W * 0.26), petY: 150 + (parseInt(getComputedStyle(document.body).paddingTop) || 0) });
  // 팻 그림 (지금 고른 동물)
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
function pongRec() { S.pong = S.pong || { win: 0, lose: 0, best: 0 }; return S.pong; }
function pongNewGame() {
  Object.assign(PONG, { me: 0, pet: 0, played: 0, rally: 0, petX: PONG.W / 2, petV: 0, aim: PONG.W / 2, mood: 'walk', moodT: 0, over: false });
  pongServe();
}
function pongServer() { return Math.floor(PONG.played / 5) % 2 === 0 ? 'me' : 'pet'; }   // 5점마다 서브 바꿈
function pongServe() {
  const who = pongServer(); PONG.rally = 0; PONG.state = who === 'me' ? 'serveMe' : 'servePet';
  PONG.ball = who === 'me' ? { x: PONG.W / 2, y: PONG.H - 150, vx: 0, vy: 0 } : { x: PONG.petX, y: PONG.petY + 60, vx: 0, vy: 0 };
  PONG.serveAt = performance.now();
  pongMsg(who === 'me' ? '내 서브! 공을 위로 쭉 밀어 올려 봐 ☝️' : `${bn()} 서브!`);
  pongScore();
}
function pongMsg(t, ms) { const e = document.getElementById('pgMsg'); if (!e) return; e.textContent = t; e.style.opacity = t ? 1 : 0; clearTimeout(PONG.msgT); if (t && ms) PONG.msgT = setTimeout(() => { e.style.opacity = 0; }, ms); }
function pongScore() {
  const e = document.getElementById('pgScore'); if (e) e.innerHTML = `<span>나</span><b>${PONG.me}</b><i>:</i><b>${PONG.pet}</b><span>${esc(bn())}</span>`;
  const r = pongRec(), q = document.getElementById('pgRec'); if (q) q.textContent = `${r.win}승 ${r.lose}패 · 최고 랠리 ${r.best}`;
}
// ── 손가락: 내 쪽(아래)으로 온 공을 누르면 받아 치고, 밀어 올리면 더 빠르게
function pongDown(e) {
  if (!PONG.on) return; e.preventDefault();
  if (PONG.over) { pongNewGame(); return; }
  const t = e.touches[0], x = t.clientX, y = t.clientY, b = PONG.ball;
  PONG.touch = { x, y, t: performance.now(), x0: x, y0: y, t0: performance.now(), hit: false };
  const near = Math.hypot(x - b.x, y - b.y) < PONG.r * 3.2 + 34;
  if (near && (PONG.state === 'serveMe' || (PONG.state === 'play' && b.vy > 0 && b.y > PONG.H * 0.45))) pongHitMe(0, 0);
}
function pongMove(e) {
  if (!PONG.on || !PONG.touch) return; e.preventDefault();
  const t = e.touches[0], T = PONG.touch, now = performance.now();
  const fvx = (t.clientX - T.x) / Math.max(8, now - T.t) * 1000, fvy = (t.clientY - T.y) / Math.max(8, now - T.t) * 1000;
  T.x = t.clientX; T.y = t.clientY; T.t = now;
  const b = PONG.ball;
  if (!T.hit) {   // 지나가는 공을 쓸어 올려도 맞음
    if (Math.hypot(T.x - b.x, T.y - b.y) < PONG.r * 3.2 + 30 && (PONG.state === 'serveMe' || (PONG.state === 'play' && b.vy > 0 && b.y > PONG.H * 0.45))) pongHitMe(fvx, fvy);
  } else if (now - T.t0 < 160 && fvy < -200) pongHitMe(fvx, fvy, true);   // 막 친 뒤 위로 밀면 속도 더
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
}
// ── 팻 실력: 기본 반반, 지고 있으면 잘하고 이기고 있으면 조금 느슨하게 (막상막하)
function pongSkill() { const d = PONG.me - PONG.pet; return Math.max(0.3, Math.min(0.82, 0.56 + d * 0.07)); }
function pongPredict() {   // 공이 팻 높이에 올 때 x (벽 튕김 포함)
  const b = PONG.ball; if (b.vy >= 0) return PONG.W / 2;
  const t = (b.y - (PONG.petY + 40)) / -b.vy; let x = b.x + b.vx * t; const L = PONG.r, R = PONG.W - PONG.r, w = R - L;
  x = ((x - L) % (2 * w) + 2 * w) % (2 * w); return L + (x > w ? 2 * w - x : x);
}
function pongLoop(now) {
  if (!PONG.on) return;
  const dt = Math.min(0.033, (now - PONG.last) / 1000); PONG.last = now;
  pongStep(dt, now); pongDraw(now);
  PONG.raf = requestAnimationFrame(pongLoop);
}
function pongStep(dt, now) {
  const b = PONG.ball, W = PONG.W, H = PONG.H, r = PONG.r;
  // 팻 움직임
  const s = pongSkill();
  if (PONG.state === 'play' && b.vy < 0 && b.y < H * 0.82) {
    if (PONG.aimFor !== PONG.rally) { PONG.aimFor = PONG.rally; const fast = Math.abs(b.vy) / PONG.base; const A = PONG.petW * (0.95 - 0.5 * s) * (1 + Math.max(0, fast - 1) * 0.3); PONG.err = (Math.random() - 0.5) * 2 * A; /* 놓칠 확률: 기본 약 15%, 팻이 이기면 더, 지면 덜 */ }
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
  if (PONG.state !== 'play') return;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * 0.97; b.vy *= 1.0; pongPlay('wall', 0.7); }
  if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx) * 0.97; pongPlay('wall', 0.7); }
  // 팻이 받아 치기
  const top = PONG.petY + 34;
  if (b.vy < 0 && b.y - r <= top && b.y - r > top - 40 && Math.abs(b.x - PONG.petX) < PONG.petW * 0.55) {
    const sp = Math.min(PONG.base * 2.3, Math.abs(b.vy) * (1.02 + Math.random() * 0.05));
    b.vy = sp; b.vx += ((b.x - PONG.petX) / PONG.petW) * PONG.base * 0.9 + (Math.random() - 0.5) * PONG.base * 0.2;
    b.vx = Math.max(-PONG.base * 1.1, Math.min(PONG.base * 1.1, b.vx));
    b.y = top + r; PONG.rally++; pongPlay('hit');
  }
  if (b.y < -r * 2) pongPoint('me');
  else if (b.y > H + r * 2) pongPoint('pet');
}
function pongPoint(who) {
  PONG.state = 'point'; PONG.played++;
  if (who === 'me') PONG.me++; else PONG.pet++;
  const r = pongRec(); if (PONG.rally > r.best) { r.best = PONG.rally; save(); }
  PONG.mood = who === 'me' ? 'sad' : 'joy'; PONG.moodT = performance.now() + 1400;
  pongPlay(who === 'me' ? 'point' : 'miss', 0.6);
  pongScore();
  const a = PONG.me, b = PONG.pet;
  if ((a >= 11 || b >= 11) && Math.abs(a - b) >= 2) {
    PONG.over = true; const meWin = a > b; meWin ? r.win++ : r.lose++; save(); pongScore();
    pongPlay(meWin ? 'win' : 'miss', 0.8);
    pongMsg(meWin ? `🎉 이겼어! ${a} : ${b}  (화면을 누르면 다시)` : `${bn()}가 이겼어! ${a} : ${b}  (화면을 누르면 다시)`);
    return;
  }
  pongMsg(who === 'me' ? '득점! 👏' : `${bn()} 득점!`, 1200);
  setTimeout(() => { if (PONG.on && !PONG.over) pongServe(); }, 1300);
}
function pongDraw(now) {
  const g = PONG.g, W = PONG.W, H = PONG.H, b = PONG.ball;
  // 탁구대
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1d5a8f'); gr.addColorStop(1, '#16466f'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.strokeRect(6, 6, W - 12, H - 12);
  g.setLineDash([10, 10]); g.beginPath(); g.moveTo(W / 2, 10); g.lineTo(W / 2, H - 10); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(6, H / 2 - 2, W - 12, 4);   // 네트
  // 내 쪽 표시
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(6, H * 0.45, W - 12, H * 0.55 - 6);
  // 팻
  const set = now < PONG.moodT ? PONG.img[PONG.mood] : Math.abs(PONG.petV) > 30 ? PONG.img.walk : PONG.img.front;
  const im = set && set[Math.floor(now / 90) % set.length];
  if (im && im.complete && im.naturalWidth) {
    const h = PONG.petW * 1.05, w = h * im.naturalWidth / im.naturalHeight, flip = set === PONG.img.walk && (PONG.petV > 0 ? PONG.face < 0 : PONG.face > 0);
    g.save(); g.translate(PONG.petX, PONG.petY - h / 2 + 30); if (flip) g.scale(-1, 1); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore();
  }
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(PONG.petX - PONG.petW / 2, PONG.petY + 34, PONG.petW, 4);   // 팻 라켓 자리
  // 공 (흰 공)
  g.beginPath(); g.ellipse(b.x + 4, b.y + 6, PONG.r, PONG.r * 0.6, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
  const bg = g.createRadialGradient(b.x - PONG.r * 0.4, b.y - PONG.r * 0.4, 1, b.x, b.y, PONG.r); bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#dfe6ee');
  g.beginPath(); g.arc(b.x, b.y, PONG.r, 0, Math.PI * 2); g.fillStyle = bg; g.fill();
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
  if (/^(우리\s*)?(하루\s*)?(탁구|핑퐁|팻\s*탁구)(\s*게임)?(\s*(하자|할래|해|시작|치자|쳐))?$/.test(t)) { openPong(); return true; }
  if (/^(우리\s*)?(게임\s*(하자|할래|해|하고\s*놀자|시작|뭐\s*있어)|게임)$/.test(t)) { gameMenu(); return true; }
  return false;
}
window.pongTalk = pongTalk;

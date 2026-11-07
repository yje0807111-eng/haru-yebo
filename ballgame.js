// 🎾 공 던지기 게임 (11-07): "게임하자" → 화면 위에 테니스 공, 손가락으로 밀어 던지면 팻이 물어 옴
async function ballGame(on) {
  const F = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.FloatPet;
  if (!F || !F.ballGame) { say('🎾 공 던지기는 갤럭시 앱에서<br>화면 위 팻이랑 할 수 있어요!', { ms: 4000 }); return; }
  if (on) say('🎾 공 던지기 하자!<br>화면 위로 나갈게!', { pose: 'joy', ms: 2500 });
  const r = await F.ballGame({ on }).catch(() => ({ ok: false }));
  if (on && !r.ok && r.why === 'perm') say('🐾 공 던지기를 하려면<br><b>"다른 앱 위에 표시"</b>를 먼저 켜 줘!', { ms: 8000, important: true, buttons: [{ label: '켜러 가기', act: () => { F.requestPermission(); hideBubble(); } }, { label: '나중에', ghost: true }] });
}
function ballTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').replace(/\s+/g, ' ').trim();
  if (/^(게임|공\s*놀이|공\s*던지기|공\s*놀이\s*게임)\s*(그만|끝|종료|멈춰|그만하자|끝내)/.test(t) || /^그만\s*놀자/.test(t)) { ballGame(false); return true; }
  if (/^(우리\s*)?(게임\s*(하자|할래|해|하고\s*놀자|시작)|공\s*던지기(\s*게임)?(\s*(하자|할래|해|시작))?|공\s*놀이(\s*(하자|할래|해))?|공\s*던지자|공\s*(가져와|물어\s*와)|공\s*놀자)$/.test(t)) { ballGame(true); return true; }
  return false;
}

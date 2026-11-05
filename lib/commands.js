// 강아지 명령 알아듣기 (말창·자비스 창·음성에서 같이 씀). 비슷한 말은 같은 동작으로 묶음
// 명령이면 AI에게 묻지 않고 바로 움직인다
const COMMANDS = [
  { id: 'sleep', re: /^(자자|자$|잘\s*자|코\s*자|잠자|자러\s*가|굿\s*나잇|잠\s*자)/, say: ['쿨쿨… 💤', '잘 자… 💤', '나 잔다~ 💤'] },
  { id: 'sit', re: /^(앉아|앉자|앉아\s*봐|싯|sit)/i, say: ['앉았어! 🐾', '착석 완료!', '나 잘 앉지?'] },
  { id: 'lie', re: /^(엎드려|엎드리|엎드려\s*봐|누워|누워\s*봐|몸\s*낮춰|낮춰)/, say: ['엎드렸어~', '살랑살랑 🐾', '편하다~'] },
  { id: 'playdead', re: /^(빵\s*야|빵|탕|옆으로\s*누워)/, say: ['으악~ 당했다! 😵', '빵! …(꼼짝)', '쿵!'] },
  { id: 'stand', re: /^(일어나|일어서|일어나\s*봐|기상)/, say: ['벌떡!', '일어났어!', '짠!'] },
  { id: 'wait', re: /^(기다려|멈춰|가만히|그만|스톱|stop|정지)/i, say: ['기다릴게!', '꼼짝 안 할게', '…(얌전)'] },
  { id: 'no', re: /^(안\s*돼|안돼|하지\s*마|노)/, say: ['히잉… 알겠어 🥺', '미안해…', '안 할게…'] },
  { id: 'quiet', re: /^(조용히|쉿|짖지\s*마|조용)/, say: ['쉿… 🤫', '조용히 있을게', '(소곤소곤)'] },
  { id: 'climb', re: /^(올라가|올라와|올라타|위로|창\s*위로|위에\s*올라)/, say: ['영차! 올라간다~', '폴짝!', '높은 데 좋아!'] },
  { id: 'jump', re: /^(점프|뛰어\s*올라|높이|폴짝)/, say: ['폴짝!', '점프!', '나 높이 뛰었지?'] },
  { id: 'down', re: /^(내려와|내려|아래로)/, say: ['내려왔어!', '쏙~', '착지!'] },
  { id: 'run', re: /^(뛰어|달려|뛰자|달리자|뛰어\s*봐|달려\s*봐)/, say: ['신난다~!', '다다다다!', '나 빠르지?'] },
  { id: 'follow', re: /^(따라와|따라\s*와|가자|같이\s*가|이리로\s*가)/, say: ['따라갈게! 🐾', '같이 가자~', '어디든 갈게!'] },
  { id: 'come', re: /^(이리\s*와|와\s*봐|일루\s*와|여기로\s*와|이리와|다가와)/, say: ['갈게!', '다다닥!', '왔어!'] },
  { id: 'back', re: /^(뒤로|물러나|비켜|저리\s*가)/, say: ['뒤로 뒤로~', '알겠어, 물러날게', '총총총…'] },
  { id: 'slow', re: /^(천천히|살살|느리게)/, say: ['천천히~ 사뿐사뿐', '느릿느릿~', '살금살금'] },
  { id: 'hide', re: /^(숨바꼭질|숨바꼭질\s*하자)/, say: ['나 어디 있게~?', '꼭꼭 숨어라~', '찾아 봐!'] },
  { id: 'call', re: /^$/, say: ['응? 불렀어? 🐶'] },   // 이름만 부를 때 (말창·목소리에서 직접 씀)
  { id: 'speak', re: /^(말해|말해\s*봐|말\s*좀\s*해|얘기해|대답해)$/, say: ['응! 나 여기 있어 🐶', '멍! 말해도 돼?', '불렀어? 헤헤'] },
  { id: 'bark', re: /^(짖어|짖어\s*봐|멍멍|왈왈|짖자)/, say: ['멍! 멍멍!', '왈왈!', '멍멍멍!'] },
  { id: 'roll', re: /^(굴러|구르|데굴|굴러\s*봐)/, say: ['데굴데굴~', '빙글빙글!', '어지러워~ 😵'] },
  { id: 'paw', re: /^(손|손\s*줘|앞발|악수|하이\s*파이브)/, say: ['여기 손! 🐾', '악수!', '하이 파이브!'] },
  { id: 'home', re: /^(홈으로|홈|집으로|집에\s*가|집$|돌아와|제자리)/, say: ['집에 갈게! 🏠', '말창 위가 제일 편해~', '집으로 쏙!'] },
  { id: 'free', re: /^(놀아|놀자|자유|나가\s*놀아|자유롭게|마음대로)/, say: ['신난다~ 놀러 간다! 🐾', '자유다~!', '다녀올게!'] },
  { id: 'spin', re: /^(돌아|빙글|한\s*바퀴|돌아\s*봐|몸\s*돌려)/, say: ['빙그르르~', '한 바퀴!', '어지러워~'] },
  { id: 'stretch', re: /^(기지개|스트레칭)/, say: ['으아~ 시원하다', '쭈욱~'] },
  { id: 'drink', re: /^(물\s*먹자|물\s*마시자|물\s*먹어|물\s*마셔|물\s*줄까|물\s*먹을래|물)$/, say: ['꿀꺽꿀꺽~ 💧', '시원하다!', '물 맛있어~'] },
  { id: 'dance', re: /^(춤|춤\s*춰|춤\s*춰\s*봐|춤추자|댄스|흔들어|신나게|노래\s*해)/, say: ['룰루랄라~ 🎵', '신난다~ 둠칫둠칫 🎶', '내 춤 어때? 🎵'] },
  { id: 'snack', re: /^(간식|과자|쿠키|개껌|육포|츄르|까까|맛있는\s*거)/, say: ['와~ 간식이다! 🍪', '냠냠 바삭바삭~ 🍪', '간식 최고! 고마워 💛'] },
  { id: 'meal', re: /^(밥\s*먹자|밥\s*먹어|밥\s*줄까|밥\s*먹을래|사료|맘마|밥$)/, say: ['냠냠냠! 🍚', '밥 최고!', '와 밥이다~!'] },
  { id: 'brush', re: /^(양치하자|양치해|양치질하자|양치질|양치|이\s*닦자|이\s*닦아|치카치카|치카)/, say: ['치카치카~ 🪥', '이 반짝반짝!', '뽀득뽀득~'] },
  { id: 'wash', re: /^(세수하자|세수해|세수|얼굴\s*씻자|얼굴\s*닦자|씻자)/, say: ['어푸어푸~ 💦', '세수 끝! 반짝', '시원하다~'] },
  { id: 'crawl', re: /^(기어|기어가|기어\s*와|기어\s*봐|엉금|포복)/, say: ['엉금엉금~', '낮은 자세로 출발!', '살금살금 기어간다~'] },
  { id: 'laugh', re: /^(웃어|웃어봐|웃자|활짝|스마일|하하|깔깔|헤헤)/, say: ['헤헤헤~ 😆', '까르르~!', '나 웃는 거 예쁘지? 😄'] },
  { id: 'wink', re: /^(윙크|잉크|윙크해|찡긋)/, say: ['찡긋~ 😉', '윙크 받아라~', '헤헤 😉'] },
  { id: 'good', re: /^(잘했어|착하다|착하지|최고|예쁘다|귀여워|사랑해|이뻐)/, say: ['헤헤 💛', '나도 사랑해!', '칭찬 고마워 💛'] },
];

function findCommand(text) {
  let t = String(text || '').trim().replace(/^((다루|강아지|얘)[야아,\s!]*|(야|자)[,\s!]+)/, '').replace(/[!~.?\s]+$/, '');
  // "왼쪽으로 굴러" / "오른쪽으로 뛰어" 처럼 방향이 붙으면 따로 기억
  let dir = 0;
  const m = t.match(/^(왼쪽|왼편|좌)(으로|로)?\s*/) || t.match(/^(오른쪽|오른편|우)(으로|로)?\s*/);
  if (m) { dir = /^(왼|좌)/.test(m[1]) ? -1 : 1; t = t.slice(m[0].length); }
  if (!t || t.length > 14) return null;              // 긴 말은 대화로
  const c = COMMANDS.find(c => c.re.test(t));
  return c ? { ...c, dir } : null;
}

// 말로 한 말: 이름을 잘못 알아들은 것(다리야·달루야…)도 이름으로 보고, 여러 마디 중 명령을 찾는다
let NAME_RE = /(다루|다리|달루|달우|다르|타루|다롱)(야|아|이|씨)?[,!\s]*/g;
const DARU_ALT = ['다루', '다리', '달루', '달우', '다르', '타루', '다롱'];
function setBuddyName(n) {
  n = String(n || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const alt = n && !DARU_ALT.includes(n) ? [n, ...DARU_ALT] : DARU_ALT;
  NAME_RE = new RegExp(`(${alt.join('|')})(야|아|이|씨)?[,!\\s]*`, 'g');
}
// "아지" → "아지야", "별" → "별아"
function callName(n) { n = String(n || '다루'); const c = n.charCodeAt(n.length - 1) - 0xAC00; return n + (c >= 0 && c < 11172 && c % 28 ? '아' : '야'); }
// 말 앞의 이름 부르기 떼기: "아지야, 몇 시야" → "몇 시야"
function stripName(t) { return String(t || '').replace(new RegExp('^\\s*' + NAME_RE.source), '').trim(); }
function cleanVoice(text) { return String(text || '').replace(NAME_RE, ' ').replace(/\s+/g, ' ').trim(); }
function findVoiceCommand(text) {
  const parts = String(text || '').split(/[,.!?~]+/).map(cleanVoice).filter(Boolean);
  let found = null;
  // 명령 낱말이 거의 전부일 때만 (노래→'노', 자전거→'자' 처럼 잘못 알아듣지 않게)
  const whole = t => { const c = findCommand(t); if (!c) return null; const x = t.replace(/^(왼쪽|왼편|좌|오른쪽|오른편|우)(으로|로)?\s*/, ''); const m = x.match(c.re); if (!m) return null; const rest = x.replace(/\s/g, '').slice(m[0].replace(/\s/g, '').length); return /^(|봐|봐요|요|줘|줘요|라|자)$/.test(rest) ? c : null; };
  for (const p of parts) {
    let c = whole(p);
    if (!c) { const w = p.split(' '); for (let i = 0; i < w.length && !c; i++) for (let j = w.length; j > i && !c; j--) c = whole(w.slice(i, j).join(' ')); }
    if (c) found = c;
  }
  if (!found) found = fuzzyCommand(parts);   // 조금 틀리게 받아써도 (점부→점프, 안자→앉아)
  return found;   // 마지막으로 말한 명령
}

// ── 비슷한 말 알아듣기: 한글을 자음·모음으로 풀어서 얼마나 다른지 잰다
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
function jamo(t) {
  let o = '';
  for (const ch of String(t).replace(/\s/g, '')) {
    const c = ch.charCodeAt(0) - 0xAC00;
    if (c < 0 || c > 11171) { o += ch; continue; }
    o += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + (c % 28 ? JONG[c % 28] : '');
  }
  return o;
}
function editDist(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// 명령마다 알아듣는 낱말 목록 (정규식에서 뽑음)
let KW = null;
function keywords() {
  if (KW) return KW;
  KW = [];
  for (const c of COMMANDS) {
    const m = c.re.source.match(/^\^\((.*)\)$/); if (!m) continue;
    for (const w of m[1].split('|')) { const k = w.replace(/\\s\*/g, ''); if (/^[가-힣]{2,4}$/.test(k)) KW.push({ k, j: jamo(k), c }); }
  }
  return KW;
}
function fuzzyCommand(parts) {
  let best = null;
  for (const p of parts) {
    // 한 마디짜리 짧은 말일 때만 (긴 말 속 낱말은 잘못 알아듣기 쉬움: 노래 불러 → 굴러)
    for (const w of [p.replace(/\s/g, '')]) {
      if (w.length > 4) continue;
      const x = w.replace(/(봐|봐요|요|줘|줘요)$/, '');
      if (x.length < 2 || x.length > 4) continue;
      const jx = jamo(x);
      for (const e of keywords()) {
        if (Math.abs(e.k.length - x.length) > 1) continue;
        const dd = editDist(jx, e.j), lim = e.j.length <= 4 ? 1 : 2;   // 짧은 말은 한 글자만 틀려도 됨
        if (dd <= lim && (!best || dd < best.d)) best = { d: dd, c: e.c };
      }
    }
  }
  return best ? { ...best.c, dir: 0 } : null;
}

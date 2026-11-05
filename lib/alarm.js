(function () {
// 말창 시간·알람 알아듣기 — "지금 몇 시야", "내일 7시에 깨워 줘", "30분 뒤에 알려 줘", "매일 아침 7시에 깨워 줘"
const NATIVE = { 한: 1, 두: 2, 세: 3, 석: 3, 네: 4, 넉: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열한: 11, 열두: 12 };
const SINO = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
function num(s) {
  if (s == null || s === '') return null;
  s = String(s).trim();
  if (/^\d+$/.test(s)) return +s;
  if (NATIVE[s] != null) return NATIVE[s];
  // 한자어 숫자: 삼십, 십오, 이십오 …
  const m = s.match(/^([일이삼사오육칠팔구])?(십)?([일이삼사오육칠팔구])?$/);
  if (m && (m[1] || m[2] || m[3])) {
    if (!m[2]) return m[1] && !m[3] ? SINO[m[1]] : null;
    return (m[1] ? SINO[m[1]] : 1) * 10 + (m[3] ? SINO[m[3]] : 0);
  }
  return null;
}
const N = '(\\d{1,3}|열한|열두|한|두|세|석|네|넉|다섯|여섯|일곱|여덟|아홉|열|[일이삼사오육칠팔구]?십?[일이삼사오육칠팔구]?)';
const TRIGGER = /(알람|알림|알려|깨워|짖어|불러|말해\s*줘|챙겨|일러|리마인드)/;
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function fmtTime(d) {
  const h = d.getHours(), m = d.getMinutes();
  const part = h < 5 ? '새벽' : h < 12 ? '아침' : h === 12 ? '낮' : h < 18 ? '오후' : '저녁';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${part} ${h12}시${m ? ' ' + m + '분' : ''}`;
}
function fmtWhen(d, now) {
  now = now || new Date();
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - day0) / 864e5);
  const dayWord = diff === 0 ? '오늘' : diff === 1 ? '내일' : diff === 2 ? '모레' : `${d.getMonth() + 1}월 ${d.getDate()}일(${DAYS[d.getDay()]})`;
  return `${dayWord} ${fmtTime(d)}`;
}

// 지금 시간·날짜 묻기
function timeAnswer(text, now) {
  now = now || new Date();
  if (TRIGGER.test(text) && !/(시간|몇\s*시).*(알려\s*줘|알려\s*줄래)$/.test(text.replace(/[?!.~\s]+$/, ''))) {
    if (/(시|분)\s*(에|뒤|후|있다가)/.test(text)) return null;   // "7시에 알려 줘" 는 알람
  }
  const askTime = /(지금\s*)?몇\s*시(야|지|예요|에요|니|냐|인지|쯤)?|시간\s*(이|좀)?\s*(어떻게|알려|몇|뭐)|지금\s*시간/.test(text) && !/(시에|시\s*반에|시간\s*(뒤|후)|분\s*(뒤|후))/.test(text);
  const askDate = /(오늘|지금)?\s*(며칠|몇\s*월\s*몇\s*일|몇\s*일이|날짜)|무슨\s*요일|몇\s*요일|요일\s*(이|알려)/.test(text);
  if (!askTime && !askDate) return null;
  const date = `${now.getMonth() + 1}월 ${now.getDate()}일 ${DAYS[now.getDay()]}요일`;
  const time = fmtTime(now).replace('아침', '오전');
  if (askTime && askDate) return `오늘은 ${date}, 지금은 ${time}이야 🕒`;
  if (askDate) return `오늘은 ${now.getFullYear()}년 ${date}이야 📅`;
  return `지금은 ${time}이야 🕒`;
}

// 알람 말 알아듣기 → { at: ms, daily, label, kind } 또는 null
function parseAlarm(text, now) {
  now = now || new Date();
  const s = text.replace(/\s+/g, ' ').trim();
  if (!TRIGGER.test(s)) return null;
  const kind = /깨워|일어나/.test(s) ? 'wake' : 'remind';
  const daily = /(매일|날마다|맨날|매일매일|아침마다|저녁마다|밤마다)/.test(s);
  let at = null, used = '';

  // ① 몇 시간·몇 분 뒤
  const rel = s.match(new RegExp(`(?:${N}\\s*시간\\s*)?(?:(${'\\d{1,3}|[일이삼사오육칠팔구]?십?[일이삼사오육칠팔구]?'})\\s*분|(반))?\\s*(뒤|후|있다가|지나서)`));
  if (rel && (rel[1] || rel[2] || rel[3])) {
    const h = rel[1] ? num(rel[1]) : 0, m = rel[2] ? num(rel[2]) : rel[3] ? 30 : 0;
    if ((h || m) && h != null && m != null) { at = new Date(now.getTime() + (h * 60 + m) * 60e3); used = rel[0]; }
  }
  // ② 몇 시 (몇 분 / 반)
  if (!at) {
    const re = new RegExp(`(오늘|내일|낼|모레|글피)?\\s*(새벽|아침|오전|낮|점심|오후|저녁|밤)?\\s*${N}\\s*시(?:\\s*(?:(\\d{1,2}|[일이삼사오육칠팔구]?십?[일이삼사오육칠팔구]?)\\s*분|(반)))?`);
    const m = s.match(re);
    if (m) {
      let h = num(m[3]); const mi = m[4] ? num(m[4]) : m[5] ? 30 : 0;
      if (h == null || h > 24 || mi == null || mi > 59) return null;
      const dayWord = m[1], part = m[2];
      if (part && /(오후|저녁|밤)/.test(part) && h < 12) h += 12;
      if (part === '밤' && h === 24) h = 0;
      if (part && /(새벽|아침|오전)/.test(part) && h === 12) h = 0;
      if ((part === '낮' || part === '점심') && h < 7) h += 12;
      const add = dayWord === '내일' || dayWord === '낼' ? 1 : dayWord === '모레' ? 2 : dayWord === '글피' ? 3 : 0;
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add);
      const mk = hh => new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mi, 0);
      if (part || h > 12 || h === 0) {
        at = mk(h % 24);
        if (!add && at <= now) at = new Date(at.getTime() + 864e5);
      } else if (add) {
        // 내일·모레 + 오전/오후 없음: 깨우기는 오전, 1~6시는 오후로
        at = mk(kind === 'wake' ? (h === 12 ? 12 : h) : (h >= 1 && h <= 6 ? h + 12 : h));
      } else {
        // 오늘 + 오전/오후 없음: 지금 뒤로 가장 가까운 시각
        const c = (kind === 'wake' ? [mk(h % 12), new Date(mk(h % 12).getTime() + 864e5)] : [mk(h % 12), mk((h % 12) + 12)]).filter(d => d > now).sort((a, b) => a - b);
        at = c[0] || new Date(mk(kind === 'wake' ? h % 12 : (h % 12) + 12).getTime() + 864e5);
      }
      used = m[0];
    }
  }
  if (!at) return null;
  // 무엇을 알려 줄지: 시간 말·부탁 말을 빼고 남은 말
  let label = s.replace(used, ' ')
    .replace(/(다루|다리|달루)(야|아)?[,\s]*/g, ' ')
    .replace(/(매일매일|매일|날마다|맨날|아침마다|저녁마다|밤마다)/g, ' ')
    .replace(/(알람|알림)\s*(좀\s*)?(맞춰|해|설정해|켜)?\s*(줘|줄래|주라|줘요)?/g, ' ')
    .replace(/(크게\s*)?(짖어서\s*)?(알려|깨워|짖어|불러|말해|챙겨|일러)\s*(줘|줄래|주라|줘요|주세요|줄\s*수\s*있어)?/g, ' ')
    .replace(/^\s*(에|에는)\s+/, ' ').replace(/\s+(에|에는)\s*$/, '')
    .replace(/[?!.~]+/g, ' ').replace(/\s+/g, ' ').trim();
  label = label.replace(/^(에|에는)\s*/, '').trim();
  if (label.length < 2) label = '';
  return { at: at.getTime(), daily, label, kind };
}

// 울릴 때 할 말: "병원 가라고" → "병원 가라고 했지!", "운동" → "운동 시간이야!"
function alarmLine(a, d) {
  const t0 = fmtTime(d || new Date(a.at)), t = t0 + (t0.endsWith('분') ? '이' : '');
  if (!a.label) return a.kind === 'wake' ? `⏰ ${t}야! 일어나~ 멍멍!` : `⏰ ${t}야! 멍멍!`;
  if (/(라고|자고|다고|냐고)$/.test(a.label)) return `⏰ ${t}야! ${a.label} 했지? 멍멍!`;
  return `⏰ ${t}야! ${a.label} 시간이야! 멍멍!`;
}
const ALARM_LIST = /(알람|알림)\s*(뭐|목록|몇\s*개|있어|보여|확인)/;
const ALARM_CANCEL = /(알람|알림)\s*(을|를|은|는)?\s*(다\s*)?(꺼|끄|취소|지워|없애|빼|그만)/;
const ALARM_STOP = /^(그만|그만해|그만\s*짖어|일어났어|알았어|알겠어|됐어|조용|조용히\s*해|조용해|시끄러워|짖지\s*마|멈춰|꺼|끄자|알람\s*꺼|스톱|stop|ㅇㅋ|오케이)[!~.\s]*$/i;

const api = { alarmLine, parseAlarm, timeAnswer, fmtWhen, fmtTime, num, ALARM_LIST, ALARM_CANCEL, ALARM_STOP };
if (typeof module !== 'undefined') module.exports = api; else window.HA = api;
})();

// ⛪ 찬양·말씀 (11-07): 찬송가 N장 · 성경 낭독(66권) · 복음성가 — 유튜브에서 찾아 뮤직방에서 들려줌
const BIBLE = ['창세기', '출애굽기', '레위기', '민수기', '신명기', '여호수아', '사사기', '룻기', '사무엘상', '사무엘하', '열왕기상', '열왕기하', '역대상', '역대하', '에스라', '느헤미야', '에스더', '욥기', '시편', '잠언', '전도서', '아가', '이사야', '예레미야', '예레미야애가', '에스겔', '다니엘', '호세아', '요엘', '아모스', '오바댜', '요나', '미가', '나훔', '하박국', '스바냐', '학개', '스가랴', '말라기',
  '마태복음', '마가복음', '누가복음', '요한복음', '사도행전', '로마서', '고린도전서', '고린도후서', '갈라디아서', '에베소서', '빌립보서', '골로새서', '데살로니가전서', '데살로니가후서', '디모데전서', '디모데후서', '디도서', '빌레몬서', '히브리서', '야고보서', '베드로전서', '베드로후서', '요한일서', '요한이서', '요한삼서', '유다서', '요한계시록'];
const BIBLE_SHORT = { 창: '창세기', 출: '출애굽기', 마태: '마태복음', 마가: '마가복음', 누가: '누가복음', 요한: '요한복음', 행전: '사도행전', 로마: '로마서', 계시록: '요한계시록', 시: '시편', 잠: '잠언', 애가: '예레미야애가', 고전: '고린도전서', 고후: '고린도후서', 롬: '로마서' };
let wNow = null;   // { kind: 'hymn'|'bible'|'gospel', n, book, ch, q, label }
function wPlayer(ids, label, info) {
  stopOthers('yt');
  const M = window.mYT = { ids, i: 0, label };
  wNow = info;
  if (typeof drawMusic === 'function') { if (typeof tvFront === 'function') tvFront(); hideBubble(); petOnly(false); mTab = 'worship'; go('music'); drawMusic(); }
  setPose('dance'); P.until = performance.now() + 6000;
}
function wPick(list, ok) { return list.filter(v => !v.live && ok(v)); }
async function hymnPlay(n) {
  tvFront && tvFront(); say(`⛪ 찬송가 ${n}장 찾는 중…`, { ms: 3000 });
  const re = new RegExp(`(^|[^0-9])${n}\\s*장`);
  let r = wPick(await ytFind(`새찬송가 ${n}장`), v => re.test(v.title) && /찬송/.test(v.title));
  if (!r.length) r = wPick(await ytFind(`찬송가 ${n}장 찬양`), v => re.test(v.title));
  if (!r.length) { say(`찬송가 ${n}장을 못 찾았어 🥲`, { ms: 3500, important: true }); return; }
  const short = r.filter(v => /^\d{1,2}:\d{2}$/.test(v.len) && +v.len.split(':')[0] < 12);   // 한 곡짜리 먼저
  const v = (short[0] || r[0]);
  wPlayer([v.id], `⛪ 찬송가 ${n}장`, { kind: 'hymn', n });
  say(`⛪ 찬송가 ${n}장<br><span class="small">${esc(v.title.slice(0, 50))} · "다음 장" 이라고 말해 줘</span>`, { ms: 4000 });
}
async function biblePlay(book, ch) {
  tvFront && tvFront(); say(`📖 ${book} ${ch}장 찾는 중…`, { ms: 3000 });
  const re = new RegExp(`${book}\\s*${ch}\\s*장`);
  let r = wPick(await ytFind(`${book} ${ch}장 성경 낭독`), v => re.test(v.title.replace(/\s+/g, ' ')));
  if (!r.length) r = wPick(await ytFind(`${book} ${ch}장 듣기 개역개정`), v => v.title.includes(book) && new RegExp(`(^|[^0-9])${ch}\\s*장`).test(v.title));
  if (!r.length) { say(`${book} ${ch}장 낭독을 못 찾았어 🥲`, { ms: 3500, important: true }); return; }
  const one = r.find(v => /^\d{1,2}:\d{2}$/.test(v.len) && !new RegExp(ch + '\\s*[-~]').test(v.title)) || r[0];   // 한 장짜리 먼저
  wPlayer([one.id], `📖 ${book} ${ch}장`, { kind: 'bible', book, ch });
  say(`📖 ${book} ${ch}장<br><span class="small">${esc(one.title.slice(0, 50))} · "다음 장" 이라고 말해 줘</span>`, { ms: 4000 });
}
async function gospelPlay(q) {
  tvFront && tvFront(); say(`🎶 ${q ? '"' + esc(q) + '" ' : ''}복음성가 찾는 중…`, { ms: 3000 });
  const r = wPick(await ytFind(`복음성가 ${q || '찬양 모음'}`), v => /^\d{1,2}:\d{2}$/.test(v.len) || /^\d:\d{2}:\d{2}$/.test(v.len));
  if (!r.length) { say('복음성가를 못 찾았어 🥲', { ms: 3500, important: true }); return; }
  wPlayer(r.slice(0, 20).map(v => v.id), `🎶 복음성가${q ? ' · ' + q : ''}`, { kind: 'gospel', q });
  say(`🎶 복음성가 ${Math.min(20, r.length)}곡 틀게! "다음 곡" 이라고 말해 줘`, { ms: 3500 });
}
// ⛪ 제목으로 찬송가 찾기: "찬송가 나 같은 죄인 살리신" → 그 장 번호까지 알아내서 틀기 ("다음 장"도 됨)
async function hymnTitle(q) {
  tvFront && tvFront(); say(`⛪ 찬송가 "${esc(q)}" 찾는 중…`, { ms: 3000 });
  const nq = norm(q);
  const r = wPick(await ytFind(`새찬송가 ${q}`), v => /찬송/.test(v.title) && /\d{1,3}\s*장/.test(v.title));
  const hit = r.filter(v => norm(v.title).includes(nq) || (nq.length >= 4 && norm(v.title).includes(nq.slice(0, 4))));
  const v = hit.find(v => /^\d{1,2}:\d{2}$/.test(v.len) && +v.len.split(':')[0] < 12) || hit[0];
  if (!v) { say(`찬송가 "${esc(q)}"를 못 찾았어 🥲 장 번호로 말해 줘`, { ms: 3500, important: true }); return; }
  const n = +(v.title.match(/(\d{1,3})\s*장/) || [])[1] || 0;
  wPlayer([v.id], `⛪ 찬송가 ${n ? n + '장 ' : ''}${q}`, n ? { kind: 'hymn', n } : null);
  say(`⛪ 찬송가 ${n ? n + '장 ' : ''}<br><span class="small">${esc(v.title.slice(0, 50))}${n ? ' · "다음 장" 이라고 말해 줘' : ''}</span>`, { ms: 4000 });
}
function wStop() { window.mYT = null; wNow = null; document.querySelectorAll('.mytp').forEach(e => e.remove()); }
function wNext(d) {
  if (!wNow) return false;
  if (wNow.kind === 'hymn') { hymnPlay(Math.max(1, Math.min(645, wNow.n + d))); return true; }
  if (wNow.kind === 'bible') { biblePlay(wNow.book, Math.max(1, wNow.ch + d)); return true; }
  if ((wNow.kind === 'gospel' || wNow.kind === 'yt') && window.mYT) { mYT.i = Math.max(0, Math.min(mYT.ids.length - 1, mYT.i + d)); drawMusic(); return true; }
  return false;
}
// 한글 숫자 "삼백오" → 305
function korNum(x) { const D = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 }; let n = 0, cur = 0; for (const c of x) { if (D[c]) cur = D[c]; else if (c === '십') { n += (cur || 1) * 10; cur = 0; } else if (c === '백') { n += (cur || 1) * 100; cur = 0; } } return n + cur; }
// 말 알아듣기
function worshipTalk(text) {
  const t = stripName(text).replace(/[?!.~]+$/g, '').trim();
  if (/(꺼|끄|끝|그만|멈춰|멈춤|정지|중지|스톱)/.test(t)) return false;   // 끄는 말은 노래 쪽에서 (전부 끄기)
  const num = x => /^\d+$/.test(x) ? +x : korNum(x);
  const h = t.match(/^(?:새\s*)?찬송가?\s*(\d{1,3}|[일이삼사오육칠팔구백십]{1,5})\s*장/) || t.match(/^찬송\s*(\d{1,3})\s*장/);
  if (h) { const n = num(h[1]); if (n >= 1 && n <= 645) { hymnPlay(n); return true; } }
  const ht = t.match(/^(?:새\s*)?찬송가?\s+(.+?)\s*(?:좀\s*)?(?:틀어|들려|켜|불러)?\s*(?:줘|줄래|주라|주세요)?$/) || t.match(/^(.+?)\s*(?:새\s*)?찬송가?\s*(?:좀\s*)?(?:틀어|들려|켜|불러)\s*(?:줘|줄래|주라|주세요)?$/);
  if (ht && ht[1].length >= 2 && !/^(\d|다음|이전)/.test(ht[1])) { hymnTitle(ht[1].trim()); return true; }
  const names = BIBLE.concat(Object.keys(BIBLE_SHORT)).sort((a, b) => b.length - a.length).join('|');
  const b = t.match(new RegExp(`^(?:성경\\s*)?(${names})\\s*(\\d{1,3}|[일이삼사오육칠팔구백십]{1,5})\\s*장`));
  if (b) { const book = BIBLE_SHORT[b[1]] || b[1], ch = num(b[2]); if (ch >= 1) { biblePlay(book, ch); return true; } }
  if (/^(복음\s*성가|ccm|씨씨엠|찬양)/i.test(t) || /(복음\s*성가|ccm|찬양)\s*(좀\s*)?(틀어|들려|켜|듣고)/i.test(t)) { const q = t.replace(/(복음\s*성가|ccm|씨씨엠|찬양|틀어|들려|켜|줘|줄래|좀|모음)/gi, ' ').replace(/\s+/g, ' ').trim(); gospelPlay(q); return true; }
  if (wNow && /^(다음\s*(장|곡|찬송|노래)|넘겨)/.test(t)) return wNext(1);
  if (wNow && /^(이전|앞)\s*(장|곡|찬송)/.test(t)) return wNext(-1);
  return false;
}

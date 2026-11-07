"""하루 예보 TV방 기본 채널 순위 만들기 (매일 GitHub 에서 저절로 돌아감)
1) 주제마다 유튜브 '채널' 검색 → 구독자 많은 순
2) 주제 순위 = 그 주제 상위 5개 채널 구독자 합 (사람들이 많이 보는 주제일수록 위로) → 1번·2번… 채널
3) tv.json 으로 저장 → 앱이 열 때 받아서 합침 (사용자가 바꾼 순서·주소는 그대로)
사용: python yt_rank.py <tv.json 경로>"""
import urllib.request, urllib.parse, re, json, sys, io, time
try: sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
except Exception: pass
Q = {
 '뮤직영상': ['케이팝 뮤직비디오', '가요 뮤직비디오'],
 '예능': ['예능', '예능 클립'],
 '개그': ['개그 코미디', '웃긴 영상 코미디'],
 '영화': ['영화 리뷰', '영화 요약'],
 '먹방': ['먹방', '맛집 먹방'],
 '게임': ['게임 방송', '게임 유튜버'],
 '키즈': ['키즈 동요', '어린이 만화'],
 '스포츠': ['스포츠 하이라이트', '축구 야구'],
 '요리': ['요리 레시피', '집밥 요리'],
 '동물': ['강아지 고양이', '동물 채널'],
 '뉴스': ['뉴스', '방송 뉴스'],
 '춤': ['댄스 커버', '안무 댄스'],
 '여행': ['여행 브이로그', '해외여행'],
 '운동': ['홈트레이닝', '운동 건강'],
 '드라마': ['드라마 클립', '드라마 하이라이트'],
 '짤': ['예능 레전드', '웃긴 짤'],
 '낚시': ['낚시', '바다낚시'],
 '도서': ['책 리뷰', '책 읽어주는'],
}
SKIP = ['하이파이브 : LA']   # 주제와 맞지 않는 채널
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36'
def num(s):
    s = s.replace(',', '').replace('구독자', '').replace('명', '').strip()
    m = re.match(r'([\d.]+)\s*(억|만|천)?', s)
    if not m: return 0
    v = float(m.group(1)); u = m.group(2)
    return v * (1e8 if u == '억' else 1e4 if u == '만' else 1e3 if u == '천' else 1)
def search(q):
    url = 'https://www.youtube.com/results?search_query=' + urllib.parse.quote(q) + '&sp=EgIQAg%253D%253D&hl=ko&gl=KR'
    t = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', 'Cookie': 'CONSENT=YES+1; PREF=hl=ko&gl=KR'}), timeout=25).read().decode('utf-8', 'ignore')
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', t)
    if not m: return []
    d = json.loads(m.group(1)); out = []
    def walk(o):
        if isinstance(o, dict):
            if 'channelRenderer' in o:
                c = o['channelRenderer']; title = c.get('title', {}).get('simpleText', '').strip()
                subs = ''
                for k in ('videoCountText', 'subscriberCountText'):
                    v = (c.get(k) or {}).get('simpleText', '')
                    if '구독자' in v: subs = v
                thumb = ((c.get('thumbnail') or {}).get('thumbnails') or [{}])[-1].get('url', '')
                if thumb.startswith('//'): thumb = 'https:' + thumb
                out.append({'id': c['channelId'], 'name': title, 'subs': subs, 'n': num(subs), 'image': thumb})
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d); return out
def main(path):
    old = {}
    try: old = json.load(open(path, encoding='utf-8'))
    except Exception: pass
    res, score = {}, {}
    used = set()
    for cat, qs in Q.items():
        seen = {}
        for q in qs:
            try:
                for c in search(q): seen.setdefault(c['id'], c)
            except Exception as e: print('검색 실패', q, e)
            time.sleep(1.5)
        top = sorted(seen.values(), key=lambda c: -c['n'])
        top = [c for c in top if c['n'] >= 1e5 and (re.search(r'[가-힣]', c['name']) or re.search(r'MBC|KBS|SBS|YTN|JTBC|EBS|tvN|Mnet', c['name']))]
        top = [c for c in top if c['id'] not in used and not any(k in c['name'] for k in SKIP)][:5]   # 같은 채널이 여러 주제에 겹치지 않게
        used.update(c['id'] for c in top)
        res[cat] = top; score[cat] = sum(c['n'] for c in top)
        print(cat, round(score[cat] / 1e4), '만', [c['name'] for c in top])
    if sum(len(v) for v in res.values()) < 20:   # 검색이 막혔으면 예전 목록 그대로
        print('채널을 거의 못 찾아서 예전 목록을 그대로 둠'); return
    cats = sorted([c for c in res if res[c]], key=lambda c: -score[c])
    out = {'ver': time.strftime('%Y%m%d%H%M'), 'note': '하루 예보 TV방 기본 채널 — 주제 순위 = 상위 채널 구독자 합, 채널 순위 = 구독자 순 (매일 새로 고침)',
           'cats': cats, 'rank': {c: i + 1 for i, c in enumerate(cats)}, 'score': {c: int(score[c]) for c in cats},
           'chans': [{'kind': 'channel', 'list': 'UU' + c['id'][2:], 'id': c['id'], 'name': c['name'], 'cat': cat, 'image': c['image'], 'subs': c['subs'], 'rank': i + 1, 'def': True}
                     for cat in cats for i, c in enumerate(res[cat])]}
    json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('주제 순위:', ' · '.join(f'{i+1}.{c}' for i, c in enumerate(cats)), '/ 채널', len(out['chans']))
if __name__ == '__main__': main(sys.argv[1])

// 앱 파일(APK)로 깔았을 때만 쓰는 휴대폰 기능: 닫혀 있어도 알람 알림 · 연락처(생일까지) · 말 알아듣기
(function () {
  const C = window.Capacitor; if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const Pl = C.Plugins || {};
  const N = window.Native = {};
  // ⏰ 알람: 휴대폰 알림으로 예약 (앱이 꺼져 있어도 울림)
  N.schedule = async alarms => {
    const LN = Pl.LocalNotifications; if (!LN) return;
    try {
      await LN.requestPermissions();
      const pend = await LN.getPending(); if (pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
      const list = (alarms || []).filter(a => a.at > Date.now()).slice(0, 60).map((a, i) => ({
        id: 1000 + i, title: '⏰ 하루 예보', body: HA.alarmLine(a).replace(/<[^>]+>/g, ''),
        schedule: a.daily ? { on: { hour: new Date(a.at).getHours(), minute: new Date(a.at).getMinutes() }, allowWhileIdle: true } : { at: new Date(a.at), allowWhileIdle: true },
        sound: null, extra: { id: a.id },
      }));
      if (list.length) await LN.schedule({ notifications: list });
    } catch (e) { console.warn('알림', e); }
  };
  // 📒 연락처: 한 번 허락하면 이름·번호·주소·생일까지
  N.contacts = async () => {
    const CT = Pl.Contacts; if (!CT) return null;
    const p = await CT.requestPermissions(); if (p.contacts !== 'granted') return [];
    const r = await CT.getContacts({ projection: { name: true, phones: true, birthday: true, postalAddresses: true } });
    return (r.contacts || []).map(c => ({
      name: (c.name && (c.name.display || [c.name.family, c.name.given].filter(Boolean).join(''))) || ((c.phones || [])[0] || {}).number || '이름 없음',
      phones: (c.phones || []).map(x => ({ type: '휴대폰', num: fmtPhone(x.number || '') })).filter(x => x.num),
      addr: ((c.postalAddresses || [])[0] || {}).street || '',
      bday: c.birthday && c.birthday.month ? { m: c.birthday.month, d: c.birthday.day } : null,
    }));
  };
  // 🎤 말 알아듣기
  N.listen = async () => {
    const SR = Pl.SpeechRecognition; if (!SR) return null;
    const ok = await SR.available(); if (!ok.available) return null;
    await SR.requestPermissions();
    const r = await SR.start({ language: 'ko-KR', maxResults: 1, partialResults: false, popup: false });
    return (r.matches || [])[0] || '';
  };
  // 켤 때 알람 다시 예약
  window.addEventListener('load', () => setTimeout(() => N.schedule(S.alarms), 2000));
})();

package kr.haruyebo.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

// 💬 카톡 알림 읽기 (11-06): 카톡이 오면 팻이 알려 줌. 설정에서 끌 수 있음.
// 안드로이드 규칙상 '알림 접근 허용'은 사용자가 휴대폰 설정에서 한 번 켜 줘야 함.
// 알림 속 '대화방 열기'(contentIntent)와 '답장'(RemoteInput) 을 기억해 두었다가 팻 말풍선·말로 씀.
public class HaruNotiListener extends NotificationListenerService {
    static long lastAt = 0;
    static String lastKey = "";
    static PendingIntent kakaoOpen = null;          // 누르면 그 대화방
    static Notification.Action kakaoReply = null;   // 답장 보내기
    static String kakaoWho = "";
    // 11-08: 사람(대화방)마다 마지막 답장 단추를 기억 → "엄마에게 카톡 보내 줘" 하면 바로 답장
    static final java.util.LinkedHashMap<String, Object[]> replies = new java.util.LinkedHashMap<>();
    static String norm(String s) { return s == null ? "" : s.replaceAll("[\\s()]", "").replaceAll("님$", ""); }
    static synchronized Notification.Action findReply(String name) {
        String n = norm(name); if (n.isEmpty()) return null;
        Notification.Action best = null; long bt = 0, now = System.currentTimeMillis();
        for (java.util.Map.Entry<String, Object[]> e : replies.entrySet()) {
            String k = norm(e.getKey()); long t = (Long) e.getValue()[1];
            if (now - t > 3L * 86400000L || k.isEmpty()) continue;
            boolean hit = k.equals(n) || (n.length() >= 2 && k.contains(n)) || (k.length() >= 2 && n.contains(k));
            if (hit && t > bt) { best = (Notification.Action) e.getValue()[0]; bt = t; }
        }
        return best;
    }
    static synchronized void keepReply(String key, Notification.Action a) {
        if (key == null || key.isEmpty() || a == null) return;
        replies.remove(key); replies.put(key, new Object[]{ a, System.currentTimeMillis() });
        while (replies.size() > 40) { String first = replies.keySet().iterator().next(); replies.remove(first); }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (!"com.kakao.talk".equals(sbn.getPackageName())) return;
            if (!getSharedPreferences("pet", 0).getBoolean("kakao", true)) return;
            Notification n = sbn.getNotification();
            if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle x = n.extras;
            CharSequence t = x.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence m = x.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence room = x.getCharSequence(Notification.EXTRA_SUB_TEXT);
            if (t == null || m == null) return;
            String who = t.toString(), msg = m.toString();
            String key = who + "|" + msg;
            long now = System.currentTimeMillis();
            if (key.equals(lastKey) && now - lastAt < 8000) return;   // 같은 알림 여러 번 오는 것 막기
            lastKey = key; lastAt = now;
            kakaoOpen = n.contentIntent; kakaoWho = room != null && room.length() > 0 ? room.toString() : who; kakaoReply = null;
            if (n.actions != null) for (Notification.Action a : n.actions) if (a.getRemoteInputs() != null && a.getRemoteInputs().length > 0) { kakaoReply = a; break; }
            if (kakaoReply != null) keepReply(room != null && room.length() > 0 ? room.toString() : who, kakaoReply);
            if (msg.length() > 60) msg = msg.substring(0, 60) + "…";
            String r = room == null ? "" : room.toString();
            FloatPetService.kakaoStatic(who, msg, r);
            FloatPetPlugin.kakaoEvent(who, msg, r);
        } catch (Exception ignored) { }
    }
}

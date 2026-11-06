package kr.haruyebo.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

// 💬 카톡 알림 읽기 (11-06): 카톡이 오면 팻이 알려 줌. 설정에서 끌 수 있음.
// 안드로이드 규칙상 '알림 접근 허용'은 사용자가 휴대폰 설정에서 한 번 켜 줘야 함.
public class HaruNotiListener extends NotificationListenerService {
    static long lastAt = 0;
    static String lastKey = "";

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
            if (msg.length() > 60) msg = msg.substring(0, 60) + "…";
            String r = room == null ? "" : room.toString();
            FloatPetService.kakaoStatic(who, msg, r);
            FloatPetPlugin.kakaoEvent(who, msg, r);
        } catch (Exception ignored) { }
    }
}

package kr.haruyebo.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import java.util.HashSet;
import java.util.Set;

// ⏰ 하루 예보 알람 (11-07): 앱을 닫아도·화면이 꺼져도 휴대폰 알람처럼 [그만]을 누를 때까지 울림
public class HaruAlarmReceiver extends BroadcastReceiver {
    static final String CH = "haru_alarm_v1";
    static final String A_FIRE = "kr.haruyebo.ALARM", A_STOP = "kr.haruyebo.ALARM_STOP", A_SNOOZE = "kr.haruyebo.ALARM_SNOOZE";

    @Override
    public void onReceive(Context c, Intent i) {
        String act = i.getAction(), id = i.getStringExtra("id"), text = i.getStringExtra("text");
        if (id == null) return;
        SharedPreferences sp = c.getSharedPreferences("pet", 0);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (A_STOP.equals(act)) { nm.cancel(nid(id)); addSet(sp, "alarmDone", id); sp.edit().remove("alarmRinging").apply(); FloatPetService.alarmStopStatic(); return; }
        if (A_SNOOZE.equals(act)) { nm.cancel(nid(id)); sp.edit().remove("alarmRinging").apply(); schedule(c, id + "_s", System.currentTimeMillis() + 5 * 60000L, text, false); addSet(sp, "alarmDone", id); FloatPetService.alarmStopStatic(); return; }
        // 울릴 시간
        if (i.getBooleanExtra("daily", false)) schedule(c, id, i.getLongExtra("at", System.currentTimeMillis()) + 86400000L, text, true);
        sp.edit().putString("alarmRinging", id).putString("alarmText", text == null ? "" : text).apply();
        if (FloatPetService.me != null && !FloatPetService.wantShown) { FloatPetPlugin.alarmEvent(id, text); return; }   // 하루 예보가 열려 있으면 앱 안에서 팻이 울림
        ensureChannel(c);
        Intent open = new Intent(c, MainActivity.class).putExtra("alarm", id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int fl = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent piOpen = PendingIntent.getActivity(c, nid(id), open, fl);
        PendingIntent piStop = PendingIntent.getBroadcast(c, nid(id) + 1, new Intent(c, HaruAlarmReceiver.class).setAction(A_STOP).putExtra("id", id), fl);
        PendingIntent piSnooze = PendingIntent.getBroadcast(c, nid(id) + 2, new Intent(c, HaruAlarmReceiver.class).setAction(A_SNOOZE).putExtra("id", id).putExtra("text", text), fl);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        b.setSmallIcon(c.getApplicationInfo().icon).setContentTitle("⏰ 하루 예보 알람").setContentText(text == null || text.isEmpty() ? "알람 시간이야!" : text)
            .setCategory(Notification.CATEGORY_ALARM).setPriority(Notification.PRIORITY_MAX).setVisibility(Notification.VISIBILITY_PUBLIC)
            .setFullScreenIntent(piOpen, true).setContentIntent(piOpen).setOngoing(true).setAutoCancel(true)
            .addAction(new Notification.Action.Builder(null, "그만 ✋", piStop).build())
            .addAction(new Notification.Action.Builder(null, "5분 뒤 다시 ⏰", piSnooze).build());
        if (Build.VERSION.SDK_INT < 26) b.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), android.media.AudioManager.STREAM_ALARM);
        Notification n = b.build();
        n.flags |= Notification.FLAG_INSISTENT;   // [그만] 누를 때까지 소리 반복
        nm.notify(nid(id), n);
        FloatPetService.alarmRingStatic(text);    // 바탕화면 팻도 울며 알려 줌
    }

    static int nid(String id) { return 50000 + (id.hashCode() & 0x3fff) * 4; }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CH) != null) return;
        NotificationChannel ch = new NotificationChannel(CH, "하루 예보 알람", NotificationManager.IMPORTANCE_HIGH);
        ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        ch.enableVibration(true); ch.setVibrationPattern(new long[] { 0, 700, 500, 700 });
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        return ((AlarmManager) c.getSystemService(Context.ALARM_SERVICE)).canScheduleExactAlarms();
    }

    static void schedule(Context c, String id, long at, String text, boolean daily) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        Intent i = new Intent(c, HaruAlarmReceiver.class).setAction(A_FIRE).putExtra("id", id).putExtra("text", text).putExtra("daily", daily).putExtra("at", at);
        PendingIntent pi = PendingIntent.getBroadcast(c, nid(id) + 3, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        try {
            if (canExact(c)) am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, PendingIntent.getActivity(c, 7, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE)), pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);   // 정확한 알람 허락이 없으면 조금 늦을 수 있음
        } catch (Exception e) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi); }
        addSet(c.getSharedPreferences("pet", 0), "alarmIds", id);
    }

    static void cancelAll(Context c) {
        SharedPreferences sp = c.getSharedPreferences("pet", 0);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        for (String id : sp.getStringSet("alarmIds", new HashSet<>())) {
            PendingIntent pi = PendingIntent.getBroadcast(c, nid(id) + 3, new Intent(c, HaruAlarmReceiver.class).setAction(A_FIRE), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            am.cancel(pi);
        }
        sp.edit().putStringSet("alarmIds", new HashSet<>()).apply();
    }

    static void addSet(SharedPreferences sp, String key, String v) {
        Set<String> s = new HashSet<>(sp.getStringSet(key, new HashSet<>())); s.add(v); sp.edit().putStringSet(key, s).apply();
    }
}

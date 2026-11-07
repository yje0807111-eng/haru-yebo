package kr.haruyebo.app;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

// 💌 가족 안부 문자 (11-07): 매일 아침 처음 잠금을 풀면 보호자에게 "오늘도 잘 있어요" 문자를 저절로
public class HaruSms {
    static SharedPreferences sp(Context c) { return c.getSharedPreferences("haru_sms", Context.MODE_PRIVATE); }
    static boolean can(Context c) { return c.checkSelfPermission(Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED; }

    // 설정 저장: nums = "010...,010...", text = 보낼 말, on = 켜기
    static void config(Context c, String nums, String text, boolean on) {
        sp(c).edit().putString("nums", nums == null ? "" : nums).putString("text", text == null ? "" : text).putBoolean("on", on).apply();
    }
    static boolean send(Context c, String num, String text) {
        try {
            if (!can(c)) return false;
            SmsManager sm = Build.VERSION.SDK_INT >= 31 ? c.getSystemService(SmsManager.class) : SmsManager.getDefault();
            ArrayList<String> parts = sm.divideMessage(text);
            if (parts.size() > 1) sm.sendMultipartTextMessage(num, null, parts, null, null); else sm.sendTextMessage(num, null, text, null, null);
            return true;
        } catch (Exception e) { return false; }
    }
    // 오늘 아직 안 보냈고 아침 7시가 지났으면 보내기 → 보낸 사람 수 (0 이면 안 보냄)
    static int daily(Context c) {
        SharedPreferences p = sp(c);
        if (!p.getBoolean("on", false) || !can(c)) return 0;
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.KOREA).format(new Date());
        if (today.equals(p.getString("day", ""))) return 0;
        if (Calendar.getInstance().get(Calendar.HOUR_OF_DAY) < 7) return 0;
        String text = p.getString("text", ""); if (text.isEmpty()) text = "오늘도 잘 있어요 🌤 (하루 예보 안부)";
        int n = 0;
        for (String num : p.getString("nums", "").split(",")) { String x = num.replaceAll("[^0-9+]", ""); if (x.length() >= 8 && send(c, x, text)) n++; }
        if (n > 0) p.edit().putString("day", today).apply();
        return n;
    }
    static String lastDay(Context c) { return sp(c).getString("day", ""); }
}

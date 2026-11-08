package kr.haruyebo.app;

import android.app.Notification;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

// ✉️💬 말로 문자·카톡 보내기 (11-08)
//  문자: 허락이 있으면 바로 보냄, 없으면 문자 화면에 글을 채워서 열기
//  카톡: 그 사람한테 온 알림(답장 단추)이 있으면 바로 답장, 없으면 카톡 '공유' 화면(친구만 고르면 됨)
public class HaruSend {
    static void copy(Context c, String text) {
        try { ClipboardManager cm = (ClipboardManager) c.getSystemService(Context.CLIPBOARD_SERVICE); cm.setPrimaryClip(ClipData.newPlainText("하루 예보", text)); } catch (Exception ignored) { }
    }
    // 돌려주는 값: "sent" 보냄 · "open" 문자 화면 열림 · "fail"
    static String sms(Context c, String num, String text) {
        String n = num == null ? "" : num.replaceAll("[^0-9+]", "");
        if (n.length() < 3) return "fail";
        if (HaruSms.can(c) && HaruSms.send(c, n, text)) return "sent";
        return smsOpen(c, n, text) ? "open" : "fail";
    }
    static boolean smsOpen(Context c, String num, String text) {
        try {
            Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + num));
            i.putExtra("sms_body", text);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            return true;
        } catch (Exception e) { Log.e("HaruPet", "sms open", e); return false; }
    }
    // 돌려주는 값: "reply" 바로 보냄 · "share" 카톡 공유 화면 · "fail"
    static String kakao(Context c, String who, String text) {
        Notification.Action a = HaruNotiListener.findReply(who);
        if (a != null && a.getRemoteInputs() != null) {
            try {
                Intent fill = new Intent(); Bundle res = new Bundle();
                for (android.app.RemoteInput ri : a.getRemoteInputs()) res.putCharSequence(ri.getResultKey(), text);
                android.app.RemoteInput.addResultsToIntent(a.getRemoteInputs(), fill, res);
                a.actionIntent.send(c, 0, fill);
                return "reply";
            } catch (Exception e) { Log.e("HaruPet", "kakao reply2", e); }
        }
        copy(c, text);
        try {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, text);
            i.setPackage("com.kakao.talk");
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            return "share";
        } catch (Exception e) { Log.e("HaruPet", "kakao share", e); return "fail"; }
    }
}

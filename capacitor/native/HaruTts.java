package kr.haruyebo.app;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.JSObject;
import java.util.Locale;

// 📖 휴대폰 목소리로 읽기 (11-07) — 인터넷 없이 성경 낭독
public class HaruTts {
    static TextToSpeech tts;
    static boolean ready = false;
    static String pendText = null, pendId = null;
    static float rate = 1.0f;

    static void init(Context c) {
        if (tts != null) return;
        tts = new TextToSpeech(c.getApplicationContext(), st -> {
            if (st == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(Locale.KOREAN);
                ready = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { }
                    @Override public void onDone(String id) { ev(id, "done"); }
                    @Override public void onError(String id) { ev(id, "error"); }
                    @Override public void onStop(String id, boolean interrupted) { ev(id, "stop"); }
                });
                if (pendText != null) { speak(c, pendText, pendId); pendText = null; }
            } else ev("", "nodata");
        });
    }
    static void ev(String id, String what) {
        JSObject d = new JSObject(); d.put("id", id == null ? "" : id); d.put("what", what);
        if (FloatPetPlugin.inst != null) FloatPetPlugin.inst.fire("tts", d);
    }
    // 반환: "ok" | "wait"(준비 중) | "nodata"(한국어 목소리 없음)
    static String speak(Context c, String text, String id) {
        init(c);
        if (tts == null) return "nodata";
        if (!ready) { pendText = text; pendId = id; return "wait"; }
        tts.setSpeechRate(rate);
        Bundle b = new Bundle();
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, b, id);
        return "ok";
    }
    static void stop() { if (tts != null) tts.stop(); }
    static String state(Context c) { init(c); return tts == null ? "nodata" : ready ? "ok" : "wait"; }
    static void installVoice(Context c) {
        try { Intent i = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(i); } catch (Exception ignored) { }
    }
}

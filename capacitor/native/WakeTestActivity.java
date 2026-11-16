package kr.haruyebo.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.ContactsContract;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;

// 🧪 11-16 깨움 시험 화면 (다른 기능 전부 없이 이것만)
//  "똑똑아/팻 이름" → 잠금 화면 위에 이 화면 → 빨간 단추 깜빡이며 듣기(글자 실시간) → "엄마 전화 걸어 줘" / "아들 문자 밥 먹었어"
//  → "OO에게 전화할까?" → "응/그래" = 실행 · "다시/그게 아니고" = 지우고 다시 · "아니" = 닫기
public class WakeTestActivity extends Activity {
    static volatile boolean active = false;
    final Handler h = new Handler(Looper.getMainLooper());
    TextView st, tx; Button btn; boolean done = false;
    ArrayList<String[]> people = new ArrayList<>();   // {이름(띄어쓰기 없이), 번호, 원래 이름}

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        active = true;
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        LinearLayout L = new LinearLayout(this); L.setOrientation(LinearLayout.VERTICAL); L.setGravity(Gravity.CENTER); L.setBackgroundColor(Color.WHITE); L.setPadding(40, 40, 40, 40);
        TextView pet = new TextView(this); pet.setText("🐶"); pet.setTextSize(90); pet.setGravity(Gravity.CENTER); L.addView(pet);
        btn = new Button(this); btn.setText("🎤"); btn.setTextSize(34); btn.setTextColor(Color.WHITE);
        GradientDrawable g = new GradientDrawable(); g.setShape(GradientDrawable.OVAL); g.setColor(0xFFE53935); btn.setBackground(g);
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(260, 260); bp.gravity = Gravity.CENTER; bp.topMargin = 30; L.addView(btn, bp);
        st = new TextView(this); st.setTextSize(20); st.setTextColor(0xFF333333); st.setGravity(Gravity.CENTER); st.setPadding(0, 30, 0, 10); L.addView(st);
        tx = new TextView(this); tx.setTextSize(28); tx.setTextColor(Color.BLACK); tx.setGravity(Gravity.CENTER); tx.setMinHeight(200); L.addView(tx);
        Button close = new Button(this); close.setText("✕ 닫기"); close.setOnClickListener(v -> end()); L.addView(close);
        setContentView(L);
        btn.setOnClickListener(v -> { if (!busy) listenCmd(); });
        String[] need = { Manifest.permission.RECORD_AUDIO, Manifest.permission.READ_CONTACTS, Manifest.permission.SEND_SMS, Manifest.permission.CALL_PHONE };
        ArrayList<String> ask = new ArrayList<>(); for (String p : need) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) ask.add(p);
        if (!ask.isEmpty()) requestPermissions(ask.toArray(new String[0]), 7);
        loadPeople();
        HaruTts.init(this);
        h.postDelayed(this::listenCmd, 300);
    }
    @Override public void onRequestPermissionsResult(int c, String[] p, int[] r) { super.onRequestPermissionsResult(c, p, r); loadPeople(); }

    void loadPeople() {
        people.clear();
        if (checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) return;
        try (Cursor c = getContentResolver().query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, new String[]{ ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER }, null, null, null)) {
            while (c != null && c.moveToNext()) { String n = c.getString(0), num = c.getString(1); if (n == null || num == null) continue; people.add(new String[]{ n.replaceAll("\\s+", ""), num.replaceAll("[^0-9+]", ""), n }); }
        } catch (Exception ignored) { }
    }

    boolean busy = false;
    void blink(boolean on, int color) {
        GradientDrawable g = new GradientDrawable(); g.setShape(GradientDrawable.OVAL); g.setColor(color); btn.setBackground(g);
        btn.animate().cancel(); btn.setAlpha(1f);
        if (on) pulse();
    }
    void pulse() { if (!busy || done) { btn.setAlpha(1f); return; } btn.animate().alpha(btn.getAlpha() > 0.7f ? 0.45f : 1f).setDuration(500).withEndAction(this::pulse).start(); }

    // 말하고 → 다 말하면(삐) → 마이크 열기
    void sayThen(String t, Runnable next) {
        st.setText(t);
        HaruTts.speak(this, t.replaceAll("[^가-힣0-9a-zA-Z ?!.,]", ""), "test");
        h.postDelayed(new Runnable() { int n = 0; public void run() {
            boolean sp = HaruTts.tts != null && HaruTts.tts.isSpeaking();
            if ((sp || n < 3) && n++ < 40) { h.postDelayed(this, 150); return; }
            h.postDelayed(next, 250);
        } }, 300);
    }
    void beep() { try { new ToneGenerator(AudioManager.STREAM_MUSIC, 70).startTone(ToneGenerator.TONE_PROP_BEEP, 150); } catch (Exception ignored) { } }

    // 11-16: 받아쓰기는 구글 인식(예전에 "대충 말해도 다 알아듣던" 그것) — 폰 안 인식(Vosk 작은 모델)은 엉뚱한 글자를 적어서 이름 부르기에만 씀
    //  연락처 이름을 미리 알려 주고(힌트), 후보 5개 중 연락처 이름이 든 것을 고름 · 안 되면 그때만 폰 안 인식
    android.speech.SpeechRecognizer sr;
    void hear(HaruWake.Got cb) {
        HaruWake.pause(true);
        h.postDelayed(new Runnable() { int n = 0; public void run() {
            if (HaruWake.recOpen && n++ < 20) { h.postDelayed(this, 100); return; }
            busy = true; blink(true, 0xFFE53935); beep();
            h.postDelayed(() -> google(cb), 250);
        } }, 50);
    }
    void vosk(HaruWake.Got cb) {
        st.setText("🔴 듣는 중… (폰 안 인식)");
        HaruWake.listenOnce(this, p -> { if (!done) tx.setText(p); }, t -> { busy = false; blink(false, 0xFF9E9E9E); if (!done) cb.on(t == null ? "" : t.trim()); });
    }
    void google(HaruWake.Got cb) {
        if (!android.speech.SpeechRecognizer.isRecognitionAvailable(this)) { vosk(cb); return; }
        try { if (sr != null) sr.destroy(); } catch (Exception ignored) { }
        sr = android.speech.SpeechRecognizer.createSpeechRecognizer(this);
        Intent i = new Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE, "ko-KR");
        i.putExtra(android.speech.RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(android.speech.RecognizerIntent.EXTRA_MAX_RESULTS, 5);
        i.putExtra(android.speech.RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        ArrayList<String> hint = new ArrayList<>(); for (String[] p : people) if (!hint.contains(p[2]) && hint.size() < 300) hint.add(p[2]);
        hint.add("전화 걸어 줘"); hint.add("문자 보내 줘");
        i.putStringArrayListExtra("android.speech.extra.BIASING_STRINGS", hint);
        final boolean[] fin = { false };
        sr.setRecognitionListener(new android.speech.RecognitionListener() {
            public void onReadyForSpeech(Bundle b) { st.setText("🔴 듣는 중… 말해 줘!\n(예: 엄마 전화 걸어 줘 · 아들 문자 밥 먹었어)"); }
            public void onBeginningOfSpeech() { }
            public void onRmsChanged(float v) { }
            public void onBufferReceived(byte[] b) { }
            public void onEndOfSpeech() { st.setText("⏳ 알아듣는 중…"); }
            public void onEvent(int t, Bundle b) { }
            public void onPartialResults(Bundle b) { ArrayList<String> r = b.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION); if (r != null && !r.isEmpty() && !done) tx.setText(r.get(0)); }
            public void onResults(Bundle b) {
                if (fin[0]) return; fin[0] = true; busy = false; blink(false, 0xFF9E9E9E);
                ArrayList<String> r = b.getStringArrayList(android.speech.SpeechRecognizer.RESULTS_RECOGNITION);
                String best = r == null || r.isEmpty() ? "" : r.get(0);
                if (r != null) for (String c : r) if (who(c.replace(" ", "")) != null) { best = c; break; }   // 후보 중 연락처 이름이 든 것
                if (!done) { tx.setText(best); cb.on(best.trim()); }
            }
            public void onError(int e) {
                if (fin[0]) return; fin[0] = true;
                if (e == android.speech.SpeechRecognizer.ERROR_NO_MATCH || e == android.speech.SpeechRecognizer.ERROR_SPEECH_TIMEOUT) { busy = false; blink(false, 0xFF9E9E9E); if (!done) cb.on(""); return; }
                // 구글이 막히면(잠금 화면·인터넷 등) → 폰 안 인식으로
                tx.setText("(구글 인식 안 됨: " + e + ")"); vosk(cb);
            }
        });
        sr.startListening(i);
    }

    int tries = 0;
    void listenCmd() {
        if (done) return;
        tx.setText(""); st.setText("🔴 듣는 중… 말해 줘!\n(예: 엄마 전화 걸어 줘 · 아들 문자 밥 먹었어)");
        hear(t -> {
            if (t.isEmpty()) { if (++tries < 3) sayThen("잘 못 들었어. 다시 말해 줘", this::listenCmd); else end(); return; }
            if (again(t)) { sayThen("지웠어. 다시 말해 줘", this::listenCmd); return; }
            plan(t);
        });
    }
    static boolean again(String t) { String s = t.replace(" ", ""); return s.startsWith("다시") || s.contains("그게아니") || s.startsWith("틀렸"); }
    static boolean yes(String t) { String s = t.replace(" ", ""); return s.matches("^(응|어|네|예|그래|좋아|오케이|실행|해줘|맞아|걸어|보내|그렇게).*"); }
    static boolean no(String t) { String s = t.replace(" ", ""); return s.matches("^(아니|아냐|아뇨|취소|됐어|하지마|그만).*"); }

    String[] who(String s) {   // 말 속에 든 연락처 이름 (가장 긴 것)
        String[] best = null;
        for (String[] p : people) if (p[0].length() >= 1 && s.contains(p[0]) && (best == null || p[0].length() > best[0].length())) best = p;
        if (best == null) for (String[] p : people) { String core = p[0].replaceAll("^(우리|내)", ""); if (core.length() >= 2 && s.contains(core) && (best == null || core.length() > best[0].length())) best = p; }
        return best;
    }

    void plan(String t) {
        String s = t.replace(" ", "");
        String[] p = who(s);
        boolean call = s.contains("전화") || s.contains("통화"), sms = s.contains("문자") || s.contains("메시지") || s.contains("보내");
        if (p == null) { sayThen(people.isEmpty() ? "연락처를 못 읽었어. 허락을 눌러 줘" : "누구인지 못 찾았어. 다시 말해 줘", this::listenCmd); return; }
        tx.setText(t);
        if (call && !sms) { confirm(p[2] + "에게 전화할까?", () -> doCall(p)); return; }
        if (sms) {
            String body = t;
            for (String w : new String[]{ p[2], "에게", "한테", "께", "문자로", "문자", "메시지", "보내줘", "보내 줘", "보내", "라고", "이라고" }) body = body.replace(w, " ");
            body = body.replaceAll("\\s+", " ").trim();
            if (body.length() < 2) { sayThen(p[2] + "에게 뭐라고 보낼까?", () -> { tx.setText(""); hear(b2 -> { if (b2.isEmpty() || again(b2)) { listenCmd(); return; } tx.setText(b2); confirm(p[2] + "에게 \"" + b2 + "\" 보낼까?", () -> doSms(p, b2)); }); }); return; }
            final String bd = body; confirm(p[2] + "에게 \"" + bd + "\" 보낼까?", () -> doSms(p, bd)); return;
        }
        sayThen(p[2] + "에게 전화할까, 문자할까? 다시 말해 줘", this::listenCmd);
    }

    void confirm(String q, Runnable go) {
        blink(false, 0xFF43A047);
        sayThen(q, () -> hear(a -> {
            if (again(a)) { sayThen("지웠어. 다시 말해 줘", this::listenCmd); return; }
            if (yes(a) && !no(a)) { go.run(); return; }
            if (no(a)) { sayThen("알았어, 안 할게", this::end); return; }
            sayThen("응 이나 아니 로 말해 줘", () -> confirm(q, go));
        }));
    }

    void doCall(String[] p) {
        st.setText("📞 " + p[2] + "에게 거는 중…");
        try {
            boolean direct = checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED;
            Intent i = new Intent(direct ? Intent.ACTION_CALL : Intent.ACTION_DIAL, Uri.parse("tel:" + p[1]));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i);
        } catch (Exception e) { st.setText("전화를 못 걸었어: " + e.getMessage()); }
        h.postDelayed(this::end, 1500);
    }
    void doSms(String[] p, String body) {
        boolean ok = HaruSms.send(this, p[1], body);
        sayThen(ok ? p[2] + "에게 문자 보냈어" : "문자를 못 보냈어. 문자 허락을 눌러 줘", this::end);
    }

    void end() {
        if (done) return; done = true; active = false;
        try { if (sr != null) sr.destroy(); } catch (Exception ignored) { }
        HaruWake.stopNow = true;
        h.postDelayed(() -> { HaruWake.pause(false); HaruWake.start(getApplicationContext()); }, 600);
        finish();
    }
    @Override protected void onDestroy() { super.onDestroy(); if (!done) { done = true; HaruWake.stopNow = true; HaruWake.pause(false); } active = false; }
}

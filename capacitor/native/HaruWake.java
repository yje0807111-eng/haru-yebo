package kr.haruyebo.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

// 11-15: 🎤 이름 부르면 깨우기 — 화면이 꺼져 있어도 팻 이름("다루야")을 부르면 화면을 켜고 하루가 대답
//  · 폰 안에서만 도는 한국어 음성 인식(Vosk, 무료·인터넷 필요 없음). 소리는 어디에도 보내지 않음
//  · 배터리 아끼기: 조용할 때는 소리 크기만 재고 쉼 → 목소리 같은 소리가 들릴 때만 알아듣기를 돌림
//  · 하루 앱을 보고 있을 때·팻이 말을 듣는 중(받아쓰기)에는 마이크를 놓아 줌
public class HaruWake {
    static final String MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-ko-0.22.zip";
    static final String TAG = "HaruWake";
    static volatile boolean running = false, paused = false, recOpen = false;   // recOpen: 지금 마이크를 잡고 있음
    static Thread th;
    static Object model;   // org.vosk.Model (한 번만 읽어 둠)
    static long lastWake = 0;

    static File modelDir(Context c) { return new File(c.getFilesDir(), "vosk-ko"); }
    static boolean hasModel(Context c) { File d = modelDir(c); return new File(d, "am").exists() || new File(d, "conf").exists(); }
    static boolean wanted(Context c) { return c.getSharedPreferences("pet", 0).getBoolean("wakeOn", false); }

    // ── 한국어 모델 받기 (처음 한 번, 약 80MB) — 진행률은 콜백으로
    interface Prog { void on(int pct, String st); }
    static void download(Context c, Prog p) {
        new Thread(() -> {
            try {
                if (hasModel(c)) { p.on(100, "ok"); return; }
                File tmp = new File(c.getCacheDir(), "vosk-ko.zip");
                HttpURLConnection con = (HttpURLConnection) new URL(MODEL_URL).openConnection();
                con.setConnectTimeout(15000); con.setReadTimeout(30000);
                long total = con.getContentLengthLong(), got = 0; int last = -1;
                try (InputStream in = con.getInputStream(); FileOutputStream out = new FileOutputStream(tmp)) {
                    byte[] b = new byte[65536]; int n;
                    while ((n = in.read(b)) > 0) { out.write(b, 0, n); got += n; int pct = total > 0 ? (int) (got * 90 / total) : 0; if (pct != last) { last = pct; p.on(pct, "down"); } }
                }
                File dir = modelDir(c); dir.mkdirs();
                try (ZipInputStream z = new ZipInputStream(new java.io.FileInputStream(tmp))) {
                    ZipEntry e; byte[] b = new byte[65536];
                    while ((e = z.getNextEntry()) != null) {
                        String name = e.getName(); int s = name.indexOf('/'); if (s < 0) continue; name = name.substring(s + 1); if (name.isEmpty()) continue;   // 맨 위 폴더 이름 떼기
                        File f = new File(dir, name);
                        if (!f.getCanonicalPath().startsWith(dir.getCanonicalPath())) continue;
                        if (e.isDirectory()) { f.mkdirs(); continue; }
                        f.getParentFile().mkdirs();
                        try (FileOutputStream o = new FileOutputStream(f)) { int n; while ((n = z.read(b)) > 0) o.write(b, 0, n); }
                    }
                }
                tmp.delete();
                p.on(100, hasModel(c) ? "ok" : "bad");
            } catch (Throwable t) { Log.e(TAG, "download", t); p.on(-1, "fail"); }
        }).start();
    }

    // ── 듣기 시작/멈춤
    static synchronized void start(Context c) {
        if (running || !wanted(c) || !hasModel(c)) return;
        if (Build.VERSION.SDK_INT >= 23 && c.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return;
        running = true;
        th = new Thread(() -> loop(c.getApplicationContext()), "HaruWake"); th.start();
    }
    static synchronized void stop() { running = false; }
    static volatile long pausedAt = 0;
    static void pause(boolean p) { paused = p; if (p) pausedAt = System.currentTimeMillis(); }   // 11-16: 쉬기는 길어야 25초 (멈춘 채로 남지 않게)

    static String norm(String s) { return s == null ? "" : s.replaceAll("[^가-힣a-zA-Z]", ""); }
    // 이름 맞추기: "다루" → 들린 말에 "다루" 가 있거나, 한 글자만 다르면(받아쓰기 실수) 맞음
    static boolean heard(String text, String name) {
        String t = norm(text), n = norm(name).replaceAll("(야|아)$", "");
        if (n.length() < 2 || t.length() < 2) return false;
        if (t.contains(n)) return true;
        for (int i = 0; i + n.length() <= t.length(); i++) { int diff = 0; for (int k = 0; k < n.length(); k++) if (t.charAt(i + k) != n.charAt(k)) diff++; if (diff <= (n.length() >= 3 ? 1 : 0)) return true; }
        return false;
    }

    static void loop(Context c) {
        AudioRecord ar = null; Object rec = null;
        try {
            if (model == null) { org.vosk.LibVosk.setLogLevel(org.vosk.LogLevel.WARNINGS); model = new org.vosk.Model(modelDir(c).getAbsolutePath()); }
            int sr = 16000, frame = 1600;   // 0.1초씩
            int min = AudioRecord.getMinBufferSize(sr, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            short[] buf = new short[frame];
            short[][] pre = new short[4][frame]; int preI = 0;   // 목소리 시작 앞 0.4초도 같이 (첫 소리 놓치지 않게)
            double floor = 300; long voiceUntil = 0; boolean inVoice = false;
            while (running) {
                if (paused && System.currentTimeMillis() - pausedAt > 25000) paused = false;
                boolean busy = paused || (FloatPetService.me != null && (FloatPetService.me.listening || FloatPetService.me.arOn));
                if (busy) {   // 앱을 보고 있거나 팻이 받아쓰는 중 → 마이크 놓아 주기
                    if (ar != null) { try { ar.stop(); ar.release(); } catch (Exception ignored) { } ar = null; }
                    recOpen = false; Thread.sleep(150); continue;
                }
                if (ar == null) {
                    ar = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, sr, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, frame * 4));
                    if (ar.getState() != AudioRecord.STATE_INITIALIZED) { ar.release(); ar = null; Thread.sleep(3000); continue; }
                    ar.startRecording(); inVoice = false; recOpen = true;
                }
                int n = ar.read(buf, 0, frame);
                if (n <= 0) { Thread.sleep(100); continue; }
                double sum = 0; for (int i = 0; i < n; i++) sum += (double) buf[i] * buf[i];
                double rms = Math.sqrt(sum / n);
                long now = System.currentTimeMillis();
                if (!inVoice) floor = floor * 0.97 + Math.min(rms, floor * 2) * 0.03;   // 조용한 바탕 소리 크기를 천천히 따라감
                if (rms > Math.max(350, floor * 2.5)) voiceUntil = now + 1000;   // 11-16: 조금 더 예민하게 (멀리서 불러도)
                if (now < voiceUntil) {
                    if (!inVoice) {   // 목소리 시작 → 알아듣기 켬 (앞 0.4초 포함)
                        inVoice = true; rec = makeRec(c);
                        for (int k = 1; k <= pre.length; k++) { short[] p = pre[(preI + k) % pre.length]; ((org.vosk.Recognizer) rec).acceptWaveForm(p, p.length); }
                    }
                    org.vosk.Recognizer r = (org.vosk.Recognizer) rec;
                    String txt = r.acceptWaveForm(buf, n) ? r.getResult() : r.getPartialResult();
                    if (check(c, txt)) { r.close(); rec = null; inVoice = false; voiceUntil = 0; }
                } else if (inVoice) {   // 말이 끝남 → 마지막 결과 보고 알아듣기 끔 (배터리)
                    org.vosk.Recognizer r = (org.vosk.Recognizer) rec; check(c, r.getFinalResult()); r.close(); rec = null; inVoice = false;
                }
                System.arraycopy(buf, 0, pre[preI], 0, frame); preI = (preI + 1) % pre.length;
            }
        } catch (Throwable t) { Log.e(TAG, "loop", t); }
        finally {
            if (ar != null) { try { ar.stop(); ar.release(); } catch (Exception ignored) { } }
            recOpen = false;
            if (rec != null) { try { ((org.vosk.Recognizer) rec).close(); } catch (Exception ignored) { } }
            running = false;
        }
    }

    // 11-16: 아무 말이나 받아 적지 말고 "똑똑 · 팻 이름 · 그 밖의 말([unk])" 중에서만 고르게 → 이름을 훨씬 정확하게
    static org.vosk.Recognizer makeRec(Context c) throws java.io.IOException {
        String pet = norm(c.getSharedPreferences("pet", 0).getString("name", ""));
        org.json.JSONArray g = new org.json.JSONArray(); g.put("똑똑"); g.put("똑똑아"); g.put("똑똑이");
        if (pet.length() >= 2) { g.put(pet); g.put(pet + "야"); g.put(pet + "아"); }
        g.put("[unk]");
        return new org.vosk.Recognizer((org.vosk.Model) model, 16000f, g.toString());
    }
    static boolean check(Context c, String json) {
        try {
            org.json.JSONObject j = new org.json.JSONObject(json == null ? "{}" : json);
            String t = j.optString("text", j.optString("partial", ""));
            if (t.isEmpty()) return false;
            // 11-16 사용자: 깨우는 이름은 "똑똑"으로 고정 (된소리 두 번 — 폰 마이크로도 가장 또렷). 팻 이름은 대화에서만
            String n = norm(t);
            // 11-16 사용자: "똑똑(아)" 와 사용자가 지은 팻 이름 둘 다 · 받아쓰기가 "톡톡·똑독"으로 적어도 맞음
            String pet = c.getSharedPreferences("pet", 0).getString("name", "");
            boolean ttok = n.contains("똑똑") || n.contains("톡톡") || n.contains("똑독") || n.contains("독똑") || n.contains("뚝뚝");
            if (ttok && n.matches(".*똑똑(하다|합니다|해요|한사람|한아이).*")) ttok = false;   // "똑똑하다" 같은 평소 말
            if (!ttok && !(pet != null && !pet.isEmpty() && heard(t, pet))) return false;
            long now = System.currentTimeMillis(); if (now - lastWake < 4000) return true; lastWake = now;
            Log.i(TAG, "heard: " + t);
            new Handler(Looper.getMainLooper()).post(() -> wake(c));
            return true;
        } catch (Exception e) { return false; }
    }

    // 11-15: 잠금 화면에서는 구글 받아쓰기가 막힘 → 폰 안 인식(Vosk)으로 명령 한 번 듣기
    interface Got { void on(String text); }
    static void listenOnce(Context c, Got cb) {
        new Thread(() -> {
            String out = ""; AudioRecord ar = null; org.vosk.Recognizer r = null;
            try {
                if (!hasModel(c)) { cb.on(""); return; }
                if (model == null) model = new org.vosk.Model(modelDir(c).getAbsolutePath());
                int sr = 16000, frame = 1600; short[] buf = new short[frame];
                ar = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, sr, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(AudioRecord.getMinBufferSize(sr, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT), frame * 4));
                r = new org.vosk.Recognizer((org.vosk.Model) model, 16000f);
                ar.startRecording();
                long start = System.currentTimeMillis(), lastVoice = 0; double floor = 300; boolean spoke = false; StringBuilder sb = new StringBuilder();
                while (true) {
                    int n = ar.read(buf, 0, frame); if (n <= 0) continue;
                    double sum = 0; for (int i = 0; i < n; i++) sum += (double) buf[i] * buf[i]; double rms = Math.sqrt(sum / n);
                    long now = System.currentTimeMillis();
                    if (!spoke && now - start < 600) floor = Math.max(200, rms);   // 처음 0.6초로 바탕 소리 재기
                    if (rms > Math.max(450, floor * 2.5)) { spoke = true; lastVoice = now; }
                    if (r.acceptWaveForm(buf, n)) { String t = new org.json.JSONObject(r.getResult()).optString("text", ""); if (!t.isEmpty()) sb.append(t).append(' '); }
                    if (spoke && now - lastVoice > 1200) break;   // 말이 끝남
                    if (!spoke && now - start > 6000) break;    // 6초 동안 말이 없음
                    if (now - start > 9000) break;
                }
                String t = new org.json.JSONObject(r.getFinalResult()).optString("text", ""); sb.append(t);
                out = sb.toString().trim().replaceAll("\\s+", " ");
            } catch (Throwable e) { Log.e(TAG, "listenOnce", e); }
            finally { if (ar != null) { try { ar.stop(); ar.release(); } catch (Exception ignored) { } } if (r != null) { try { r.close(); } catch (Exception ignored) { } } }
            final String res = out; new Handler(Looper.getMainLooper()).post(() -> cb.on(res));
        }).start();
    }

    // ── 이름이 들리면: 화면 켜기 → 잠금 화면 위에 하루 → 바로 받아쓰기
    static void wake(Context c) {
        try {
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            @SuppressWarnings("deprecation") PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE, "haru:wake");
            wl.acquire(15000);
        } catch (Exception e) { Log.e(TAG, "wakelock", e); }
        // 11-15 사용자: 팻창(하루 앱의 팻만 보이는 화면)이 잠금 화면 위에도 바로 뜸 → 팻이 울고 "듣고 있어… 말해 줘!" → 말로만 명령
        //  잠금을 풀 필요 없음 · "끝"이나 뒤로 가기 = 하루를 뒤로 보내고 바탕 화면(팻은 계속 떠 있음)
        paused = true;   // 앱이 마이크를 쓰도록 놓아 줌 (앱이 듣기를 마치면 wakePause(false) 로 다시 이름 듣기)
        if (MainActivity.visible) { FloatPetPlugin.tapped("wake"); return; }   // 다른 앱을 쓰는 중이면 → 하루 팻창이 그 위에 떠서 대답 ("끝"이면 쓰던 앱으로 돌아감)   // 앱(팻창)이 이미 떠 있으면 그 자리에서 바로 대답
        Intent i = new Intent(c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("haruWake", true);
        c.startActivity(i);
        new Handler(Looper.getMainLooper()).postDelayed(() -> FloatPetPlugin.tapped("wake"), 700);
    }
}

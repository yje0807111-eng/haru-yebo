package kr.haruyebo.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.ImageView;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.view.KeyEvent;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.content.pm.PackageManager;
import java.util.ArrayList;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.InputStream;

// 화면 위 팻 + 말창 (PC 하루 예보처럼). 서비스는 계속 켜 두고, 앱이 열려 있을 때만 숨김
public class FloatPetService extends Service {
    static FloatPetService me;
    static boolean wantShown = true;
    WindowManager wm;
    ImageView pet;
    LinearLayout bar;
    TextView hint;
    WindowManager.LayoutParams lp, blp;
    final Handler h = new Handler(Looper.getMainLooper());
    Bitmap[] idle, walk, run;
    int sizePct = 100, act = 2;          // act: 0 가만히 · 1 조금 · 2 보통 · 3 활발 · 4 아주 활발
    String name = "다루";
    // 돌아다니기
    float px, tx; int dir = 1; boolean moving = false, running = false; int frame = 0; long nextDecide = 0;

    @Override
    public IBinder onBind(Intent i) { return null; }

    static void maybeStart(Context c) {
        try {
            SharedPreferences sp = c.getSharedPreferences("pet", 0);
            if (!sp.getBoolean("on", true)) return;
            if (Build.VERSION.SDK_INT >= 23 && !android.provider.Settings.canDrawOverlays(c)) return;
            Intent i = new Intent(c, FloatPetService.class);
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception e) { Log.e("HaruPet", "start", e); c.getSharedPreferences("pet", 0).edit().putString("err", "start: " + e).apply(); }
    }

    // 앱이 열리면 숨기고, 닫히면 보이기 (서비스는 그대로)
    static void setShown(boolean on) {
        wantShown = on;
        if (me != null) me.h.post(() -> me.applyShown());
    }

    void applyShown() {
        Log.i("HaruPet", "shown=" + wantShown + " pet=" + (pet != null) + " bar=" + (bar != null));
        int vis = wantShown ? View.VISIBLE : View.GONE;
        if (pet != null) pet.setVisibility(vis);
        if (bar != null) bar.setVisibility(vis);
        if (bub != null && !wantShown) bub.setVisibility(View.GONE);
        if (!wantShown) endEdit();
    }

    @Override
    public void onCreate() {
        super.onCreate();
        final Thread.UncaughtExceptionHandler old = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            try { getSharedPreferences("pet", 0).edit().putString("crash", new java.util.Date() + " " + Log.getStackTraceString(e).substring(0, Math.min(1500, Log.getStackTraceString(e).length()))).commit(); } catch (Exception ignored) { }
            if (old != null) old.uncaughtException(t, e);
        });
        Log.i("HaruPet", "service create");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        me = this;
        Log.i("HaruPet", "start shown=" + wantShown);
        SharedPreferences sp = getSharedPreferences("pet", 0);
        sizePct = sp.getInt("size", 100);
        act = sp.getInt("act", 2);
        name = sp.getString("name", "다루");
        startFg();
        if (pet == null) build(); else { applySize(); if (hint != null) hint.setText(name + "에게 말 걸기…"); }
        applyShown();
        return START_STICKY;
    }

    void startFg() {
        String ch = "haru_pet";
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(ch, "화면 위 팻", NotificationManager.IMPORTANCE_MIN));
        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, ch) : new Notification.Builder(this);
        Notification n = b.setContentTitle("하루 예보").setContentText("팻이 화면에서 놀고 있어요").setSmallIcon(getApplicationInfo().icon).setContentIntent(pi).setOngoing(true).build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(7, n);
    }

    Bitmap load(String n) {
        try (InputStream in = getAssets().open("public/chars/dog/" + n)) { return BitmapFactory.decodeStream(in); }
        catch (Exception e) { return null; }
    }
    Bitmap[] frames(String pre, int n) { Bitmap[] b = new Bitmap[n]; for (int i = 0; i < n; i++) b[i] = load(pre + i + ".webp"); return b; }

    int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }
    int sw() { return getResources().getDisplayMetrics().widthPixels; }
    int sh() { return getResources().getDisplayMetrics().heightPixels; }

    WindowManager.LayoutParams params() {
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams p = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
        p.gravity = Gravity.TOP | Gravity.START;
        return p;
    }

    void note(String s) { getSharedPreferences("pet", 0).edit().putString("err", s).apply(); }

    void build() {
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        SharedPreferences sp = getSharedPreferences("pet", 0);
        // 🐶 팻
        try {
            idle = new Bitmap[] { load("정면.webp"), load("눈망울_앉기.webp"), load("기쁨.webp"), load("a_윙크_1.webp"), load("엎드림.webp") };
            walk = frames("a_walk_", 8);
            run = frames("a_run_", 6);
            pet = new ImageView(this);
            pet.setScaleType(ImageView.ScaleType.FIT_CENTER);
            if (idle[0] != null) pet.setImageBitmap(idle[0]);
            lp = params();
            lp.x = sp.getInt("x", sw() / 2 - dp(60));
            lp.y = sp.getInt("y", sh() - dp(330));
            px = tx = lp.x;
            sizeLp();
            pet.setOnTouchListener(dragger(pet, lp, "", () -> open("pet"), true));
            wm.addView(pet, lp);
            Log.i("HaruPet", "pet added");
        } catch (Exception e) { Log.e("HaruPet", "pet", e); note("pet " + e); }
        // 💬 말창 (PC 말창 모양)
        try {
            bar = new LinearLayout(this);
            bar.setOrientation(LinearLayout.HORIZONTAL);
            bar.setGravity(Gravity.CENTER_VERTICAL);
            bar.setPadding(dp(12), dp(6), dp(6), dp(6));
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(Color.parseColor("#FFFBF0"));
            bg.setStroke(dp(2), Color.parseColor("#2B2118"));
            bg.setCornerRadius(dp(28));
            bar.setBackground(bg);
            TextView heart = new TextView(this);
            heart.setText("♥");
            heart.setTextColor(Color.parseColor("#E0245E"));
            heart.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
            heart.setPadding(0, 0, dp(8), 0);
            hint = new TextView(this);
            hint.setText(name + "에게 말 걸기…");
            hint.setTextColor(Color.parseColor("#8A7A66"));
            hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
            hint.setSingleLine(true);
            hint.setLayoutParams(new LinearLayout.LayoutParams(dp(170), LinearLayout.LayoutParams.WRAP_CONTENT));
            // 🐶 얼굴 (보내 준 그림처럼: ♥ · 🐶 · "○○에게 말 걸기…")
            ImageView face = new ImageView(this);
            Bitmap fb = load("정면.webp"); if (fb != null) face.setImageBitmap(fb);
            face.setScaleType(ImageView.ScaleType.FIT_CENTER);
            LinearLayout.LayoutParams flp = new LinearLayout.LayoutParams(dp(30), dp(30)); flp.setMargins(0, 0, dp(10), 0);
            face.setLayoutParams(flp);
            hint.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
            hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
            bar.setPadding(dp(16), dp(10), dp(16), dp(10));
            bar.addView(heart);
            bar.addView(face);
            bar.addView(hint);
            input = new EditText(this);
            input.setHint(name + "에게 말 걸기…");
            input.setSingleLine(true);
            input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
            input.setTextColor(Color.parseColor("#2B2118"));
            input.setBackground(null);
            input.setImeOptions(EditorInfo.IME_ACTION_SEND);
            input.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
            input.setVisibility(View.GONE);
            input.setOnEditorActionListener((v, actionId, ev) -> { submit(input.getText().toString()); return true; });
            input.setOnKeyListener((v, keyCode, ev) -> {
                if (keyCode == KeyEvent.KEYCODE_BACK && ev.getAction() == KeyEvent.ACTION_UP) { endEdit(); return true; }
                if (keyCode == KeyEvent.KEYCODE_ENTER && ev.getAction() == KeyEvent.ACTION_UP) { submit(input.getText().toString()); return true; }
                return false;
            });
            bar.addView(input);
            // 🎤 마이크 (누르면 하루 예보가 열리며 바로 말로 하기)
            TextView mic = new TextView(this);
            mic.setText("🎤");
            mic.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
            mic.setGravity(Gravity.CENTER);
            GradientDrawable mbg = new GradientDrawable();
            mbg.setColor(Color.WHITE);
            mbg.setStroke(dp(2), Color.parseColor("#2B2118"));
            mbg.setCornerRadius(dp(20));
            mic.setBackground(mbg);
            mic.setLayoutParams(new LinearLayout.LayoutParams(dp(40), dp(40)));
            bar.addView(mic);
            bar.setPadding(dp(16), dp(6), dp(6), dp(6));
            blp = params();
            blp.width = sw() - dp(24);                     // 화면 아래 가로로 길게
            blp.x = sp.getInt("bx", dp(12));
            blp.y = sp.getInt("by", sh() - dp(78));
            bar.setOnTouchListener(dragger(bar, blp, "b", () -> startEdit(), false));
            mic.setOnTouchListener(dragger(bar, blp, "b", () -> listen(), false));
            wm.addView(bar, blp);
            Log.i("HaruPet", "bar added x=" + blp.x + " y=" + blp.y);
        } catch (Exception e) { Log.e("HaruPet", "bar", e); note("bar " + e); }
        h.post(tick);
    }

    // 끌면 옮기고, 살짝 누르면 onTap
    View.OnTouchListener dragger(final View v, final WindowManager.LayoutParams p, final String key, final Runnable onTap, final boolean isPet) {
        return new View.OnTouchListener() {
            float sx, sy; int ox, oy; boolean moved;
            @Override
            public boolean onTouch(View view, MotionEvent e) {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN: sx = e.getRawX(); sy = e.getRawY(); ox = p.x; oy = p.y; moved = false; if (isPet) { moving = false; held = true; } return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - sx, dy = e.getRawY() - sy;
                        if (Math.abs(dx) + Math.abs(dy) > dp(8)) moved = true;
                        if (moved) { p.x = ox + (int) dx; p.y = oy + (int) dy; wm.updateViewLayout(v, p); if (isPet) { px = tx = p.x; } }
                        return true;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        if (isPet) { held = false; nextDecide = System.currentTimeMillis() + 2500; }
                        if (moved) getSharedPreferences("pet", 0).edit().putInt(key + "x", p.x).putInt(key + "y", p.y).apply();
                        else if (e.getAction() == MotionEvent.ACTION_UP) onTap.run();
                        return true;
                }
                return false;
            }
        };
    }
    boolean held = false;

    // 1초에 25번: 걷기·뛰기 그림 바꾸며 옆으로 돌아다니기 (팻 기분·움직이는 정도 따라)
    final Runnable tick = new Runnable() {
        long last = 0;
        @Override
        public void run() {
            if (pet == null) return;
            long now = System.currentTimeMillis();
            try {
                if (!held && wantShown) {
                    if (moving) {
                        float speed = dp(running ? (act >= 4 ? 7 : 5) : 2.2f);
                        float d = tx - px;
                        if (Math.abs(d) <= speed) { px = tx; moving = false; pet.setImageBitmap(pick(idle, now)); pet.setScaleX(1); nextDecide = now + restMs(); }
                        else {
                            px += Math.signum(d) * speed; dir = d > 0 ? 1 : -1;
                            if (now - last > (running ? 70 : 100)) { last = now; frame++; Bitmap[] f = running ? run : walk; Bitmap b = f[frame % f.length]; if (b != null) pet.setImageBitmap(b); }
                            pet.setScaleX(dir);   // 그림은 오른쪽을 봄 → 왼쪽으로 갈 땐 뒤집기
                        }
                        lp.x = (int) px; wm.updateViewLayout(pet, lp);
                    } else if (now > nextDecide) decide(now);
                }
            } catch (Exception e) { Log.e("HaruPet", "tick", e); }
            h.postDelayed(this, 40);
        }
    };
    Bitmap pick(Bitmap[] a, long seed) { Bitmap b = a[(int) (Math.random() * a.length)]; return b != null ? b : a[0]; }
    long restMs() { return act >= 4 ? 700 + (long) (Math.random() * 1500) : act == 3 ? 1500 + (long) (Math.random() * 3000) : act == 2 ? 4000 + (long) (Math.random() * 6000) : act == 1 ? 9000 + (long) (Math.random() * 12000) : 3600000; }
    void decide(long now) {
        if (act <= 0) { nextDecide = now + 60000; return; }
        double r = Math.random();
        double moveP = act >= 4 ? 0.92 : act == 3 ? 0.75 : act == 2 ? 0.45 : 0.2;
        if (r < moveP) {
            int w = lp.width > 0 ? lp.width : dp(120);
            tx = (float) (Math.random() * Math.max(1, sw() - w));
            running = act >= 3 ? Math.random() < (act >= 4 ? 0.7 : 0.45) : Math.random() < 0.15;
            moving = true;
        } else { pet.setImageBitmap(pick(idle, now)); nextDecide = now + restMs(); }
    }

    // ── 바탕화면 말창에서 바로 쓰기
    EditText input;
    boolean editing = false;
    int savedBy = 0;
    static volatile boolean ack = false;
    void startEdit() {
        if (editing || input == null) return;
        editing = true;
        hint.setVisibility(View.GONE);
        input.setVisibility(View.VISIBLE);
        input.setText("");
        savedBy = blp.y;
        blp.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        blp.y = (int) (sh() * 0.38f);                       // 글자판에 가리지 않게 위로
        wm.updateViewLayout(bar, blp);
        input.requestFocus();
        h.postDelayed(() -> { InputMethodManager im = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE); if (im != null) im.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT); }, 200);
    }
    void endEdit() {
        if (!editing) return;
        editing = false;
        InputMethodManager im = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (im != null) im.hideSoftInputFromWindow(input.getWindowToken(), 0);
        input.setVisibility(View.GONE);
        hint.setVisibility(View.VISIBLE);
        blp.flags |= WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        blp.y = savedBy;
        wm.updateViewLayout(bar, blp);
    }
    void submit(String text) {
        final String t = text == null ? "" : text.trim();
        endEdit();
        if (t.isEmpty()) return;
        bubble("💭 …", 20000);
        ack = false;
        FloatPetPlugin.overlayText(t);
        // 하루 예보가 대답을 못 하면(꺼져 있으면) 열어서 이어서 하기
        h.postDelayed(() -> { if (!ack) { FloatPetPlugin.pending = t; open("talk"); } }, 3500);
    }

    // ── 바탕화면 🎤: 그 자리에서 듣기
    void listen() {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { open("mic"); return; }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { open("mic"); return; }
        bubble("👂 듣고 있어… 말해 줘!", 9000);
        final SpeechRecognizer sr = SpeechRecognizer.createSpeechRecognizer(this);
        sr.setRecognitionListener(new RecognitionListener() {
            public void onResults(Bundle b) {
                ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                sr.destroy();
                if (m != null && !m.isEmpty()) { bubble("👂 \"" + m.get(0) + "\"", 2500); submit(m.get(0)); }
                else bubble("잘 못 들었어 🥲 다시 눌러 줘", 3000);
            }
            public void onError(int err) {
                sr.destroy();
                if (err == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS || err == SpeechRecognizer.ERROR_AUDIO) open("mic");
                else bubble("잘 못 들었어 🥲 다시 눌러 줘", 3000);
            }
            public void onReadyForSpeech(Bundle p) { }
            public void onBeginningOfSpeech() { }
            public void onRmsChanged(float v) { }
            public void onBufferReceived(byte[] b) { }
            public void onEndOfSpeech() { }
            public void onPartialResults(Bundle b) { }
            public void onEvent(int t, Bundle b) { }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR");
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try { sr.startListening(i); } catch (Exception e) { open("mic"); }
    }

    // ── 바탕화면 팻 말풍선
    TextView bub;
    WindowManager.LayoutParams bubLp;
    final Runnable hideBub = () -> { if (bub != null) bub.setVisibility(View.GONE); };
    void bubble(String text, int ms) {
        try {
            if (bub == null) {
                bub = new TextView(this);
                GradientDrawable g = new GradientDrawable();
                g.setColor(Color.WHITE); g.setStroke(dp(2), Color.parseColor("#2B2118")); g.setCornerRadius(dp(18));
                bub.setBackground(g);
                bub.setPadding(dp(14), dp(10), dp(14), dp(10));
                bub.setTextColor(Color.parseColor("#2B2118"));
                bub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
                bub.setMaxWidth(sw() - dp(40));
                bubLp = params();
                bub.setOnClickListener(v -> bub.setVisibility(View.GONE));
                wm.addView(bub, bubLp);
            }
            bub.setText(text);
            bub.setVisibility(wantShown ? View.VISIBLE : View.GONE);
            bub.measure(View.MeasureSpec.makeMeasureSpec(sw() - dp(40), View.MeasureSpec.AT_MOST), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
            int bw = bub.getMeasuredWidth(), bh = bub.getMeasuredHeight();
            int pw = lp != null ? lp.width : dp(120);
            bubLp.x = Math.max(dp(8), Math.min(sw() - bw - dp(8), (lp != null ? lp.x : 0) + pw / 2 - bw / 2));
            bubLp.y = Math.max(dp(30), (lp != null ? lp.y : dp(300)) - bh - dp(6));
            wm.updateViewLayout(bub, bubLp);
            h.removeCallbacks(hideBub);
            h.postDelayed(hideBub, ms);
            moving = false; nextDecide = System.currentTimeMillis() + Math.min(ms, 8000);
            if (pet != null && idle != null && idle[2] != null && !text.startsWith("💭")) pet.setImageBitmap(idle[2]);
        } catch (Exception e) { Log.e("HaruPet", "bubble", e); }
    }
    static void sayStatic(String text, int ms) { if (me != null) me.h.post(() -> me.bubble(text, ms)); }

    void open(String what) {
        if ("pet".equals(what) && idle[2] != null) pet.setImageBitmap(idle[2]);
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
        h.postDelayed(() -> FloatPetPlugin.tapped(what), 600);
    }

    void sizeLp() {
        int hpx = Math.max(dp(10), dp(120 * sizePct / 100f));   // 100 = 120dp, 10 = 12dp (콩알만)
        lp.height = hpx;
        lp.width = (int) (hpx * 1.1f);
    }
    void applySize() { if (pet != null && lp != null) { sizeLp(); wm.updateViewLayout(pet, lp); } }
    static void reload() { if (me != null) me.h.post(() -> { SharedPreferences sp = me.getSharedPreferences("pet", 0); me.sizePct = sp.getInt("size", 100); me.act = sp.getInt("act", 2); me.name = sp.getString("name", "다루"); me.applySize(); if (me.hint != null) me.hint.setText(me.name + "에게 말 걸기…"); }); }
    static void setSizeStatic(int s) { if (me != null) { me.sizePct = s; me.h.post(me::applySize); } }

    @Override
    public void onDestroy() {
        Log.i("HaruPet", "service destroy");
        h.removeCallbacksAndMessages(null);
        try { if (pet != null) wm.removeView(pet); } catch (Exception ignored) { }
        try { if (bar != null) wm.removeView(bar); } catch (Exception ignored) { }
        try { if (bub != null) wm.removeView(bub); } catch (Exception ignored) { }
        pet = null; bar = null; me = null;
        super.onDestroy();
    }
}

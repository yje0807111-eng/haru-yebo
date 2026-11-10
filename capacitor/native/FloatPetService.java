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
    Bitmap[] idle, walk, run, upF, downF;
    int sizePct = 100, act = 2;          // act: 0 가만히 · 1 조금 · 2 보통 · 3 활발 · 4 아주 활발
    String name = "다루";
    // 돌아다니기
    boolean hopping = false;   // 계단 뛰기 중 (빠르게)
    float px, tx, py = -1, ty = -1; int dir = 1; boolean moving = false, running = false; int frame = 0; long nextDecide = 0;

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
        if (wantShown) { SharedPreferences ps = getSharedPreferences("pet", 0); String k = ps.getString("sp", "dog") + "|" + ps.getString("walk", "") + ps.getString("up", ""); if (!k.equals(loadedSp)) loadLists(); }   // 고른 동물 다시 확인
        if (pet != null) pet.setVisibility(vis);
        if (bar != null) bar.setVisibility(View.GONE);
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
        String ch = "haru_pet2";   // 11-06: 아이콘에 '1'이 뜨지 않게 (늘 있는 알림은 숫자로 세지 않음)
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            try { nm.deleteNotificationChannel("haru_pet"); } catch (Exception ignored) { }
            NotificationChannel nc = new NotificationChannel(ch, "화면 위 팻", NotificationManager.IMPORTANCE_MIN);
            nc.setShowBadge(false);
            nm.createNotificationChannel(nc);
        }
        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, ch) : new Notification.Builder(this);
        Notification n = b.setContentTitle("하루 예보").setContentText("팻이 화면에서 놀고 있어요").setSmallIcon(getApplicationInfo().icon).setContentIntent(pi).setOngoing(true).build();
        boolean micOk = Build.VERSION.SDK_INT < 23 || checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE | (micOk ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0));
            else if (Build.VERSION.SDK_INT >= 30) startForeground(7, n, micOk ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0);
            else startForeground(7, n);
        } catch (Exception e) {
            Log.e("HaruPet", "fg", e); note("fg " + e);
            if (Build.VERSION.SDK_INT >= 34) startForeground(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE); else startForeground(7, n);
        }
    }

    // 11-10: 영상 동작이 늘어 그림이 많아짐 → 작게(높이 320) 줄여 한 번만 읽고 같이 씀 (메모리 아끼기, 듣기 끊김 방지)
    final java.util.HashMap<String, Bitmap> bcache = new java.util.HashMap<>(); String bcacheSp = "";
    synchronized Bitmap load(String n) {
        String sp = getSharedPreferences("pet", 0).getString("sp", "dog");
        if (!sp.equals(bcacheSp)) { bcache.clear(); bcacheSp = sp; }
        Bitmap c = bcache.get(n); if (c != null) return c;
        try (InputStream in = getAssets().open("public/chars/" + sp + "/" + n)) {
            Bitmap b = BitmapFactory.decodeStream(in); if (b == null) return null;
            int H = 320; if (b.getHeight() > H) b = Bitmap.createScaledBitmap(b, Math.max(1, b.getWidth() * H / b.getHeight()), H, true);
            if (bcache.size() > 220) bcache.clear();
            bcache.put(n, b); return b;
        }
        catch (Throwable e) { return null; }
    }

    // 11-06: 고른 동물의 그림 목록(앱이 config 로 넘겨줌). 없으면 예전 강아지 그림
    Bitmap[] list(String key, String[] def) {
        String v = getSharedPreferences("pet", 0).getString(key, "");
        String[] names = v == null || v.isEmpty() ? def : v.split("\\|");
        if (names.length > 24) { String[] nn = new String[24]; for (int j = 0; j < 24; j++) nn[j] = names[j * names.length / 24]; names = nn; }   // 11-10: 너무 많으면 고르게 24장만
        java.util.ArrayList<Bitmap> out = new java.util.ArrayList<>();
        for (String n : names) { Bitmap b = load(n); if (b != null) out.add(b); }
        if (out.isEmpty()) { Bitmap b = load("정면.webp"); if (b != null) out.add(b); }
        while (out.size() < 5 && key.equals("idle")) out.add(out.get(0));
        return out.toArray(new Bitmap[0]);
    }
    String loadedSp = "";
    void loadLists() {
        idle = list("idle", new String[] { "정면.webp", "눈망울_앉기.webp", "기쁨.webp", "a_윙크_1.webp", "엎드림.webp" });
        walk = list("walk", new String[] { "걷기1.webp", "걷기2.webp" });
        run = list("run", new String[] { "뛰기1.webp", "뛰기2.webp" });
        upF = getSharedPreferences("pet", 0).getString("up", "").isEmpty() ? null : list("up", new String[0]);   // 11-10: 위로 = 뒤돌아 걷기
        downF = getSharedPreferences("pet", 0).getString("down", "").isEmpty() ? null : list("down", new String[0]);   // 아래로 = 춤(걸어오기)
        loadedSp = getSharedPreferences("pet", 0).getString("sp", "dog") + "|" + getSharedPreferences("pet", 0).getString("walk", "") + getSharedPreferences("pet", 0).getString("up", "");
        if (pet != null && idle.length > 0 && idle[0] != null) pet.setImageBitmap(idle[0]);
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

    // 👋 휴대폰 화면을 켜고 잠금을 풀면 팻이 반갑게 인사 (11-07)
    android.content.BroadcastReceiver screenRx;
    long lastHello = 0;
    void greet() {
        if (pet == null || !wantShown) return;
        long now = System.currentTimeMillis();
        if (now - lastHello < 20000) return;   // 너무 자주는 말고
        lastHello = now;
        moving = false; hopping = false;
        Bitmap[] hf = list("hello", new String[] { "기쁨.webp" });
        if (hf.length > 1) showFramesB(hf, 6, 4000); else if (hf.length == 1 && hf[0] != null) { pet.setScaleX(1); pet.setImageBitmap(hf[0]); nextDecide = now + 4000; }
        SharedPreferences sp = getSharedPreferences("pet", 0);
        String u = sp.getString("uname", ""); String call = u.isEmpty() ? "" : u + "! ";
        int hr = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
        String[] lines = hr < 5 ? new String[] { "늦었는데 안 자? 🌙", "아직 깨어 있구나! 나도 있어~" }
            : hr < 11 ? new String[] { "좋은 아침이야! ☀️", "왔구나! 오늘도 잘 부탁해 🐾", "일어났어? 반가워!" }
            : hr < 18 ? new String[] { "왔구나! 반가워 🐾", "헤헤 보고 싶었어!", "어서 와~ 나 여기 있어!" }
            : new String[] { "왔구나! 오늘 하루 어땠어? 🌙", "반가워~ 고생 많았어 💛", "어서 와! 보고 싶었어 🐾" };
        bubble(call + lines[(int) (Math.random() * lines.length)], 4500);
        if (sp.getBoolean("cries", true)) bark(true, sp.getFloat("vol", 0.5f));
    }
    void build() {
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        SharedPreferences sp = getSharedPreferences("pet", 0);
        // 🐶 팻
        try {
            loadLists();
            pet = new ImageView(this);
            pet.setScaleType(ImageView.ScaleType.FIT_CENTER);
            if (idle[0] != null) pet.setImageBitmap(idle[0]);
            lp = params();
            lp.x = sp.getInt("x", sw() / 2 - dp(60));
            lp.y = sp.getInt("y", sh() - dp(330));
            px = tx = lp.x;
            sizeLp();
            pet.setOnTouchListener(dragger(pet, lp, "", () -> listen(), true));   // 11-06: 누르면 바로 말로 대화
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
            mic = new TextView(this);
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
            // 11-06 사용자: 바탕화면에는 말창 없이 팻만 (말창이 화면을 가림) — 팻을 누르면 바로 음성 대화
            Log.i("HaruPet", "bar added x=" + blp.x + " y=" + blp.y);
        } catch (Exception e) { Log.e("HaruPet", "bar", e); note("bar " + e); }
        h.post(tick);
        try {
            screenRx = new android.content.BroadcastReceiver() { @Override public void onReceive(Context c, Intent i) { if (Intent.ACTION_USER_PRESENT.equals(i.getAction())) { h.postDelayed(() -> greet(), 400); new Thread(() -> HaruSms.daily(c)).start(); } else if (Intent.ACTION_SCREEN_ON.equals(i.getAction())) { try { if (!((android.app.KeyguardManager) getSystemService(KEYGUARD_SERVICE)).isKeyguardLocked()) h.postDelayed(() -> greet(), 400); } catch (Exception ignored) { } } } };
            android.content.IntentFilter f = new android.content.IntentFilter(Intent.ACTION_USER_PRESENT); f.addAction(Intent.ACTION_SCREEN_ON);   // 잠금 없는 휴대폰도 화면이 켜지면 인사
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenRx, f, Context.RECEIVER_EXPORTED); else registerReceiver(screenRx, f);
        } catch (Exception e) { Log.e("HaruPet", "screenRx", e); }
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
                        if (moved) { p.x = ox + (int) dx; p.y = oy + (int) dy; wm.updateViewLayout(v, p); if (isPet) { px = tx = p.x; py = ty = p.y; if (homeMode) homeMode = false; } else if (homeMode && pet != null) { lp.y = homeY(); lp.x = Math.max(blp.x, Math.min(blp.x + blp.width - lp.width, lp.x)); px = tx = lp.x; wm.updateViewLayout(pet, lp); } }
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
    // 🌙 11-08: 팻을 누르고 "끝" → 쏙 작아지며 사라지고 하루 예보 끝 (울어서 끄기 쉽게)
    boolean leaving = false;
    void vanish() {
        if (pet == null) { quitAll(); return; }
        leaving = true; held = true;
        if (bub != null) bub.setVisibility(View.GONE);
        try { pet.setPivotX(pet.getWidth() / 2f); pet.setPivotY(pet.getHeight() * 0.6f); } catch (Exception ignored) { }
        final float sx = pet.getScaleX() < 0 ? -1 : 1;
        pet.animate().scaleX(0.05f * sx).scaleY(0.05f).alpha(0f).setDuration(450).withEndAction(this::quitAll).start();
    }
    void quitAll() {
        getSharedPreferences("pet", 0).edit().putBoolean("on", false).commit();
        FloatPetPlugin.finishApp();
        try { stopSelf(); } catch (Exception ignored) { }
    }
    boolean endWord(String t) {
        String s = t == null ? "" : t.trim();
        if (!s.matches("^(하루야\\s*)?(끝|끝내|끝내기|끝내\\s*줘|끝내자|끝낼게|하루\\s*예보\\s*끝내?)[\\s.!~]*$")) return false;
        bubble("잘 자~ 또 불러 줘 🐾", 900);
        h.postDelayed(this::vanish, 700);
        return true;
    }

    // 1초에 25번: 걷기·뛰기 그림 바꾸며 옆으로 돌아다니기 (팻 기분·움직이는 정도 따라)
    final Runnable tick = new Runnable() {
        long last = 0;
        @Override
        public void run() {
            if (pet == null) return;
            long now = System.currentTimeMillis();
            try {
                if (HaruBall.on && !wantShown && now - HaruBall.startedAt > 2500) HaruBall.stop(FloatPetService.this, false);   // 하루 예보를 열면 게임 끝
                if (!held && wantShown && HaruBall.on && !listening) HaruBall.tick(FloatPetService.this, now);   // 듣는 동안엔 잠깐 멈춤   // 🎾 공 던지기 중
                else if (!held && wantShown) {
                    if (moving) {
                        float speed = dp(hopping ? 11 : running ? (act >= 4 ? 7 : 5) : 2.2f);
                        if (py < 0) py = ty = lp.y;
                        float d = tx - px, dyy = ty - py, dist = (float) Math.hypot(d, dyy);
                        if (dist <= speed) { px = tx; py = ty; moving = false; hopping = false; pet.setImageBitmap(pick(idle, now)); pet.setScaleX(1); nextDecide = now + restMs(); }
                        else {
                            px += d / dist * speed; py += dyy / dist * speed; if (Math.abs(d) > 1) dir = d > 0 ? 1 : -1;
                            boolean vert = !hopping && Math.abs(dyy) > Math.abs(d) * 1.2f; Bitmap[] vf = vert ? (dyy > 0 ? downF : upF) : null;   // 11-10: 위아래로 갈 땐 앞/뒤 모습
                            if (vf != null && vf.length > 0) { if (now - last > 125) { last = now; frame++; Bitmap b = vf[frame % vf.length]; if (b != null) pet.setImageBitmap(b); } pet.setScaleX(1); }
                            else { Bitmap[] f = running ? run : walk; if (now - last > (f.length > 4 ? 125 : running ? 140 : 200)) { last = now; frame++; Bitmap b = f[frame % f.length]; if (b != null) pet.setImageBitmap(b); }
                            pet.setScaleX(-dir); }  // 그림은 왼쪽을 봄 → 오른쪽으로 갈 땐 뒤집기
                        }
                        lp.x = (int) px; lp.y = (int) py - (hopping ? (int) (dp(26) * Math.sin(Math.PI * Math.min(1f, Math.abs(ty - py) / Math.max(1f, dp(180))))) : 0); wm.updateViewLayout(pet, lp);
                    } else if (poseFrames != null && now < poseUntil) {
                        if (now - poseLast > 1000 / poseFps) { poseLast = now; poseFi = poseOnce && poseFi + 1 >= poseFrames.length ? poseFrames.length - 1 : (poseFi + 1) % poseFrames.length; if (poseFrames[poseFi] != null) pet.setImageBitmap(poseFrames[poseFi]); }
                    } else if (now > nextDecide) { poseFrames = null; decide(now); }
                    maybeChat(now); if (!maybeFacts(now)) maybeTeach(now); maybeHungry(now);   // 상식을 켜 두면 상식+동작, 끄면 명령 말+동작
                    musicDance(now);
                }
            } catch (Exception e) { Log.e("HaruPet", "tick", e); }
            h.postDelayed(this, 40);
        }
    };
    Bitmap pick(Bitmap[] a, long seed) { Bitmap b = a[(int) (Math.random() * a.length)]; return b != null ? b : a[0]; }
    long restMs() { return act >= 4 ? 700 + (long) (Math.random() * 1500) : act == 3 ? 1500 + (long) (Math.random() * 3000) : act == 2 ? 4000 + (long) (Math.random() * 6000) : act == 1 ? 9000 + (long) (Math.random() * 12000) : 3600000; }
    long lastBark = 0;
    void maybeBark(long now) {
        SharedPreferences sp = getSharedPreferences("pet", 0);
        if (!sp.getBoolean("cries", true) || act <= 0 || !screenOn()) return;
        int hr = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
        if (hr >= 23 || hr < 7) return;
        long gap = act >= 4 ? 45000 : act == 3 ? 90000 : act == 2 ? 180000 : 360000;   // 최소 간격
        if (now - lastBark < gap) return;
        double p = act >= 4 ? 0.35 : act == 3 ? 0.22 : act == 2 ? 0.12 : 0.05;
        if (Math.random() > p) return;
        lastBark = now;
        bark(Math.random() < 0.5, sp.getFloat("vol", 0.5f));
        Bitmap b = load("소리.webp"); if (b != null && pet != null) { pet.setScaleX(1); pet.setImageBitmap(b); }
    }

    // 💬 말 걸기 (11-07): 설정의 '말 걸고 움직이는 정도' — 자주 5분 · 보통 20분 · 가끔 30분 · 조용히 0
    long nextChat = 0;
    String[] CHAT = { "뭐 하고 있어? 나 심심해 🐾", "물 한 잔 마셨어? 💧", "잠깐 기지개 켜 볼까? 🙆", "오늘 하루 어때? 나를 누르고 말해 줘!", "궁금한 거 있으면 물어봐! 내가 찾아 줄게 🔎",
        "눈이 피곤하면 잠깐 먼 곳을 봐 줘 👀", "나 여기 있어~ 같이 놀자!", "어깨 한 번 쭉 펴 볼까? 💪", "오늘도 잘하고 있어 💛", "심심하면 나를 눌러서 \"만세\" 해 봐!" };
    // 11-10: 💡 상식 정보 — 화면이 켜져 있을 때 1분마다 상식 한 줄 + 팻 동작 하나씩 (차례로 전부)
    //  상식 창고: github.io/haru-yebo/facts (매일 채움) · 20대 이상은 위키백과도 가끔 · 영어 단어도 가끔
    static final String FACTS = "https://yje0807111-eng.github.io/haru-yebo/facts/";
    final java.util.ArrayList<String> factQ = new java.util.ArrayList<>(); volatile boolean factLoading = false; int factTick = 0;
    String httpGet(String u) throws Exception {
        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(u).openConnection();
        c.setConnectTimeout(8000); c.setReadTimeout(8000); c.setRequestProperty("User-Agent", "HaruYebo/1.0 (pet app)");
        try (java.io.InputStream in = c.getInputStream()) { java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream(); byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n); return o.toString("UTF-8"); }
    }
    void loadFacts() {
        if (factLoading) return; factLoading = true;
        new Thread(() -> {
            try {
                SharedPreferences sp = getSharedPreferences("pet", 0); int age = sp.getInt("age", 0);
                int files = new org.json.JSONObject(httpGet(FACTS + "index.json")).optInt("files", 1);
                int f = sp.getInt("factFile", 0) % Math.max(1, files);
                org.json.JSONArray a = new org.json.JSONArray(httpGet(FACTS + String.format(java.util.Locale.US, "%04d.json", f + 1)));
                java.util.ArrayList<String> got = new java.util.ArrayList<>();
                for (int i = 0; i < a.length(); i++) { org.json.JSONArray e = a.getJSONArray(i); int lo = e.optInt(1, 10), hi = e.optInt(2, 99); if (age == 0 || (age >= lo && age <= hi)) got.add(e.getString(0)); }
                java.util.Collections.shuffle(got);
                sp.edit().putInt("factFile", f + 1).apply();
                h.post(() -> factQ.addAll(got));
            } catch (Exception e) { Log.e("HaruPet", "facts", e); }
            factLoading = false;
        }).start();
    }
    void wikiFact() {   // 위키백과 아무 글 요약 한 토막 (사람·동네 이름 같은 건 거름)
        new Thread(() -> {
            try {
                for (int k = 0; k < 4; k++) {
                    org.json.JSONObject j = new org.json.JSONObject(httpGet("https://ko.wikipedia.org/api/rest_v1/page/random/summary"));
                    String t = j.optString("title", ""), d = j.optString("description", ""), x = j.optString("extract", "");
                    if (x.length() < 30 || t.matches(".*[0-9].*") || (d + x).matches("(?s).*(정치인|배우|가수|선수|기업인|아나운서|읍|면|리 |동 |마을|군 |시 |구 |역|고등학교|중학교|초등학교|대학교|방송|프로그램|드라마|앨범|노래|싱글).*")) continue;
                    int dot = x.indexOf("다."); String one = dot > 0 ? x.substring(0, dot + 2) : x;
                    if (one.length() > 110) one = one.substring(0, 108) + "…";
                    final String msg = "📖 " + one + " (위키백과)";
                    h.post(() -> showFact(msg)); return;
                }
            } catch (Exception e) { Log.e("HaruPet", "wiki", e); }
            h.post(() -> { if (!factQ.isEmpty()) showFact(factQ.remove(0)); });
        }).start();
    }
    void showFact(String text) {
        int ms = Math.max(7000, Math.min(14000, 5000 + text.length() * 110));   // 11-10: 읽을 시간만큼 보여 주고 바로 다음 (끊임없이)
        bubble(text, ms); nextFact = System.currentTimeMillis() + ms + 700;
        long nowP = System.currentTimeMillis(); if (nowP - factPoseAt < 60000) return; factPoseAt = nowP;   // 11-10: 팻 동작은 1분에 하나씩 (상식은 끊임없이)
        String all = getSharedPreferences("pet", 0).getString("teach", "");   // 팻 동작은 차례로 하나씩 전부
        if (all != null && !all.isEmpty()) { String[] L = all.split("\n"); String[] e = L[teachI++ % L.length].split("\t"); if (e.length >= 3) { poseOnce = "1".equals(e[1]); showFrames(e[2].split("\\|"), 8, 60000); } }
    }
    long nextFact = 0, factPoseAt = 0;
    boolean maybeFacts(long now) {
        SharedPreferences sp = getSharedPreferences("pet", 0);
        if (!sp.getBoolean("factsOn", true)) return false;
        if (listening || moving || HaruBall.on || !screenOn()) return true;
        if (factQ.size() < 10) loadFacts();
        if (nextFact == 0) { nextFact = now + 4000; return true; }
        if (now < nextFact) return true;
        nextFact = now + 15000;   // 위키백과 받는 동안 잠깐 (showFact 가 다시 맞춤)
        int k = factTick++ % 6, age = sp.getInt("age", 0);
        if (k == 2) { String eng = sp.getString("eng", ""); if (eng != null && !eng.isEmpty()) { String[] L = eng.split("\n"); showFact("🇺🇸 오늘의 영어: " + L[(int) (Math.random() * L.length)]); return true; } }
        if (k == 4 && age >= 20) { wikiFact(); return true; }
        if (!factQ.isEmpty()) showFact(factQ.remove(0));
        return true;
    }
    // 11-10: 혼자 운동하기 (축구·농구·야구·테니스·줄넘기·태권도·훌라후프·자전거 중 하나)
    boolean playSport() {
        String s = getSharedPreferences("pet", 0).getString("sports", "");
        if (s == null || s.isEmpty()) return false;
        String[] g = s.split(";"); String one = g[(int) (Math.random() * g.length)];
        if (one.isEmpty()) return false;
        poseOnce = false; showFrames(one.split("\\|"), 8, 6000); return true;
    }
    // 11-10: 명령 알려 주기 — 정해 둔 간격(기본 1분)마다 명령 하나를 말하고 그 동작을 보여 줌 (차례대로 전부)
    long nextTeach = 0; int teachI = 0;
    void maybeTeach(long now) {
        SharedPreferences sp = getSharedPreferences("pet", 0);
        int min = sp.getInt("teachMin", 1);
        if (min <= 0 || listening || moving || HaruBall.on || !screenOn()) return;
        if (nextTeach == 0) { nextTeach = now + min * 60000L; return; }
        if (now < nextTeach) return;
        nextTeach = now + min * 60000L;
        String all = sp.getString("teach", "");
        if (all == null || all.isEmpty()) return;
        String[] L = all.split("\n"); String[] e = L[teachI++ % L.length].split("\t");
        if (e.length < 3) return;
        bubble(e[0] + "!", 5000);   // 명령 말만 딱
        poseOnce = "1".equals(e[1]); showFrames(e[2].split("\\|"), 8, 6000);
    }
    // 11-10: 1시간마다 배고프다고 꼬르륵 → 누르면 앱에서 밥 주기
    long nextHungry = 0;
    void maybeHungry(long now) {
        if (true) return;   // 11-10 사용자: 배고픈 소리 없앰
        if (listening || moving || HaruBall.on || !screenOn()) return;
        if (nextHungry == 0) { nextHungry = now + 60 * 60000L; return; }
        if (now < nextHungry) return;
        nextHungry = now + 60 * 60000L;
        try { android.content.res.AssetFileDescriptor fd = getAssets().openFd("public/sounds/tummy_growl.mp3"); if (mp != null) { try { mp.release(); } catch (Exception ignored) { } } mp = new android.media.MediaPlayer(); mp.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength()); fd.close(); mp.prepare(); mp.start(); } catch (Exception e) { }
        sayOpenStatic("배고파… 꼬르륵 🍚\n👉 누르면 밥 주기", "feed", 30000);
        String hf = getSharedPreferences("pet", 0).getString("hungryF", "");
        if (hf != null && !hf.isEmpty()) { poseOnce = false; showFrames(hf.split("\\|"), 8, 8000); }
    }
    void maybeChat(long now) {
        SharedPreferences sp = getSharedPreferences("pet", 0);
        int min = sp.getInt("talkMin", 20);
        if (min <= 0) { nextChat = now + 60000; return; }
        if (!screenOn()) return;   // 화면이 꺼져 있으면 말 걸지 않기
        if (nextChat == 0) { nextChat = now + min * 60000L; return; }
        if (now < nextChat) return;
        nextChat = now + min * 60000L;
        int hr = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
        if (hr >= 23 || hr < 7) return;
        if (bub != null && bub.getVisibility() == View.VISIBLE) return;
        String u = sp.getString("uname", ""); String call = u.isEmpty() ? "" : u + "! ";
        String line;
        double r = Math.random();
        if (r < 0.4) line = hr < 10 ? "좋은 아침이야! ☀️ 아침은 먹었어?" : hr < 14 ? "점심 맛있게 먹어! 🍚" : hr < 18 ? "오후도 힘내! 💪" : "오늘도 수고했어 🌙 푹 쉬자";
        else line = CHAT[(int) (Math.random() * CHAT.length)];
        bubble(call + line, 7000);
    }
    void decide(long now) {
        if (act <= 0) { nextDecide = now + 60000; return; }
        maybeBark(now);
        double r = Math.random();
        // 11-06 팻 기분: 활발 = 화면 전체 · 평범 = 놓은 높이에서 옆으로만 · 소심 = 그 자리에서만
        String tm = getSharedPreferences("pet", 0).getString("temper", "normal");
        double moveP = "shy".equals(tm) ? 0 : "active".equals(tm) ? 0.95 : act >= 4 ? 0.92 : act == 3 ? 0.75 : act == 2 ? 0.45 : 0.2;
        if (r < moveP) {
            int w = lp.width > 0 ? lp.width : dp(120);
            if (py < 0) py = lp.y;
            if (homeMode && blp != null) { int bw = blp.width > 0 ? blp.width : sw(); tx = blp.x + (float) (Math.random() * Math.max(1, bw - w)); ty = homeY(); }
            else {
                tx = (float) (Math.random() * Math.max(1, sw() - w));
                int hgt = lp.height > 0 ? lp.height : dp(120);
                int top = dp(60), bottom = sh() - dp(110) - hgt;   // 11-07: 말창이 없어졌으니 화면 아래까지
                ty = top + (float) (Math.random() * Math.max(1, bottom - top));
                if ("active".equals(tm) && Math.random() < 0.45) {   // 계단처럼 한 칸 뛰어 내리기·오르기
                    float step = dp(90 + (float) (Math.random() * 90));
                    boolean down = py < top + (bottom - top) * 0.35f ? true : py > top + (bottom - top) * 0.75f ? false : Math.random() < 0.5;
                    ty = Math.max(top, Math.min(bottom, py + (down ? step : -step)));
                    tx = Math.max(0, Math.min(sw() - w, px + (float) ((Math.random() < 0.5 ? -1 : 1) * dp(40 + (float) (Math.random() * 80)))));
                    hopping = true;
                }
            }
            if ("normal".equals(tm) && !homeMode) ty = py;   // 평범: 옆으로만
            running = "active".equals(tm) ? Math.random() < 0.75 : act >= 3 ? Math.random() < (act >= 4 ? 0.7 : 0.45) : Math.random() < 0.15;
            moving = true;
        } else if (Math.random() < ("active".equals(tm) ? 0.35 : 0.2) && playSport()) { nextDecide = now + 6000; }   // 11-10: 가끔 혼자 운동
        else { pet.setImageBitmap(pick(idle, now)); nextDecide = now + ("active".equals(tm) ? 500 + (long) (Math.random() * 1200) : restMs()); }
    }

    // ── 바탕화면 말창에서 바로 쓰기
    EditText input;
    TextView mic;
    GradientDrawable micBg;
    // 🎮 11-08: 게임 중에도 언제든 "게임 끝"·"끝" → 게임만 끝 (앱은 그대로) · 앞으로 다른 게임도 여기에
    boolean listening = false;
    static boolean gameOn() { return HaruBall.on; }
    void stopGames() { if (HaruBall.on) HaruBall.stop(this, true); }
    boolean gameWord(String t) {
        if (!gameOn()) return false;
        String x = t == null ? "" : t.trim();
        if (!x.matches("^(하루야\\s*)?((게임|공\\s*놀이|공\\s*던지기|놀이)\\s*)?(끝|끝내|끝내기|끝내\\s*줘|끝내자|그만|그만해|그만하자|그만\\s*놀자|종료|멈춰)[\\s.!~]*$")) return false;
        stopGames(); return true;
    }
    void micRed(boolean on) { listening = on; if (mic == null) return; if (micBg == null) { micBg = new GradientDrawable(); micBg.setStroke(dp(2), Color.parseColor("#2B2118")); micBg.setCornerRadius(dp(20)); } micBg.setColor(Color.parseColor(on ? "#FF6B6B" : "#FFFFFF")); mic.setBackground(micBg); }
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
        if (composing()) { composeConfirm(t); return; }
        if (gameWord(t)) return;   // 🎮 게임만 끝
        if (endWord(t)) return;   // 🌙 "끝"   // ✉️💬 받아 적는 중이면 쓴 글 = 보낼 글
        bubble("💭 …", 20000);
        ack = false;
        FloatPetPlugin.overlayText(t);
        // 하루 예보가 대답을 못 하면(꺼져 있으면) 열어서 이어서 하기
        h.postDelayed(() -> { if (!ack) { FloatPetPlugin.pending = t; open("run"); } }, 6000);   // 11-09: 앱이 늦게 답하면 앱을 열어 그 말을 그대로 처리 (검색창에 넣지 않음)
    }


    // 11-06: 마이크 켜질 때·꺼질 때 '띵' 소리 줄이기 (micBeep 2 보통 · 1 작게 · 0 끄기) — 잠깐 소리 크기를 낮췄다가 되돌림
    static int[] savedVol = null;
    static final int[] BEEP_STREAMS = { android.media.AudioManager.STREAM_MUSIC, android.media.AudioManager.STREAM_SYSTEM, android.media.AudioManager.STREAM_NOTIFICATION };
    static void beepQuiet(Context c, int level) {
        if (level >= 2 || savedVol != null) return;
        try {
            android.media.AudioManager am = (android.media.AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            savedVol = new int[BEEP_STREAMS.length];
            for (int k = 0; k < BEEP_STREAMS.length; k++) {
                savedVol[k] = am.getStreamVolume(BEEP_STREAMS[k]);
                int to = level <= 0 ? 0 : Math.max(1, am.getStreamMaxVolume(BEEP_STREAMS[k]) / 6);
                if (to < savedVol[k]) { try { am.setStreamVolume(BEEP_STREAMS[k], to, 0); } catch (Exception ignored) { } }
            }
        } catch (Exception e) { savedVol = null; }
    }
    static void beepRestore(Context c) {
        if (savedVol == null) return;
        try {
            android.media.AudioManager am = (android.media.AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            for (int k = 0; k < BEEP_STREAMS.length; k++) { try { am.setStreamVolume(BEEP_STREAMS[k], savedVol[k], 0); } catch (Exception ignored) { } }
        } catch (Exception ignored) { }
        savedVol = null;
    }

    // ── 💬 카톡: 노란 말풍선 → 누르면 그 대화방 → 팻 누르고 말하면 글로 써서 보내기(한 번 더 확인)
    GradientDrawable bubBg;
    String bubKind = "", nextKind = "";          // "" 보통 · "kakao" 누르면 대화방 · "reply" 누르면 보내기
    String replyText = "", telNum = "", openWhat = "";
    long replyUntil = 0;          // 이 시간까지는 팻을 누르고 한 말 = 카톡 답장
    void bubTap() {
        String k = bubKind; bubKind = "";
        if (bub != null) bub.setVisibility(View.GONE);
        if ("kakao".equals(k)) openKakao();
        else if ("reply".equals(k)) sendReply(replyText);
        else if ("csend".equals(k)) composeSend();
        else if ("open".equals(k)) open(openWhat);   // 💬📞 대화방·전화 열기
        else if ("tel".equals(k)) { try { Intent i = new Intent(Intent.ACTION_DIAL, android.net.Uri.parse("tel:" + android.net.Uri.encode(telNum.replaceAll("[^0-9+*#]", "")))); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); } catch (Exception e) { bubble("전화 화면을 못 열었어 🥲", 3000); } }
    }
    void bubbleK(String kind, String text, int ms) { nextKind = kind; bubble(text, ms); h.postDelayed(() -> { if (bub == null || bub.getVisibility() != View.VISIBLE) bubKind = ""; }, ms + 100); }
    void openKakao() {
        boolean ok = false;
        PendingIntent pi = HaruNotiListener.kakaoOpen;
        if (pi != null) {
            try {
                if (Build.VERSION.SDK_INT >= 34) {
                    android.app.ActivityOptions o = android.app.ActivityOptions.makeBasic();
                    o.setPendingIntentBackgroundActivityStartMode(android.app.ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED);
                    pi.send(this, 0, null, null, null, null, o.toBundle());
                } else pi.send();
                ok = true;
            } catch (Exception e) { Log.e("HaruPet", "kakao open", e); }
        }
        if (!ok) { try { Intent i = getPackageManager().getLaunchIntentForPackage("com.kakao.talk"); if (i != null) { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); ok = true; } } catch (Exception ignored) { } }
        if (ok) {
            replyUntil = System.currentTimeMillis() + 600000; replyStart = System.currentTimeMillis();
            h.postDelayed(() -> bubble("💬 " + HaruNotiListener.kakaoWho + " 대화방을 열었어!\n나를 누르고 말하면 글로 써 줄게 🎤", 7000), 900);
        } else bubble("카톡을 못 열었어 🥲", 3000);
    }

    // 지금 카톡 대화방이 앞에 있나? (사용 기록 허락 있으면 정확히, 없으면 1분 동안만)
    boolean inKakaoChat() {   // 11-07 권한 줄임: 대화방을 연 뒤(또는 보낸 뒤) 1분 동안만 답장
        long now = System.currentTimeMillis();
        return now < replyUntil && now - replyStart < 60000;
    }
    long replyStart = 0;
    // ✉️💬 11-08: "엄마에게 문자(카톡) 보내 줘" → 어떻게 보낼까? → 말하면 받아 적고 → 말풍선 누르면 보냄
    String cKind = "", cWho = "", cNum = "", cText = ""; long cUntil = 0;
    boolean composing() { return System.currentTimeMillis() < cUntil; }
    String cIcon() { return "sms".equals(cKind) ? "✉️ " : "💬 "; }
    String cWhat() { return "sms".equals(cKind) ? "문자" : "카톡"; }
    void composeStart(String kind, String who, String num, String text) {
        cKind = kind; cWho = who == null ? "" : who; cNum = num == null ? "" : num; cText = "";
        if (text != null && !text.trim().isEmpty()) { composeConfirm(text.trim()); return; }
        cUntil = System.currentTimeMillis() + 90000;
        bubble(cIcon() + cWho + "에게 " + cWhat() + " 어떻게 보낼까?\n말해 줘 🎤", 4000);
        h.postDelayed(() -> { if (composing() && cText.isEmpty()) listen(); }, 1600);   // 바로 듣기
    }
    void composeConfirm(String text) {
        cText = text; cUntil = System.currentTimeMillis() + 30000;   // 30초 안에 나를 누르면 다시 받아 적기
        bubbleK("csend", cIcon() + cWho + "에게 이렇게 보낼까?\n\"" + text + "\"\n👉 여기를 누르면 보내요 (다시 말하려면 나를 눌러)", 30000);
    }
    void composeSend() {
        String text = cText; cUntil = 0; cText = "";
        if (text.isEmpty()) return;
        if ("sms".equals(cKind)) {
            String r = HaruSend.sms(this, cNum, text);
            try { if ("sent".equals(r)) HaruTts.speak(this, cWho + "에게 일반 문자로 보냈어", "sent"); } catch (Exception ignored) { }
            bubble("sent".equals(r) ? "✉️ " + cWho + "에게 문자 보냈어! ✓" : "open".equals(r) ? "✉️ 문자 화면에 글을 채워 뒀어.\n보내기 단추만 눌러 줘" : "문자를 못 보냈어 🥲", 5000);
        } else {
            String r = HaruSend.kakao(this, cWho, text);
            try { if ("reply".equals(r)) HaruTts.speak(this, cWho + "에게 카톡 보냈어", "sent"); } catch (Exception ignored) { }
            bubble("reply".equals(r) ? "💬 " + cWho + "에게 카톡 보냈어! ✓" : "share".equals(r) ? "💬 글은 채워 뒀어!\n" + cWho + " 님을 찾아 누르고 [확인]만 눌러 줘" : "카톡을 못 열었어 🥲 글은 복사해 뒀어", 9000);
        }
    }
    void confirmReply(String text) {
        replyText = text;
        bubbleK("reply", "💬 " + HaruNotiListener.kakaoWho + "에게 이렇게 보낼까?\n\"" + text + "\"\n👉 여기를 누르면 보내요 (다시 말하려면 나를 눌러)", 20000);
    }
    void sendReply(String text) {
        Notification.Action a = HaruNotiListener.kakaoReply;
        if (a != null && a.getRemoteInputs() != null) {
            try {
                Intent fill = new Intent(); Bundle res = new Bundle();
                for (android.app.RemoteInput ri : a.getRemoteInputs()) res.putCharSequence(ri.getResultKey(), text);
                android.app.RemoteInput.addResultsToIntent(a.getRemoteInputs(), fill, res);
                a.actionIntent.send(this, 0, fill);
                replyUntil = System.currentTimeMillis() + 600000; replyStart = System.currentTimeMillis();
                bubble("보냈어! ✓ 더 할 말 있으면 나를 눌러", 4000);
                return;
            } catch (Exception e) { Log.e("HaruPet", "kakao reply", e); }
        }
        try {   // 답장 단추가 없으면: 글을 복사해 두고 붙여 넣게
            android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            cm.setPrimaryClip(android.content.ClipData.newPlainText("하루 예보", text));
            bubble("글을 복사해 뒀어! 📋\n카톡 입력칸을 꾹 눌러 [붙여넣기] 해 줘", 6000);
        } catch (Exception e) { bubble("못 보냈어 🥲", 3000); }
    }
    // ── 바탕화면 🎤: 그 자리에서 듣기
    // 💬 11-09 말로 바로 답장: 하루 대화방에 말이 오면 '띠링' → startMs 안에 말을 시작하면 받아 적고, endMs 동안 조용하면 끝
    //  화면이 켜져 있고 잠금이 풀려 있을 때만 · 결과는 앱(JS)으로 보내서 보낼지·물어볼지 정함
    String arId = ""; boolean arOn = false, arSpoke = false; long arT0 = 0, arLast = 0; int arStart = 6000, arEnd = 3000;
    StringBuilder arText = new StringBuilder(); float arRms = -2; float arConf = -1; SpeechRecognizer arSr = null;
    static boolean autoReplyStatic(String id, int startMs, int endMs, boolean ding) { if (me == null) return false; me.h.post(() -> me.arBegin(id, startMs, endMs, ding)); return true; }
    void arEmit(String kind, String text) { FloatPetPlugin.arEvent(arId, kind, text, arConf, arRms); }
    void arBegin(String id, int startMs, int endMs, boolean ding) {
        if (arOn) arStop();
        arId = id; arStart = Math.max(2000, startMs); arEnd = Math.max(1000, endMs);
        boolean screenOk = false;
        try { android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE); android.app.KeyguardManager km = (android.app.KeyguardManager) getSystemService(KEYGUARD_SERVICE); screenOk = pm.isInteractive() && !km.isKeyguardLocked(); } catch (Exception ignored) { }
        boolean micOk = Build.VERSION.SDK_INT < 23 || checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        if (ding) arDing();
        if (!screenOk || !micOk || !SpeechRecognizer.isRecognitionAvailable(this) || listening) { arEmit("skip", ""); return; }
        arOn = true; arSpoke = false; arText.setLength(0); arRms = -2; arConf = -1; arT0 = System.currentTimeMillis() + (ding ? 450 : 0); arLast = arT0;
        h.postDelayed(this::arListen, ding ? 450 : 0);
        h.postDelayed(arTick, 300);
    }
    void arDing() {   // 하루 대화방 알림 소리 (띠-링)
        try { android.media.ToneGenerator tg = new android.media.ToneGenerator(android.media.AudioManager.STREAM_NOTIFICATION, 70); tg.startTone(android.media.ToneGenerator.TONE_PROP_BEEP2, 300); h.postDelayed(tg::release, 600); } catch (Exception ignored) { }
    }
    final Runnable arTick = new Runnable() { @Override public void run() {
        if (!arOn) return;
        long now = System.currentTimeMillis();
        if (!arSpoke && now - arT0 > arStart) { arFinish(); return; }      // 시작 시간 안에 말이 없음 → 1 만 남김
        if (arSpoke && now - arLast > arEnd) { try { if (arSr != null) arSr.stopListening(); } catch (Exception ignored) { } h.postDelayed(() -> { if (arOn) arFinish(); }, 1500); return; }
        h.postDelayed(this, 250);
    } };
    void arListen() {
        if (!arOn) return;
        try { if (arSr != null) arSr.destroy(); } catch (Exception ignored) { }
        micRed(true);
        arSr = SpeechRecognizer.createSpeechRecognizer(this);
        final int base = arText.length();
        arSr.setRecognitionListener(new RecognitionListener() {
            public void onReadyForSpeech(Bundle p) { }
            public void onBeginningOfSpeech() { arSpoke = true; arLast = System.currentTimeMillis(); }
            public void onRmsChanged(float v) { if (v > arRms) arRms = v; if (v > 4f && arSpoke) arLast = System.currentTimeMillis(); }
            public void onBufferReceived(byte[] b) { }
            public void onEndOfSpeech() { }
            public void onEvent(int t, Bundle b) { }
            public void onPartialResults(Bundle b) {
                ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (m != null && !m.isEmpty() && !m.get(0).isEmpty()) { arSpoke = true; arLast = System.currentTimeMillis(); arEmit("partial", (arText.toString() + " " + m.get(0)).trim()); }
            }
            public void onResults(Bundle b) {
                ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                float[] cf = b.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
                if (m != null && !m.isEmpty() && !m.get(0).trim().isEmpty()) { if (arText.length() > 0) arText.append(' '); arText.append(m.get(0).trim()); arSpoke = true; if (cf != null && cf.length > 0) arConf = arConf < 0 ? cf[0] : Math.min(arConf, cf[0]); }
                if (arOn && arSpoke && System.currentTimeMillis() - arLast < arEnd) h.post(() -> arListen());   // 아직 말이 이어질 수 있음 → 계속 듣기
                else if (arOn) arFinish();
            }
            public void onError(int err) {
                if (!arOn) return;
                long now = System.currentTimeMillis();
                if (!arSpoke && now - arT0 < arStart - 500) { h.postDelayed(() -> arListen(), 150); return; }   // 아직 시작 시간 안 → 다시 듣기
                if (arSpoke && now - arLast < arEnd) { h.postDelayed(() -> arListen(), 150); return; }
                arFinish();
            }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR");
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        i.putExtra("android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", (long) arEnd);
        i.putExtra("android.speech.extra.SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS", (long) arEnd);
        beepQuiet(this, 0);
        try { arSr.startListening(i); } catch (Exception e) { arFinish(); }
    }
    void arFinish() {
        if (!arOn) return;
        String t = arText.toString().trim();
        arStop();
        arEmit(t.isEmpty() ? "none" : "final", t);
    }
    void arStop() {
        arOn = false; h.removeCallbacks(arTick);
        try { if (arSr != null) { arSr.cancel(); arSr.destroy(); } } catch (Exception ignored) { }
        arSr = null; micRed(false); h.postDelayed(() -> beepRestore(FloatPetService.this), 900);
    }
    static void autoReplyStopStatic() { if (me != null) me.h.post(me::arStop); }
    void listen() {
        if (alarmOn) { stopAlarmByTap(); return; }   // 알람 울리는 중이면 누르면 그만
        if (arOn) arStop();
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { open("mic"); return; }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { open("mic"); return; }
        bubble(composing() ? cIcon() + cWho + "에게 보낼 말을 해 줘! 🎤" : inKakaoChat() ? "🎤 " + HaruNotiListener.kakaoWho + "에게 보낼 말을 해 줘!" : "👂 듣고 있어… 말해 줘!", 9000);
        micRed(true);
        final SpeechRecognizer sr = SpeechRecognizer.createSpeechRecognizer(this);
        sr.setRecognitionListener(new RecognitionListener() {
            public void onResults(Bundle b) {
                ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                sr.destroy(); micRed(false); h.postDelayed(() -> beepRestore(FloatPetService.this), 900);
                if (m != null && !m.isEmpty() && composing()) { if (m.get(0).matches("^\\s*(그만|취소|안\\s*보내|됐어)[\\s.!~]*$")) { cUntil = 0; bubble("알겠어, 안 보낼게", 2500); } else composeConfirm(m.get(0)); }   // ✉️💬 받아 적기
                else if (m != null && !m.isEmpty() && HaruNotiListener.kakaoOpen != null && inKakaoChat()) confirmReply(m.get(0));   // 💬 카톡 답장
                else if (m != null && !m.isEmpty() && gameWord(m.get(0))) { }   // 🎮 게임만 끝
                else if (m != null && !m.isEmpty() && endWord(m.get(0))) { }   // 🌙 "끝"
                else if (m != null && !m.isEmpty()) { bubble("👂 \"" + m.get(0) + "\"", 2500); submit(m.get(0)); }
                else bubble("잘 못 들었어 🥲 다시 눌러 줘", 3000);
            }
            public void onError(int err) {
                sr.destroy(); micRed(false); h.postDelayed(() -> beepRestore(FloatPetService.this), 900); Log.i("HaruPet", "listen err " + err); note("listen err " + err);
                if (err == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS || err == SpeechRecognizer.ERROR_AUDIO) open("mic");
                else bubble("잘 못 들었어 🥲 다시 눌러 줘", 3000);
            }
            public void onReadyForSpeech(Bundle p) { }
            public void onBeginningOfSpeech() { }
            public void onRmsChanged(float v) { }
            public void onBufferReceived(byte[] b) { }
            public void onEndOfSpeech() { }
            public void onPartialResults(Bundle b) { ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION); if (m != null && !m.isEmpty() && !m.get(0).isEmpty()) bubble("👂 " + m.get(0) + "…", 6000); }
            public void onEvent(int t, Bundle b) { }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR");
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        beepQuiet(this, getSharedPreferences("pet", 0).getInt("micBeep", 1));
        try { sr.startListening(i); } catch (Exception e) { micRed(false); beepRestore(this); open("mic"); }
    }

    // ── 바탕화면 팻 말풍선
    TextView bub;
    WindowManager.LayoutParams bubLp;
    final Runnable hideBub = () -> { if (bub != null) bub.setVisibility(View.GONE); };
    void bubble(String text, int ms) {
        try {
            if (bub == null) {
                bub = new TextView(this);
                bubBg = new GradientDrawable();
                bubBg.setColor(Color.WHITE); bubBg.setStroke(dp(2), Color.parseColor("#2B2118")); bubBg.setCornerRadius(dp(18));
                bub.setBackground(bubBg);
                bub.setPadding(dp(14), dp(10), dp(14), dp(10));
                bub.setTextColor(Color.parseColor("#2B2118"));
                bub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
                bub.setMaxWidth(sw() - dp(40));
                bubLp = params();
                bub.setOnClickListener(v -> bubTap());
                wm.addView(bub, bubLp);
            }
            bub.setText(text); bubKind = nextKind; nextKind = "";   // 보통 말풍선이 오면 카톡 표시는 풀림
            if (bubBg != null) bubBg.setColor(Color.parseColor(bubKind.isEmpty() ? "#FFFFFF" : "#FEE500"));   // 카톡 말풍선은 노랑
            bub.setVisibility(wantShown ? View.VISIBLE : View.GONE);
            bub.measure(View.MeasureSpec.makeMeasureSpec(sw() - dp(40), View.MeasureSpec.AT_MOST), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
            int bw = bub.getMeasuredWidth(), bh = bub.getMeasuredHeight();
            int pw = lp != null ? lp.width : dp(120);
            bubLp.x = Math.max(dp(8), Math.min(sw() - bw - dp(8), (lp != null ? lp.x : 0) + pw / 2 - bw / 2));
            bubLp.y = Math.max(dp(30), (lp != null ? lp.y : dp(300)) - bh - dp(6));
            wm.updateViewLayout(bub, bubLp);
            h.removeCallbacks(hideBub);
            h.postDelayed(hideBub, ms);
            long nowB = System.currentTimeMillis();
            if (!moving) nextDecide = Math.max(nextDecide, nowB + Math.min(ms, 8000));
            if (nowB - lastPoseAt > 1500 && !moving && pet != null && idle != null && idle[2] != null && !text.startsWith("💭") && !text.startsWith("👂")) pet.setImageBitmap(idle[2]);
        } catch (Exception e) { Log.e("HaruPet", "bubble", e); }
    }
    android.media.MediaPlayer mp;
    // 11-07: 화면이 꺼져 있으면(어두우면) 짖지 않기 — 알람만 예외. 다시 켜면 greet() 가 인사
    boolean screenOn() { try { return ((android.os.PowerManager) getSystemService(POWER_SERVICE)).isInteractive(); } catch (Exception e) { return true; } }
    void bark(boolean happy, float vol) {
        if (listening || HaruBall.on || (vol <= 0.01f && !alarmOn)) return;   // 11-10: 소리 0이면 조용히   // 듣는 중·게임 중엔 짖지 않기 (게임 중에도 말을 잘 알아듣게)
        if (!alarmOn && !screenOn()) return;
        try {
            String cv = getSharedPreferences("pet", 0).getString(happy ? "sndH" : "sndC", ""); String[] list = cv != null && !cv.isEmpty() ? cv.split("\\|") : happy ? new String[] { "dog_happy1", "dog_happy2", "dog_happy3" } : new String[] { "dog_bark1", "dog_bark2", "dog_bark3", "dog_bark4" };
            android.content.res.AssetFileDescriptor fd = getAssets().openFd("public/sounds/" + list[(int) (Math.random() * list.length)] + ".mp3");
            if (mp != null) { try { mp.release(); } catch (Exception ignored) { } }
            mp = new android.media.MediaPlayer();
            mp.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength()); fd.close();
            mp.setVolume(vol, vol); mp.prepare(); mp.start();
        } catch (Exception e) { Log.e("HaruPet", "bark", e); }
    }
    long lastPoseAt = 0, poseUntil = 0;
    Bitmap[] poseFrames = null; int poseFps = 8, poseFi = 0; long poseLast = 0;
    boolean homeMode = false;
    int homeY() { return blp != null ? blp.y - lp.height + dp(10) : lp.y; }
    void goHome() {
        if (pet == null || blp == null) return;
        homeMode = true; moving = false; poseFrames = null;
        int w = lp.width > 0 ? lp.width : dp(120);
        px = tx = Math.max(blp.x, Math.min(blp.x + (blp.width > 0 ? blp.width : sw()) - w, (int) px));
        lp.x = (int) px; lp.y = homeY(); py = ty = lp.y; wm.updateViewLayout(pet, lp);
        String hf = getSharedPreferences("pet", 0).getString("home", ""); Bitmap b = load(hf == null || hf.isEmpty() ? "기쁨.webp" : hf); if (b != null) { pet.setScaleX(1); pet.setImageBitmap(b); }
        nextDecide = System.currentTimeMillis() + 3000;
    }
    void leaveHome() {
        if (!homeMode) return;
        homeMode = false;
        lp.y = getSharedPreferences("pet", 0).getInt("y", sh() - dp(330)); py = ty = lp.y; wm.updateViewLayout(pet, lp);
    }
    void showPose(String file, String action, int ms) {
        if (pet == null) return;
        if ("home".equals(action)) { goHome(); return; }
        if ("free".equals(action) || "run".equals(action)) leaveHome();
        lastPoseAt = System.currentTimeMillis(); poseFrames = null; framesTok++;
        if (("run".equals(action) || "walk".equals(action)) && "shy".equals(getSharedPreferences("pet", 0).getString("temper", "normal"))) { Bitmap[] f = "run".equals(action) ? run : walk; if (f != null && f.length > 0) showFramesB(f, 6, ms); return; }
        if ("run".equals(action) || "walk".equals(action)) { int w = lp.width > 0 ? lp.width : dp(120); if (py < 0) py = lp.y; tx = (float) (Math.random() * Math.max(1, sw() - w)); if (Math.abs(tx - px) < dp(80)) tx = px > sw() / 2f ? dp(10) : sw() - w - dp(10); int hgt = lp.height > 0 ? lp.height : dp(120); int bottom = (blp != null ? blp.y - dp(8) : sh() - dp(100)) - hgt; ty = dp(60) + (float) (Math.random() * Math.max(1, bottom - dp(60))); if ("normal".equals(getSharedPreferences("pet", 0).getString("temper", "normal"))) ty = py; running = "run".equals(action); moving = true; return; }
        Bitmap b = file == null ? null : load(file);
        if (b != null) { moving = false; pet.setScaleX(1); pet.setImageBitmap(b); nextDecide = System.currentTimeMillis() + ms; poseUntil = nextDecide; }
    }
    volatile long framesTok = 0; static volatile boolean poseOnce = false;   // 11-10: 한 번만 하는 동작은 끝 모습에서 멈춤
    void showFrames(String[] files, int fps, int ms) {
        if (pet == null || files == null || files.length == 0) return;
        // 11-10: 그림 읽기는 뒤에서(화면·듣기 멈추지 않게), 다 읽으면 화면에 붙임
        final long tok = ++framesTok;
        lastPoseAt = System.currentTimeMillis(); moving = false; nextDecide = lastPoseAt + ms;
        new Thread(() -> {
            Bitmap[] f = new Bitmap[files.length]; for (int i = 0; i < files.length; i++) f[i] = load(files[i]);
            h.post(() -> {
                if (tok != framesTok || pet == null) return;
                lastPoseAt = System.currentTimeMillis(); moving = false; pet.setScaleX(1);
                poseFrames = f; poseFps = Math.max(2, fps); poseFi = 0; poseUntil = lastPoseAt + ms; nextDecide = poseUntil;
                if (f[0] != null) pet.setImageBitmap(f[0]);
            });
        }).start();
    }
    void showFramesB(Bitmap[] f, int fps, int ms) {   // 소심: 그 자리에서 걷는 시늉만
        poseOnce = false;
        lastPoseAt = System.currentTimeMillis(); moving = false; pet.setScaleX(1);
        poseFrames = f; poseFps = Math.max(2, fps); poseFi = 0; poseUntil = lastPoseAt + Math.max(ms, 3000); nextDecide = poseUntil;
        if (f[0] != null) pet.setImageBitmap(f[0]);
    }
    static void framesStatic(String[] files, int fps, int ms) { if (me != null) me.h.post(() -> me.showFrames(files, fps, ms)); }
    static void barkStatic(boolean happy, float vol) { if (me != null) me.h.post(() -> me.bark(happy, vol)); }
    static void poseStatic(String file, String action, int ms) { if (me != null) me.h.post(() -> me.showPose(file, action, ms)); }

    static void quitStatic() { if (me != null) me.h.post(() -> { try { me.stopSelf(); } catch (Exception ignored) { } }); }
    // 💬 카톡이 오면 바탕화면 팻이 알려 줌 (하루 예보가 열려 있으면 앱 안에서 알려 줌)
    static void openKakaoStatic() { if (me != null) me.h.post(me::openKakao); }
    static void kakaoStatic(String who, String msg, String room) {
        if (me == null || !wantShown) return;
        me.h.post(() -> {
            String from = room != null && !room.isEmpty() && !room.equals(who) ? room + "(" + who + ")" : who;
            me.bubbleK("kakao", "💬 " + from + "한테 카톡 왔어!\n\"" + msg + "\"\n👉 누르면 카톡 열어 줄게", 15000);
            SharedPreferences sp = me.getSharedPreferences("pet", 0);
            if (sp.getBoolean("cries", true)) me.bark(true, sp.getFloat("vol", 0.5f));
        });
    }
    static boolean composeStatic(String kind, String who, String num, String text) { if (me == null) return false; me.h.post(() -> me.composeStart(kind, who, num, text)); return true; }
    static void sayOpenStatic(String text, String what, int ms) { if (me != null) me.h.post(() -> { me.openWhat = what; me.bubbleK("open", text, ms); }); }
    static void sayTelStatic(String text, String tel, int ms) { if (me != null) me.h.post(() -> { me.telNum = tel; me.bubbleK("tel", text, ms); }); }
    // ⏰ 알람: 팻이 울며 알려 줌 (팻을 누르면 그만)
    boolean alarmOn = false; int alarmN = 0;
    final Runnable alarmLoop = new Runnable() { @Override public void run() {
        if (!alarmOn) return;
        if (++alarmN > 40) { alarmOn = false; return; }
        SharedPreferences sp = getSharedPreferences("pet", 0);
        bark(false, Math.max(0.8f, sp.getFloat("vol", 0.5f)));
        h.postDelayed(this, 2500);
    } };
    static void alarmRingStatic(String text) { if (me != null) me.h.post(() -> { if (!wantShown) return; me.alarmOn = true; me.alarmN = 0; me.bubble("⏰ " + (text == null || text.isEmpty() ? "알람 시간이야!" : text) + "\n👉 나를 누르면 그만", 100000); me.h.removeCallbacks(me.alarmLoop); me.h.post(me.alarmLoop); }); }
    static void alarmStopStatic() { if (me != null) me.h.post(() -> { me.alarmOn = false; me.h.removeCallbacks(me.alarmLoop); if (me.bub != null) me.bub.setVisibility(View.GONE); }); }
    void stopAlarmByTap() {
        alarmOn = false; h.removeCallbacks(alarmLoop);
        SharedPreferences sp = getSharedPreferences("pet", 0); String id = sp.getString("alarmRinging", "");
        if (!id.isEmpty()) { ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(HaruAlarmReceiver.nid(id)); HaruAlarmReceiver.addSet(sp, "alarmDone", id); sp.edit().remove("alarmRinging").apply(); }
        bubble("헤헤 잘했어! 오늘도 화이팅 💛", 3000);
    }
    // 🎵 노래가 나오면 팻이 춤 (11-07)
    static void musicStatic(String title, String artist, boolean playing) { if (me != null) me.h.post(() -> { if (playing && title != null && !title.isEmpty() && wantShown) me.bubble("🎵 " + title + (artist == null || artist.isEmpty() ? "" : " · " + artist), 4000); me.lastMusicCheck = 0; }); }
    long lastMusicCheck = 0; boolean dancing = false;
    void musicDance(long now) {
        if (now - lastMusicCheck < 3000) return;
        lastMusicCheck = now;
        boolean on = HaruMusic.anyPlaying(this) && !alarmOn;
        if (on && !moving) {
            Bitmap[] df = list("dance", new String[] { "기쁨.webp" });
            if (df.length > 1) { if (!dancing || poseFrames == null || now >= poseUntil) showFramesB(df, 7, 6000); }
            dancing = true; nextDecide = now + 5000;
        } else dancing = false;
    }
    // 하루 예보를 앞으로 (바탕화면에서 "TV 켜 줘" 했을 때 TV 화면이 보이게)
    static void frontStatic(Context c) {
        Intent i = new Intent(c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try { c.startActivity(i); } catch (Exception ignored) { }
    }
    static boolean ballStatic(boolean start) { if (me == null) return false; me.h.post(() -> { if (start) HaruBall.start(me); else HaruBall.stop(me, true); }); return true; }
    static void sayStatic(String text, int ms) { if (me != null) me.h.post(() -> me.bubble(text, ms)); }

    void open(String what) {
        if ("pet".equals(what) && idle[2] != null) pet.setImageBitmap(idle[2]);
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
        h.postDelayed(() -> FloatPetPlugin.tapped(what), 600);
    }

    void sizeLp() {
        float old = 30f + (Math.max(10, Math.min(100, sizePct)) - 10) * 100f / 90f;   // 10 = 예전 30 크기, 100 = 예전 130 크기
        int hpx = dp(1.2f * old);
        lp.height = hpx;
        lp.width = (int) (hpx * 1.1f);
    }
    void applySize() { if (pet != null && lp != null) { sizeLp(); wm.updateViewLayout(pet, lp); } }
    static void reload() { if (me != null) me.h.post(() -> { SharedPreferences sp = me.getSharedPreferences("pet", 0); me.sizePct = sp.getInt("size", 100); me.act = sp.getInt("act", 2); me.name = sp.getString("name", "다루"); me.applySize(); if (me.hint != null) me.hint.setText(me.name + "에게 말 걸기…"); String k = sp.getString("sp", "dog") + "|" + sp.getString("walk", "") + sp.getString("up", ""); if (!k.equals(me.loadedSp)) me.loadLists(); }); }
    static void setSizeStatic(int s) { if (me != null) { me.sizePct = s; me.h.post(me::applySize); } }

    @Override
    public void onDestroy() {
        try { if (screenRx != null) unregisterReceiver(screenRx); } catch (Exception ignored) { }
        Log.i("HaruPet", "service destroy");
        h.removeCallbacksAndMessages(null);
        try { HaruBall.stop(this, false); } catch (Exception ignored) { }
        try { if (pet != null) wm.removeView(pet); } catch (Exception ignored) { }
        try { if (bar != null) wm.removeView(bar); } catch (Exception ignored) { }
        try { if (bub != null) wm.removeView(bub); } catch (Exception ignored) { }
        pet = null; bar = null; me = null;
        super.onDestroy();
    }
}

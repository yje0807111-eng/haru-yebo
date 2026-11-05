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
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
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
        } catch (Exception e) { Log.e("HaruPet", "start", e); }
    }

    // 앱이 열리면 숨기고, 닫히면 보이기 (서비스는 그대로)
    static void setShown(boolean on) {
        wantShown = on;
        if (me != null) me.h.post(() -> me.applyShown());
    }

    void applyShown() {
        int vis = wantShown ? View.VISIBLE : View.GONE;
        if (pet != null) pet.setVisibility(vis);
        if (bar != null) bar.setVisibility(vis);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        me = this;
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
            TextView mic = new TextView(this);
            mic.setText("🎤");
            mic.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
            mic.setGravity(Gravity.CENTER);
            GradientDrawable mbg = new GradientDrawable();
            mbg.setColor(Color.WHITE);
            mbg.setStroke(dp(2), Color.parseColor("#2B2118"));
            mbg.setCornerRadius(dp(20));
            mic.setBackground(mbg);
            mic.setLayoutParams(new LinearLayout.LayoutParams(dp(38), dp(38)));
            bar.addView(heart);
            bar.addView(hint);
            bar.addView(mic);
            blp = params();
            blp.x = sp.getInt("tx", Math.max(0, sw() / 2 - dp(135)));
            blp.y = sp.getInt("ty", sh() - dp(210));
            bar.setOnTouchListener(dragger(bar, blp, "t", () -> open("talk"), false));
            mic.setOnTouchListener(dragger(bar, blp, "t", () -> open("mic"), false));
            wm.addView(bar, blp);
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
        h.removeCallbacksAndMessages(null);
        try { if (pet != null) wm.removeView(pet); } catch (Exception ignored) { }
        try { if (bar != null) wm.removeView(bar); } catch (Exception ignored) { }
        pet = null; bar = null; me = null;
        super.onDestroy();
    }
}

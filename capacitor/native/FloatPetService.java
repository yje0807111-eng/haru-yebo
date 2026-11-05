package kr.haruyebo.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
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
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.InputStream;

// 화면 위 팻 + 말창 (PC 하루 예보처럼): 다른 앱 위에 떠 있고, 끌어서 옮기고, 누르면 하루 예보가 열림
public class FloatPetService extends Service {
    static FloatPetService me;
    WindowManager wm;
    ImageView pet;
    LinearLayout bar;
    TextView hint;
    WindowManager.LayoutParams lp, blp;
    final Handler h = new Handler(Looper.getMainLooper());
    Bitmap[] poses;
    int fi = 0;
    int sizePct = 100;
    String name = "다루";

    @Override
    public IBinder onBind(Intent i) { return null; }

    // 앱이 화면에서 사라질 때 (MainActivity.onStop) — 켜 두었고 허락이 있으면 띄움
    static void maybeStart(android.content.Context c) {
        try {
            SharedPreferences sp = c.getSharedPreferences("pet", 0);
            if (!sp.getBoolean("on", true)) return;
            if (Build.VERSION.SDK_INT >= 23 && !android.provider.Settings.canDrawOverlays(c)) return;
            Intent i = new Intent(c, FloatPetService.class);
            i.putExtra("size", sp.getInt("size", 100));
            i.putExtra("name", sp.getString("name", "다루"));
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception ignored) { }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        me = this;
        if (intent != null) {
            sizePct = intent.getIntExtra("size", sizePct);
            String n = intent.getStringExtra("name");
            if (n != null && !n.isEmpty()) name = n;
        }
        startFg();
        if (pet == null) { try { show(); } catch (Exception e) { android.util.Log.e("HaruPet", "show", e); } } else { applySize(); if (hint != null) hint.setText(name + "에게 말 걸기…"); }
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

    int dp(float v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

    WindowManager.LayoutParams params() {
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams p = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
        p.gravity = Gravity.TOP | Gravity.START;
        return p;
    }

    // 끌면 옮기고, 살짝 누르면 onTap
    View.OnTouchListener dragger(final View v, final WindowManager.LayoutParams p, final String key, final Runnable onTap) {
        return new View.OnTouchListener() {
            float sx, sy; int ox, oy; boolean moved;
            @Override
            public boolean onTouch(View view, MotionEvent e) {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN: sx = e.getRawX(); sy = e.getRawY(); ox = p.x; oy = p.y; moved = false; return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - sx, dy = e.getRawY() - sy;
                        if (Math.abs(dx) + Math.abs(dy) > dp(8)) moved = true;
                        if (moved) { p.x = ox + (int) dx; p.y = oy + (int) dy; wm.updateViewLayout(v, p); }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (moved) getSharedPreferences("pet", 0).edit().putInt(key + "x", p.x).putInt(key + "y", p.y).apply();
                        else onTap.run();
                        return true;
                }
                return false;
            }
        };
    }

    void show() {
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        SharedPreferences sp = getSharedPreferences("pet", 0);
        int sw = getResources().getDisplayMetrics().widthPixels, sh = getResources().getDisplayMetrics().heightPixels;

        // 🐶 팻
        poses = new Bitmap[] { load("정면.webp"), load("눈망울_앉기.webp"), load("기쁨.webp"), load("a_윙크_1.webp"), load("엎드림.webp") };
        pet = new ImageView(this);
        pet.setScaleType(ImageView.ScaleType.FIT_CENTER);
        if (poses[0] != null) pet.setImageBitmap(poses[0]);
        lp = params();
        lp.x = sp.getInt("x", sw / 2 - dp(60));
        lp.y = sp.getInt("y", sh - dp(330));
        sizeLp();
        pet.setOnTouchListener(dragger(pet, lp, "", () -> open("pet")));
        wm.addView(pet, lp);

        // 💬 말창 (PC 말창 모양)
        bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(12), dp(6), dp(6), dp(6));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#FFFBF0")); bg.setStroke(dp(2.5f), Color.parseColor("#2B2118")); bg.setCornerRadius(dp(30));
        bar.setBackground(bg);
        bar.setElevation(dp(4));
        TextView heart = new TextView(this);
        heart.setText("♥"); heart.setTextColor(Color.parseColor("#E0245E")); heart.setTextSize(20); heart.setPadding(0, 0, dp(8), 0);
        hint = new TextView(this);
        hint.setText(name + "에게 말 걸기…"); hint.setTextColor(Color.parseColor("#A8998A")); hint.setTextSize(15);
        hint.setLayoutParams(new LinearLayout.LayoutParams(dp(170), LinearLayout.LayoutParams.WRAP_CONTENT));
        TextView mic = new TextView(this);
        mic.setText("🎤"); mic.setTextSize(18); mic.setGravity(Gravity.CENTER);
        GradientDrawable mbg = new GradientDrawable(); mbg.setColor(Color.WHITE); mbg.setStroke(dp(2), Color.parseColor("#2B2118")); mbg.setCornerRadius(dp(20));
        mic.setBackground(mbg);
        mic.setLayoutParams(new LinearLayout.LayoutParams(dp(38), dp(38)));
        bar.addView(heart); bar.addView(hint); bar.addView(mic);
        blp = params();
        blp.x = sp.getInt("tx", sw / 2 - dp(135));
        blp.y = sp.getInt("ty", sh - dp(200));
        bar.setOnTouchListener(dragger(bar, blp, "t", () -> open("talk")));
        mic.setOnTouchListener(dragger(bar, blp, "t", () -> open("mic")));
        wm.addView(bar, blp);

        h.postDelayed(anim, 5000);
    }

    // 가끔 앉고, 웃고, 윙크하고, 엎드리기
    final Runnable anim = new Runnable() {
        @Override
        public void run() {
            if (pet == null) return;
            fi = (fi + 1) % 8;
            int k = fi % 2 == 0 ? 0 : 1 + (int) (Math.random() * (poses.length - 1));
            if (poses[k] != null) pet.setImageBitmap(poses[k]);
            h.postDelayed(this, k == 0 ? 7000 : 2500);
        }
    };

    void open(String what) {
        if ("pet".equals(what) && poses[2] != null) pet.setImageBitmap(poses[2]);
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

    static void setSizeStatic(int s) { if (me != null) { me.sizePct = s; me.h.post(me::applySize); } }

    @Override
    public void onDestroy() {
        h.removeCallbacks(anim);
        try { if (pet != null) wm.removeView(pet); } catch (Exception ignored) { }
        try { if (bar != null) wm.removeView(bar); } catch (Exception ignored) { }
        pet = null; bar = null; me = null;
        super.onDestroy();
    }
}

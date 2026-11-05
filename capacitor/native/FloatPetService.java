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
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import java.io.InputStream;

// 화면 위 팻: 다른 앱 위에 떠 있고, 끌어서 옮기고, 누르면 하루 예보가 열림
public class FloatPetService extends Service {
    static FloatPetService me;
    WindowManager wm;
    ImageView v;
    WindowManager.LayoutParams lp;
    final Handler h = new Handler(Looper.getMainLooper());
    Bitmap[] poses;
    int fi = 0;
    int sizePct = 60;

    @Override
    public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        me = this;
        if (intent != null) sizePct = intent.getIntExtra("size", sizePct);
        startFg();
        if (v == null) show(); else applySize();
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

    Bitmap load(String name) {
        try (InputStream in = getAssets().open("public/chars/dog/" + name)) { return BitmapFactory.decodeStream(in); }
        catch (Exception e) { return null; }
    }

    void show() {
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        poses = new Bitmap[] { load("정면.webp"), load("눈망울_앉기.webp"), load("기쁨.webp"), load("a_윙크_1.webp"), load("엎드림.webp") };
        v = new ImageView(this);
        v.setScaleType(ImageView.ScaleType.FIT_CENTER);
        if (poses[0] != null) v.setImageBitmap(poses[0]);
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        lp = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        SharedPreferences sp = getSharedPreferences("pet", 0);
        lp.x = sp.getInt("x", 40);
        lp.y = sp.getInt("y", 500);
        sizeLp();
        v.setOnTouchListener(new View.OnTouchListener() {
            float sx, sy; int ox, oy; boolean moved;
            @Override
            public boolean onTouch(View view, MotionEvent e) {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN: sx = e.getRawX(); sy = e.getRawY(); ox = lp.x; oy = lp.y; moved = false; return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - sx, dy = e.getRawY() - sy;
                        if (Math.abs(dx) + Math.abs(dy) > 14) moved = true;
                        if (moved) { lp.x = ox + (int) dx; lp.y = oy + (int) dy; wm.updateViewLayout(v, lp); }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (moved) getSharedPreferences("pet", 0).edit().putInt("x", lp.x).putInt("y", lp.y).apply();
                        else tap();
                        return true;
                }
                return false;
            }
        });
        wm.addView(v, lp);
        h.postDelayed(anim, 5000);
    }

    // 가끔 앉고, 웃고, 윙크하고, 엎드리기
    final Runnable anim = new Runnable() {
        @Override
        public void run() {
            if (v == null) return;
            fi = (fi + 1) % 8;
            int k = fi % 2 == 0 ? 0 : 1 + (int) (Math.random() * (poses.length - 1));
            if (poses[k] != null) v.setImageBitmap(poses[k]);
            h.postDelayed(this, k == 0 ? 7000 : 2500);
        }
    };

    void tap() {
        if (poses[2] != null) v.setImageBitmap(poses[2]);
        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra("petTap", true);
        startActivity(open);
        h.postDelayed(FloatPetPlugin::tapped, 600);
    }

    void sizeLp() {
        float d = getResources().getDisplayMetrics().density;
        int hpx = Math.max((int) (d * 18), (int) (d * 200 * sizePct / 100f));   // 100 = 앱 안 처음 크기쯤
        lp.height = hpx;
        lp.width = (int) (hpx * 1.1f);
    }

    void applySize() { if (v != null && lp != null) { sizeLp(); wm.updateViewLayout(v, lp); } }

    static void setSizeStatic(int s) { if (me != null) { me.sizePct = s; me.h.post(me::applySize); } }

    @Override
    public void onDestroy() {
        h.removeCallbacks(anim);
        if (v != null && wm != null) { try { wm.removeView(v); } catch (Exception ignored) { } }
        v = null; me = null;
        super.onDestroy();
    }
}

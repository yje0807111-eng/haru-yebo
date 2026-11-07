package kr.haruyebo.app;

import android.annotation.SuppressLint;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.MotionEvent;
import android.view.VelocityTracker;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;

// 🎾 공 던지기 게임 (11-07): 화면 위 테니스 공을 손가락으로 밀어 던지면 → 팻이 바라보다 쫓아가 물고 돌아옴
public class HaruBall {
    static boolean on = false;
    static ImageView ball;
    static WindowManager.LayoutParams blp2;
    static int state = 0;              // 0 기다림 · 1 날아감 · 2 멈춘 공으로 · 3 물고 오기
    static boolean sat = false, dragging = false;
    static float bx, by, vx, vy, homeX, homeY, grabDx, grabDy;
    static long startedAt = 0, lastAct = 0, lastFrame = 0, chaseAt = 0, happyUntil = 0;
    static int frame = 0, size = 0, fetchN = 0;
    static VelocityTracker vt;
    static Bitmap watch;

    static Bitmap ballBmp(int s) {
        Bitmap b = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.parseColor("#D4EF3C"));
        c.drawCircle(s / 2f, s / 2f, s / 2f - 1, p);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(s * 0.07f);
        p.setColor(Color.WHITE);
        c.drawArc(new RectF(-s * 0.55f, s * 0.08f, s * 0.45f, s * 0.92f), -60, 120, false, p);
        c.drawArc(new RectF(s * 0.55f, s * 0.08f, s * 1.55f, s * 0.92f), 120, 120, false, p);
        p.setColor(Color.parseColor("#9AB02A"));
        p.setStrokeWidth(s * 0.04f);
        c.drawCircle(s / 2f, s / 2f, s / 2f - s * 0.03f, p);
        return b;
    }

    static int pw(FloatPetService s) { return s.lp.width > 0 ? s.lp.width : s.dp(120); }
    static int ph(FloatPetService s) { return s.lp.height > 0 ? s.lp.height : s.dp(120); }
    static void cry(FloatPetService s, float k) {
        SharedPreferences sp = s.getSharedPreferences("pet", 0);
        if (sp.getBoolean("cries", true)) s.bark(true, sp.getFloat("vol", 0.5f) * k);
    }

    static void start(FloatPetService s) {
        if (s.pet == null) return;
        if (on) { s.bubble("🎾 공을 손가락으로 쭉 밀어서 던져 줘!", 4000); return; }
        on = true; state = 0; sat = false; dragging = false; fetchN = 0; watch = null;
        startedAt = lastAct = System.currentTimeMillis();
        size = s.dp(38);
        homeX = s.sw() / 2f - size / 2f; homeY = s.sh() - s.dp(200);
        bx = homeX; by = homeY; vx = vy = 0;
        ball = new ImageView(s);
        ball.setImageBitmap(ballBmp(size));
        blp2 = s.params(); blp2.width = size; blp2.height = size; blp2.x = (int) bx; blp2.y = (int) by;
        ball.setOnTouchListener(touch(s));
        try { s.wm.addView(ball, blp2); } catch (Exception e) { on = false; ball = null; return; }
        s.moving = false; s.poseFrames = null; s.homeMode = false;
        if (s.py < 0) s.py = s.lp.y;
        s.bubble("🎾 공 던지기 하자!\n공을 손가락으로 쭉 밀어서 던져 줘!", 6000);
        cry(s, 1f);
    }

    static void stop(FloatPetService s, boolean say) {
        boolean was = on;
        on = false; state = 0; dragging = false;
        if (vt != null) { try { vt.recycle(); } catch (Exception ignored) { } vt = null; }
        if (ball != null) { try { s.wm.removeView(ball); } catch (Exception ignored) { } ball = null; }
        if (s == null) return;
        if (say && was) s.bubble(fetchN > 0 ? "재미있었다! 🎾 " + fetchN + "번 물어 왔어.\n다음에 또 놀자 🐾" : "다음에 또 공 던지기 하자 🐾", 4000);
        s.moving = false; s.nextDecide = System.currentTimeMillis() + 2000;
    }

    // 1초에 25번 (팻 tick 에서 부름)
    static void tick(FloatPetService s, long now) {
        if (ball == null || s.pet == null) { on = false; return; }
        int w = pw(s), hg = ph(s);
        int floorB = s.sh() - s.dp(110) - size;
        if (s.py < 0) s.py = s.lp.y;
        if (state == 1) {   // 날아감
            bx += vx; by += vy; vx *= 0.955f; vy *= 0.955f;
            if (bx < 0) { bx = 0; vx = -vx * 0.7f; }
            if (bx > s.sw() - size) { bx = s.sw() - size; vx = -vx * 0.7f; }
            if (by < s.dp(30)) { by = s.dp(30); vy = -vy * 0.7f; }
            if (by > floorB) { by = floorB; vy = -vy * 0.6f; }
            float sp = (float) Math.hypot(vx, vy);
            ball.setRotation(ball.getRotation() + vx * 1.5f);
            float lift = Math.min(0.6f, sp / s.dp(40));   // 빠를수록 높이 떠 보이게
            ball.setScaleX(1 + lift); ball.setScaleY(1 + lift);
            if (sp < s.dp(0.6f)) { state = 2; vx = vy = 0; ball.setScaleX(1); ball.setScaleY(1); }
            if (now - chaseAt > 450) petStep(s, now, bx + size / 2f - w / 2f, by + size / 2f - hg * 0.65f, w, hg);   // 잠깐 바라보다 쫓아감
            else look(s);
        } else if (state == 2) {   // 멈춘 공으로 달려가기
            if (petStep(s, now, bx + size / 2f - w / 2f, by + size / 2f - hg * 0.65f, w, hg)) { state = 3; fetchN++; if (Math.random() < 0.5) cry(s, 0.7f); }
        } else if (state == 3) {   // 물고 돌아오기
            boolean at = petStep(s, now, homeX + size + s.dp(4) - w * 0.2f, homeY + size / 2f - hg * 0.65f, w, hg);
            bx = s.dir > 0 ? s.px + w * 0.8f - size / 2f : s.px + w * 0.2f - size / 2f;   // 공은 입 쪽에
            by = s.py + hg * 0.58f - size / 2f;
            ball.setRotation(0);
            if (at) {
                state = 0; sat = true; bx = homeX; by = homeY; lastAct = now; happyUntil = now + 1800;
                Bitmap b = s.load("기쁨.webp"); if (b != null) { s.pet.setScaleX(1); s.pet.setImageBitmap(b); }
                cry(s, 1f);
                String[] L = { "가져왔어! 또 던져 줘 🎾", "헤헤 잡았다! 한 번 더! 🐾", "더 멀리 던져 봐! 🎾", "재밌다! 또 또! 💛" };
                s.bubble(L[(int) (Math.random() * L.length)], 3000);
            }
        } else {   // 기다림: 공 옆에 와서 앉아 바라보기
            if (!sat) sat = petStep(s, now, homeX + size + s.dp(4) - w * 0.2f, homeY + size / 2f - hg * 0.65f, w, hg);
            else if (!dragging && now > happyUntil) look(s);
            if (!dragging && now - lastAct > 120000) { stop(s, true); return; }   // 2분 동안 안 던지면 끝
        }
        blp2.x = (int) bx; blp2.y = (int) by;
        try { s.wm.updateViewLayout(ball, blp2); } catch (Exception ignored) { }
    }

    // 팻을 (tx, ty) 로 달려가게 — 도착하면 true
    static boolean petStep(FloatPetService s, long now, float txx, float tyy, int w, int hg) {
        txx = Math.max(0, Math.min(s.sw() - w, txx));
        tyy = Math.max(s.dp(30), Math.min(s.sh() - s.dp(110) - hg, tyy));
        float d = txx - s.px, dy = tyy - s.py, dist = (float) Math.hypot(d, dy), speed = s.dp(8);
        if (dist <= speed) { s.px = txx; s.py = tyy; place(s); return true; }
        s.px += d / dist * speed; s.py += dy / dist * speed;
        if (Math.abs(d) > 2) s.dir = d > 0 ? 1 : -1;
        if (now - lastFrame > 110) {
            lastFrame = now; frame++;
            Bitmap[] f = s.run != null && s.run.length > 0 ? s.run : s.walk;
            if (f != null && f.length > 0) { Bitmap b = f[frame % f.length]; if (b != null) s.pet.setImageBitmap(b); }
        }
        s.pet.setScaleX(-s.dir);   // 그림은 왼쪽을 봄 → 오른쪽으로 갈 땐 뒤집기
        place(s);
        return false;
    }
    static void place(FloatPetService s) {
        s.lp.x = (int) s.px; s.lp.y = (int) s.py;
        try { s.wm.updateViewLayout(s.pet, s.lp); } catch (Exception ignored) { }
    }
    // 공 쪽을 바라보기
    static void look(FloatPetService s) {
        int w = pw(s);
        float d = bx + size / 2f - (s.px + w / 2f);
        if (Math.abs(d) > s.dp(10)) s.dir = d > 0 ? 1 : -1;
        if (watch == null) { watch = s.load("눈망울_앉기.webp"); if (watch == null && s.idle != null && s.idle.length > 0) watch = s.idle[0]; }
        if (watch != null) s.pet.setImageBitmap(watch);
        s.pet.setScaleX(-s.dir);
    }

    // 공을 손가락으로: 잡고 끌다가 쭉 밀면 던짐 (던진 자리 = 주인 자리 → 팻이 거기로 물어 옴)
    @SuppressLint("ClickableViewAccessibility")
    static View.OnTouchListener touch(final FloatPetService s) {
        return (v, e) -> {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    dragging = true; vx = vy = 0; state = 0;
                    grabDx = e.getRawX() - bx; grabDy = e.getRawY() - by;
                    if (vt != null) vt.recycle();
                    vt = VelocityTracker.obtain(); vt.addMovement(e);
                    lastAct = System.currentTimeMillis();
                    ball.setScaleX(1); ball.setScaleY(1);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if (vt != null) vt.addMovement(e);
                    bx = e.getRawX() - grabDx; by = e.getRawY() - grabDy;
                    blp2.x = (int) bx; blp2.y = (int) by;
                    try { s.wm.updateViewLayout(ball, blp2); } catch (Exception ignored) { }
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    dragging = false; lastAct = System.currentTimeMillis();
                    float fx = 0, fy = 0;
                    if (vt != null) { vt.addMovement(e); vt.computeCurrentVelocity(1000); fx = vt.getXVelocity(); fy = vt.getYVelocity(); vt.recycle(); vt = null; }
                    homeX = Math.max(0, Math.min(s.sw() - size, bx)); homeY = Math.max(s.dp(30), Math.min(s.sh() - s.dp(110) - size, by));
                    if (Math.hypot(fx, fy) > s.dp(250)) {   // 던짐!
                        vx = fx * 0.045f; vy = fy * 0.045f;
                        float max = s.dp(70), cur = (float) Math.hypot(vx, vy);
                        if (cur > max) { vx *= max / cur; vy *= max / cur; }
                        state = 1; chaseAt = System.currentTimeMillis();
                    } else { state = 0; sat = false; }   // 그냥 놓으면 거기가 새 자리 → 팻이 옆으로 옴
                    return true;
            }
            return false;
        };
    }
}

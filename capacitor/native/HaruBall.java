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

// 🎾 공 던지기 게임 (11-07 다시): 공을 밀면 아주 세게 튕겨 나가 벽마다 부딪히고 → 팻이 마구 쫓아가 물고 → 맨 아래 가운데로 가져다 줌
public class HaruBall {
    static boolean on = false;
    static ImageView ball;
    static WindowManager.LayoutParams blp2;
    static int state = 0;              // 0 기다림 · 1 날아감 · 2 멈춘 공으로 · 3 물고 오기
    static boolean sat = false, dragging = false;
    static float bx, by, vx, vy, grabDx, grabDy, lift = 0;
    static long startedAt = 0, lastAct = 0, lastFrame = 0, chaseAt = 0, happyUntil = 0;
    static int frame = 0, size = 0, win = 0, pad = 0, fetchN = 0;
    static VelocityTracker vt;
    static Bitmap watch;
    static FloatPetService svc;

    // 공 그림: 둥근 테니스 공 (창은 공보다 넉넉하게 — 커져도 네모로 잘리지 않게)
    static Bitmap ballBmp(int s, int w) {
        Bitmap b = Bitmap.createBitmap(w, w, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        float o = (w - s) / 2f;
        c.translate(o, o);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.parseColor("#D4EF3C"));
        c.drawCircle(s / 2f, s / 2f, s / 2f - 1, p);
        c.save();
        android.graphics.Path clip = new android.graphics.Path(); clip.addCircle(s / 2f, s / 2f, s / 2f - 1, android.graphics.Path.Direction.CW);
        c.clipPath(clip);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(s * 0.07f);
        p.setColor(Color.WHITE);
        c.drawArc(new RectF(-s * 0.55f, s * 0.08f, s * 0.45f, s * 0.92f), -60, 120, false, p);
        c.drawArc(new RectF(s * 0.55f, s * 0.08f, s * 1.55f, s * 0.92f), 120, 120, false, p);
        c.restore();
        p.setColor(Color.parseColor("#9AB02A"));
        p.setStrokeWidth(s * 0.04f);
        c.drawCircle(s / 2f, s / 2f, s / 2f - s * 0.03f, p);
        return b;
    }

    static int pw(FloatPetService s) { return s.lp.width > 0 ? s.lp.width : s.dp(120); }
    static int ph(FloatPetService s) { return s.lp.height > 0 ? s.lp.height : s.dp(120); }
    static float floorY(FloatPetService s) { return s.sh() - s.dp(110) - size; }
    static float homeX(FloatPetService s) { return s.sw() / 2f - size / 2f; }   // 맨 아래 가운데 = 주인 자리
    static void cry(FloatPetService s, float k) {
        SharedPreferences sp = s.getSharedPreferences("pet", 0);
        if (sp.getBoolean("cries", true)) s.bark(true, sp.getFloat("vol", 0.5f) * k);
    }
    static void placeBall() {
        if (ball == null || svc == null) return;
        blp2.x = (int) bx - pad; blp2.y = (int) by - pad;
        try { svc.wm.updateViewLayout(ball, blp2); } catch (Exception ignored) { }
    }

    static void start(FloatPetService s) {
        if (s.pet == null) return;
        if (on) { s.bubble("🎾 공을 손가락으로 쭉 밀어서 던져 줘!", 4000); return; }
        svc = s; on = true; state = 0; sat = false; dragging = false; fetchN = 0; watch = null; lift = 0;
        startedAt = lastAct = System.currentTimeMillis();
        size = s.dp(38); win = (int) (size * 1.9f); pad = (win - size) / 2;
        bx = homeX(s); by = floorY(s); vx = vy = 0;
        ball = new ImageView(s);
        ball.setImageBitmap(ballBmp(size, win));
        ball.setScaleType(ImageView.ScaleType.CENTER);
        blp2 = s.params(); blp2.width = win; blp2.height = win;
        blp2.x = (int) bx - pad; blp2.y = (int) by - pad;
        ball.setOnTouchListener(touch(s));
        try { s.wm.addView(ball, blp2); } catch (Exception e) { on = false; ball = null; return; }
        s.moving = false; s.poseFrames = null; s.homeMode = false;
        if (s.py < 0) s.py = s.lp.y;
        s.bubble("🎾 공 던지기 하자!\n공을 손가락으로 쭉 밀어서 던져 줘!", 6000);
        cry(s, 1f);
        s.h.post(physics);
    }

    static void stop(FloatPetService s, boolean say) {
        boolean was = on;
        on = false; state = 0; dragging = false;
        if (s != null) s.h.removeCallbacks(physics);
        if (vt != null) { try { vt.recycle(); } catch (Exception ignored) { } vt = null; }
        if (ball != null && s != null) { try { s.wm.removeView(ball); } catch (Exception ignored) { } }
        ball = null;
        if (s == null) return;
        if (say && was) s.bubble(fetchN > 0 ? "재미있었다! 🎾 " + fetchN + "번 물어 왔어.\n다음에 또 놀자 🐾" : "다음에 또 공 던지기 하자 🐾", 4000);
        s.moving = false; s.nextDecide = System.currentTimeMillis() + 2000;
    }

    // 공 움직임: 1초에 60번 (부드럽게) — 벽마다 튕김
    static final Runnable physics = new Runnable() {
        @Override public void run() {
            if (!on || ball == null || svc == null) return;
            FloatPetService s = svc;
            if (state == 1 && !dragging) {
                bx += vx; by += vy; vx *= 0.991f; vy *= 0.991f;
                float top = s.dp(30), fl = floorY(s), right = s.sw() - size;
                boolean hit = false;
                if (bx < 0) { bx = -bx; vx = -vx * 0.88f; hit = true; }
                if (bx > right) { bx = right - (bx - right); vx = -vx * 0.88f; hit = true; }
                if (by < top) { by = top + (top - by); vy = -vy * 0.88f; hit = true; }
                if (by > fl) { by = fl - (by - fl); vy = -vy * 0.88f; hit = true; }
                bx = Math.max(0, Math.min(right, bx)); by = Math.max(top, Math.min(fl, by));
                float sp = (float) Math.hypot(vx, vy);
                ball.setRotation(ball.getRotation() + vx * 2.2f);
                float want = Math.min(0.5f, sp / s.dp(60)); lift += (want - lift) * 0.2f;   // 빠를수록 높이 떠 보이게 (부드럽게)
                if (hit) lift *= 0.6f;
                ball.setScaleX(1 + lift); ball.setScaleY(1 + lift);
                if (sp < s.dp(0.35f)) { state = 2; vx = vy = 0; lift = 0; ball.setScaleX(1); ball.setScaleY(1); }
                placeBall();
            }
            s.h.postDelayed(this, 16);
        }
    };

    // 팻 (1초에 25번, 팻 tick 에서 부름)
    static void tick(FloatPetService s, long now) {
        if (ball == null || s.pet == null) { on = false; return; }
        svc = s;
        int w = pw(s), hg = ph(s);
        if (s.py < 0) s.py = s.lp.y;
        float ptx = bx + size / 2f - w / 2f, pty = by + size / 2f - hg * 0.65f;   // 공이 입에 오게
        if (state == 1) {   // 날아감: 잠깐 바라보다 마구 쫓아감 · 느려지면 낚아챔
            if (now - chaseAt < 350) look(s);
            else if (petStep(s, now, ptx, pty, w, hg, 12) && Math.hypot(vx, vy) < s.dp(5)) { state = 3; vx = vy = 0; lift = 0; ball.setScaleX(1); ball.setScaleY(1); fetchN++; if (Math.random() < 0.6) cry(s, 0.7f); }
        } else if (state == 2) {   // 멈춘 공으로
            if (petStep(s, now, ptx, pty, w, hg, 10)) { state = 3; fetchN++; if (Math.random() < 0.6) cry(s, 0.7f); }
        } else if (state == 3) {   // 물고 맨 아래 가운데로
            float hx = homeX(s) + size / 2f - w / 2f, hy = floorY(s) + size / 2f - hg * 0.65f;
            boolean at = petStep(s, now, hx, hy, w, hg, 8);
            bx = s.dir > 0 ? s.px + w * 0.8f - size / 2f : s.px + w * 0.2f - size / 2f;   // 공은 입 쪽에
            by = s.py + hg * 0.58f - size / 2f;
            ball.setRotation(0);
            if (at) {
                state = 0; sat = true; lastAct = now; happyUntil = now + 1800;
                bx = homeX(s); by = floorY(s);   // 주인 앞에 내려놓기
                int side = Math.random() < 0.5 ? -1 : 1;   // 팻은 공 옆으로 살짝 비켜 앉기
                s.px = Math.max(0, Math.min(s.sw() - w, bx + size / 2f - w / 2f + side * (w * 0.55f + size / 2f))); place(s);
                Bitmap b = s.load("기쁨.webp"); if (b != null) { s.pet.setScaleX(1); s.pet.setImageBitmap(b); }
                cry(s, 1f);
                String[] L = { "가져왔어! 또 던져 줘 🎾", "헤헤 잡았다! 한 번 더! 🐾", "더 세게 던져 봐! 🎾", "재밌다! 또 또! 💛" };
                s.bubble(L[(int) (Math.random() * L.length)], 3000);
            }
            placeBall();
        } else {   // 기다림: 공 옆에 와서 바라보기
            if (!sat) {
                float hx = homeX(s) + size / 2f - w / 2f + w * 0.55f + size / 2f, hy = floorY(s) + size / 2f - hg * 0.65f;
                sat = petStep(s, now, hx, hy, w, hg, 8);
            } else if (!dragging && now > happyUntil) look(s);
            if (!dragging && now - lastAct > 120000) { stop(s, true); return; }   // 2분 동안 안 던지면 끝
        }
    }

    // 팻을 (tx, ty) 로 달려가게 — 도착하면 true
    static boolean petStep(FloatPetService s, long now, float txx, float tyy, int w, int hg, float spd) {
        txx = Math.max(0, Math.min(s.sw() - w, txx));
        tyy = Math.max(s.dp(30), Math.min(s.sh() - s.dp(110) - hg * 0.4f, tyy));
        float d = txx - s.px, dy = tyy - s.py, dist = (float) Math.hypot(d, dy), speed = s.dp(spd);
        if (dist <= speed) { s.px = txx; s.py = tyy; place(s); return true; }
        s.px += d / dist * speed; s.py += dy / dist * speed;
        if (Math.abs(d) > 2) s.dir = d > 0 ? 1 : -1;
        if (now - lastFrame > 100) {
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
    static void look(FloatPetService s) {   // 공 쪽을 바라보기
        int w = pw(s);
        float d = bx + size / 2f - (s.px + w / 2f);
        if (Math.abs(d) > s.dp(10)) s.dir = d > 0 ? 1 : -1;
        if (watch == null) { watch = s.load("눈망울_앉기.webp"); if (watch == null && s.idle != null && s.idle.length > 0) watch = s.idle[0]; }
        if (watch != null) s.pet.setImageBitmap(watch);
        s.pet.setScaleX(-s.dir);
    }

    // 손가락으로 공 잡고 쭉 밀면 → 아주 세게(예전의 5배) 튕겨 나감
    @SuppressLint("ClickableViewAccessibility")
    static View.OnTouchListener touch(final FloatPetService s) {
        return (v, e) -> {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    if (state == 3) return true;   // 팻이 물고 오는 중엔 기다리기
                    dragging = true; vx = vy = 0; state = 0; lift = 0;
                    grabDx = e.getRawX() - bx; grabDy = e.getRawY() - by;
                    if (vt != null) vt.recycle();
                    vt = VelocityTracker.obtain(); vt.addMovement(e);
                    lastAct = System.currentTimeMillis();
                    ball.setScaleX(1); ball.setScaleY(1);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if (!dragging) return true;
                    if (vt != null) vt.addMovement(e);
                    bx = Math.max(0, Math.min(s.sw() - size, e.getRawX() - grabDx)); by = Math.max(s.dp(30), Math.min(floorY(s), e.getRawY() - grabDy));
                    placeBall();
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if (!dragging) return true;
                    dragging = false; lastAct = System.currentTimeMillis();
                    float fx = 0, fy = 0;
                    if (vt != null) { vt.addMovement(e); vt.computeCurrentVelocity(1000); fx = vt.getXVelocity(); fy = vt.getYVelocity(); vt.recycle(); vt = null; }
                    if (Math.hypot(fx, fy) > s.dp(150)) {   // 던짐! (1초 속도 → 16ms 한 칸)
                        vx = fx * 0.09f; vy = fy * 0.09f;
                        float max = s.dp(140), cur = (float) Math.hypot(vx, vy);
                        if (cur > max) { vx *= max / cur; vy *= max / cur; }
                        float min = s.dp(18); if (cur < min) { vx *= min / cur; vy *= min / cur; }
                        state = 1; chaseAt = System.currentTimeMillis();
                    } else { state = 2; }   // 그냥 놓으면 → 팻이 가서 물어 옴
                    return true;
            }
            return false;
        };
    }
}

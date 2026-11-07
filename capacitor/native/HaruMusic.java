package kr.haruyebo.app;

import android.content.ComponentName;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.MediaPlayer;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.provider.MediaStore;
import android.view.KeyEvent;
import java.util.List;

// 🎵 노래 (11-07): ① 휴대폰 노래 파일 틀기 ② 음악 앱 열어 찾아 틀기 ③ 다음 곡·멈춤·소리 ④ 지금 나오는 노래 알기
public class HaruMusic {
    static MediaPlayer mp;
    static long[] q = new long[0];
    static String[] qt = new String[0], qa = new String[0];
    static int qi = 0;
    static boolean paused = false;
    static Context app;

    // ── 휴대폰 노래 목록
    static com.getcapacitor.JSArray list(Context c) {
        com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
        try (Cursor cur = c.getContentResolver().query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                new String[] { MediaStore.Audio.Media._ID, MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.ARTIST, MediaStore.Audio.Media.DURATION },
                MediaStore.Audio.Media.IS_MUSIC + "!=0", null, MediaStore.Audio.Media.TITLE + " ASC")) {
            int n = 0;
            while (cur != null && cur.moveToNext() && n < 3000) {
                long dur = cur.getLong(3); if (dur > 0 && dur < 30000) continue;   // 30초 안 되는 소리(알림음 등)는 뺌
                org.json.JSONObject o = new org.json.JSONObject();
                o.put("id", cur.getLong(0)); o.put("t", cur.getString(1) == null ? "" : cur.getString(1)); o.put("a", cur.getString(2) == null || "<unknown>".equals(cur.getString(2)) ? "" : cur.getString(2));
                arr.put(o); n++;
            }
        } catch (Exception e) { }
        return arr;
    }

    // ── 하루 예보가 직접 틀기 (차례대로, 끝나면 다음 곡)
    static void play(Context c, long[] ids, String[] titles, String[] artists, int start) {
        app = c.getApplicationContext(); q = ids; qt = titles; qa = artists; qi = Math.max(0, Math.min(start, ids.length - 1));
        startCur();
    }
    static void startCur() {
        stopPlayer();
        if (q.length == 0) return;
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            mp.setDataSource(app, ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, q[qi]));
            mp.setOnCompletionListener(m -> next());
            mp.setOnErrorListener((m, w, x) -> { next(); return true; });
            mp.prepare(); mp.start(); paused = false;
            ((AudioManager) app.getSystemService(Context.AUDIO_SERVICE)).requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            FloatPetPlugin.musicEvent(qt[qi], qa[qi], true);
            FloatPetService.musicStatic(qt[qi], qa[qi], true);
        } catch (Exception e) { next(); }
    }
    static void next() { if (q.length == 0) return; qi = (qi + 1) % q.length; startCur(); }
    static void prev() { if (q.length == 0) return; qi = (qi - 1 + q.length) % q.length; startCur(); }
    static void stopPlayer() { if (mp != null) { try { mp.stop(); } catch (Exception ignored) { } try { mp.release(); } catch (Exception ignored) { } mp = null; } }
    static boolean ours() { return mp != null; }

    // ── 지금 나오는 노래 조절 (우리 것이면 직접, 아니면 음악 앱에 단추 신호)
    static String control(Context c, String cmd) {
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        if ("up".equals(cmd)) { am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI); return "ok"; }
        if ("down".equals(cmd)) { am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI); return "ok"; }
        if (ours()) {
            switch (cmd) {
                case "next": next(); return "ok";
                case "prev": prev(); return "ok";
                case "pause": try { mp.pause(); paused = true; FloatPetPlugin.musicEvent(qt[qi], qa[qi], false); FloatPetService.musicStatic(qt[qi], qa[qi], false); } catch (Exception ignored) { } return "ok";
                case "play": try { mp.start(); paused = false; FloatPetPlugin.musicEvent(qt[qi], qa[qi], true); FloatPetService.musicStatic(qt[qi], qa[qi], true); } catch (Exception ignored) { } return "ok";
                case "stop": stopPlayer(); q = new long[0]; FloatPetPlugin.musicEvent("", "", false); FloatPetService.musicStatic("", "", false); return "ok";
            }
        }
        int key = "next".equals(cmd) ? KeyEvent.KEYCODE_MEDIA_NEXT : "prev".equals(cmd) ? KeyEvent.KEYCODE_MEDIA_PREVIOUS : "pause".equals(cmd) || "stop".equals(cmd) ? KeyEvent.KEYCODE_MEDIA_PAUSE : KeyEvent.KEYCODE_MEDIA_PLAY;
        am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, key));
        am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, key));
        return "key";
    }

    // ── 음악 앱 열기 (찾을 말이 있으면 '검색해서 재생')
    static boolean openApp(Context c, String pkg, String query) {
        try {
            if (query != null && !query.isEmpty()) {
                Intent i = new Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH);
                i.putExtra(MediaStore.EXTRA_MEDIA_FOCUS, "vnd.android.cursor.item/*");
                i.putExtra(android.app.SearchManager.QUERY, query);
                if (pkg != null && !pkg.isEmpty()) i.setPackage(pkg);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (i.resolveActivity(c.getPackageManager()) != null) { c.startActivity(i); return true; }
            }
            if (pkg != null && !pkg.isEmpty()) {
                Intent l = c.getPackageManager().getLaunchIntentForPackage(pkg);
                if (l != null) { l.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(l); if (query == null || query.isEmpty()) { new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> control(c, "play"), 2500); } return true; }
            }
            Intent m = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_MUSIC); m.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(m); return true;
        } catch (Exception e) { return false; }
    }

    // ── 지금 나오는 노래 (우리 것 → 아니면 다른 음악 앱; 카톡 알림 허락이 있어야 다른 앱 것도 보임)
    static org.json.JSONObject now(Context c) {
        org.json.JSONObject o = new org.json.JSONObject();
        try {
            if (ours()) { o.put("title", qt[qi]); o.put("artist", qa[qi]); o.put("playing", !paused); o.put("app", "하루 예보"); return o; }
            MediaSessionManager msm = (MediaSessionManager) c.getSystemService(Context.MEDIA_SESSION_SERVICE);
            List<MediaController> ls = msm.getActiveSessions(new ComponentName(c, HaruNotiListener.class));
            for (MediaController mc : ls) {
                PlaybackState st = mc.getPlaybackState(); MediaMetadata md = mc.getMetadata();
                boolean playing = st != null && st.getState() == PlaybackState.STATE_PLAYING;
                if (md == null) continue;
                o.put("title", md.getString(MediaMetadata.METADATA_KEY_TITLE)); o.put("artist", md.getString(MediaMetadata.METADATA_KEY_ARTIST)); o.put("playing", playing); o.put("app", mc.getPackageName());
                if (playing) return o;
            }
        } catch (Exception e) { }
        return o;
    }
    static boolean anyPlaying(Context c) {
        if (ours()) return !paused;
        try { return ((AudioManager) c.getSystemService(Context.AUDIO_SERVICE)).isMusicActive(); } catch (Exception e) { return false; }
    }
}

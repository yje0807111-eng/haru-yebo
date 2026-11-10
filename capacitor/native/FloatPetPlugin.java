package kr.haruyebo.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

// 다른 앱 위에 떠 있는 팻 (하루 예보) — 켜기·끄기·크기·권한
@CapacitorPlugin(name = "FloatPet", permissions = { @Permission(alias = "contacts", strings = { android.Manifest.permission.READ_CONTACTS }), @Permission(alias = "sms", strings = { android.Manifest.permission.SEND_SMS }), @Permission(alias = "audio", strings = { "android.permission.READ_MEDIA_AUDIO" }), @Permission(alias = "audioOld", strings = { android.Manifest.permission.READ_EXTERNAL_STORAGE }) })
public class FloatPetPlugin extends Plugin {
    static FloatPetPlugin inst;

    @Override
    public void load() { inst = this; }
    // 🌙 팻이 "끝"으로 사라질 때: 하루 예보 화면도 닫기
    static void finishApp() { try { if (inst != null && inst.getActivity() != null) inst.getActivity().runOnUiThread(() -> { try { inst.getActivity().finishAndRemoveTask(); } catch (Exception ignored) { } }); } catch (Exception ignored) { } }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(getContext())) { call.reject("no-permission"); return; }
        Intent i = new Intent(getContext(), FloatPetService.class);
        i.putExtra("size", call.getInt("size", 100));
        i.putExtra("name", call.getString("name", "다루"));
        if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i); else getContext().startService(i);
        call.resolve();
    }

    // 크기·이름·켜기 저장 (앱을 닫을 때 안드로이드가 이걸 보고 띄움)
    @PluginMethod
    public void config(PluginCall call) {
        getContext().getSharedPreferences("pet", 0).edit()
            .putInt("size", call.getInt("size", 100))
            .putString("name", call.getString("name", "다루"))
            .putBoolean("on", call.getBoolean("on", true))
            .putInt("act", call.getInt("act", 2))
            .putBoolean("cries", call.getBoolean("cries", true))
            .putFloat("vol", call.getFloat("vol", 0.5f))
            .putString("sp", call.getString("sp", "dog"))
            .putInt("micBeep", call.getInt("micBeep", 1))
            .putString("temper", call.getString("temper", "normal"))
            .putBoolean("kakao", call.getBoolean("kakao", true))
            .putInt("talkMin", call.getInt("talkMin", 20))
            .putString("uname", call.getString("uname", ""))
            .putString("idle", call.getString("idle", ""))
            .putString("walk", call.getString("walk", ""))
            .putString("up", call.getString("up", "")).putString("down", call.getString("down", ""))
            .putString("hello", call.getString("hello", ""))
            .putString("dance", call.getString("dance", ""))
            .putString("sports", call.getString("sports", "")).putString("hungryF", call.getString("hungryF", "")).putString("teach", call.getString("teach", "")).putInt("teachMin", call.getInt("teachMin", 1))
            .putString("run", call.getString("run", ""))
            .putString("home", call.getString("home", ""))
            .putString("sndC", call.getString("sndC", ""))
            .putString("sndH", call.getString("sndH", ""))
            .apply();
        FloatPetService.reload();
        call.resolve();
    }

    // 11-06: 🌙 끝내기 — 이번에는 팻을 띄우지 않고 앱을 닫음 (다시 열면 다시 나옴)
    @PluginMethod
    public void quit(PluginCall call) {
        getContext().getSharedPreferences("pet", 0).edit().putBoolean("on", false).commit();
        getContext().stopService(new Intent(getContext(), FloatPetService.class));
        call.resolve();
        if (getActivity() != null) getActivity().runOnUiThread(() -> getActivity().finishAndRemoveTask());
    }

    @PluginMethod
    public void micQuiet(PluginCall call) { FloatPetService.beepQuiet(getContext(), call.getInt("level", 1)); call.resolve(); }
    @PluginMethod
    public void micRestore(PluginCall call) { FloatPetService.beepRestore(getContext()); call.resolve(); }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), FloatPetService.class));
        call.resolve();
    }

    @PluginMethod
    public void setSize(PluginCall call) {
        FloatPetService.setSizeStatic(call.getInt("size", 100));
        call.resolve();
    }

    @PluginMethod
    public void diag(PluginCall call) {
        JSObject r = new JSObject();
        android.content.SharedPreferences sp = getContext().getSharedPreferences("pet", 0);
        r.put("canDraw", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(getContext()));
        r.put("on", sp.getBoolean("on", true));
        r.put("running", FloatPetService.me != null);
        r.put("shown", FloatPetService.wantShown);
        r.put("pet", FloatPetService.me != null && FloatPetService.me.pet != null && FloatPetService.me.pet.isAttachedToWindow());
        r.put("bar", FloatPetService.me != null && FloatPetService.me.bar != null && FloatPetService.me.bar.isAttachedToWindow());
        r.put("err", sp.getString("err", ""));
        r.put("crash", sp.getString("crash", ""));
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("model", Build.MANUFACTURER + " " + Build.MODEL);
        StringBuilder sb = new StringBuilder();
        try {
            Process p = Runtime.getRuntime().exec(new String[] { "logcat", "-d", "-t", "600" });
            java.io.BufferedReader br = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()));
            String line;
            while ((line = br.readLine()) != null) {
                if (line.contains("HaruPet") || line.contains("AndroidRuntime") || line.contains("FATAL") || line.contains("ForegroundService") || line.contains("kr.haruyebo")) sb.append(line).append('\n');
            }
        } catch (Exception e) { sb.append("log ").append(e); }
        String log = sb.toString();
        r.put("log", log.length() > 4000 ? log.substring(log.length() - 4000) : log);
        call.resolve(r);
    }

    static volatile String pending = null;
    // 💬 말로 바로 답장 (11-09)
    @PluginMethod
    public void autoReply(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ok", FloatPetService.autoReplyStatic(call.getString("id", ""), call.getInt("startMs", 6000), call.getInt("endMs", 3000), Boolean.TRUE.equals(call.getBoolean("ding", true))));
        call.resolve(r);
    }
    @PluginMethod
    public void autoReplyStop(PluginCall call) { FloatPetService.autoReplyStopStatic(); call.resolve(); }
    static void arEvent(String id, String kind, String text, float conf, float rms) {
        JSObject d = new JSObject(); d.put("id", id); d.put("kind", kind); d.put("text", text); d.put("conf", conf); d.put("rms", rms);
        if (inst != null) inst.notifyListeners("autoReply", d, true);
    }
    static void kakaoEvent(String who, String msg, String room) {
        JSObject d = new JSObject(); d.put("who", who); d.put("text", msg); d.put("room", room);
        if (inst != null) inst.notifyListeners("kakao", d, true);
    }
    @PluginMethod
    public void openKakao(PluginCall call) {
        try { if (HaruNotiListener.kakaoOpen != null) HaruNotiListener.kakaoOpen.send(); else { Intent i = getContext().getPackageManager().getLaunchIntentForPackage("com.kakao.talk"); if (i != null) { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); } } } catch (Exception ignored) { }
        call.resolve();
    }
    @PluginMethod
    public void usageAccess(PluginCall call) {   // 카톡 방을 나왔는지 알기 (사용 기록 접근)
        boolean ok = false;
        try {
            android.app.AppOpsManager ao = (android.app.AppOpsManager) getContext().getSystemService(android.content.Context.APP_OPS_SERVICE);
            int m = ao.checkOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), getContext().getPackageName());
            ok = m == android.app.AppOpsManager.MODE_ALLOWED;
        } catch (Exception ignored) { }
        JSObject r = new JSObject(); r.put("granted", ok); call.resolve(r);
    }
    @PluginMethod
    public void openUsageAccess(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i); call.resolve();
    }
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i); call.resolve();
    }
    // 📞 전화 (11-07 권한 줄임): 번호가 찍힌 전화 화면을 엶 — 초록 단추만 누르면 됨 (전화 걸기 권한 없음)
    @PluginMethod
    public void call(PluginCall call) {
        String num = call.getString("num", "").replaceAll("[^0-9+*#]", "");
        try {
            Intent i = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(num)));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            JSObject r = new JSObject(); r.put("direct", false); call.resolve(r);
        } catch (Exception e) { call.reject("call: " + e); }
    }
    // 📒 연락처 읽기 (11-07): 읽기 권한만. 이름·번호·주소·생일
    @PluginMethod
    public void readContacts(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) { requestPermissionForAlias("contacts", call, "contactsPermCb"); return; }
        doReadContacts(call);
    }
    @PermissionCallback
    private void contactsPermCb(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) { call.reject("denied"); return; }
        doReadContacts(call);
    }
    private void doReadContacts(PluginCall call) {
        new Thread(() -> {
            try {
                android.content.ContentResolver cr = getContext().getContentResolver();
                java.util.LinkedHashMap<String, JSObject> map = new java.util.LinkedHashMap<>();
                android.database.Cursor c = cr.query(android.provider.ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                        new String[] { android.provider.ContactsContract.CommonDataKinds.Phone.CONTACT_ID, android.provider.ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, android.provider.ContactsContract.CommonDataKinds.Phone.NUMBER }, null, null, null);
                if (c != null) {
                    while (c.moveToNext()) {
                        String id = c.getString(0), nm = c.getString(1), num = c.getString(2);
                        JSObject o = map.get(id);
                        if (o == null) { o = new JSObject(); o.put("name", nm == null ? "" : nm); o.put("phones", new com.getcapacitor.JSArray()); o.put("addr", ""); map.put(id, o); }
                        if (num != null) ((com.getcapacitor.JSArray) o.get("phones")).put(num);
                    }
                    c.close();
                }
                android.database.Cursor b = cr.query(android.provider.ContactsContract.Data.CONTENT_URI,
                        new String[] { android.provider.ContactsContract.Data.CONTACT_ID, android.provider.ContactsContract.CommonDataKinds.Event.START_DATE },
                        android.provider.ContactsContract.Data.MIMETYPE + "=? AND " + android.provider.ContactsContract.CommonDataKinds.Event.TYPE + "=?",
                        new String[] { android.provider.ContactsContract.CommonDataKinds.Event.CONTENT_ITEM_TYPE, String.valueOf(android.provider.ContactsContract.CommonDataKinds.Event.TYPE_BIRTHDAY) }, null);
                if (b != null) { while (b.moveToNext()) { JSObject o = map.get(b.getString(0)); if (o != null && b.getString(1) != null) o.put("bday", b.getString(1)); } b.close(); }
                android.database.Cursor ad = cr.query(android.provider.ContactsContract.CommonDataKinds.StructuredPostal.CONTENT_URI,
                        new String[] { android.provider.ContactsContract.CommonDataKinds.StructuredPostal.CONTACT_ID, android.provider.ContactsContract.CommonDataKinds.StructuredPostal.FORMATTED_ADDRESS }, null, null, null);
                if (ad != null) { while (ad.moveToNext()) { JSObject o = map.get(ad.getString(0)); if (o != null && ad.getString(1) != null) o.put("addr", ad.getString(1)); } ad.close(); }
                com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
                for (JSObject o : map.values()) arr.put(o);
                JSObject r = new JSObject(); r.put("contacts", arr); call.resolve(r);
            } catch (Exception e) { call.reject("read: " + e); }
        }).start();
    }
    // ⏰ 알람 (11-07)
    @PluginMethod
    public void setAlarms(PluginCall call) {
        HaruAlarmReceiver.cancelAll(getContext());
        com.getcapacitor.JSArray list = call.getArray("list");
        long now = System.currentTimeMillis(); int n = 0;
        try {
            for (int k = 0; list != null && k < list.length(); k++) {
                org.json.JSONObject a = list.getJSONObject(k);
                long at = a.optLong("at", 0); if (at <= now) continue;
                HaruAlarmReceiver.schedule(getContext(), a.optString("id"), at, a.optString("text", ""), a.optBoolean("daily", false)); n++;
            }
        } catch (Exception e) { }
        JSObject r = new JSObject(); r.put("count", n); r.put("exact", HaruAlarmReceiver.canExact(getContext())); call.resolve(r);
    }
    @PluginMethod
    public void alarmState(PluginCall call) {
        android.content.SharedPreferences sp = getContext().getSharedPreferences("pet", 0);
        JSObject r = new JSObject(); r.put("ringing", sp.getString("alarmRinging", ""));
        com.getcapacitor.JSArray d = new com.getcapacitor.JSArray(); for (String x : sp.getStringSet("alarmDone", new java.util.HashSet<>())) d.put(x); r.put("done", d);
        call.resolve(r);
    }
    @PluginMethod
    public void alarmClear(PluginCall call) { getContext().getSharedPreferences("pet", 0).edit().remove("alarmRinging").putStringSet("alarmDone", new java.util.HashSet<>()).apply(); call.resolve(); }
    @PluginMethod
    public void alarmStop(PluginCall call) {
        String id = call.getString("id", "");
        android.app.NotificationManager nm = (android.app.NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        if (!id.isEmpty()) nm.cancel(HaruAlarmReceiver.nid(id));
        getContext().getSharedPreferences("pet", 0).edit().remove("alarmRinging").apply();
        FloatPetService.alarmStopStatic(); call.resolve();
    }
    @PluginMethod
    public void openExact(PluginCall call) {
        try { Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName())); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); } catch (Exception e) { }
        call.resolve();
    }
    static void alarmEvent(String id, String text) {
        JSObject d = new JSObject(); d.put("id", id); d.put("text", text);
        if (inst != null) inst.notifyListeners("alarm", d, true);
    }
    // 🎵 노래 (11-07)
    String audioAlias() { return Build.VERSION.SDK_INT >= 33 ? "audio" : "audioOld"; }
    @PluginMethod
    public void musicList(PluginCall call) {
        if (getPermissionState(audioAlias()) != PermissionState.GRANTED) { requestPermissionForAlias(audioAlias(), call, "musicPermCb"); return; }
        doMusicList(call);
    }
    @PermissionCallback
    private void musicPermCb(PluginCall call) { if (getPermissionState(audioAlias()) != PermissionState.GRANTED) { call.reject("denied"); return; } doMusicList(call); }
    private void doMusicList(PluginCall call) { new Thread(() -> { JSObject r = new JSObject(); r.put("list", HaruMusic.list(getContext())); call.resolve(r); }).start(); }
    @PluginMethod
    public void musicPlay(PluginCall call) {
        try {
            com.getcapacitor.JSArray a = call.getArray("list"); int n = a.length();
            long[] ids = new long[n]; String[] t = new String[n], ar = new String[n];
            for (int k = 0; k < n; k++) { org.json.JSONObject o = a.getJSONObject(k); ids[k] = o.optLong("id"); t[k] = o.optString("t"); ar[k] = o.optString("a"); }
            HaruMusic.play(getContext(), ids, t, ar, call.getInt("start", 0));
            call.resolve();
        } catch (Exception e) { call.reject("play: " + e); }
    }
    @PluginMethod
    public void musicCtl(PluginCall call) { JSObject r = new JSObject(); r.put("how", HaruMusic.control(getContext(), call.getString("cmd", "pause"))); call.resolve(r); }
    @PluginMethod
    public void musicApp(PluginCall call) { JSObject r = new JSObject(); r.put("ok", HaruMusic.openApp(getContext(), call.getString("pkg", ""), call.getString("q", ""))); call.resolve(r); }
    @PluginMethod
    public void musicNow(PluginCall call) { try { call.resolve(JSObject.fromJSONObject(HaruMusic.now(getContext()))); } catch (Exception e) { call.resolve(new JSObject()); } }
    @PluginMethod
    public void musicApps(PluginCall call) {   // 휴대폰에 깔린 음악 앱
        String[][] apps = { { "com.sec.android.app.music", "삼성 뮤직" }, { "com.iloen.melon", "멜론" }, { "com.ktmusic.geniemusic", "지니" }, { "com.google.android.apps.youtube.music", "유튜브 뮤직" }, { "com.spotify.music", "스포티파이" }, { "skplanet.musicmate", "FLO" }, { "com.naver.vibe", "바이브" }, { "com.google.android.youtube", "유튜브" } };
        com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
        for (String[] a : apps) { if (getContext().getPackageManager().getLaunchIntentForPackage(a[0]) != null) { JSObject o = new JSObject(); o.put("pkg", a[0]); o.put("name", a[1]); arr.put(o); } }
        JSObject r = new JSObject(); r.put("apps", arr); call.resolve(r);
    }
    static void musicEvent(String title, String artist, boolean playing, long id) {
        JSObject d = new JSObject(); d.put("id", id); d.put("title", title); d.put("artist", artist); d.put("playing", playing);
        if (inst != null) inst.notifyListeners("music", d, true);
    }
    // 📺 TV방 (11-07): 유튜브 채널·재생목록 주소 → 채널 번호·이름 / 다른 앱 열기
    @PluginMethod
    public void ytResolve(PluginCall call) {
        String url = call.getString("url", "");
        new Thread(() -> {
            try {
                java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36");
                c.setRequestProperty("Accept-Language", "ko-KR,ko;q=0.9");
                c.setConnectTimeout(10000); c.setReadTimeout(15000);
                java.io.BufferedReader br = new java.io.BufferedReader(new java.io.InputStreamReader(c.getInputStream(), "UTF-8"));
                StringBuilder sb = new StringBuilder(); String line; int n = 0;
                while ((line = br.readLine()) != null && n < 3000000) { sb.append(line).append('\n'); n += line.length(); }
                br.close();
                String h = sb.toString();
                JSObject r = new JSObject();
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"(?:channelId|externalId|browseId)\":\"(UC[0-9A-Za-z_-]{22})\"").matcher(h);
                if (m.find()) r.put("channelId", m.group(1));
                java.util.regex.Matcher t = java.util.regex.Pattern.compile("<meta property=\"og:title\" content=\"([^\"]*)\"").matcher(h);
                if (t.find()) r.put("title", android.text.Html.fromHtml(t.group(1), 0).toString());
                java.util.regex.Matcher im = java.util.regex.Pattern.compile("<meta property=\"og:image\" content=\"([^\"]*)\"").matcher(h);
                if (im.find()) r.put("image", im.group(1));
                java.util.regex.Matcher wv = java.util.regex.Pattern.compile("<link rel=\"canonical\" href=\"https://www.youtube.com/watch\\?v=([0-9A-Za-z_-]{11})\"").matcher(h);
                if (wv.find()) r.put("watch", wv.group(1));   // /live 주소면 지금 생방송 영상
                call.resolve(r);
            } catch (Exception e) { call.reject("resolve: " + e); }
        }).start();
    }
    @PluginMethod
    public void front(PluginCall call) { FloatPetService.frontStatic(getContext()); call.resolve(); }
    // 채널(또는 재생목록)의 최근 영상 번호들 — 쇼츠 말고 일반 영상
    @PluginMethod
    public void ytVideos(PluginCall call) {
        String url = call.getString("url", "");
        new Thread(() -> {
            try {
                java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                c.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36");
                c.setRequestProperty("Accept-Language", "ko-KR,ko;q=0.9");
                c.setConnectTimeout(10000); c.setReadTimeout(15000);
                java.io.InputStream in = c.getInputStream(); java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[16384]; int k; while ((k = in.read(buf)) > 0 && bo.size() < 4000000) bo.write(buf, 0, k); in.close();
                String h = bo.toString("UTF-8");
                java.util.LinkedHashSet<String> ids = new java.util.LinkedHashSet<>();
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"videoId\":\"([0-9A-Za-z_-]{11})\"").matcher(h);   // /videos 탭에는 쇼츠가 없음
                while (m.find() && ids.size() < 40) ids.add(m.group(1));
                com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray(); for (String v : ids) arr.put(v);
                JSObject r = new JSObject(); r.put("ids", arr); call.resolve(r);
            } catch (Exception e) { call.reject("videos: " + e); }
        }).start();
    }
    @PluginMethod
    public void ytSearch(PluginCall call) {
        String qy = call.getString("q", ""), sp = call.getString("sp", "");
        new Thread(() -> {
            try {
                String url = "https://www.youtube.com/results?search_query=" + java.net.URLEncoder.encode(qy, "UTF-8") + (sp.isEmpty() ? "" : "&sp=" + sp) + "&hl=ko&gl=KR";
                java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                c.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36");
                c.setRequestProperty("Accept-Language", "ko-KR,ko;q=0.9");
                c.setConnectTimeout(10000); c.setReadTimeout(15000);
                java.io.InputStream in = c.getInputStream(); java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[16384]; int k; while ((k = in.read(buf)) > 0 && bo.size() < 5000000) bo.write(buf, 0, k); in.close();
                String h = bo.toString("UTF-8");
                int a = h.indexOf("var ytInitialData = "); String d = "";
                if (a >= 0) { a += 20; int b = h.indexOf(";</script>", a); if (b > a) d = h.substring(a, b); }
                JSObject r = new JSObject(); r.put("data", d); call.resolve(r);
            } catch (Exception e) { call.reject("search: " + e); }
        }).start();
    }
    @PluginMethod
    public void openApp(PluginCall call) {
        String pkg = call.getString("pkg", ""), url = call.getString("url", "");
        boolean ok = false;
        try {
            if (!url.isEmpty()) { Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url)); if (!pkg.isEmpty()) i.setPackage(pkg); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); if (i.resolveActivity(getContext().getPackageManager()) != null) { getContext().startActivity(i); ok = true; } }
            if (!ok && !pkg.isEmpty()) { Intent l = getContext().getPackageManager().getLaunchIntentForPackage(pkg); if (l != null) { l.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(l); ok = true; } }
            if (!ok && !url.isEmpty()) { Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url)); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); ok = true; }
        } catch (Exception e) { }
        JSObject r = new JSObject(); r.put("ok", ok); call.resolve(r);
    }
    @PluginMethod
    public void notiAccess(PluginCall call) {
        String en = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        JSObject r = new JSObject(); r.put("granted", en != null && en.contains(getContext().getPackageName())); call.resolve(r);
    }
    @PluginMethod
    public void openNotiAccess(PluginCall call) {
        Intent i = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i); call.resolve();
    }
    static void overlayText(String text) {
        JSObject d = new JSObject();
        d.put("text", text);
        if (inst != null) inst.notifyListeners("overlayText", d, true);
    }
    @PluginMethod
    public void say(PluginCall call) {
        String tel = call.getString("tel", "");
        String op = call.getString("open", "");
        if (op != null && !op.isEmpty()) { FloatPetService.sayOpenStatic(call.getString("text", ""), op, call.getInt("ms", 20000)); call.resolve(); return; }   // 💬 누르면 하루 예보의 그 화면(대화방·전화)
        if (tel != null && !tel.isEmpty()) FloatPetService.sayTelStatic(call.getString("text", ""), tel, call.getInt("ms", 20000));   // 📞 누르면 전화 화면
        else FloatPetService.sayStatic(call.getString("text", ""), call.getInt("ms", 6000));
        call.resolve();
    }
    @PluginMethod
    public void bark(PluginCall call) { FloatPetService.barkStatic(call.getBoolean("happy", false), call.getFloat("vol", 0.6f)); call.resolve(); }
    @PluginMethod
    public void frames(PluginCall call) {
        try {
            com.getcapacitor.JSArray a = call.getArray("files");
            String[] f = new String[a.length()]; for (int i = 0; i < a.length(); i++) f[i] = a.getString(i);
            FloatPetService.poseOnce = call.getBoolean("once", false); FloatPetService.framesStatic(f, call.getInt("fps", 8), call.getInt("ms", 5000));
        } catch (Exception e) { }
        call.resolve();
    }
    @PluginMethod
    public void pose(PluginCall call) { FloatPetService.poseStatic(call.getString("file", null), call.getString("action", ""), call.getInt("ms", 4000)); call.resolve(); }
    @PluginMethod
    public void ack(PluginCall call) { FloatPetService.ack = true; call.resolve(); }
    @PluginMethod
    public void takePending(PluginCall call) {
        JSObject r = new JSObject();
        r.put("text", pending == null ? "" : pending);
        pending = null;
        call.resolve(r);
    }

    static void tapped(String what) {
        JSObject d = new JSObject();
        d.put("what", what);
        if (inst != null) inst.notifyListeners("petTap", d, true);
    }
    // 📖 휴대폰 목소리로 읽기 (11-07)
    void fire(String name, JSObject d) { notifyListeners(name, d, true); }
    @PluginMethod
    public void ttsSpeak(PluginCall call) { if (call.getDouble("rate") != null) HaruTts.rate = call.getDouble("rate").floatValue(); HaruTts.lang = call.getString("lang", "ko"); JSObject r = new JSObject(); r.put("st", HaruTts.speak(getContext(), call.getString("text", ""), call.getString("id", "x"))); call.resolve(r); }
    @PluginMethod
    public void ttsStop(PluginCall call) { HaruTts.stop(); call.resolve(); }
    @PluginMethod
    public void ttsState(PluginCall call) { JSObject r = new JSObject(); r.put("st", HaruTts.state(getContext())); call.resolve(r); }
    @PluginMethod
    public void ttsInstall(PluginCall call) { HaruTts.installVoice(getContext()); call.resolve(); }
    // 💌 가족 안부 문자 (11-07)
    @PluginMethod
    public void smsConfig(PluginCall call) {
        HaruSms.config(getContext(), call.getString("nums", ""), call.getString("text", ""), Boolean.TRUE.equals(call.getBoolean("on", false)));
        if (Boolean.TRUE.equals(call.getBoolean("on", false)) && getPermissionState("sms") != PermissionState.GRANTED) { requestPermissionForAlias("sms", call, "smsPermCb"); return; }
        smsReply(call);
    }
    @PermissionCallback
    private void smsPermCb(PluginCall call) { smsReply(call); }
    private void smsReply(PluginCall call) { JSObject r = new JSObject(); r.put("granted", HaruSms.can(getContext())); r.put("day", HaruSms.lastDay(getContext())); call.resolve(r); }
    @PluginMethod
    public void smsDaily(PluginCall call) { JSObject r = new JSObject(); r.put("sent", HaruSms.daily(getContext())); r.put("day", HaruSms.lastDay(getContext())); call.resolve(r); }
    // ✉️💬 11-08: 말로 문자·카톡 — compose = 화면 위 팻이 받아 적기 · msgSend = 바로 보내기(앱 안에서)
    @PluginMethod
    public void compose(PluginCall call) {
        if ("sms".equals(call.getString("kind", "")) && getPermissionState("sms") != PermissionState.GRANTED && getActivity() != null && !getActivity().isFinishing() && hasWindowFocusSafe()) { requestPermissionForAlias("sms", call, "composePermCb"); return; }
        composeGo(call);
    }
    private boolean hasWindowFocusSafe() { try { return getActivity().hasWindowFocus(); } catch (Exception e) { return false; } }
    @PermissionCallback
    private void composePermCb(PluginCall call) { composeGo(call); }
    private void composeGo(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ok", FloatPetService.composeStatic(call.getString("kind", "sms"), call.getString("who", ""), call.getString("num", ""), call.getString("text", "")));
        call.resolve(r);
    }
    @PluginMethod
    public void msgSend(PluginCall call) {
        if ("sms".equals(call.getString("kind", "")) && getPermissionState("sms") != PermissionState.GRANTED) { requestPermissionForAlias("sms", call, "msgPermCb"); return; }
        msgGo(call);
    }
    @PermissionCallback
    private void msgPermCb(PluginCall call) { msgGo(call); }
    private void msgGo(PluginCall call) {
        JSObject r = new JSObject();
        String kind = call.getString("kind", "sms"), text = call.getString("text", "");
        r.put("how", "sms".equals(kind) ? HaruSend.sms(getContext(), call.getString("num", ""), text) : HaruSend.kakao(getContext(), call.getString("who", ""), text));
        call.resolve(r);
    }
    // 📞 통화 (11-09): 스피커로 듣기 켜기·끄기 · 통화 모드
    @PluginMethod
    public void speaker(PluginCall call) {
        try {
            android.media.AudioManager am = (android.media.AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
            boolean inCall = Boolean.TRUE.equals(call.getBoolean("call", true));
            am.setMode(inCall ? android.media.AudioManager.MODE_IN_COMMUNICATION : android.media.AudioManager.MODE_NORMAL);
            am.setSpeakerphoneOn(inCall && Boolean.TRUE.equals(call.getBoolean("on", false)));
        } catch (Exception ignored) { }
        call.resolve();
    }
    @PluginMethod
    public void smsSend(PluginCall call) { JSObject r = new JSObject(); r.put("ok", HaruSms.send(getContext(), call.getString("num", ""), call.getString("text", ""))); call.resolve(r); }
    // 🎾 공 던지기 게임 (11-07): 하루 예보가 앞에 있으면 뒤로 보내고 화면 위 팻과 놀기
    @PluginMethod
    public void ballGame(PluginCall call) {
        boolean start = Boolean.TRUE.equals(call.getBoolean("on", true));
        JSObject r = new JSObject();
        if (start && Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(getContext())) { r.put("ok", false); r.put("why", "perm"); call.resolve(r); return; }
        if (start && getActivity() != null) { try { getActivity().moveTaskToBack(true); } catch (Exception ignored) { } }
        if (start && FloatPetService.me == null) FloatPetService.maybeStart(getContext());
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> FloatPetService.ballStatic(start), start ? 900 : 0);
        r.put("ok", true); call.resolve(r);
    }
    // 🧾 영수증 글자 읽기 (11-08): 휴대폰 안에서 ML Kit 한국어 글자 인식 — 사진은 저장하지 않음
    @PluginMethod
    public void ocr(PluginCall call) {
        final String b64 = call.getString("data", "");
        new Thread(() -> {
            try {
                String d = b64; int c = d.indexOf(','); if (c >= 0) d = d.substring(c + 1);
                byte[] bytes = android.util.Base64.decode(d, android.util.Base64.DEFAULT);
                android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (bmp == null) { call.reject("ocr: no image"); return; }
                com.google.mlkit.vision.common.InputImage img = com.google.mlkit.vision.common.InputImage.fromBitmap(bmp, 0);
                com.google.mlkit.vision.text.TextRecognizer rec = com.google.mlkit.vision.text.TextRecognition.getClient(new com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions.Builder().build());
                com.google.mlkit.vision.text.Text t = com.google.android.gms.tasks.Tasks.await(rec.process(img));
                rec.close(); bmp.recycle();
                JSObject r = new JSObject(); r.put("text", t.getText()); call.resolve(r);
            } catch (Exception e) { call.reject("ocr: " + e); }
        }).start();
    }
    // 🗺️ 걷기 지도 동안 화면이 꺼지지 않게 (11-08)
    @PluginMethod
    public void keepScreen(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        if (getActivity() != null) getActivity().runOnUiThread(() -> { if (on) getActivity().getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); else getActivity().getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); });
        call.resolve();
    }
}

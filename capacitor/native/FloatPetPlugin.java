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

// 다른 앱 위에 떠 있는 팻 (하루 예보) — 켜기·끄기·크기·권한
@CapacitorPlugin(name = "FloatPet")
public class FloatPetPlugin extends Plugin {
    static FloatPetPlugin inst;

    @Override
    public void load() { inst = this; }

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
            .putString("idle", call.getString("idle", ""))
            .putString("walk", call.getString("walk", ""))
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
    static void overlayText(String text) {
        JSObject d = new JSObject();
        d.put("text", text);
        if (inst != null) inst.notifyListeners("overlayText", d, true);
    }
    @PluginMethod
    public void say(PluginCall call) {
        FloatPetService.sayStatic(call.getString("text", ""), call.getInt("ms", 6000));
        call.resolve();
    }
    @PluginMethod
    public void bark(PluginCall call) { FloatPetService.barkStatic(call.getBoolean("happy", false), call.getFloat("vol", 0.6f)); call.resolve(); }
    @PluginMethod
    public void frames(PluginCall call) {
        try {
            com.getcapacitor.JSArray a = call.getArray("files");
            String[] f = new String[a.length()]; for (int i = 0; i < a.length(); i++) f[i] = a.getString(i);
            FloatPetService.framesStatic(f, call.getInt("fps", 8), call.getInt("ms", 5000));
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
}

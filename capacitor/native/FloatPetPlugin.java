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
            .apply();
        FloatPetService.reload();
        call.resolve();
    }

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

    static void tapped(String what) {
        JSObject d = new JSObject();
        d.put("what", what);
        if (inst != null) inst.notifyListeners("petTap", d, true);
    }
}

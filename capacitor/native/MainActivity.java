package kr.haruyebo.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FloatPetPlugin.class);   // 화면 위 팻
        super.onCreate(savedInstanceState);
    }

    // 뒤로 가기 = 앱을 끄지 않고 뒤로 보내기 (바탕화면에서 팻이 계속 대답하려고)
    @Override
    public void onBackPressed() {
        // 11-08: 앱 안에서 다른 화면을 보고 있으면 → 바로 전 화면으로 (팻방 첫 화면이면 뒤로 보내기)
        try {
            android.webkit.WebView w = getBridge().getWebView();
            if (w != null) {
                w.evaluateJavascript("(window.haruBack && window.haruBack()) ? '1' : '0'", v -> { if (v == null || !v.contains("1")) moveTaskToBack(true); });
                return;
            }
        } catch (Exception ignored) { }
        moveTaskToBack(true);
    }

    // 앱이 보이면 → 화면 위 팻은 숨기고(서비스는 그대로), 서비스는 앱이 앞에 있을 때 켜 둠
    @Override
    public void onResume() {
        super.onResume();
        FloatPetService.setShown(false);
        FloatPetService.maybeStart(this);
    }

    // 앱을 닫거나 바탕화면으로 가면 → 화면 위에 팻과 말창 다시 보이기
    @Override
    public void onStop() {
        super.onStop();
        android.util.Log.i("HaruPet", "activity stop, service=" + (FloatPetService.me != null));
        FloatPetService.setShown(true);
        if (FloatPetService.me == null) FloatPetService.maybeStart(this);
    }
}

package kr.haruyebo.app;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FloatPetPlugin.class);   // 화면 위 팻
        super.onCreate(savedInstanceState);
        try { getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false); } catch (Exception ignored) { }   // 📞 통화 소리 바로 나오게
        // 11-08: 휴대폰 뒤로 가기 = 앱 안에서 바로 전 화면으로 (첫 화면이면 앱을 뒤로 보내기)
        //  새 안드로이드(뒤로 가기 몸짓)에서도 꼭 여기로 오도록 등록
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() { goBack(); }
        });
    }

    void goBack() {
        try {
            android.webkit.WebView w = getBridge().getWebView();
            if (w != null) {
                w.evaluateJavascript("(function(){try{return (window.haruBack && window.haruBack()) ? '1' : '0'}catch(e){return 'e'}})()", v -> {
                    if (v != null && v.contains("1")) return;
                    moveTaskToBack(true);
                });
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

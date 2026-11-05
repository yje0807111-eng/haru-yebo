package kr.haruyebo.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FloatPetPlugin.class);   // 화면 위 팻
        super.onCreate(savedInstanceState);
    }

    // 앱을 열면 → 화면 위 팻은 거두고 앱 안에서
    @Override
    public void onResume() {
        super.onResume();
        try { stopService(new Intent(this, FloatPetService.class)); } catch (Exception ignored) { }
    }

    // 앱을 닫거나 바탕화면으로 가면 → 화면 위에 팻과 말창
    @Override
    public void onStop() {
        super.onStop();
        FloatPetService.maybeStart(this);
    }
}

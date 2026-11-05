package kr.haruyebo.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FloatPetPlugin.class);   // 화면 위 팻
        super.onCreate(savedInstanceState);
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
        FloatPetService.setShown(true);
        if (FloatPetService.me == null) FloatPetService.maybeStart(this);
    }
}

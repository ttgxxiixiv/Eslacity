package io.github.ttgxxiixiv.eslacity;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Свой плагин обновления (ApkUpdatePlugin) регистрируется до запуска моста.
        registerPlugin(ApkUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        hideSystemBars();
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // После шторки уведомлений, диалога разрешений или клавиатуры панели могли вернуться.
        if (hasFocus) hideSystemBars();
    }

    /**
     * Игра на весь экран: строка состояния и полоса навигации спрятаны, свайп от края показывает их на время.
     * Вырез камеры остаётся: отступ от него страница берёт из env(safe-area-inset-top) (src/index.css).
     */
    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}

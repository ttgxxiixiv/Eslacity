package io.github.ttgxxiixiv.eslacity;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Свой плагин обновления (ApkUpdatePlugin) регистрируется до запуска моста.
        registerPlugin(ApkUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

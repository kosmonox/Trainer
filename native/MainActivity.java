package com.apneatrainer.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaHapticsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

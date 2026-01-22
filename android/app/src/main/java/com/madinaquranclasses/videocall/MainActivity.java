package com.madinaquranclasses.videocall;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AgoraScreensharePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
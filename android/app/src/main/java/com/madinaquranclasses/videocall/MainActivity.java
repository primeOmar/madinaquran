package com.madinaquranclasses.videocall;

import com.getcapacitor.BridgeActivity;
import com.madinaquran.agorascreenshare.AgoraScreenSharePluginPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register plugins
        registerPlugin(AgoraScreenSharePluginPlugin.class);
    }
}